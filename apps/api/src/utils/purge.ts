import { prisma } from "../config/db";
import { AUDIT_RETENTION_DAYS, THROTTLE_RETENTION_MS } from "../config/customer-auth";

/**
 * Nettoyage des données d'authentification périmées. Il ne touche QUE les tables d'authentification (sessions expirées,
 * compteurs de limitation inactifs) : jamais les clients, commandes, produits… Appelé de façon opportuniste à chaque connexion
 * ou inscription (petit lot, rapide) ; la tâche planifiée quotidienne (phase 3) fait le reste.
 */
export async function purgeExpiredAuthData(options: { limit?: number; now?: Date } = {}): Promise<{ sessions: number; throttles: number }> {
  const limit = options.limit ?? 100;
  const now = options.now ?? new Date();

  const expired = await prisma.customerSession.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit });
  const sessions = expired.length ? (await prisma.customerSession.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } })).count : 0;

  const stale = await prisma.authThrottle.findMany({
    where: { updatedAt: { lte: new Date(now.getTime() - THROTTLE_RETENTION_MS) }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    select: { id: true },
    take: limit,
  });
  const throttles = stale.length ? (await prisma.authThrottle.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } })).count : 0;

  return { sessions, throttles };
}

/** Supprime les entrées du journal d'audit plus anciennes que la durée de conservation. */
export async function purgeOldAuditLogs(now: Date = new Date(), retentionDays: number = AUDIT_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 3600 * 1000);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lte: cutoff } } });
  return count;
}

/** Nettoyage complet (tâche planifiée) : boucle par lots jusqu'à épuisement (borné), puis journal d'audit périmé. */
export async function purgeAll(now: Date = new Date()): Promise<{ sessions: number; throttles: number; auditLogs: number }> {
  let sessions = 0;
  let throttles = 0;
  for (let i = 0; i < 50; i += 1) {
    const batch = await purgeExpiredAuthData({ limit: 500, now });
    sessions += batch.sessions;
    throttles += batch.throttles;
    if (batch.sessions === 0 && batch.throttles === 0) break;
  }
  return { sessions, throttles, auditLogs: await purgeOldAuditLogs(now) };
}

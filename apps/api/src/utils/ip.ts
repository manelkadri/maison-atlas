import type { Request } from "express";

/** IP du client telle que vue par Express (`trust proxy = 1` : dernier saut du proxy). */
export const clientIp = (req: Pick<Request, "ip">): string => req.ip ?? "unknown";

/** Développe une adresse IPv6 en 8 groupes (gère « :: »). Renvoie null si elle n'est pas analysable. */
function ipv6Groups(ip: string): string[] | null {
  const clean = ip.split("%")[0] ?? ip; // sans identifiant de zone
  if (clean.includes(".")) return null; // IPv4 incorporée : non gérée ici
  const halves = clean.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array<string>(missing).fill("0"), ...tail];
  return groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g)) ? groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")) : null;
}

/**
 * Masque une adresse IP avant de l'enregistrer dans le journal d'audit : IPv4 en /24 (« 203.0.113.0/24 »), IPv6 en /48
 * (« 2001:db8:abcd::/48 »). Renvoie null si l'adresse n'est pas analysable (on n'enregistre alors rien plutôt qu'une valeur douteuse).
 */
export function maskIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  const raw = mapped?.[1] ?? ip;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(raw);
  if (v4) {
    const octets = v4.slice(1, 5).map(Number);
    return octets.every((o) => o <= 255) ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24` : null;
  }
  if (raw.includes(":")) {
    const groups = ipv6Groups(raw);
    return groups ? `${groups[0]}:${groups[1]}:${groups[2]}::/48` : null;
  }
  return null;
}

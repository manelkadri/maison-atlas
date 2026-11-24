-- Comptes clientes (téléphone + mot de passe) : migration ADDITIVE.
--
-- Ce que fait cette migration (rien n'est supprimé ni réécrit) :
--   1. Customer : 3 colonnes AJOUTÉES (passwordHash, mustChangePassword, passwordChangedAt), toutes sans effet sur les lignes
--      existantes (NULL / false / NULL).
--   2. 3 nouvelles tables : CustomerSession (sessions, empreinte SHA-256 du jeton), AuthThrottle (compteurs de limitation),
--      AuditLog (journal d'audit) + le type AuditActorType.
--   3. Contraintes d'intégrité (voir prisma/sql/constraints.sql) : format de Customer.phoneKey, hachage bcrypt obligatoire
--      pour passwordHash (un mot de passe en clair serait refusé par la base), durée de session valide, compteur positif.
--   4. Verrouillage d'accès public des 3 nouvelles tables (RLS + retrait des droits anon/authenticated), car la migration
--      « lockdown_public_access » ne s'applique qu'aux tables qui existaient à ce moment-là.
--
-- Annulation : prisma/rollbacks/20261124163134_customer_accounts.down.sql (manuelle, après sauvegarde : elle supprime les
-- comptes, sessions et journaux créés depuis, et ne les restaure pas).

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('admin', 'customer', 'system');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipMasked" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthThrottle_updatedAt_idx" ON "AuthThrottle"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthThrottle_scope_keyHash_key" ON "AuthThrottle"("scope", "keyHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Garde-fou : le format de phoneKey est vérifié AVANT d'ajouter la contrainte =====
-- Si des clients existants avaient un phoneKey non normalisé, on s'arrête avec un message clair (la migration est annulée en
-- bloc : aucune donnée n'est modifiée).
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad FROM "Customer" WHERE "phoneKey" !~ '^0[5-7][0-9]{8}$';
  IF bad > 0 THEN
    RAISE EXCEPTION 'Migration interrompue : % client(s) ont un phoneKey non normalise (attendu : 0[5-7] + 8 chiffres). Corrigez-les puis relancez ; rien n''a ete modifie.', bad;
  END IF;
END
$$;

-- ===== Contraintes d'integrite (prisma/sql/constraints.sql) =====
-- Le telephone normalise (cle d'unicite d'un client) a toujours le format national algerien, meme si une requete contourne l'API.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_phoneKey_format" CHECK ("phoneKey" ~ '^0[5-7][0-9]{8}$');
-- Un mot de passe n'est jamais stocke en clair : la base n'accepte qu'un hachage bcrypt (cout 04 a 31).
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_passwordHash_bcrypt"
  CHECK ("passwordHash" IS NULL OR "passwordHash" ~ '^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$');
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_expiry_valid" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "AuthThrottle" ADD CONSTRAINT "AuthThrottle_count_non_negative" CHECK ("count" >= 0);

-- ===== Verrouillage d'acces public des nouvelles tables =====
-- RLS activee sans aucune politique : refus pour les roles anon/authenticated (cle publique Supabase). Le serveur API se
-- connecte avec le role proprietaire, qui contourne la RLS. Sur un PostgreSQL ordinaire ces roles n'existent pas.
ALTER TABLE "CustomerSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthThrottle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "CustomerSession", "AuthThrottle", "AuditLog" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "CustomerSession", "AuthThrottle", "AuditLog" FROM authenticated;
  END IF;
END
$$;

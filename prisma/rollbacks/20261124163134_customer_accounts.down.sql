-- ANNULATION MANUELLE de la migration 20261124163134_customer_accounts.
--
-- NE JAMAIS l'exécuter sans sauvegarde de la base. Ce n'est PAS un retour automatique : Prisma n'exécute jamais ce fichier.
-- Il SUPPRIME, de façon définitive, tout ce que la migration a créé et ce qui s'y est ajouté depuis :
--   - les mots de passe des comptes clientes (colonnes passwordHash, mustChangePassword, passwordChangedAt),
--   - toutes les sessions clientes, les compteurs de limitation et le journal d'audit.
-- Il ne restaure aucune donnée. Les clients, commandes et le reste de la base ne sont pas touchés.
--
-- À exécuter avec la connexion directe (Session pooler, port 5432), en une seule transaction.
-- Si le code déployé utilise déjà ces colonnes/tables, redéployer d'abord la version précédente de l'API.

BEGIN;

DROP TABLE "AuditLog";
DROP TABLE "AuthThrottle";
DROP TABLE "CustomerSession";
DROP TYPE "AuditActorType";

ALTER TABLE "Customer" DROP CONSTRAINT "Customer_phoneKey_format";
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_passwordHash_bcrypt";
ALTER TABLE "Customer"
  DROP COLUMN "passwordChangedAt",
  DROP COLUMN "mustChangePassword",
  DROP COLUMN "passwordHash";

-- Permet de réappliquer la migration plus tard (efface seulement sa ligne dans l'historique de Prisma).
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261124163134_customer_accounts';

COMMIT;

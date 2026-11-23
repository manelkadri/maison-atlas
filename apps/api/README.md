# apps/api — API REST (Express + Prisma + PostgreSQL)

Serveur de la plateforme (phase 2). Contrat complet des routes : [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md).

## Démarrage en développement

Aucune installation de PostgreSQL n'est nécessaire : un vrai PostgreSQL 17 est embarqué pour le développement.

```bash
pnpm install
cp ../../.env.example .env           # puis ajuster (voir ci-dessous)

# Terminal 1 — base de données (port 5433, données dans apps/api/.pgdata) ; laisser ouvert
pnpm --filter @fashion/api dev:db

# Terminal 2 — schéma, compte propriétaire, données de démonstration (une seule fois)
pnpm --filter @fashion/api db:deploy
ADMIN_PASSWORD="un-mot-de-passe-de-12-caracteres-minimum" pnpm --filter @fashion/api db:seed
pnpm --filter @fashion/api db:seed:demo        # facultatif : catalogue, commandes, stocks fictifs

# Terminal 2 — API sur http://localhost:4000
pnpm --filter @fashion/api dev
```

Puis le site, relié à l'API :

```bash
# apps/web/.env.local
NEXT_PUBLIC_DATA_SOURCE=api
API_INTERNAL_URL=http://localhost:4000
pnpm dev        # http://localhost:3000 ; l'admin est sur /admin (e-mail ADMIN_EMAIL + le mot de passe du seed)
```

> Windows : PostgreSQL refuse de tourner sous un compte administrateur ; le démarreur passe par `pg_ctl`, qui relance
> le serveur avec un jeton restreint. Si le terminal est fermé brutalement, la base s'arrête : relancer `dev:db`.

## Variables d'environnement

Voir [`.env.example`](../../.env.example). En **production** :
`NODE_ENV=production`, `DATABASE_URL` vers un PostgreSQL géré, `JWT_SECRET` aléatoire de ≥ 32 caractères (le serveur refuse de démarrer sinon),
`WEB_ORIGIN` = l'adresse publique du site, `UPLOAD_DRIVER=cloudinary` + `CLOUDINARY_*`.

## Base de données

- Schéma : [`prisma/schema.prisma`](../../prisma/schema.prisma) ; migrations dans `prisma/migrations/` (la migration initiale inclut
  [`prisma/sql/constraints.sql`](../../prisma/sql/constraints.sql) : stock ≥ 0, total de commande cohérent, paiement COD uniquement, etc.
  La base refuse ces états même si le code a un bug).
- Développement : `pnpm db:migrate` (crée une migration) ; production : `pnpm db:deploy`. Ne jamais utiliser `db push` ni `migrate reset` sur une base qui contient des données.

## Structure

```
src/
├── app.ts            Express (helmet, cookies, CSRF par Origin, routes publiques / admin)
├── server.ts         démarrage + arrêt propre
├── config/           env (validé par Zod), client Prisma
├── middlewares/      auth (session admin), security (limiteurs, Origin), error-handler
├── modules/          auth, products, categories, orders, inventory, customers, promotions, settings, analytics, uploads, newsletter
└── utils/            erreurs, jwt, validation, mot de passe, téléphone, numéro de commande
prisma/seed.ts        compte propriétaire + paramètres (sans danger en production)
prisma/seed-demo.ts   données fictives de démonstration (refuse NODE_ENV=production)
tests/                Vitest + supertest, sur une base PostgreSQL jetable créée à chaque exécution
```

## Tests

```bash
pnpm --filter @fashion/api test      # ~2 min ; démarre sa propre base jetable (port libre), aucune configuration
```

Ils couvrent notamment la concurrence (15 commandes simultanées sur 5 pièces : exactement 5 réussissent), la restitution unique du stock,
les contraintes de la base, la sécurité des sessions et des envois de fichiers.

## Sécurité (résumé)

Session admin : JWT dans un cookie `httpOnly` + `SameSite=Lax` (`Secure` en production) ; mot de passe bcrypt (coût 12) ; message d'échec unique ;
limiteurs de débit (connexion, commande, newsletter, codes promo, suivi) ; contrôle `Origin` sur les requêtes modifiantes ; envois d'images vérifiés
par signature binaire ; prix d'achat jamais exposé aux routes publiques ; suivi de commande par numéro **et** téléphone ; erreurs 500 sans détail.

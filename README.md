# Maison Atlas — Plateforme e-commerce de vêtements

Boutique en ligne + dashboard propriétaire dans un même site, pour une boutique de vêtements algérienne
(un seul magasin, un seul administrateur, paiement à la livraison, prix en DZD).

> **État : phase 1 (frontend) et phase 2 (backend) réalisées.** Le site fonctionne dans deux modes :
> - **`mock`** (défaut) : données fictives enregistrées dans le navigateur, sans serveur.
> - **`api`** : le site parle à un vrai serveur Express + PostgreSQL ([`apps/api`](apps/api/README.md)) : une commande passée sur un appareil
>   apparaît dans l'administration de n'importe quel autre. Voir « Passer en mode API » plus bas.
>
> Reste à faire avant la mise en ligne : hébergement (base PostgreSQL gérée, serveur API, site), compte Cloudinary, vérification du client par SMS/e-mail (OTP).

## Démarrage rapide

Prérequis : **Node.js ≥ 20.9** (testé sur 20.13) et **pnpm 10**.

```bash
npm i -g pnpm@10        # si pnpm n'est pas installé
pnpm install
cp .env.example .env.local   # optionnel en phase 1 (copier dans apps/web/.env.local si besoin)
pnpm dev                 # http://localhost:3000
```

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | Serveur de développement (boutique + admin) |
| `pnpm build` / `pnpm start` | Build de production et exécution |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict sur tous les paquets |
| `pnpm test` | Tests unitaires et composants (Vitest + Testing Library) |
| `pnpm test:e2e` | Tests E2E Playwright sur le build de production (lancer `pnpm build` avant ; première fois : `pnpm --filter @fashion/web exec playwright install chromium`) |
| `pnpm --filter @fashion/web images:generate` | Régénère les images SVG de démonstration |

- Boutique : <http://localhost:3000>
- Administration : <http://localhost:3000/admin> (connexion **simulée** : tout e-mail + mot de passe non vide est accepté)

## Passer en mode API (serveur réel)

Détail complet dans [`apps/api/README.md`](apps/api/README.md). En résumé :

```bash
pnpm --filter @fashion/api dev:db          # 1. base PostgreSQL de développement (laisser ouvert)
pnpm --filter @fashion/api db:deploy       # 2. schéma (une fois)
ADMIN_PASSWORD="…12 caractères min…" pnpm --filter @fashion/api db:seed       # compte propriétaire
pnpm --filter @fashion/api db:seed:demo    #    + données de démonstration (facultatif)
pnpm --filter @fashion/api dev             # 3. API sur :4000
# apps/web/.env.local : NEXT_PUBLIC_DATA_SOURCE=api  et  API_INTERNAL_URL=http://localhost:4000
pnpm dev                                   # 4. site sur :3000 — l'admin se connecte avec ADMIN_EMAIL + ce mot de passe
```

- En mode API, la boutique est rendue **à chaque requête** (pas de pages figées à la compilation) et la connexion administrateur est réelle
  (cookie `httpOnly` vérifié par le serveur ; le bandeau « connexion simulée » disparaît).
- Tests : `pnpm --filter @fashion/api test` (188 tests, base jetable automatique) et `pnpm --filter @fashion/web exec playwright test -c playwright.api.config.ts`
  (7 parcours contre le vrai serveur : commande entre deux appareils, suivi, image téléversée, paramètres partagés, stock, sécurité de session ; nécessite
  API + site construit en mode API sur :3100).
- Contrat des routes : [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Architecture

```
fashion-ecommerce/
├── apps/
│   ├── web/            Next.js 16 (App Router) — boutique publique + dashboard admin
│   │   └── src/
│   │       ├── app/        routes : (store)/…  et  admin/…
│   │       ├── components/ ui/ (shadcn + design system) · layout/ · store/ · admin/
│   │       ├── features/   logique par domaine (hooks TanStack Query, calculs, mappers)
│   │       ├── services/   contrats (contracts.ts) + implémentations mock  ← remplaçables par l'API
│   │       ├── mocks/      données de démonstration (jamais importées par les composants)
│   │       ├── stores/     Zustand : panier, favoris, sessions simulées
│   │       └── …
│   └── api/            (phase 2) Express + TypeScript — voir apps/api/README.md
├── packages/
│   ├── types/          types métier (indépendants de Prisma)
│   ├── validators/     schémas Zod partagés (checkout, produit, stock, promo…)
│   └── shared/         règles métier pures : stock par variante, totaux, livraison, filtres catalogue, formats
├── prisma/schema.prisma  brouillon du schéma PostgreSQL (phase 2)
└── docs/FRONTEND_GUIDE.md  conventions et briques réutilisables
```

### Couche de services (clé de la phase 2)

L'interface ne dépend **que** des interfaces de `apps/web/src/services/contracts.ts`
(`ProductService`, `OrderService`, `InventoryService`…). En phase 1 elles sont implémentées par des
services mock (`*.service.ts`) adossés à une base en mémoire persistée dans `localStorage`
(`services/mock/db.ts`) — **ce ne sont pas de faux appels HTTP**, juste des fonctions asynchrones.

Pour passer à l'API : écrire des implémentations `*.api.ts` de ces interfaces (client `fetch` vers Express)
et changer les exports de `services/index.ts` (sélection via `NEXT_PUBLIC_DATA_SOURCE`). Aucun composant à modifier.
Les règles métier déjà écrites et testées dans `packages/shared` (stock, totaux, transitions de statut, filtres)
sont réutilisables telles quelles côté serveur.

## Règles métier implémentées

1. **Stock par variante** (couleur × taille). Le stock total d'un produit est la somme de ses variantes ; la
   disponibilité d'une combinaison ne l'utilise **jamais**.
2. SKU unique (vérifié à la création/modification), génération des variantes à partir des couleurs × tailles.
3. Une variante en rupture ne peut pas être commandée ; la quantité est plafonnée au stock ; combinaisons inexistantes non sélectionnables.
4. Le panier distingue chaque variante (une ligne par couleur/taille).
5. Les prix et coûts sont **figés** dans les lignes de commande à l'achat.
6. Paiement **COD uniquement** : `paymentStatus = pending` tant que la commande n'est pas livrée (« à encaisser »).
7. Frais de livraison séparés du sous-total ; tarifs par zone de wilaya et par mode (domicile / bureau), réglables dans l'admin.
8. Commande **sans compte** autorisée (client invité).
9. Machine à états des commandes (9 statuts) ; annulation, refus et retour restituent le stock et écrivent un mouvement.
10. Chaque variation de stock produit une ligne d'historique (type, quantité avant/après, motif, référence).
11. Statistiques : chiffre d'affaires (livré, hors livraison) ≠ bénéfice brut (CA − coût d'achat). Le **bénéfice net n'est pas calculé**.
12. Administrateur unique ; routes `/admin` destinées à être protégées par le backend.

## Ce qui est simulé en phase 1 (et à remplacer)

| Domaine | Phase 1 | Phase 2 |
| --- | --- | --- |
| Données | Mocks + `localStorage` du navigateur | PostgreSQL via Prisma + API Express |
| Auth admin | Drapeau de session local (**non sécurisé**, bandeau explicite) | JWT en cookie `httpOnly`, rôle propriétaire, middleware serveur |
| Auth client | Identification par téléphone (**non sécurisée**, bandeau explicite) | OTP SMS ou e-mail + mot de passe |
| Images produits | SVG générés (`public/images`), uploads admin en data-URL | Cloudinary |
| Newsletter | Enregistrée en `localStorage` | Service d'e-mailing |
| Communes | Saisie libre (liste des 69 wilayas fournie) | Référentiel communes |
| Bureaux de livraison | **Données de démonstration** (2 par wilaya) | Liste du transporteur partenaire |

### Limites connues de la phase 1

- Les données créées dans l'admin (produits, commandes…) vivent dans le navigateur : le rendu serveur ne les connaît pas.
  Les pages concernées (fiche produit, confirmation de commande) retombent donc sur une lecture côté navigateur.
  Ce contournement disparaît avec la vraie API.
- Vider le stockage du navigateur ou utiliser *Paramètres → Réinitialiser les données de démonstration* restaure les données d'origine.

## Tests

- **Unitaires / composants** (`apps/web/tests/unit`) : règles de stock, variantes, filtres, totaux, transitions de statut, cohérence des mocks, stores, formulaires.
- **E2E Playwright** (`apps/web/tests/e2e`) : parcours boutique (catalogue, filtres, variantes, panier, checkout COD) et admin (produit + variantes, ajustement de stock, changement de statut, statistiques), plus vérifications responsive (absence de débordement horizontal).

## Notes techniques

- Next.js 16 : `params`/`searchParams` asynchrones ; Turbopack par défaut.
- Outils de test alignés sur **Node 20.13** : Vitest 3 / Vite 6 / jsdom 26 (Vitest 5 exige Node ≥ 22.12).
- `pnpm-workspace.yaml` fixe `magic-string` en 0.30.x : la 1.x est ESM pur et fait échouer Tailwind sur Node < 20.19 (`require()` d'un module ESM).
- Après un changement de dépendances, supprimer `apps/web/.next` avant de relancer un build (un cache périmé a déjà produit une fausse erreur).
- Typographie : Playfair Display (titres boutique) + Inter ; palette centralisée dans `apps/web/src/app/globals.css`.

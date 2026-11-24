# Contrat d'API (phase 2)

Référence unique entre `apps/api` (serveur) et `apps/web/src/services/*.api.ts` (client).
Les corps de requête/réponse sont **exactement** les types de `@fashion/types` (JSON, dates ISO 8601, montants entiers en DZD).
Les entrées sont validées avec Zod (`@fashion/validators` quand un schéma existe).

## Conventions

- Préfixe `/api`. **Public** : `/api/<module>/…`. **Admin** : `/api/admin/<module>/…` (session obligatoire).
- Le site web appelle l'API **en même origine** (réécriture Next `/api/* → serveur`) : pas de CORS, cookie `SameSite=Lax`.
- Erreurs : `{ "error": { "code", "message", "details"? } }`. Codes (identiques à `ServiceError` côté web) :

| code | HTTP | sens |
|---|---|---|
| `VALIDATION` | 400 (413 si trop gros) | entrée invalide |
| `UNAUTHENTICATED` | 401 | session absente/expirée |
| `FORBIDDEN` | 403 | origine refusée / accès interdit |
| `NOT_FOUND` | 404 | ressource inconnue |
| `CONFLICT` | 409 | doublon (slug, SKU, code promo…) ou suppression interdite |
| `OUT_OF_STOCK` | 409 | stock insuffisant pour une variante |
| `INVALID_TRANSITION` | 409 | changement de statut de commande interdit |
| `RATE_LIMITED` | 429 | trop de requêtes |
| `NOT_CONFIGURED` | 501 | fonctionnalité non configurée (ex. Cloudinary) |
| `INTERNAL` | 500 | erreur serveur (message générique) |

- Réponses sans contenu : `204`. Création : `201` + ressource.
- Ordre des listes : identique au mock (commandes/mouvements : plus récents d'abord ; catégories : `displayOrder`).

## Authentification propriétaire (un seul administrateur)

| Méthode | Chemin | Corps → Réponse |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `200 { email }` + cookie `admin_session` (httpOnly, SameSite=Lax, Secure en prod, 12 h). 401 générique si échec (même message pour e-mail inconnu / mauvais mot de passe). Limiteur : 10 essais / 15 min / IP. |
| POST | `/api/auth/logout` | → `204`, cookie effacé |
| GET | `/api/auth/me` | → `200 { email }` ou `401` |

Mot de passe : bcrypt (coût ≥ 12). Jeton : JWT HS256 (`JWT_SECRET`). Le compte est créé par `pnpm --filter @fashion/api db:seed` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## Routes publiques

| Méthode | Chemin | Réponse |
|---|---|---|
| GET | `/api/products?search&category&collection&sizes&colors&minPrice&maxPrice&inStockOnly&sort&page&pageSize` | `PaginatedResult<Product>` — **publiés et non archivés uniquement**. `sizes`/`colors` : listes séparées par des virgules. Filtrage = `applyProductFilters` de `@fashion/shared`. |
| GET | `/api/products/catalog` | `Product[]` — tout le catalogue public (≤ 500). Sert au panier, aux favoris et aux facettes. |
| GET | `/api/products/by-slug/:slug` | `Product` public ou 404 |
| GET | `/api/products/:id/related?limit=4` | `Product[]` (même logique de score que le mock) |
| GET | `/api/categories` | `Category[]` non archivées, triées par `displayOrder` |
| GET | `/api/categories/by-slug/:slug` | `Category` ou 404 |
| GET | `/api/settings` | `StoreSettings` |
| POST | `/api/promotions/validate` | `{ code, subtotal }` → `PromotionValidation` (n'incrémente pas l'usage) |
| POST | `/api/newsletter` | `{ email }` → `204` (idempotent, e-mail unique) |
| POST | `/api/orders` | `CreateOrderInput` → `201 Order`. Limiteur 20/h/IP. Voir « Création de commande ». |
| GET | `/api/orders/track?number=CMD-…&phone=05…` | `Order` si le numéro ET le téléphone (comparé normalisé) correspondent, sinon 404 (même réponse dans les deux cas : ne révèle rien). |

Pas de liste de commandes « par téléphone seul » ni de recherche de client par téléphone en public : ce serait une fuite de données personnelles. L'espace client retrouve ses commandes grâce aux couples (numéro, téléphone) mémorisés sur l'appareil.

### Création de commande (transaction unique)

1. Valider l'entrée (`checkoutSchema` pour le client/adresse ; wilaya ∈ `WILAYAS`, bureau ∈ `PICKUP_POINTS` de la wilaya si mode bureau).
2. Pour chaque variante demandée (quantités fusionnées) : produit publié et non archivé, sinon `NOT_FOUND`. **Décrémentation atomique** `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q` ; 0 ligne modifiée ⇒ `OUT_OF_STOCK` et **rollback de toute la commande**. Jamais de lecture-puis-écriture non protégée.
3. Prix et coût **relus en base** (jamais ceux du client) et figés dans `OrderItem` (`unitPrice`, `unitCost`, nom, slug, SKU, couleur, taille, image).
4. Remise : `validatePromotion` (`@fashion/shared`) ; usage incrémenté dans la même transaction. Livraison : `getShippingFee` avec les paramètres en base. Total : `computeOrderTotals`.
5. Client : retrouvé par `phoneKey` (téléphone normalisé `05XXXXXXXX`) ou créé en invité.
6. `status=pending`, `paymentStatus=pending`, `paymentMethod=cash_on_delivery`, première entrée d'historique, numéro `CMD-AAAA-NNNNNN` dérivé d'un compteur séquentiel unique, `soldCount` incrémenté, un `StockMovement{type:"sale", reference:orderNumber}` par ligne.

## Routes admin (`/api/admin/…`, cookie requis, sinon 401)

| Méthode | Chemin | Corps → Réponse |
|---|---|---|
| GET | `/products` | `Product[]` (tous : brouillons et archivés inclus) |
| GET | `/products/:id` · `/products/by-slug/:slug` | `Product` ou 404 |
| POST | `/products` | `CreateProductInput` → `201 Product` (slug et SKU uniques ; mouvement `initial` par variante avec stock > 0) |
| PATCH | `/products/:id` | `UpdateProductInput` → `Product` (règles de `products.service.ts` : variantes appariées par `id` puis `sku`, écart de stock ⇒ mouvement `adjustment`, `compareAtPrice: undefined` ⇒ effacé) |
| POST | `/products/:id/publish` | `{ isPublished }` → `Product` (refusé si archivé) |
| POST | `/products/:id/archive` · `/restore` | → `204` |
| DELETE | `/products/:id` | → `204` ; `409 CONFLICT` si le produit figure dans une commande |
| GET | `/categories?includeArchived=true` | `Category[]` |
| POST / PATCH | `/categories` · `/categories/:id` | `CreateCategoryInput` / `UpdateCategoryInput` → `Category` |
| POST | `/categories/:id/archive` · `/restore` | → `204` (l'archivage cascade aux sous-catégories) |
| GET | `/categories/:id/deletion-impact` | → `{ subcategories, products, orderedProducts }` : ce que supprimerait la suppression définitive (arbre complet, archivés compris) ; `409` pour une collection |
| DELETE | `/categories/:id` | → `204`. Supprime DÉFINITIVEMENT la catégorie, ses sous-catégories et leurs produits (variantes, images, mouvements de stock en cascade). Tout ou rien : `409` si un produit figure dans une commande (archiver à la place) ou si l'arbre contient une collection ; `404` si inconnue |
| GET | `/orders?search&status&deliveryMethod&dateFrom&dateTo&minTotal&maxTotal&customerId&phone` | `Order[]` (dates `YYYY-MM-DD` interprétées en heure d'Algérie, UTC+1) |
| GET | `/orders/:id` · `/orders/by-number/:number` | `Order` ou 404 |
| PATCH | `/orders/:id/status` | `{ status, note? }` → `Order`. Transition via `canTransition` sinon `INVALID_TRANSITION`. Annulée/refusée/retournée ⇒ stock restitué + mouvement `return`. `delivered` ⇒ `paymentStatus=paid` ; `delivery_failed`/`returned` ⇒ `failed` ; `shipped` ⇒ `pending`. Historique complété. |
| GET | `/inventory?search&productId&color&size&status` | `InventoryItem[]` (hors produits archivés) |
| GET | `/inventory/movements?variantId&productId` | `StockMovement[]` |
| POST | `/inventory/movements` | `CreateStockMovementInput` → `201 StockMovement`. `out` > stock ⇒ `OUT_OF_STOCK` ; `adjustment` = quantité absolue, sans effet ⇒ `VALIDATION` ; date future ⇒ `VALIDATION`. Mise à jour atomique du stock. |
| GET | `/customers` · `/customers/:id` | `CustomerSummary[]` · `{ customer: CustomerSummary, orders: Order[] }` |
| GET / POST | `/promotions` | `Promotion[]` · `CreatePromotionInput` → `201 Promotion` (code unique, insensible à la casse) |
| PATCH / DELETE | `/promotions/:id` | `UpdatePromotionInput` → `Promotion` · `204` |
| PATCH | `/settings` | `Partial<StoreSettings>` → `StoreSettings` |
| GET | `/analytics/dashboard` | `DashboardData` (voir `services/contracts.ts`) |
| GET | `/analytics/report?period=7d\|30d\|90d\|12m\|all` | `AnalyticsReport` |
| POST | `/uploads` | multipart `file` (image ≤ 5 Mo : jpeg/png/webp/avif) → `201 { url, publicId }`. Driver `local` (dev, dossier `UPLOAD_DIR`, servi sur `/uploads`) ou `cloudinary`. Contenu vérifié par signature (magic bytes), pas seulement par l'extension. |

### Chiffres et statistiques

Les calculs sont dans `@fashion/shared/analytics.ts` (mêmes fonctions que l'interface) : CA = commandes **livrées**, remises déduites, hors livraison ; bénéfice brut = CA − coût d'achat ; le bénéfice net n'est jamais calculé.

## Règles d'intégrité garanties par la base

`prisma/sql/constraints.sql` (CHECK) : stock ≥ 0, prix ≥ 0, `lineTotal = unitPrice × quantity`, `total = subtotal − discountTotal + shippingFee`, paiement `cash_on_delivery` uniquement, une seule ligne de paramètres, etc. Elles protègent même contre un bug applicatif.

## Sécurité

Helmet, limiteurs de débit (login, commande, newsletter, validation de code), vérification `Origin` sur les requêtes modifiantes, cookie httpOnly, corps JSON ≤ 200 Ko, erreurs 500 sans détail interne, journaux sans cookies, aucun mot de passe/jeton dans les réponses. Le mot de passe admin n'est jamais journalisé.

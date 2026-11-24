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
| `FORBIDDEN` | 403 | origine refusée / accès interdit (ex. mot de passe actuel erroné) |
| `PASSWORD_CHANGE_REQUIRED` | 403 | la cliente doit d'abord changer son mot de passe provisoire (contrôlé par le serveur) |
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
| POST | `/api/orders` | **Cliente connectée obligatoire** (cookie `customer_session`, sinon `401` et rien n'est créé ; `403 PASSWORD_CHANGE_REQUIRED` si le mot de passe provisoire n'a pas été changé). `CreateOrderInput` → `201 CustomerOrder`. Limiteur 20/h/IP. Voir « Création de commande ». |
| GET | `/api/orders/track?number=CMD-…&phone=05…` | `PublicTrackedOrder` (réponse **dédiée**, voir ci-dessous) si le numéro ET le téléphone (comparé normalisé) correspondent, sinon 404 (même réponse dans les deux cas : ne révèle rien). |

Pas de liste de commandes « par téléphone seul » ni de recherche de client par téléphone en public : ce serait une fuite de données personnelles. L'espace client retrouve ses commandes grâce aux couples (numéro, téléphone) mémorisés sur l'appareil.

### Création de commande (transaction unique)

1. Valider l'entrée (`checkoutSchema` pour le client/adresse ; wilaya ∈ `WILAYAS`, bureau ∈ `PICKUP_POINTS` de la wilaya si mode bureau).
2. Pour chaque variante demandée (quantités fusionnées) : produit publié et non archivé, sinon `NOT_FOUND`. **Décrémentation atomique** `UPDATE … SET stock = stock - q WHERE id = ? AND stock >= q` ; 0 ligne modifiée ⇒ `OUT_OF_STOCK` et **rollback de toute la commande**. Jamais de lecture-puis-écriture non protégée.
3. Prix et coût **relus en base** (jamais ceux du client) et figés dans `OrderItem` (`unitPrice`, `unitCost`, nom, slug, SKU, couleur, taille, image).
4. Remise : `validatePromotion` (`@fashion/shared`) ; usage incrémenté dans la même transaction. Livraison : `getShippingFee` avec les paramètres en base. Total : `computeOrderTotals`.
5. Cliente : celle de la **session** (`customerId` ne vient JAMAIS du corps de la requête). Le nom, le téléphone et l'e-mail du formulaire ne sont que les coordonnées de **livraison** de cette commande : ils ne créent, ne retrouvent ni ne modifient aucune fiche client (sinon on pourrait toucher le compte d'une autre personne en saisissant son numéro).
6. `status=pending`, `paymentStatus=pending`, `paymentMethod=cash_on_delivery`, première entrée d'historique, numéro `CMD-AAAA-NNNNNN` dérivé d'un compteur séquentiel unique, `soldCount` incrémenté, un `StockMovement{type:"sale", reference:orderNumber}` par ligne.

### Réponses « vue publique » (listes blanches)

Les trois vues d'une commande sont construites **champ par champ** (jamais en recopiant l'objet complet) : un champ ajouté plus tard à `Order` n'apparaît donc jamais dans une vue cliente ou publique par accident.

| Vue | Utilisée par | Contenu |
|---|---|---|
| `Order` (complète) | administration | tout, dont le **prix de revient** (`unitCost`) et les **notes internes** de l'historique |
| `CustomerOrder` | `POST /orders`, `GET /customers/me/orders…` | la commande de la cliente, sans `unitCost` ni notes internes |
| `PublicTrackedOrder` | `GET /orders/track` | le strict nécessaire au suivi : `orderNumber`, `status`, `statusHistory[{status, at}]`, `paymentMethod`, `paymentStatus`, `customer.firstName` (prénom seulement), `shippingAddress{wilayaName, commune, deliveryMethod, pickupPointName?}` (pas la rue), `items[{productName, productSlug, color, colorCode, size, imageUrl, unitPrice, quantity, lineTotal}]`, `subtotal`, `discountTotal`, `promoCode?`, `shippingFee`, `total`, `createdAt`, `updatedAt` |

`PublicTrackedOrder` ne contient **jamais** : identifiants internes (commande, client, produit, variante), SKU, prix de revient, notes (administration ou cliente), nom de famille, téléphone, e-mail, adresse postale. Des tests parcourent la réponse à tous les niveaux d'imbrication (clés et valeurs).

## Comptes clientes (téléphone + mot de passe)

Un visiteur non connecté garde accès à tout le site (catalogue, catégories, panier, suivi public) : **seule la commande exige une connexion**.

| Méthode | Chemin | Réponse |
|---|---|---|
| POST | `/api/customers/register` | `{ firstName, lastName, phone, email?, wilayaCode, commune, address?, password }` → `201 CustomerAccount` + cookie. Numéro déjà inscrit : `409` au message **générique** (identique pour un compte actif et un compte historique). |
| POST | `/api/customers/login` | `{ phone, password }` → `200 CustomerAccount` + cookie. Échec : `401` unique (numéro inconnu, mauvais mot de passe, compte sans mot de passe…). Trop d'essais : `429` + `Retry-After`. |
| POST | `/api/customers/logout` | → `204` : la session est **supprimée en base** (révocation réelle) et le cookie effacé. |
| GET | `/api/customers/me` | `CustomerAccount` (accessible même avant le changement obligatoire) |
| PATCH | `/api/customers/me` | `{ firstName?, lastName?, email?, wilayaCode?, commune?, address? }` → `CustomerAccount`. Tout autre champ (téléphone, mot de passe, `id`…) : `400`. |
| POST | `/api/customers/me/password` | `{ currentPassword, newPassword }` → `200 CustomerAccount`. **Toutes** les sessions sont révoquées (y compris l'actuelle) et une session neuve est ouverte (cookie remplacé). Ancien mot de passe erroné : `403` (5 échecs ⇒ blocage `429`). |
| GET | `/api/customers/me/orders` · `/me/orders/:number` | `CustomerOrder[]` (100 max, plus récentes d'abord) · `CustomerOrder` ou `404` (une commande d'une autre cliente est indiscernable d'une commande inexistante) |

- **Identité** : toujours issue de la **session** côté serveur, jamais d'un paramètre, d'un en-tête ou du corps.
- **Mot de passe** : 8 caractères minimum, **72 octets UTF-8 maximum** (limite de bcrypt : refusé plutôt que tronqué), refusé s'il est égal au téléphone ; bcrypt coût 12.
- **Session** : jeton aléatoire de 32 octets dans le cookie `customer_session` (httpOnly, SameSite=Lax, Secure en production, 30 jours, sans prolongation) ; la base ne stocke que son empreinte SHA-256. 10 sessions actives au plus par cliente. Vérifiée en base à chaque requête. **Distincte** de `admin_session` (aucune route ne lit l'autre cookie).
- **Téléphone** : normalisé (`+213 555…`, `00213 555…` et `0555…` désignent le même compte) avec une fonction unique (`@fashion/shared`).
- **Mot de passe provisoire** (réinitialisation par l'administrateur) : tant qu'il n'est pas changé, seuls `GET /me`, `POST /me/password` et `POST /logout` répondent ; tout le reste (dont `POST /orders`) renvoie `403 PASSWORD_CHANGE_REQUIRED`.

### Limites de tentatives (compteurs atomiques en base, partagés entre les instances)

| Quoi | Seuil | Remarque |
|---|---|---|
| Connexion, par numéro | 5 échecs / 15 min ⇒ blocage fixe de 15 min | tenu pour tout numéro, existant ou non (réponses identiques) ; levé par une connexion réussie ou une réinitialisation admin |
| Connexion, par IP | 30 tentatives / 15 min | contrôlé **avant** les compteurs par numéro |
| **Inscription, par IP** (IPv6 en /64) | **10 / heure** et **20 / jour** | |
| **Inscription, par sous-réseau** (IPv4 /24, IPv6 /48) | **60 / jour** | borne un robot qui change d'adresse dans une plage |
| **Inscription, globale** (toutes IP) | **100 / heure** et **500 / jour** | une boutique réelle reçoit quelques inscriptions par jour |
| Changement de mot de passe (échecs de l'ancien) | 5 / 15 min ⇒ blocage 15 min | par cliente |
| Réinitialisation admin | 10 / heure ; 5 échecs de confirmation / 15 min ⇒ blocage | par administrateur |

Pour les **inscriptions**, chaque tentative (numéro neuf **ou** déjà inscrit : comptage identique, avant toute vérification d'existence) consomme dans l'ordre IP/heure → IP/jour → sous-réseau/jour → global/heure → global/jour ; la première limite atteinte répond `429` (message sans lien avec l'état du numéro) et les suivantes ne sont pas entamées : une IP abusive n'épuise jamais le budget global. Les requêtes invalides (`400`) ne consomment rien.

### Journal d'audit (jamais de secret)

Événements : `customer.registered`, `customer.register_duplicate` (tentative sur un numéro déjà inscrit : cible = le compte), `customer.register_limit_reached` (plafond de sous-réseau ou global atteint, écrit **une fois par fenêtre**), `customer.login_locked`, `customer.password_changed`, `customer.password_change_forced`, `admin.customer_password_reset` et `admin.customer_password_reset_denied`. Adresse IP **masquée** (IPv4 /24, IPv6 /48) ; métadonnées en liste fermée de clés ; ni mot de passe, ni jeton, ni cookie. Conservation : 365 jours (purge quotidienne).

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
| POST | `/customers/:id/reset-password` | `{ adminPassword }` (l'administrateur ressaisit **son** mot de passe) → `200 { customerId, temporaryPassword, mustChangePassword: true }`. Mot de passe provisoire de 12 caractères, **affiché une seule fois** (`no-store`), haché en base ; toutes les sessions de la cliente sont révoquées ; opération atomique avec le journal d'audit. `403` si le mot de passe admin est erroné, `404` si la cliente n'existe pas (après ré-authentification), `429` au-delà de 10 par heure. |
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

Helmet, limiteurs de débit (login, commande, newsletter, validation de code), vérification `Origin` sur les requêtes modifiantes, cookie httpOnly, corps JSON ≤ 200 Ko, erreurs 500 sans détail interne, journaux HTTP en **liste blanche** (voir ci-dessous), aucun mot de passe/jeton dans les réponses. Le mot de passe admin n'est jamais journalisé.

### Journaux HTTP

Les journaux ne conservent que ce qui est connu comme sans risque (« refuser par défaut ») :
- **URL** : numéros de commande et téléphones masqués dans le chemin ; dans la requête, seuls les paramètres de pagination, de tri et de filtres de catalogue sont conservés, **tout autre paramètre** (`phone`, `number`, `search`, `customerId`, inconnus…) est remplacé par `[Redacted]` ;
- **en-têtes de requête** : liste blanche (`host`, `user-agent`, `accept*`, `content-type/length`, `origin`, `sec-fetch-*`, `x-forwarded-proto/host`) ; ni cookie, ni `Authorization`, ni signature du proxy, ni localisation, ni IP complète (l'adresse n'apparaît que masquée : `ipMasked`) ;
- **en-têtes de réponse** : `Set-Cookie` n'est jamais journalisé ; seul un petit sous-ensemble sûr subsiste ;
- aucun corps de requête n'est journalisé ; les messages d'erreur sont filtrés (hachages bcrypt, JWT, cookies de session, Bearer, empreintes, jetons, valeurs associées à `password/secret/token/hash`).

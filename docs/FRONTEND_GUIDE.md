# Guide de développement frontend (apps/web)

Document de référence pour toute personne (ou agent) qui ajoute des pages à `apps/web`.
Il décrit les briques **déjà en place** : ne les réécrivez pas, importez-les.

## 1. Stack et règles de base

- Next.js 16 (App Router), React 19, TypeScript **strict** (`noUncheckedIndexedAccess` activé), Tailwind CSS 4, shadcn/ui (Radix), Lucide, Zustand, TanStack Query, React Hook Form + Zod, Recharts, Sonner.
- Next 16 : `params` et `searchParams` des pages sont des **Promises** (`const { slug } = await params`). Le fichier `middleware.ts` est remplacé par `proxy.ts`.
- Server Components par défaut. `"use client"` seulement si interaction navigateur (état, effets, handlers, hooks).
- **Aucun `any`**, aucun lien `href="#"`, aucun bouton sans action, aucune page vide, aucun emoji comme icône.
- Aucune donnée de démonstration dans les composants : tout passe par `@/services` (jamais d'import depuis `@/mocks` ni `@/services/mock` dans un composant/page).
- Ne mélangez pas boutique et admin : `components/store/*` n'est utilisé que par `(store)`, `components/admin/*` que par `admin/*`. `components/ui/*` et `components/layout/*` sont partagés.
- Textes de l'interface en **français**. Montants avec `formatDZD` (jamais `toLocaleString`). Dates avec `formatDate`/`formatDateTime` de `@fashion/shared` (évite les écarts d'hydratation).
- Accessibilité : labels liés aux champs, `aria-label` sur les boutons-icônes, focus visible (déjà global), zones tactiles ≥ 40 px sur mobile, contraste suffisant.
- Responsive : vérifier 360, 390, 768, 1024, 1440 px. Pas de débordement horizontal. Les tableaux admin passent en cartes ou défilent dans un conteneur `overflow-x-auto` sur mobile.

## 2. Design system

Variables CSS dans `src/app/globals.css` (ne jamais coder une couleur en dur ; utiliser les classes Tailwind sémantiques) :

`bg-background`, `bg-background-secondary`, `bg-card`, `bg-secondary`, `bg-muted`, `bg-accent`, `text-foreground`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `text-brand` / `bg-brand` / `bg-brand-soft`, `text-success|warning|destructive|info` (+ `bg-*-soft`), `border-border`, `border-input`, `bg-sidebar*`.

- Titres boutique : classe `font-display` (serif Playfair) ; dans l'admin la même classe devient sans-serif automatiquement.
- Conteneur boutique : `container-store`. Sur-titre : `eyebrow`. Animation d'entrée discrète : `reveal`.
- Thème admin : le wrapper racine de l'admin porte `data-theme="admin"` (déjà géré par le layout admin).
- Rayon par défaut : `rounded-md`/`rounded-sm` (sobre). Pas de dégradés, pas d'ombres lourdes.

### Composants disponibles

`components/ui/` (shadcn) : accordion, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, dialog, dropdown-menu, input, label, pagination, popover, radio-group, scroll-area, select, separator, sheet, skeleton, slider, sonner (Toaster déjà monté), switch, table, tabs, textarea, tooltip.

Ajouts maison dans `components/ui/` : `Price`, `EmptyState`, `ConfirmDialog` (action destructive/sensible), `QuantityStepper`, `ColorSwatch`, `OrderStatusBadge` / `StockStatusBadge` / `ToneBadge`, `ProductImage`, `FormField` (label+erreur pour RHF), `social-icons` (Instagram/TikTok/WhatsApp).

`components/store/` : `ProductCard`, `ProductCardSkeleton`, `FavoriteButton`.
`components/admin/` : `PageHeader`, `StatCard`, `TablePagination`.

## 3. Données : services, hooks, stores

```
@/services            productService, categoryService, orderService, inventoryService,
                      customerService, promotionService, settingsService, analyticsService,
                      authService, uploadService, newsletterService,
                      ServiceError, getErrorMessage      (contrats : services/contracts.ts)
@/features/*/hooks    useProducts, useSearchProducts, useProductBySlug, useRelatedProducts, useCreateProduct,
                      useUpdateProduct, useSetPublished, useArchiveProduct, useRestoreProduct, useDeleteProduct,
                      useCategories + mutations, useOrders, useOrder, useOrderByNumber, useCreateOrder,
                      useUpdateOrderStatus, useInventory, useStockMovements, useRecordMovement, useCustomers,
                      useCustomer, useDashboard, useAnalyticsReport, usePromotions + mutations, useValidatePromoCode,
                      useSettings, useUpdateSettings, useResetDemoData
@/stores              useCartStore (cart.store), useFavoritesStore, useAdminSessionStore, useCustomerSessionStore,
                      usePlacedOrdersStore (commandes mémorisées sur l'appareil, mode API)
@/hooks/use-hydrated  useHydrated() — OBLIGATOIRE avant d'afficher panier/favoris/session (localStorage)
@fashion/shared       formatDZD, formatDate…, WILAYAS, getPickupPointsForWilaya, getShippingFee, computeOrderTotals,
                      validatePromotion, ORDER_STATUS_LABELS, canTransition, ORDER_STATUS_TRANSITIONS, findVariant,
                      getProductColors, getProductSizes, getAvailableSizesForColor, getTotalStock, getVariantStatus,
                      isOnSale, isNewProduct, isProductInStock, generateVariants, buildSku, slugify, applyProductFilters…
@fashion/validators   checkoutSchema, newsletterSchema, adminLoginSchema, customerLoginSchema, profileSchema,
                      productFormSchema, categoryFormSchema, stockMovementSchema, promotionFormSchema, settingsFormSchema
@fashion/types        via @/types/*.types (Product, ProductVariant, Order, StockMovement…)
```

- **Mutations** : toute mutation réussie invalide *tout* le cache TanStack Query (voir `lib/query-client.ts`) → inutile d'invalider à la main. Afficher un toast Sonner de succès, et `toast.error(getErrorMessage(err))` en cas d'échec.
- **Rendu serveur + hydratation client** : une page serveur appelle directement `productService.*` (données de départ, SEO, JSON-LD) et passe le résultat en `initialData` au hook client correspondant. Les composants qui affichent des données modifiables (stock, commandes) lisent via les hooks.
- La base mock vit en mémoire + `localStorage` (`services/mock/db.ts`). Côté serveur elle renvoie toujours les données initiales.

### Sources de données : mock ou API (`NEXT_PUBLIC_DATA_SOURCE`)

`services/index.ts` choisit l'implémentation une seule fois, à l'import : `NEXT_PUBLIC_DATA_SOURCE=api` → `services/api/*.api.ts`
(contrat : `docs/API_CONTRACT.md`) ; toute autre valeur (défaut) → services mock. Les composants n'importent **que** `@/services`.
Pour savoir quelle source est active dans l'interface (textes, bandeaux, sections), utiliser `isApiMode()` de `@/lib/api-config` — jamais
`process.env` directement dans un composant.

- **Client HTTP** : `lib/api-client.ts` (`apiFetch`, `apiFetchOrNull`). Navigateur : chemin relatif `/api/...` (même origine, réécrit par
  `next.config.ts` vers `API_INTERNAL_URL`, cookie de session joint) ; rendu serveur : `${API_INTERNAL_URL}/api/...` avec `cache: "no-store"`.
  Toute erreur est un `ServiceError` au même code que l'API (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OUT_OF_STOCK`,
  `INVALID_TRANSITION`, `RATE_LIMITED`, `NOT_CONFIGURED`, `INTERNAL`) ; un serveur injoignable donne `INTERNAL` (« Le serveur est injoignable… »).
  Un 401 sur une route `/admin/*` vide la session locale et renvoie vers `/admin/login` (une seule fois).
- **Publiques vs admin** : `getProducts({ onlyPublic })`, `getProductBySlug(slug, { onlyPublic })` et `getCategories({ includeArchived })` choisissent la
  route publique ou admin. `getOrderByNumber(numéro, téléphone?)` : avec téléphone = suivi public (numéro ET téléphone), sans = recherche admin.
- **Aucune fuite de données personnelles** : en mode API `customerService.findByPhone` renvoie toujours `null` et il n'existe pas de liste de commandes
  « par téléphone ». L'espace client (`useMyOrders`, `useTrackedOrder`) relit chaque commande avec le couple (numéro, téléphone) mémorisé dans
  `usePlacedOrdersStore` après `createOrder`, ou saisi dans le formulaire « Suivre une commande ». Ne jamais appeler `orderService.getOrderByNumber`
  sans téléphone depuis la boutique (route admin → 401).
- **Authentification admin** : `authService` (`login`, `logout`, `me`). Mode API : cookie httpOnly posé par le serveur ; `SessionGuard` vérifie la
  session via `authService.me()`, `src/proxy.ts` redirige `/admin/dashboard/**` sans cookie `admin_session` (confort UX, la vraie protection est le 401 de l'API).
- **Téléversements** : `uploadService.uploadImage(file)` → `{ url }` (mock : data-URL redimensionnée ; API : `POST /admin/uploads`, multipart).
  Les formulaires admin (images produit, catégorie, logo) n'utilisent que lui ; les contrôles de type/taille de `lib/image-utils.ts` restent appliqués.
- **Mode API uniquement** : la section « Données de démonstration » (réinitialisation) et les bandeaux « mode démonstration » sont masqués.
- **Règle de stock** : la disponibilité d'une combinaison se lit sur **la variante** (`findVariant(product, color, size)?.stock`). Ne jamais additionner le stock de plusieurs variantes pour décider si une combinaison est commandable.
- Panier : une ligne = une variante (`variantId`). `addItem` plafonne à `maxStock`. Les prix du panier sont un instantané ; `createOrder` revalide stock et prix.
- Paiement : uniquement `cash_on_delivery`. COD ≠ encaissé : `paymentStatus` reste `pending` jusqu'à la livraison.
- Auth simulée (mock : admin et client) : afficher clairement « mode démo — non sécurisé ». Ne jamais prétendre à une vraie sécurité.
  En mode API, la session admin est réelle (cookie httpOnly) ; l'« espace client » reste une simple mémoire locale de l'appareil (pas de compte).

## 4. Images

Les images de démonstration sont des SVG générés dans `public/images/` :
`/images/products/{slug}/{color-slug}-{1|2}.svg`, `/images/categories/{slug}.svg`, `/images/hero.svg`, `/images/promo.svg`, `/images/brand.svg`.
Toujours utiliser `next/image` (ou `ProductImage`) avec `alt` pertinent. Les images admin « téléversées » passent par `uploadService` : data-URL en mode mock, URL `/uploads/...` ou Cloudinary en mode API
(`next.config.ts` autorise `/images/**`, `/uploads/**` et `res.cloudinary.com` pour `next/image`).

## 5. Vérifications avant de rendre la main

Depuis `apps/web` :

```
pnpm exec tsc --noEmit        # doit passer sans erreur
pnpm exec eslint <vos dossiers>
pnpm exec vitest run
```

Ne lancez pas `next build` ni `next dev` en parallèle d'un autre agent (le dossier `.next` est partagé) sauf instruction contraire.

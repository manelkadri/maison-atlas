-- Contraintes d'intégrité que Prisma ne sait pas exprimer.
-- Elles sont recopiées dans la migration initiale ; en cas de nouvelle migration qui recrée une table,
-- les ré-appliquer. Elles garantissent les règles métier MÊME si une requête contourne l'API.

-- Règle n°1/4 : le stock d'une variante ne peut jamais être négatif (pas de survente).
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_alert_non_negative" CHECK ("alertThreshold" >= 0);

ALTER TABLE "Product" ADD CONSTRAINT "Product_prices_non_negative" CHECK ("price" >= 0 AND "costPrice" >= 0);

-- Règle n°6 : lignes de commande figées et cohérentes.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_line_total" CHECK ("lineTotal" = "unitPrice" * "quantity");

-- Règle n°8 : total = sous-total - remise + livraison (livraison séparée du sous-total).
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_consistent" CHECK ("total" = "subtotal" - "discountTotal" + "shippingFee");
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_non_negative" CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingFee" >= 0);

-- Règle n°7 : COD uniquement.
ALTER TABLE "Order" ADD CONSTRAINT "Order_payment_cod_only" CHECK ("paymentMethod" = 'cash_on_delivery');

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_value_positive" CHECK ("value" > 0);
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_period_valid" CHECK ("endsAt" >= "startsAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_percentage_max" CHECK ("type" <> 'percentage' OR "value" <= 100);

-- Un seul magasin : une seule ligne de paramètres.
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_single_row" CHECK ("id" = 1);

-- Comptes clientes (migration 20261124163134_customer_accounts).
-- Le téléphone normalisé (clé d'unicité d'un client) a toujours le format national algérien (même clé que `normalizePhone`).
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_phoneKey_format" CHECK ("phoneKey" ~ '^0[5-7][0-9]{8}$');
-- Un mot de passe n'est jamais stocké en clair : la base n'accepte qu'un hachage bcrypt.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_passwordHash_bcrypt"
  CHECK ("passwordHash" IS NULL OR "passwordHash" ~ '^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$');
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_expiry_valid" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "AuthThrottle" ADD CONSTRAINT "AuthThrottle_count_non_negative" CHECK ("count" >= 0);
-- Les nouvelles tables (CustomerSession, AuthThrottle, AuditLog) ont la RLS activée (voir la migration) ; tout nouvel ajout de
-- table doit en faire autant : tests/migrations.test.ts échoue sinon.

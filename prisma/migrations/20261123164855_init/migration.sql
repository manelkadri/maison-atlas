-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('women', 'men', 'unisex');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('category', 'collection');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'rejected', 'delivery_failed', 'returned');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('home', 'pickup_point');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('in', 'out', 'adjustment', 'sale', 'return', 'initial');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('percentage', 'fixed');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "kind" "CategoryKind" NOT NULL DEFAULT 'category',
    "parentId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'unisex',
    "tags" TEXT[],
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "alertThreshold" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "email" TEXT,
    "wilayaCode" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerFirstName" TEXT NOT NULL,
    "customerLastName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "wilayaCode" TEXT NOT NULL,
    "wilayaName" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "pickupPointId" TEXT,
    "pickupPointName" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "shippingFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash_on_delivery',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "customerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "openingHours" TEXT NOT NULL DEFAULT '',
    "plusCode" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "social" JSONB NOT NULL,
    "shippingFees" JSONB NOT NULL,
    "freeShippingThreshold" INTEGER NOT NULL DEFAULT 0,
    "defaultAlertThreshold" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_reference_key" ON "Product"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_isPublished_isArchived_idx" ON "Product"("isPublished", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_color_size_key" ON "ProductVariant"("productId", "color", "size");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneKey_key" ON "Customer"("phoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sequence_key" ON "Order"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Contraintes d'integrite (prisma/sql/constraints.sql) =====
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

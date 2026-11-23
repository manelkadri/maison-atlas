import { categoriesMock } from "@/mocks/categories.mock";
import { customersMock } from "@/mocks/customers.mock";
import { stockMovementsMock } from "@/mocks/inventory.mock";
import { ORDER_SEQUENCE_START, ordersMock } from "@/mocks/orders.mock";
import { productsMock } from "@/mocks/products.mock";
import { promotionsMock } from "@/mocks/promotions.mock";
import { settingsMock } from "@/mocks/settings.mock";
import type { Category, Product } from "@/types/product.types";
import type { Customer } from "@/types/customer.types";
import type { Order } from "@/types/order.types";
import type { StockMovement } from "@/types/inventory.types";
import type { Promotion } from "@/types/promotion.types";
import type { StoreSettings } from "@/types/settings.types";

/**
 * Base de données EN MÉMOIRE (+ persistance localStorage côté navigateur) qui remplace PostgreSQL
 * pendant la phase 1. Elle est volontairement cachée derrière les interfaces de services :
 * aucun composant ne l'importe directement.
 *
 * Ce n'est PAS un faux serveur HTTP : ce sont de simples fonctions asynchrones.
 */
export type MockDbState = {
  version: number;
  products: Product[];
  categories: Category[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  promotions: Promotion[];
  settings: StoreSettings;
  orderSequence: number;
  idCounter: number;
};

const STORAGE_KEY = "fashion-mock-db";
/** Incrémenter lorsque la forme des données change, pour invalider les anciens états persistés. */
const DB_VERSION = 3; // v3 : réseaux réels (Instagram, TikTok), WhatsApp, Facebook retiré

function seed(): MockDbState {
  return structuredClone({
    version: DB_VERSION,
    products: productsMock,
    categories: categoriesMock,
    customers: customersMock,
    orders: ordersMock,
    movements: stockMovementsMock,
    promotions: promotionsMock,
    settings: settingsMock,
    orderSequence: ORDER_SEQUENCE_START,
    idCounter: 1000,
  });
}

let state: MockDbState | null = null;

function load(): MockDbState {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDbState;
        if (parsed.version === DB_VERSION) return parsed;
      }
    } catch {
      /* stockage indisponible ou corrompu : on repart des données de démonstration */
    }
  }
  return seed();
}

export function getDb(): MockDbState {
  if (!state) state = load();
  return state;
}

/** À appeler après chaque mutation. */
export function commit(): void {
  if (typeof window === "undefined" || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("mock-db:changed"));
  } catch {
    /* quota dépassé / mode privé : l'état reste en mémoire pour la session */
  }
}

export function resetDb(): void {
  state = seed();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("mock-db:changed"));
  }
}

export function nextId(prefix: string): string {
  const db = getDb();
  db.idCounter += 1;
  return `${prefix}_${db.idCounter}`;
}

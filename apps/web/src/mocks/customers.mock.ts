import type { Customer } from "@/types/customer.types";
import { daysAgo } from "./helpers";

/**
 * Clients fictifs. Les numéros 0550 00 00 xx sont volontairement factices.
 * Index stable : orders.mock.ts s'appuie sur l'ordre de ce tableau.
 */
const raw: Array<[string, string, string, string, string, string?]> = [
  ["Amina", "Benali", "16", "Bab Ezzouar", "Cité 5 Juillet, bloc C", "amina.benali@example.com"],
  ["Yacine", "Merzouk", "31", "Bir El Djir", "Rue des Frères Bouchama, n° 14"],
  ["Sarah", "Boudiaf", "25", "El Khroub", "Cité Ziadia, bâtiment 7", "sarah.boudiaf@example.com"],
  ["Karim", "Haddad", "09", "Boufarik", "Lotissement El Wiam, villa 22"],
  ["Lina", "Cherif", "19", "Sétif", "Rue du 8 Mai 1945, n° 3", "lina.cherif@example.com"],
  ["Rayan", "Mebarki", "23", "El Bouni", "Cité Seybouse, n° 118"],
  ["Meriem", "Khelifi", "15", "Tizi Ouzou", "Nouvelle ville, résidence Les Orangers"],
  ["Walid", "Saadi", "05", "Batna", "Cité Kechida, n° 45"],
  ["Nesrine", "Ferhat", "06", "Béjaïa", "Boulevard de la Liberté, n° 9", "nesrine.ferhat@example.com"],
  ["Mounir", "Belkacem", "13", "Tlemcen", "Rue Khaldoun, n° 21"],
  ["Imane", "Zerrouki", "30", "Hassi Messaoud", "Cité 1200 logements, bloc D"],
  ["Sofiane", "Amrani", "07", "Biskra", "Rue Hakim Saadane, n° 6"],
  ["Yasmine", "Djaballah", "16", "Hydra", "Chemin Sidi Yahia, n° 31", "yasmine.d@example.com"],
  ["Anis", "Rahmani", "27", "Mostaganem", "Cité Salamandre, n° 77"],
];

export const customersMock: Customer[] = raw.map(([firstName, lastName, wilayaCode, commune, address, email], i) => ({
  id: `cust_${String(i + 1).padStart(3, "0")}`,
  firstName,
  lastName,
  phone: `0550 00 00 ${String(i + 1).padStart(2, "0")}`,
  email,
  wilayaCode,
  commune,
  address,
  isGuest: i % 4 === 3, // quelques clients ayant commandé sans compte
  createdAt: daysAgo(150 - i * 9),
}));

export type ShippingZone = "1" | "2" | "3";

export type Wilaya = {
  code: string;
  name: string;
  /** Zone tarifaire de livraison (voir StoreSettings.shippingFees). */
  zone: ShippingZone;
};

// Les nouvelles wilayas (59-69) héritent de la zone tarifaire de leur wilaya d'origine.
const ZONE_1 = new Set(["16", "09", "35", "42", "15", "10", "26", "44", "66"]);
const ZONE_3 = new Set([
  "01", "03", "07", "08", "11", "17", "30", "32", "33", "37", "39", "45", "47",
  "49", "50", "51", "52", "53", "54", "55", "56", "57", "58",
  "59", "60", "62", "68", "69",
]);

const RAW: Array<[string, string]> = [
  ["01", "Adrar"], ["02", "Chlef"], ["03", "Laghouat"], ["04", "Oum El Bouaghi"],
  ["05", "Batna"], ["06", "Béjaïa"], ["07", "Biskra"], ["08", "Béchar"],
  ["09", "Blida"], ["10", "Bouira"], ["11", "Tamanrasset"], ["12", "Tébessa"],
  ["13", "Tlemcen"], ["14", "Tiaret"], ["15", "Tizi Ouzou"], ["16", "Alger"],
  ["17", "Djelfa"], ["18", "Jijel"], ["19", "Sétif"], ["20", "Saïda"],
  ["21", "Skikda"], ["22", "Sidi Bel Abbès"], ["23", "Annaba"], ["24", "Guelma"],
  ["25", "Constantine"], ["26", "Médéa"], ["27", "Mostaganem"], ["28", "M'Sila"],
  ["29", "Mascara"], ["30", "Ouargla"], ["31", "Oran"], ["32", "El Bayadh"],
  ["33", "Illizi"], ["34", "Bordj Bou Arréridj"], ["35", "Boumerdès"], ["36", "El Tarf"],
  ["37", "Tindouf"], ["38", "Tissemsilt"], ["39", "El Oued"], ["40", "Khenchela"],
  ["41", "Souk Ahras"], ["42", "Tipaza"], ["43", "Mila"], ["44", "Aïn Defla"],
  ["45", "Naâma"], ["46", "Aïn Témouchent"], ["47", "Ghardaïa"], ["48", "Relizane"],
  ["49", "Timimoun"], ["50", "Bordj Badji Mokhtar"], ["51", "Ouled Djellal"],
  ["52", "Béni Abbès"], ["53", "In Salah"], ["54", "In Guezzam"], ["55", "Touggourt"],
  ["56", "Djanet"], ["57", "El M'Ghair"], ["58", "El Meniaa"],
  // Nouvelles wilayas (réforme administrative : 58 → 69).
  ["59", "Aflou"], ["60", "El Abiodh Sidi Cheikh"], ["61", "El Aricha"], ["62", "El Kantara"],
  ["63", "Barika"], ["64", "Bou Saâda"], ["65", "Bir El Ater"], ["66", "Ksar El Boukhari"],
  ["67", "Ksar Chellala"], ["68", "Aïn Oussara"], ["69", "Messaâd"],
];

export const WILAYAS: readonly Wilaya[] = RAW.map(([code, name]) => ({
  code,
  name,
  zone: ZONE_1.has(code) ? "1" : ZONE_3.has(code) ? "3" : "2",
}));

export function getWilaya(code: string): Wilaya | undefined {
  return WILAYAS.find((w) => w.code === code);
}

export type PickupPoint = {
  id: string;
  wilayaCode: string;
  name: string;
  address: string;
};

/**
 * Bureaux de livraison.
 * DONNÉES DE DÉMONSTRATION : à remplacer par la liste réelle du transporteur partenaire.
 */
export const PICKUP_POINTS: readonly PickupPoint[] = WILAYAS.flatMap((w) => [
  { id: `${w.code}-centre`, wilayaCode: w.code, name: `Bureau ${w.name} Centre`, address: `Centre-ville, ${w.name}` },
  { id: `${w.code}-nord`, wilayaCode: w.code, name: `Bureau ${w.name} Nord`, address: `Quartier Nord, ${w.name}` },
]);

export function getPickupPointsForWilaya(wilayaCode: string): PickupPoint[] {
  return PICKUP_POINTS.filter((p) => p.wilayaCode === wilayaCode);
}

export function getPickupPoint(id: string): PickupPoint | undefined {
  return PICKUP_POINTS.find((p) => p.id === id);
}

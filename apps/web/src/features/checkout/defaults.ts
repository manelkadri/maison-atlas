import type { CheckoutFormValues } from "@fashion/validators";
import type { CartShippingEstimate } from "@/stores/cart.store";
import type { CustomerAccount } from "@/types/customer.types";

/**
 * Valeurs initiales du formulaire : compte de la cliente connectée + estimation de livraison du panier.
 * Commune et adresse du compte ne sont proposées que pour la même wilaya que l'estimation (sinon elles ne correspondraient pas).
 */
export function getCheckoutDefaults(
  profile: Pick<CustomerAccount, "firstName" | "lastName" | "phone" | "wilayaCode" | "commune" | "address"> | null,
  shipping: CartShippingEstimate,
): CheckoutFormValues {
  const sameWilaya = !!profile && profile.wilayaCode === shipping.wilayaCode;
  return {
    lastName: profile?.lastName ?? "",
    firstName: profile?.firstName ?? "",
    phone: profile?.phone ?? "",
    wilayaCode: shipping.wilayaCode,
    commune: sameWilaya ? profile.commune : "",
    address: sameWilaya ? profile.address : "",
    deliveryMethod: shipping.method,
    pickupPointId: undefined,
    note: "",
  };
}

import type { CheckoutFormValues } from "@fashion/validators";
import type { CartShippingEstimate } from "@/stores/cart.store";
import type { CustomerProfile } from "@/stores/customer-session.store";

/** Valeurs initiales du formulaire : session client simulée + estimation de livraison du panier. */
export function getCheckoutDefaults(
  profile: CustomerProfile | null,
  shipping: CartShippingEstimate,
): CheckoutFormValues {
  return {
    lastName: profile?.lastName ?? "",
    firstName: profile?.firstName ?? "",
    phone: profile?.phone ?? "",
    wilayaCode: shipping.wilayaCode,
    commune: "",
    address: "",
    deliveryMethod: shipping.method,
    pickupPointId: undefined,
    note: "",
  };
}

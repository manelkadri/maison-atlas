import type { NextFunction, Request, RequestHandler, Response } from "express";
import { CUSTOMER_SESSION_COOKIE } from "../config/customer-auth";
import { passwordChangeRequired, unauthenticated } from "../utils/errors";
import { clearCustomerSessionCookie, resolveCustomerSession } from "../utils/customer-session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Cliente authentifiée (renseignée par `requireCustomer`). L'identité vient TOUJOURS d'ici, jamais du corps ni de l'URL. */
      customer?: { id: string; sessionId: string; mustChangePassword: boolean };
    }
  }
}

function customerGuard(options: { allowPasswordChangePending: boolean }): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[CUSTOMER_SESSION_COOKIE] as string | undefined;
    const session = await resolveCustomerSession(token);
    if (!session) {
      if (token) clearCustomerSessionCookie(res); // jeton périmé ou révoqué : le navigateur peut l'oublier
      throw unauthenticated("Connexion requise.");
    }
    req.customer = { id: session.customerId, sessionId: session.id, mustChangePassword: session.customer.mustChangePassword };
    // Après une réinitialisation par l'administrateur, le mot de passe provisoire doit être changé AVANT toute autre action.
    // Contrôlé ICI, côté serveur : une redirection du site ne suffirait pas (l'API serait appelable directement).
    if (session.customer.mustChangePassword && !options.allowPasswordChangePending) throw passwordChangeRequired();
    next();
  };
}

/**
 * Protège les routes réservées aux clientes connectées : cookie `customer_session` + session vérifiée en base à CHAQUE requête.
 * Refuse (403 `PASSWORD_CHANGE_REQUIRED`) une cliente dont le mot de passe provisoire n'a pas encore été changé.
 * Ne lit jamais le cookie admin ; la session admin ne lit jamais celui-ci (séparation totale).
 */
export const requireCustomer: RequestHandler = customerGuard({ allowPasswordChangePending: false });

/**
 * Variante pour les seules routes utiles AVANT le changement obligatoire : lire son profil (le site y découvre l'obligation)
 * et changer son mot de passe. Aucune autre route ne doit l'utiliser.
 */
export const requireCustomerAllowPasswordChange: RequestHandler = customerGuard({ allowPasswordChangePending: true });

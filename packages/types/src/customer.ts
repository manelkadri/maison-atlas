export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  wilayaCode: string;
  commune: string;
  address: string;
  /** Client ayant commandé sans créer de compte. */
  isGuest: boolean;
  createdAt: string;
};

/** Vue agrégée pour l'admin (calculée à partir des commandes). */
export type CustomerSummary = Customer & {
  ordersCount: number;
  /** Somme des commandes livrées uniquement (CA réellement encaissé). */
  totalSpent: number;
  lastOrderAt: string | null;
};

/** Compte client tel que renvoyé par l'API d'authentification (jamais de hachage ni de jeton). */
export type CustomerAccount = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  wilayaCode: string;
  commune: string;
  address: string;
  /** Vrai après une réinitialisation par l'administrateur : le mot de passe provisoire doit être changé. */
  mustChangePassword: boolean;
};

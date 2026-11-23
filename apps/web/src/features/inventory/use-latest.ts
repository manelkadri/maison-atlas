"use client";

import { useState } from "react";

/**
 * Conserve la dernière valeur définie : pendant le rechargement d'une requête dont la clé change
 * (frappe dans une recherche), on continue d'afficher les résultats précédents au lieu d'un squelette qui clignote.
 */
export function useLatest<T>(value: T | undefined): T | undefined {
  const [kept, setKept] = useState<T | undefined>(value);
  if (value !== undefined && value !== kept) setKept(value);
  return value ?? kept;
}

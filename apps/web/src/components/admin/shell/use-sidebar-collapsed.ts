"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "fashion-admin-sidebar-collapsed";

let memory: boolean | null = null;
const listeners = new Set<() => void>();

function readStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // stockage indisponible (navigation privée, etc.)
  }
}

const getSnapshot = (): boolean => memory ?? readStorage();
const getServerSnapshot = (): boolean => false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      memory = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** État rétracté/déployé de la sidebar, mémorisé en localStorage (avec repli mémoire si indisponible). */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setCollapsed = useCallback((value: boolean) => {
    memory = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignoré : l'état reste en mémoire pour la session */
    }
    listeners.forEach((l) => l());
  }, []);
  return [collapsed, setCollapsed];
}

"use client";

import Link from "next/link";
import { storeNav } from "@/config/site";
import { cn } from "@/lib/utils";
import { useNavActive } from "./use-nav-active";

/** Navigation principale (desktop). Le lien actif est souligné et marqué `aria-current`. */
export function MainNav({ className }: { className?: string }) {
  const isActive = useNavActive();
  return (
    <nav aria-label="Navigation principale" className={cn("items-center gap-1", className)}>
      {storeNav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 items-center rounded-sm px-3 text-sm transition-colors",
              "after:bg-foreground after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-300",
              "hover:text-foreground hover:after:scale-x-100",
              active ? "text-foreground font-medium after:scale-x-100" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Version sans état actif, affichée pendant la suspension de `useSearchParams`. */
export function MainNavFallback({ className }: { className?: string }) {
  return (
    <nav aria-label="Navigation principale" className={cn("items-center gap-1", className)}>
      {storeNav.map((item) => (
        <Link key={item.href} href={item.href} className="text-muted-foreground inline-flex h-10 items-center px-3 text-sm">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import { Heart, Menu, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StoreLogo } from "@/components/ui/store-logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { storeNav } from "@/config/site";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/product.types";
import { categoryHref, getChildCategories, getRootCategories } from "./category-links";
import { useNavActive } from "./use-nav-active";

const accountLinks = [
  { label: "Mon compte", href: "/account", icon: User },
  { label: "Mes favoris", href: "/favorites", icon: Heart },
  { label: "Mon panier", href: "/cart", icon: ShoppingBag },
] as const;

/** Menu mobile : tiroir à gauche, liens larges (≥ 44 px), catégories dépliables, liens compte. */
export function MobileMenu({ storeName, logoUrl, categories }: { storeName: string; logoUrl?: string; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const isActive = useNavActive();
  const roots = getRootCategories(categories).filter((c) => c.kind === "category");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-sm gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display text-xl">
            <StoreLogo logoUrl={logoUrl} storeName={storeName} imageClassName="h-12 max-w-56" />
          </SheetTitle>
          <SheetDescription className="sr-only">Navigation principale de la boutique</SheetDescription>
        </SheetHeader>

        <nav aria-label="Menu principal" className="px-2 py-3">
          <ul>
            {storeNav.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center rounded-md px-3 text-lg transition-colors",
                        active ? "bg-accent font-medium" : "hover:bg-accent/60",
                      )}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>

        {roots.length > 0 && (
          <div className="border-t px-5 py-3">
            <p className="eyebrow pt-2 pb-1">Catégories</p>
            <Accordion type="multiple">
              {roots.map((root) => {
                const children = getChildCategories(categories, root.id);
                return (
                  <AccordionItem key={root.id} value={root.id}>
                    {children.length > 0 ? (
                      <>
                        <AccordionTrigger className="min-h-12 py-3 text-base">{root.name}</AccordionTrigger>
                        <AccordionContent>
                          <ul className="pb-1">
                            <li>
                              <SheetClose asChild>
                                <Link href={categoryHref(root)} className="text-muted-foreground flex min-h-11 items-center text-sm hover:underline">
                                  Voir tout : {root.name}
                                </Link>
                              </SheetClose>
                            </li>
                            {children.map((child) => (
                              <li key={child.id}>
                                <SheetClose asChild>
                                  <Link href={categoryHref(child)} className="flex min-h-11 items-center text-sm hover:underline">
                                    {child.name}
                                  </Link>
                                </SheetClose>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </>
                    ) : (
                      <SheetClose asChild>
                        <Link href={categoryHref(root)} className="flex min-h-12 items-center py-3 text-base hover:underline">
                          {root.name}
                        </Link>
                      </SheetClose>
                    )}
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        <div className="mt-auto border-t px-2 py-3">
          <ul>
            {accountLinks.map(({ label, href, icon: Icon }) => (
              <li key={href}>
                <SheetClose asChild>
                  <Link href={href} className="hover:bg-accent/60 flex min-h-12 items-center gap-3 rounded-md px-3 text-base">
                    <Icon className="text-muted-foreground size-5" aria-hidden />
                    {label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

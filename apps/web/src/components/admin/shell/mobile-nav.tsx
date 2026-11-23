"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";

/** Drawer de navigation pour mobile et tablette (< lg). */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 max-w-[85vw] gap-0 p-0 sm:max-w-72 [&>button]:text-white"
      >
        <SheetTitle className="sr-only">Navigation de l&apos;administration</SheetTitle>
        <SheetDescription className="sr-only">Menu principal du tableau de bord</SheetDescription>
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

import { TriangleAlert } from "lucide-react";
import { isApiMode } from "@/lib/api-config";
import { cn } from "@/lib/utils";

/** Avertissement affiché UNIQUEMENT en mode démonstration (données locales) : en mode API, les comptes sont réels et sécurisés. */
export function DemoBanner({ className }: { className?: string }) {
  if (isApiMode()) return null;
  return (
    <div role="note" className={cn("bg-warning-soft text-foreground border-warning/40 flex gap-3 rounded-md border p-4 text-sm leading-relaxed", className)}>
      <TriangleAlert className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
      <p>
        <strong className="font-semibold">Mode démonstration</strong> — les comptes sont simulés dans ce navigateur : le mot de passe n&apos;est pas vérifié.
        L&apos;authentification réelle est assurée par le serveur.
      </p>
    </div>
  );
}

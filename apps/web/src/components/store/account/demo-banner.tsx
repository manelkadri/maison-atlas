import { TriangleAlert } from "lucide-react";
import { isApiMode } from "@/lib/api-config";
import { cn } from "@/lib/utils";

/** Avertissement permanent : l'espace client est simulé et NON sécurisé. */
export function DemoBanner({ className }: { className?: string }) {
  // Mode API : plus de simulation de commandes ; le profil reste une simple mémoire locale de l'appareil.
  if (isApiMode()) {
    return (
      <div role="note" className={cn("bg-secondary text-foreground flex gap-3 rounded-md p-4 text-sm leading-relaxed", className)}>
        <TriangleAlert className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          Cet espace est enregistré sur cet appareil uniquement : il n&apos;y a pas de compte. Vos commandes se retrouvent grâce à leur numéro et au
          téléphone utilisé.
        </p>
      </div>
    );
  }
  return (
    <div role="note" className={cn("bg-warning-soft text-foreground border-warning/40 flex gap-3 rounded-md border p-4 text-sm leading-relaxed", className)}>
      <TriangleAlert className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
      <p>
        <strong className="font-semibold">Mode démonstration</strong> — cet espace n&apos;est pas sécurisé : l&apos;accès se fait par simple numéro de téléphone.
        L&apos;authentification réelle sera ajoutée avec le serveur.
      </p>
    </div>
  );
}

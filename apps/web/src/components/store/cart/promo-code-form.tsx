"use client";

import { formatDZD } from "@fashion/shared";
import { Check, Loader2, Tag, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useCartPromo } from "@/features/cart/hooks";

type PromoCodeFormProps = {
  promo: ReturnType<typeof useCartPromo>;
};

/** Champ « code promo » : validation par le service, remise affichée, retrait possible. */
export function PromoCodeForm({ promo }: PromoCodeFormProps) {
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const result = await promo.apply(code);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setCode("");
    toast.success("Code promotionnel appliqué");
  };

  // Un code est enregistré dans le panier : on affiche son état plutôt que le champ.
  if (promo.storedCode) {
    return (
      <div className="space-y-2">
        <div className="bg-secondary flex items-center justify-between gap-3 rounded-md px-3.5 py-3 text-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            {promo.isChecking ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : promo.activeCode ? (
              <Check className="text-success size-4 shrink-0" aria-hidden />
            ) : (
              <Tag className="text-warning size-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-medium">{promo.storedCode}</p>
              {promo.activeCode && (
                <p className="text-muted-foreground text-xs">
                  {promo.label ? `${promo.label} · ` : ""}-{formatDZD(promo.discount)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={promo.remove}
            aria-label={`Retirer le code promotionnel ${promo.storedCode}`}
            className="text-muted-foreground hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {promo.invalidReason && (
          <p role="alert" className="text-warning text-xs">
            Ce code n&apos;est plus applicable : {promo.invalidReason}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        Code promotionnel
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(undefined);
          }}
          placeholder="Saisissez votre code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-11 uppercase"
        />
        <Button type="submit" variant="outline" className="h-11 px-5" disabled={promo.isApplying}>
          {promo.isApplying && <Loader2 className="animate-spin" aria-hidden />}
          Appliquer
        </Button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}

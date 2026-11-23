"use client";

import { formatDZD } from "@fashion/shared";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useValidatePromoCode } from "@/features/promotions/hooks";
import { formatPromotionValue } from "@/features/promotions/logic";
import { getErrorMessage } from "@/services";
import type { PromotionValidation } from "@/types/promotion.types";

/**
 * Simulateur « Tester un code » : appelle exactement la même validation que la boutique
 * (`validateCode`), donc le résultat est ce que verra le client au panier.
 */
export function PromoTester() {
  const validate = useValidatePromoCode();
  const [code, setCode] = useState("");
  const [subtotal, setSubtotal] = useState("10000");
  const [result, setResult] = useState<{ subtotal: number; validation: PromotionValidation } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const amount = Number(subtotal);
    if (!code.trim()) return setFormError("Saisissez un code à tester.");
    if (!Number.isFinite(amount) || amount < 0) return setFormError("Saisissez un sous-total valide (en DA).");
    setFormError(null);
    try {
      const validation = await validate.mutateAsync({ code: code.trim(), subtotal: amount });
      setResult({ subtotal: amount, validation });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="text-muted-foreground size-4" aria-hidden /> Tester un code
        </CardTitle>
        <CardDescription>Simulez un panier : le résultat est identique à ce que verra le client.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <form onSubmit={run} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="tester-code">Code</Label>
            <Input
              id="tester-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BIENVENUE10"
              autoComplete="off"
              aria-invalid={!!formError && !code.trim()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tester-subtotal">Sous-total du panier (DA)</Label>
            <Input id="tester-subtotal" type="number" inputMode="numeric" min={0} step={100} value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
          </div>
          <Button type="submit" disabled={validate.isPending}>
            {validate.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Tester
          </Button>
        </form>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <div aria-live="polite">
          {result &&
            (result.validation.valid ? (
              <div className="bg-success-soft text-success flex items-start gap-3 rounded-md p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="space-y-0.5">
                  <p className="font-medium">
                    Code valide ({formatPromotionValue(result.validation.promotion)}) : remise de {formatDZD(result.validation.discount)}
                  </p>
                  <p className="tabular-nums">
                    Sous-total {formatDZD(result.subtotal)} → {formatDZD(result.subtotal - result.validation.discount)} (hors livraison)
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-destructive-soft text-destructive flex items-start gap-3 rounded-md p-3 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Code refusé</p>
                  <p>{result.validation.reason}</p>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

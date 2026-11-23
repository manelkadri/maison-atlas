"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copie le code dans le presse-papiers (avec retour visuel et repli en cas de refus du navigateur). */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Code ${code} copié.`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible : sélectionnez le code et copiez-le manuellement.");
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label={`Copier le code ${code}`} title="Copier le code">
      {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}

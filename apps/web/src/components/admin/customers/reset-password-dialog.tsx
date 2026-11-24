"use client";

import { adminResetCustomerPasswordSchema } from "@fashion/validators";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useResetCustomerPassword } from "@/features/customers/hooks";
import { getErrorMessage } from "@/services";

type ResetPasswordDialogProps = {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Réinitialisation du mot de passe d'une cliente par l'administrateur.
 * - ré-authentification : l'administrateur ressaisit SON mot de passe (une session volée ne suffit pas) ;
 * - le mot de passe provisoire est affiché UNE SEULE FOIS : il n'est ni conservé par le site ni récupérable ensuite ;
 * - la cliente devra le changer à sa première connexion ; ses sessions en cours sont fermées.
 */
export function ResetPasswordDialog({ customerId, customerName, open, onOpenChange }: ResetPasswordDialogProps) {
  const reset = useResetCustomerPassword();
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [temporary, setTemporary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      // Tout est effacé à la fermeture : le mot de passe provisoire ne reste nulle part dans l'interface.
      setAdminPassword("");
      setError(null);
      setTemporary(null);
      setCopied(false);
      reset.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = adminResetCustomerPasswordSchema.safeParse({ adminPassword });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Votre mot de passe est obligatoire.");
    setError(null);
    reset.mutate(
      { customerId, adminPassword: parsed.data.adminPassword },
      {
        onSuccess: (result) => {
          setAdminPassword("");
          setTemporary(result.temporaryPassword);
        },
        onError: (err) => {
          setAdminPassword("");
          setError(getErrorMessage(err));
        },
      },
    );
  };

  const copy = async () => {
    if (!temporary) return;
    try {
      await navigator.clipboard.writeText(temporary);
      setCopied(true);
      toast.success("Mot de passe provisoire copié");
    } catch {
      toast.error("Copie impossible : recopiez-le manuellement.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {temporary
              ? `Mot de passe provisoire de ${customerName}.`
              : `Un mot de passe provisoire sera créé pour ${customerName}. Ses sessions en cours seront fermées et elle devra le changer à sa prochaine connexion.`}
          </DialogDescription>
        </DialogHeader>

        {temporary ? (
          <div className="space-y-4">
            <div className="bg-secondary flex items-center justify-between gap-3 rounded-md p-4">
              <code className="font-mono text-lg font-semibold tracking-wide select-all" data-testid="temporary-password">
                {temporary}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={() => void copy()} aria-label="Copier le mot de passe provisoire">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            </div>
            <p role="note" className="text-sm leading-relaxed">
              <strong>Il ne sera plus affiché.</strong> Communiquez-le à la cliente par un canal sûr (appel téléphonique, en main propre) : jamais par un
              message public. Si vous le perdez, relancez une réinitialisation.
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => close(false)}>
                J&apos;ai noté le mot de passe
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Confirmer la réinitialisation">
            <FormField label="Votre mot de passe administrateur" htmlFor="reset-admin-password" error={error ?? undefined} required>
              <Input
                id="reset-admin-password"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "reset-admin-password-error" : undefined}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                Réinitialiser
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

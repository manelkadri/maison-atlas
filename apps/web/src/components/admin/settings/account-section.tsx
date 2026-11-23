"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminChangeEmailSchema,
  adminChangePasswordFormSchema,
  type AdminChangeEmailValues,
  type AdminChangePasswordFormValues,
} from "@fashion/validators";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { authService, getErrorMessage } from "@/services";
import { useAdminSessionStore } from "@/stores/admin-session.store";

/** Champ mot de passe avec bouton « afficher / masquer ». */
function PasswordInput({
  id,
  error,
  autoComplete,
  registration,
}: {
  id: string;
  error?: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="pr-10"
        {...registration}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminChangePasswordFormValues>({
    resolver: zodResolver(adminChangePasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: AdminChangePasswordFormValues) => {
    try {
      await authService.changePassword(values.currentPassword, values.newPassword);
      reset();
      toast.success("Mot de passe modifié. Utilisez-le à votre prochaine connexion.");
    } catch (error) {
      const message = getErrorMessage(error, "Impossible de modifier le mot de passe.");
      setError("currentPassword", { message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Changer le mot de passe">
      <FormField label="Mot de passe actuel" htmlFor="acc-current" error={errors.currentPassword?.message} required>
        <PasswordInput id="acc-current" autoComplete="current-password" error={errors.currentPassword?.message} registration={register("currentPassword")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nouveau mot de passe" htmlFor="acc-new" error={errors.newPassword?.message} hint="12 caractères minimum." required>
          <PasswordInput id="acc-new" autoComplete="new-password" error={errors.newPassword?.message} registration={register("newPassword")} />
        </FormField>
        <FormField label="Confirmer le nouveau mot de passe" htmlFor="acc-confirm" error={errors.confirmPassword?.message} required>
          <PasswordInput id="acc-confirm" autoComplete="new-password" error={errors.confirmPassword?.message} registration={register("confirmPassword")} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}

function ChangeEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const login = useAdminSessionStore((s) => s.login);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminChangeEmailValues>({
    resolver: zodResolver(adminChangeEmailSchema),
    defaultValues: { currentPassword: "", newEmail: "" },
  });
  const [visible, setVisible] = useState(false);

  const onSubmit = async (values: AdminChangeEmailValues) => {
    try {
      const session = await authService.changeEmail(values.currentPassword, values.newEmail);
      login(session.email);
      getQueryClient().setQueryData(queryKeys.auth.me, session);
      reset();
      toast.success("Adresse e-mail modifiée.");
    } catch (error) {
      const message = getErrorMessage(error, "Impossible de modifier l'adresse e-mail.");
      // Un conflit (adresse déjà prise) concerne le nouvel e-mail ; tout le reste vient du mot de passe actuel.
      const field = message.includes("déjà utilisée") ? "newEmail" : "currentPassword";
      setError(field, { message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Changer l'adresse e-mail">
      {currentEmail && (
        <p className="text-muted-foreground text-sm">
          Adresse actuelle : <strong className="text-foreground font-medium">{currentEmail}</strong>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nouvelle adresse e-mail" htmlFor="acc-email" error={errors.newEmail?.message} required>
          <Input
            id="acc-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.newEmail}
            aria-describedby={errors.newEmail ? "acc-email-error" : undefined}
            {...register("newEmail")}
          />
        </FormField>
        <FormField label="Mot de passe actuel" htmlFor="acc-email-pw" error={errors.currentPassword?.message} required>
          <div className="relative">
            <Input
              id="acc-email-pw"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              aria-describedby={errors.currentPassword ? "acc-email-pw-error" : undefined}
              className="pr-10"
              {...register("currentPassword")}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={visible}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
            >
              {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Changer l&apos;e-mail
        </Button>
      </div>
    </form>
  );
}

/**
 * Sécurité du compte propriétaire (mode API uniquement : en mode démonstration la connexion est simulée).
 * Chaque changement redemande le mot de passe actuel ; une erreur s'affiche sous le champ concerné.
 */
export function AccountSection() {
  const email = useAdminSessionStore((s) => s.email);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Mot de passe</h3>
        <ChangePasswordForm />
      </div>
      <div className="border-t pt-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Adresse e-mail de connexion</h3>
          <ChangeEmailForm currentEmail={email} />
        </div>
      </div>
    </div>
  );
}

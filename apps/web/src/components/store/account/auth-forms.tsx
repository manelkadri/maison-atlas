"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  customerAccountLoginSchema,
  customerChangePasswordSchema,
  customerRegisterSchema,
  type CustomerAccountLoginValues,
  type CustomerChangePasswordValues,
  type CustomerRegisterValues,
} from "@fashion/validators";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { WilayaSelect } from "@/components/store/checkout/wilaya-select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useChangePassword, useLogin, useRegister } from "@/features/account/hooks";
import { getErrorMessage } from "@/services";

/** Champs saisis : `address` est facultative (le schéma la complète par une chaîne vide). */
type RegisterFormValues = Omit<CustomerRegisterValues, "address"> & { address?: string };

const CONFIRM_MISMATCH = "Les deux mots de passe ne correspondent pas.";

function field(id: string, error?: string) {
  return { id, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined };
}

/** Connexion : téléphone + mot de passe. Le message d'échec est unique (rien ne révèle si le numéro existe). */
export function LoginPanel({ onSwitch }: { onSwitch: () => void }) {
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerAccountLoginValues>({ resolver: zodResolver(customerAccountLoginSchema), defaultValues: { phone: "", password: "" } });

  const onSubmit = async (values: CustomerAccountLoginValues) => {
    setServerError(null);
    try {
      const account = await login.mutateAsync(values);
      toast.success(`Bonjour ${account.firstName}`);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-5" aria-label="Connexion">
      <FormField label="Numéro de téléphone" htmlFor="login-phone" error={errors.phone?.message} required>
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="0555 12 34 56"
          className="h-12"
          {...field("login-phone", errors.phone?.message)}
          {...register("phone")}
        />
      </FormField>
      <FormField label="Mot de passe" htmlFor="login-password" error={errors.password?.message} required>
        <Input type="password" autoComplete="current-password" className="h-12" {...field("login-password", errors.password?.message)} {...register("password")} />
      </FormField>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending} className="h-12 w-full">
        {login.isPending ? "Connexion…" : "Me connecter"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Pas encore de compte ?{" "}
        <button type="button" onClick={onSwitch} className="text-foreground font-medium underline underline-offset-4">
          Créer un compte
        </button>
      </p>
      <p className="text-muted-foreground text-center text-sm">
        Mot de passe oublié ? Contactez la boutique : nous vous remettrons un mot de passe provisoire.{" "}
        <Link href="/track" className="text-foreground underline underline-offset-4">
          Suivre une commande sans compte
        </Link>
      </p>
    </form>
  );
}

/** Création de compte : coordonnées de livraison habituelles + mot de passe. La session est ouverte aussitôt. */
export function RegisterPanel({ onSwitch }: { onSwitch: () => void }) {
  const register_ = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues, unknown, CustomerRegisterValues>({
    resolver: zodResolver(customerRegisterSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", wilayaCode: "", commune: "", address: "", password: "" },
  });

  const onSubmit = async (values: CustomerRegisterValues) => {
    setServerError(null);
    if (values.password !== confirm) return setConfirmError(CONFIRM_MISMATCH);
    setConfirmError(null);
    try {
      const account = await register_.mutateAsync(values);
      toast.success(`Bienvenue ${account.firstName}`);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-5" aria-label="Créer un compte">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="register-first-name" error={errors.firstName?.message} required>
          <Input autoComplete="given-name" className="h-12" {...field("register-first-name", errors.firstName?.message)} {...register("firstName")} />
        </FormField>
        <FormField label="Nom" htmlFor="register-last-name" error={errors.lastName?.message} required>
          <Input autoComplete="family-name" className="h-12" {...field("register-last-name", errors.lastName?.message)} {...register("lastName")} />
        </FormField>
      </div>
      <FormField
        label="Numéro de téléphone"
        htmlFor="register-phone"
        error={errors.phone?.message}
        hint="C'est votre identifiant de connexion. Exemple : 0555 12 34 56."
        required
      >
        <Input type="tel" inputMode="tel" autoComplete="username" className="h-12" {...field("register-phone", errors.phone?.message)} {...register("phone")} />
      </FormField>
      <FormField label="E-mail (facultatif)" htmlFor="register-email" error={errors.email?.message}>
        <Input type="email" inputMode="email" autoComplete="email" className="h-12" {...field("register-email", errors.email?.message)} {...register("email")} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Wilaya" htmlFor="register-wilaya" error={errors.wilayaCode?.message} required>
          <Controller
            control={control}
            name="wilayaCode"
            render={({ field: f }) => (
              <WilayaSelect
                id="register-wilaya"
                value={f.value}
                onChange={f.onChange}
                ref={f.ref}
                invalid={!!errors.wilayaCode}
                describedBy={errors.wilayaCode ? "register-wilaya-error" : undefined}
                className="h-12"
              />
            )}
          />
        </FormField>
        <FormField label="Commune" htmlFor="register-commune" error={errors.commune?.message} required>
          <Input autoComplete="address-level2" className="h-12" {...field("register-commune", errors.commune?.message)} {...register("commune")} />
        </FormField>
      </div>
      <FormField label="Adresse (facultatif)" htmlFor="register-address" error={errors.address?.message}>
        <Input autoComplete="street-address" className="h-12" {...field("register-address", errors.address?.message)} {...register("address")} />
      </FormField>
      <FormField label="Mot de passe" htmlFor="register-password" error={errors.password?.message} hint="8 caractères minimum, sans espace." required>
        <Input type="password" autoComplete="new-password" className="h-12" {...field("register-password", errors.password?.message)} {...register("password")} />
      </FormField>
      <FormField label="Confirmer le mot de passe" htmlFor="register-confirm" error={confirmError ?? undefined} required>
        <Input
          type="password"
          autoComplete="new-password"
          className="h-12"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          {...field("register-confirm", confirmError ?? undefined)}
        />
      </FormField>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={register_.isPending} className="h-12 w-full">
        {register_.isPending ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Déjà un compte ?{" "}
        <button type="button" onClick={onSwitch} className="text-foreground font-medium underline underline-offset-4">
          Me connecter
        </button>
      </p>
    </form>
  );
}

/** Connexion / création de compte (sert à la page « Mon espace » et au paiement : le panier est conservé). */
export function AuthPanel({ title = "Accéder à mon espace", intro }: { title?: string; intro?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl sm:text-4xl">{mode === "login" ? title : "Créer mon compte"}</h1>
      {intro && <p className="text-muted-foreground mt-3 leading-relaxed">{intro}</p>}
      <div className="bg-card mt-6 rounded-md border p-5 sm:p-6">
        {mode === "login" ? <LoginPanel onSwitch={() => setMode("register")} /> : <RegisterPanel onSwitch={() => setMode("login")} />}
      </div>
    </div>
  );
}

/**
 * Changement du mot de passe : mot de passe actuel exigé. Toutes les sessions sont révoquées puis une session neuve est ouverte
 * (le serveur remplace le cookie). `forced` : mot de passe provisoire remis par la boutique, à changer avant toute autre action.
 */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const change = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerChangePasswordValues>({ resolver: zodResolver(customerChangePasswordSchema), defaultValues: { currentPassword: "", newPassword: "" } });

  const onSubmit = async (values: CustomerChangePasswordValues) => {
    setServerError(null);
    if (values.newPassword !== confirm) return setConfirmError(CONFIRM_MISMATCH);
    setConfirmError(null);
    try {
      await change.mutateAsync(values);
      reset();
      setConfirm("");
      toast.success("Mot de passe modifié");
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="bg-card max-w-xl space-y-5 rounded-md border p-5 sm:p-6"
      aria-label={forced ? "Choisir un nouveau mot de passe" : "Changer mon mot de passe"}
    >
      {forced && (
        <p role="note" className="bg-secondary rounded-md p-4 text-sm leading-relaxed">
          Vous vous êtes connecté avec un mot de passe provisoire. Choisissez maintenant votre propre mot de passe pour continuer.
        </p>
      )}
      <FormField label={forced ? "Mot de passe provisoire" : "Mot de passe actuel"} htmlFor="password-current" error={errors.currentPassword?.message} required>
        <Input type="password" autoComplete="current-password" className="h-12" {...field("password-current", errors.currentPassword?.message)} {...register("currentPassword")} />
      </FormField>
      <FormField label="Nouveau mot de passe" htmlFor="password-new" error={errors.newPassword?.message} hint="8 caractères minimum, sans espace." required>
        <Input type="password" autoComplete="new-password" className="h-12" {...field("password-new", errors.newPassword?.message)} {...register("newPassword")} />
      </FormField>
      <FormField label="Confirmer le nouveau mot de passe" htmlFor="password-confirm" error={confirmError ?? undefined} required>
        <Input
          type="password"
          autoComplete="new-password"
          className="h-12"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          {...field("password-confirm", confirmError ?? undefined)}
        />
      </FormField>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={change.isPending} className="h-12 px-8">
        {change.isPending ? "Enregistrement…" : "Changer mon mot de passe"}
      </Button>
    </form>
  );
}

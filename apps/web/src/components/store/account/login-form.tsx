"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { customerLoginSchema, profileSchema, type CustomerLoginValues, type ProfileValues } from "@fashion/validators";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { customerService, getErrorMessage } from "@/services";
import { useCustomerSessionStore } from "@/stores/customer-session.store";
import { DemoBanner } from "./demo-banner";

function PhoneStep({ onUnknown }: { onUnknown: (phone: string) => void }) {
  const signIn = useCustomerSessionStore((s) => s.signIn);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerLoginValues>({ resolver: zodResolver(customerLoginSchema), defaultValues: { phone: "" } });

  const onSubmit = async ({ phone }: CustomerLoginValues) => {
    try {
      const customer = await customerService.findByPhone(phone);
      if (customer) {
        signIn({ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email ?? "" });
        toast.success(`Bonjour ${customer.firstName}`);
      } else {
        onUnknown(phone);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label="Accéder à mon espace">
      <FormField
        label="Numéro de téléphone"
        htmlFor="login-phone"
        error={errors.phone?.message}
        hint="Le numéro utilisé pour vos commandes. Exemple : 0555 12 34 56."
        required
      >
        <Input
          id="login-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0555 12 34 56"
          className="h-12"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "login-phone-error" : undefined}
          {...register("phone")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting} className="h-12 w-full">
        {isSubmitting ? "Vérification…" : "Continuer"}
      </Button>
    </form>
  );
}

function IdentityStep({ phone, onBack }: { phone: string; onBack: () => void }) {
  const signIn = useCustomerSessionStore((s) => s.signIn);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { firstName: "", lastName: "", phone, email: "" } });

  const onSubmit = (values: ProfileValues) => {
    signIn({ firstName: values.firstName, lastName: values.lastName, phone: values.phone, email: values.email ?? "" });
    toast.success(`Bienvenue ${values.firstName}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label="Créer mon espace">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Ce numéro ({phone}) n&apos;est associé à aucun client connu. Indiquez votre nom pour créer votre espace : vous retrouverez ensuite vos
        commandes passées avec ce numéro.
      </p>
      <input type="hidden" {...register("phone")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="login-first-name" error={errors.firstName?.message} required>
          <Input
            id="login-first-name"
            autoComplete="given-name"
            className="h-12"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "login-first-name-error" : undefined}
            {...register("firstName")}
          />
        </FormField>
        <FormField label="Nom" htmlFor="login-last-name" error={errors.lastName?.message} required>
          <Input
            id="login-last-name"
            autoComplete="family-name"
            className="h-12"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "login-last-name-error" : undefined}
            {...register("lastName")}
          />
        </FormField>
      </div>
      <FormField label="E-mail (facultatif)" htmlFor="login-email" error={errors.email?.message}>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-12"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          {...register("email")}
        />
      </FormField>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" className="h-12 sm:flex-1" onClick={onBack}>
          Changer de numéro
        </Button>
        <Button type="submit" size="lg" className="h-12 sm:flex-1">
          Accéder à mon espace
        </Button>
      </div>
    </form>
  );
}

/** Accès simulé à l'espace client : téléphone, puis nom si le numéro est inconnu. */
export function LoginForm() {
  const [unknownPhone, setUnknownPhone] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl sm:text-4xl">Accéder à mon espace</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">Retrouvez vos commandes et gérez vos informations.</p>
      <DemoBanner className="mt-6" />
      <div className="bg-card mt-6 rounded-md border p-5 sm:p-6">
        {unknownPhone === null ? (
          <PhoneStep onUnknown={setUnknownPhone} />
        ) : (
          <IdentityStep phone={unknownPhone} onBack={() => setUnknownPhone(null)} />
        )}
      </div>
    </div>
  );
}

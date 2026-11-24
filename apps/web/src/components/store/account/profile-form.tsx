"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { customerProfileUpdateSchema, type CustomerProfileUpdateValues } from "@fashion/validators";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { WilayaSelect } from "@/components/store/checkout/wilaya-select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useAccount, useUpdateProfile } from "@/features/account/hooks";
import { getErrorMessage } from "@/services";
import type { CustomerAccount } from "@/types/customer.types";
import { ChangePasswordForm } from "./auth-forms";

const attrs = (id: string, error?: string) => ({ id, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined });

function toFormValues(account: CustomerAccount): CustomerProfileUpdateValues {
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email ?? "",
    wilayaCode: account.wilayaCode,
    commune: account.commune,
    address: account.address,
  };
}

function ProfileFields({ account }: { account: CustomerAccount }) {
  const update = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CustomerProfileUpdateValues>({ resolver: zodResolver(customerProfileUpdateSchema), defaultValues: toFormValues(account) });

  const onSubmit = async (values: CustomerProfileUpdateValues) => {
    setServerError(null);
    try {
      const saved = await update.mutateAsync(values);
      reset(toFormValues(saved));
      toast.success("Profil mis à jour");
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="bg-card max-w-xl space-y-5 rounded-md border p-5 sm:p-6" aria-label="Mon profil">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="profile-first-name" error={errors.firstName?.message} required>
          <Input autoComplete="given-name" className="h-12" {...attrs("profile-first-name", errors.firstName?.message)} {...register("firstName")} />
        </FormField>
        <FormField label="Nom" htmlFor="profile-last-name" error={errors.lastName?.message} required>
          <Input autoComplete="family-name" className="h-12" {...attrs("profile-last-name", errors.lastName?.message)} {...register("lastName")} />
        </FormField>
      </div>
      <FormField
        label="Téléphone"
        htmlFor="profile-phone"
        hint="C'est l'identifiant de votre compte : il ne peut pas être modifié ici. Pour en changer, contactez la boutique."
      >
        <Input id="profile-phone" type="tel" readOnly value={account.phone} className="bg-muted h-12" />
      </FormField>
      <FormField label="E-mail (facultatif)" htmlFor="profile-email" error={errors.email?.message}>
        <Input type="email" inputMode="email" autoComplete="email" className="h-12" {...attrs("profile-email", errors.email?.message)} {...register("email")} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Wilaya" htmlFor="profile-wilaya" error={errors.wilayaCode?.message}>
          <Controller
            control={control}
            name="wilayaCode"
            render={({ field }) => <WilayaSelect id="profile-wilaya" value={field.value} onChange={(value) => field.onChange(value)} ref={field.ref} className="h-12" />}
          />
        </FormField>
        <FormField label="Commune" htmlFor="profile-commune" error={errors.commune?.message}>
          <Input autoComplete="address-level2" className="h-12" {...attrs("profile-commune", errors.commune?.message)} {...register("commune")} />
        </FormField>
      </div>
      <FormField label="Adresse" htmlFor="profile-address" error={errors.address?.message}>
        <Input autoComplete="street-address" className="h-12" {...attrs("profile-address", errors.address?.message)} {...register("address")} />
      </FormField>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 px-8" disabled={!isDirty || update.isPending}>
        Enregistrer les modifications
      </Button>
    </form>
  );
}

export function ProfileForm() {
  const { data: account } = useAccount();
  if (!account) return null;
  return (
    <div className="space-y-12">
      <div>
        <header className="mb-8">
          <p className="eyebrow">Mon espace</p>
          <h1 className="font-display mt-2 text-3xl sm:text-4xl">Mon profil</h1>
          <p className="text-muted-foreground mt-2">Ces coordonnées pré-remplissent votre prochaine commande.</p>
        </header>
        <ProfileFields account={account} />
      </div>
      <section aria-labelledby="security-title">
        <h2 id="security-title" className="font-display mb-4 text-2xl">
          Sécurité
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}

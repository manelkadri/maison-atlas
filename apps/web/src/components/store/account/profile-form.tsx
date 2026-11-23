"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileValues } from "@fashion/validators";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useCustomerSessionStore, type CustomerProfile } from "@/stores/customer-session.store";

function ProfileFields({ profile }: { profile: CustomerProfile }) {
  const updateProfile = useCustomerSessionStore((s) => s.updateProfile);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone, email: profile.email },
  });

  const onSubmit = (values: ProfileValues) => {
    updateProfile({ firstName: values.firstName, lastName: values.lastName, email: values.email ?? "" });
    reset(values);
    toast.success("Profil mis à jour");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-card max-w-xl space-y-5 rounded-md border p-5 sm:p-6" aria-label="Mon profil">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Prénom" htmlFor="profile-first-name" error={errors.firstName?.message} required>
          <Input
            id="profile-first-name"
            autoComplete="given-name"
            className="h-12"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "profile-first-name-error" : undefined}
            {...register("firstName")}
          />
        </FormField>
        <FormField label="Nom" htmlFor="profile-last-name" error={errors.lastName?.message} required>
          <Input
            id="profile-last-name"
            autoComplete="family-name"
            className="h-12"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "profile-last-name-error" : undefined}
            {...register("lastName")}
          />
        </FormField>
      </div>
      <FormField
        label="Téléphone"
        htmlFor="profile-phone"
        error={errors.phone?.message}
        hint="Ce numéro identifie votre espace et vos commandes. Pour en changer, déconnectez-vous puis reconnectez-vous avec le nouveau numéro."
      >
        <Input id="profile-phone" type="tel" readOnly className="bg-muted h-12" {...register("phone")} />
      </FormField>
      <FormField label="E-mail (facultatif)" htmlFor="profile-email" error={errors.email?.message}>
        <Input
          id="profile-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-12"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "profile-email-error" : undefined}
          {...register("email")}
        />
      </FormField>
      <Button type="submit" size="lg" className="h-12 px-8" disabled={!isDirty}>
        Enregistrer les modifications
      </Button>
    </form>
  );
}

export function ProfileForm() {
  const profile = useCustomerSessionStore((s) => s.profile);
  if (!profile) return null;
  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">Mon espace</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Mon profil</h1>
        <p className="text-muted-foreground mt-2">Vos informations sont enregistrées uniquement dans ce navigateur (mode démonstration).</p>
      </header>
      <ProfileFields profile={profile} />
    </div>
  );
}

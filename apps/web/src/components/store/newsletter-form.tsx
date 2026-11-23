"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { newsletterSchema, type NewsletterValues } from "@fashion/validators";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getErrorMessage, newsletterService } from "@/services";

// Conservés ici pour compatibilité : la logique de stockage local (mode mock) vit dans le service de newsletter.
export { NEWSLETTER_STORAGE_KEY, saveNewsletterEmail } from "@/services";

export function NewsletterForm({ className }: { className?: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  const onSubmit = async (values: NewsletterValues) => {
    try {
      // Mode mock : stockage local ; mode API : POST /newsletter (idempotent).
      await newsletterService.subscribe(values.email);
    } catch (error) {
      setError("email", { message: getErrorMessage(error, "Inscription impossible pour le moment. Veuillez réessayer.") });
      return;
    }
    reset();
    setSubscribed(true);
    toast.success("Merci, vous êtes inscrit");
  };

  if (subscribed) {
    return (
      <div className={cn("bg-success-soft text-success flex items-center justify-center gap-2 rounded-md px-4 py-4 text-sm font-medium", className)} role="status">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        Merci, vous êtes inscrit à la newsletter.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={className} aria-label="Inscription à la newsletter">
      <div className="flex flex-col gap-3 text-left sm:flex-row sm:items-start">
        <FormField label="Adresse e-mail" htmlFor="newsletter-email" error={errors.email?.message} className="flex-1 [&>label]:sr-only">
          <Input
            id="newsletter-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="votre@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "newsletter-email-error" : undefined}
            className="bg-card h-12"
            {...register("email")}
          />
        </FormField>
        <Button type="submit" size="lg" disabled={isSubmitting} className="h-12 px-8">
          S&apos;inscrire
        </Button>
      </div>
    </form>
  );
}

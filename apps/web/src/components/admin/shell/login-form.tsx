"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { adminLoginSchema, type AdminLoginValues } from "@fashion/validators";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { siteConfig } from "@/config/site";
import { useHydrated } from "@/hooks/use-hydrated";
import { isApiMode } from "@/lib/api-config";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { authService, getErrorMessage } from "@/services";
import { useAdminSessionStore } from "@/stores/admin-session.store";
import { ShellSkeleton } from "./session-guard";

/**
 * Connexion administrateur.
 * Mode mock : SIMULÉE — tout e-mail valide et tout mot de passe non vide ouvrent une session de démonstration.
 * Mode API : `authService.login` (cookie httpOnly posé par le serveur) ; l'échec affiche le message unique de l'API.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const isAuthenticated = useAdminSessionStore((s) => s.isAuthenticated);
  const login = useAdminSessionStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const apiMode = isApiMode();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Déjà connecté : on renvoie directement vers le dashboard.
  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace(ADMIN_ROOT);
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || isAuthenticated) return <ShellSkeleton />;

  const onSubmit = async (values: AdminLoginValues) => {
    setFormError(null);
    try {
      // Mock : petite latence simulée ; API : appel réel (le serveur renvoie un message unique en cas d'échec).
      const session = await authService.login(values.email, values.password);
      login(session.email);
      // Évite qu'une ancienne réponse « non connecté » (en cache) renvoie aussitôt vers la page de connexion.
      if (apiMode) getQueryClient().setQueryData(queryKeys.auth.me, session);
      toast.success(apiMode ? "Connexion réussie." : "Connexion réussie (session de démonstration).");
      router.replace(ADMIN_ROOT);
    } catch (error) {
      setFormError(getErrorMessage(error, "Connexion impossible. Veuillez réessayer."));
    }
  };

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center">
        <p className="eyebrow">{siteConfig.name}</p>
        <h1 className="font-display mt-2 text-2xl">Espace d&apos;administration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connectez-vous pour gérer la boutique.</p>
      </div>

      {!apiMode && (
        <div role="note" className="border-warning/40 bg-warning-soft text-foreground flex gap-3 rounded-md border p-3 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Mode démonstration :</strong> cette connexion est simulée et non sécurisée. Tout e-mail et mot de passe non vides
            sont acceptés. L&apos;authentification réelle (propriétaire unique) sera fournie par le serveur.
          </p>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Connexion administrateur">
            <FormField label="Adresse e-mail" htmlFor="admin-email" error={errors.email?.message} required>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="proprietaire@exemple.dz"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "admin-email-error" : undefined}
                {...register("email")}
              />
            </FormField>

            <FormField label="Mot de passe" htmlFor="admin-password" error={errors.password?.message} required>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "admin-password-error" : undefined}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </FormField>

            {formError && (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              {isSubmitting ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

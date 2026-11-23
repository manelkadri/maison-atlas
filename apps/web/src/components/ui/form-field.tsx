import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Enveloppe label + contrôle + message d'erreur/aide, à utiliser avec React Hook Form.
 * L'erreur est annoncée aux lecteurs d'écran (role="alert"). Le contrôle doit recevoir
 * `id={htmlFor}`, `aria-invalid={!!error}` et `aria-describedby={`${htmlFor}-error`}`.
 */
export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

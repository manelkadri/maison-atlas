import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/shell/login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <AdminLoginForm />
    </main>
  );
}

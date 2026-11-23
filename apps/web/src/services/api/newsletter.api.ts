import { apiFetch } from "@/lib/api-client";
import type { NewsletterService } from "../contracts";

export const apiNewsletterService: NewsletterService = {
  async subscribe(email) {
    await apiFetch<void>("/newsletter", { method: "POST", body: { email: email.trim() } });
  },
};

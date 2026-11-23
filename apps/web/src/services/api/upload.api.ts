import { apiFetch } from "@/lib/api-client";
import { validateImageFile } from "@/lib/image-utils";
import type { UploadService } from "../contracts";
import { ServiceError } from "../errors";

export const apiUploadService: UploadService = {
  async uploadImage(file) {
    const problem = validateImageFile(file);
    if (problem) throw new ServiceError("VALIDATION", problem);
    const form = new FormData();
    form.append("file", file);
    const result = await apiFetch<{ url: string; publicId?: string }>("/admin/uploads", { method: "POST", body: form });
    return { url: result.url };
  },
};

import type { Metadata } from "next";
import { ProfileForm } from "@/components/store/account/profile-form";

export const metadata: Metadata = { title: "Mon profil" };

export default function AccountProfilePage() {
  return <ProfileForm />;
}

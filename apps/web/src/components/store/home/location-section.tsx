import Link from "next/link";
import { StoreLocation } from "@/components/store/store-location";
import { settingsService } from "@/services";

/** Section « Notre boutique » de l'accueil : adresse, horaires et carte. */
export async function LocationSection() {
  const settings = await settingsService.getSettings();
  return (
    <section aria-labelledby="home-location-title" className="container-store py-16 lg:py-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">En boutique</p>
          <h2 id="home-location-title" className="font-display mt-3 text-3xl sm:text-4xl">
            Retrouvez-nous
          </h2>
        </div>
        <Link href="/contact" className="text-sm underline-offset-4 hover:underline">
          Tous les détails
        </Link>
      </div>
      <StoreLocation initialSettings={settings} headingId="home-location-title" />
    </section>
  );
}

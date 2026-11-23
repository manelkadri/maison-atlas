"use client";

import { Clock, HandCoins, Mail, MapPin, Phone, Truck, Undo2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { StoreLogo } from "@/components/ui/store-logo";
import { footerLinks, siteConfig, type NavItem } from "@/config/site";
import { useSettings } from "@/features/settings/hooks";
import type { StoreSettings } from "@/types/settings.types";

/** N'accepte que des URL http(s) pour les réseaux sociaux (jamais `javascript:` ni lien vide). */
export function safeExternalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function LinkColumn({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="eyebrow mb-4">{title}</h2>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-foreground/80 hover:text-foreground inline-flex min-h-10 items-center text-sm hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Reassurance({ icon, title, children, href }: { icon: ReactNode; title: string; children: ReactNode; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-start gap-4">
        <span className="text-brand mt-0.5 shrink-0">{icon}</span>
        <span>
          <span className="block text-sm font-medium group-hover:underline">{title}</span>
          <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">{children}</span>
        </span>
      </Link>
    </li>
  );
}

/** Pied de page : engagements livraison, liens réels (aucun "#"), contact et réseaux issus des paramètres. */
export function SiteFooter({ initialSettings }: { initialSettings?: StoreSettings }) {
  const { data: settings } = useSettings(initialSettings);
  const storeName = settings?.storeName || siteConfig.name;
  const socials = [
    { label: "Instagram", url: safeExternalUrl(settings?.social.instagram), Icon: InstagramIcon },
    { label: "TikTok", url: safeExternalUrl(settings?.social.tiktok), Icon: TikTokIcon },
  ].filter((s): s is { label: string; url: string; Icon: typeof InstagramIcon } => s.url !== null);

  return (
    <footer className="bg-background-secondary mt-24 border-t">
      <div className="container-store py-12">
        <ul className="grid gap-8 border-b pb-12 sm:grid-cols-3">
          <Reassurance icon={<Truck className="size-6" aria-hidden />} title="Livraison partout en Algérie" href="/info/livraison">
            À domicile ou en bureau de livraison, dans les 69 wilayas.
          </Reassurance>
          <Reassurance icon={<HandCoins className="size-6" aria-hidden />} title="Paiement à la livraison" href="/info/livraison">
            Vous réglez en espèces à la réception de votre commande.
          </Reassurance>
          <Reassurance icon={<Undo2 className="size-6" aria-hidden />} title="Retours & échanges" href="/info/retours">
            Une taille qui ne convient pas ? Consultez notre politique de retour.
          </Reassurance>
        </ul>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="max-w-xs">
            <Link href="/" className="font-display inline-block text-2xl" aria-label={`${storeName} — accueil`}>
              <StoreLogo logoUrl={settings?.logoUrl} storeName={storeName} imageClassName="h-20 max-w-64" />
            </Link>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{settings?.tagline || siteConfig.description}</p>
            {socials.length > 0 && (
              <ul className="mt-5 flex gap-1">
                {socials.map(({ label, url, Icon }) => (
                  <li key={label}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${storeName} sur ${label} (nouvel onglet)`}
                      className="hover:bg-accent flex size-11 items-center justify-center rounded-full transition-colors"
                    >
                      <Icon className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <LinkColumn title="Boutique" links={footerLinks.shop} />
          <LinkColumn title="Aide" links={footerLinks.help} />

          <div>
            <h2 className="eyebrow mb-4">Contact</h2>
            <address className="space-y-1 text-sm not-italic">
              {settings?.phone && (
                <a href={telHref(settings.phone)} className="hover:text-foreground text-foreground/80 flex min-h-10 items-center gap-3 hover:underline">
                  <Phone className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span>{settings.phone}</span>
                </a>
              )}
              {settings?.email && (
                <a href={`mailto:${settings.email}`} className="hover:text-foreground text-foreground/80 flex min-h-10 items-center gap-3 break-all hover:underline">
                  <Mail className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span>{settings.email}</span>
                </a>
              )}
              {settings?.address && (
                <Link href="/contact" className="text-foreground/80 hover:text-foreground flex gap-3 py-2 hover:underline">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {settings.address}
                    <span className="text-muted-foreground block text-xs">Voir le plan d&apos;accès</span>
                  </span>
                </Link>
              )}
              {settings?.openingHours && (
                <p className="text-foreground/80 flex gap-3 py-2">
                  <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="whitespace-pre-line">{settings.openingHours}</span>
                </p>
              )}
            </address>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} {storeName}. Tous droits réservés.
          </p>
          <nav aria-label="Informations légales">
            <ul className="flex flex-wrap gap-x-5">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

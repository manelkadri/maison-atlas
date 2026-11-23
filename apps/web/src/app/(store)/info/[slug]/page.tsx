import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShippingFeesTable } from "@/components/layout/shipping-fees-table";
import { siteConfig } from "@/config/site";
import { settingsService } from "@/services";
import { INFO_PAGES, getInfoPage, type InfoBlock } from "./content";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return INFO_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) return { title: "Page introuvable", robots: { index: false } };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/info/${page.slug}` },
    openGraph: { title: `${page.title} | ${siteConfig.name}`, description: page.description, url: `/info/${page.slug}` },
  };
}

function Block({ block, settings }: { block: InfoBlock; settings: Awaited<ReturnType<typeof settingsService.getSettings>> }) {
  switch (block.type) {
    case "p":
      return <p className="text-foreground/85 leading-relaxed">{block.text}</p>;
    case "list":
      return (
        <ul className="text-foreground/85 list-disc space-y-2 pl-5 leading-relaxed marker:text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="text-muted-foreground bg-card border-b px-4 py-2.5 text-left text-xs">{block.caption}</caption>
            <thead className="bg-secondary">
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-t">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={cell} scope="row" className="px-4 py-3 font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={`${cell}-${i}`} className="px-4 py-3">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "shipping-fees":
      return <ShippingFeesTable initialSettings={settings} />;
    case "notice":
      return (
        <p className="bg-warning-soft text-foreground/90 flex gap-3 rounded-md p-4 text-sm leading-relaxed" role="note">
          <Info className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{block.text}</span>
        </p>
      );
  }
}

export default async function InfoPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) notFound();
  const settings = await settingsService.getSettings();

  return (
    <div className="container-store py-12 lg:py-16">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <aside aria-label="Pages d'information" className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-3">Informations</p>
          <nav>
            <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {INFO_PAGES.map((item) => {
                const active = item.slug === page.slug;
                return (
                  <li key={item.slug} className="shrink-0">
                    <Link
                      href={`/info/${item.slug}`}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm whitespace-nowrap transition-colors ${
                        active ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <article className="max-w-3xl">
          <header className="reveal">
            <p className="eyebrow">{siteConfig.name}</p>
            <h1 className="font-display mt-3 text-3xl sm:text-4xl">{page.title}</h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">{page.intro}</p>
          </header>

          <div className="mt-10 space-y-10">
            {page.sections.map((section) => (
              <section key={section.heading} aria-labelledby={`s-${slugId(section.heading)}`} className="space-y-4">
                <h2 id={`s-${slugId(section.heading)}`} className="font-display text-xl sm:text-2xl">
                  {section.heading}
                </h2>
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} settings={settings} />
                ))}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function slugId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

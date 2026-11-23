import { NewsletterForm } from "@/components/store/newsletter-form";

/** Section newsletter de l'accueil (le formulaire est le seul composant client). */
export function NewsletterSection() {
  return (
    <section aria-labelledby="home-newsletter" className="bg-background-secondary">
      <div className="container-store py-16 text-center sm:py-24">
        <p className="eyebrow">Newsletter</p>
        <h2 id="home-newsletter" className="font-display mx-auto mt-3 max-w-xl text-3xl sm:text-4xl">
          Restez informé des nouvelles collections
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md leading-relaxed">
          Recevez en avant-première nos nouveautés et nos offres. Pas de spam, désinscription à tout moment.
        </p>
        <NewsletterForm className="mx-auto mt-8 max-w-md" />
      </div>
    </section>
  );
}

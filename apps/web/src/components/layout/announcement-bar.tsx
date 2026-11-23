/** Barre d'annonce fine au-dessus du header. */
export function AnnouncementBar() {
  return (
    <div className="bg-primary text-primary-foreground">
      <p className="container-store py-2 text-center text-xs tracking-wide">
        Paiement à la livraison <span aria-hidden>·</span> Livraison dans les 69 wilayas
      </p>
    </div>
  );
}

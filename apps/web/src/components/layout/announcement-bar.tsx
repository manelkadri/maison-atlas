const MESSAGES = [
  "Paiement à la livraison",
  "Livraison dans les 69 wilayas",
  "Échange et retour facilités",
  "Prix en DZD – Sans surprise",
] as const;

/**
 * Nombre de fois où la série de messages est répétée dans un groupe : un groupe doit être plus large que
 * l'écran pour qu'aucun vide n'apparaisse pendant le défilement (4 séries ≈ 4000 px, même sur très grand écran).
 */
const SETS_PER_GROUP = 4;

function MessageSet({ hidden }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center motion-reduce:flex-wrap motion-reduce:justify-center ${hidden ? "motion-reduce:hidden" : ""}`}
    >
      {MESSAGES.map((message) => (
        <li key={message} className="group flex items-center py-2 text-xs tracking-wide whitespace-nowrap">
          <span className="px-5">{message}</span>
          <span aria-hidden className="opacity-60 group-last:motion-reduce:hidden">
            ·
          </span>
        </li>
      ))}
    </ul>
  );
}

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 items-center motion-reduce:flex-wrap motion-reduce:justify-center ${hidden ? "motion-reduce:hidden" : ""}`}
    >
      {Array.from({ length: SETS_PER_GROUP }, (_, i) => (
        <MessageSet key={i} hidden={hidden || i > 0} />
      ))}
    </div>
  );
}

/**
 * Barre d'annonce au-dessus du header : les messages défilent en continu de droite à gauche (CSS pur, sans clic).
 * Le défilement s'arrête au survol. Deux groupes identiques bouclent sans coupure (`translateX(-50%)`) ; seuls la
 * première série est lue par les lecteurs d'écran. Avec « réduire les animations », la barre devient fixe et centrée.
 */
export function AnnouncementBar() {
  return (
    <div role="group" aria-label="Informations de la boutique" className="bg-primary text-primary-foreground overflow-hidden">
      <div className="animate-marquee pause-on-hover flex w-max motion-reduce:w-full motion-reduce:justify-center">
        <Group />
        <Group hidden />
      </div>
    </div>
  );
}

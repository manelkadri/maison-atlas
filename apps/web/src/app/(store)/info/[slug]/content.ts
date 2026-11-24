/**
 * Contenu éditorial des pages d'information (texte statique, en français).
 * Les textes juridiques sont des MODÈLES à faire valider par le propriétaire / un conseil juridique ;
 * les informations d'identification de la société sont volontairement laissées à « [À compléter] ».
 */

export type InfoBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; caption: string; head: string[]; rows: string[][] }
  | { type: "shipping-fees" }
  | { type: "notice"; text: string };

export type InfoSection = { heading: string; blocks: InfoBlock[] };

export type InfoPage = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  sections: InfoSection[];
};

const TEMPLATE_NOTICE: InfoBlock = {
  type: "notice",
  text: "Texte modèle à valider par le propriétaire de la boutique (et, si besoin, par un conseil juridique) avant la mise en ligne définitive. Les champs « [À compléter] » doivent être renseignés.",
};

export const INFO_PAGES: InfoPage[] = [
  {
    slug: "a-propos",
    title: "À propos de nous",
    description: "Maison Atlas, boutique de prêt-à-porter féminin et d'accessoires à Aïn Témouchent. Paiement à la livraison partout en Algérie.",
    intro: "Maison Atlas est une boutique de prêt-à-porter féminin et d'accessoires, installée à Aïn Témouchent et ouverte à toute l'Algérie.",
    sections: [
      {
        heading: "Notre boutique",
        blocks: [
          { type: "p", text: "Nous proposons des vêtements et des accessoires pour femme, choisis pour leur coupe, leur matière et leur facilité à se porter au quotidien." },
          { type: "p", text: "Vous pouvez venir essayer nos pièces en magasin, ou commander en ligne depuis chez vous." },
        ],
      },
      {
        heading: "Commander simplement",
        blocks: [
          {
            type: "list",
            items: [
              "Paiement à la livraison : vous ne payez qu'à la réception de votre commande, en espèces.",
              "Livraison dans les 69 wilayas, à domicile ou en bureau de livraison.",
              "Un échange est possible selon les conditions décrites dans la page « Retours & échanges ».",
            ],
          },
        ],
      },
      {
        heading: "Nous contacter",
        blocks: [
          { type: "p", text: "Une question sur une taille, une couleur ou une commande ? Retrouvez l'adresse, les horaires et le numéro de la boutique sur la page Contact : nous vous répondons avec plaisir." },
        ],
      },
    ],
  },
  {
    slug: "livraison",
    title: "Livraison",
    description: "Délais, tarifs et modes de livraison partout en Algérie. Paiement à la livraison.",
    intro: "Nous livrons dans les 69 wilayas, à domicile ou en bureau de livraison. Vous ne payez qu'à la réception de votre commande.",
    sections: [
      {
        heading: "Deux modes de livraison",
        blocks: [
          { type: "p", text: "Livraison à domicile : le livreur vous contacte et dépose votre colis à l'adresse indiquée lors de la commande." },
          { type: "p", text: "Livraison en bureau : vous choisissez un bureau de livraison de votre wilaya et récupérez votre colis à votre convenance, sur présentation d'une pièce d'identité. Ce mode est généralement moins coûteux." },
        ],
      },
      {
        heading: "Tarifs de livraison",
        blocks: [
          { type: "p", text: "Les frais de livraison dépendent de la wilaya de destination et du mode choisi. Ils sont affichés séparément du prix des articles, avant la validation de votre commande." },
          { type: "shipping-fees" },
        ],
      },
      {
        heading: "Délais",
        blocks: [
          { type: "p", text: "Une fois la commande confirmée par notre équipe (par téléphone si nécessaire), elle est préparée puis expédiée. Les délais indicatifs sont de 24 à 72 heures pour le Nord et de 3 à 7 jours pour le Sud et les wilayas éloignées." },
          { type: "p", text: "Ces délais sont donnés à titre indicatif et peuvent varier selon la disponibilité des transporteurs." },
        ],
      },
      {
        heading: "Paiement à la livraison",
        blocks: [
          { type: "p", text: "Le règlement s'effectue en espèces, en dinars algériens, directement auprès du livreur ou au bureau de livraison. Aucun paiement n'est demandé en ligne." },
          { type: "p", text: "Merci de préparer si possible l'appoint. Vous pouvez vérifier l'état de votre colis avant de payer." },
        ],
      },
      {
        heading: "Suivre ma commande",
        blocks: [
          { type: "p", text: "Depuis votre espace client, vous retrouvez le statut de chaque commande : en attente, confirmée, en préparation, expédiée, livrée." },
        ],
      },
    ],
  },
  {
    slug: "retours",
    title: "Retours & échanges",
    description: "Comment retourner ou échanger un article : conditions, délais et démarche.",
    intro: "Une taille ou une coupe qui ne convient pas ? Nous facilitons les retours et les échanges, dans le respect de quelques conditions simples.",
    sections: [
      {
        heading: "Conditions de retour",
        blocks: [
          { type: "p", text: "Vous disposez de 7 jours après la réception de votre commande pour demander un retour ou un échange. Les articles doivent être :" },
          {
            type: "list",
            items: [
              "non portés, non lavés et non modifiés ;",
              "dans leur état d'origine, avec leurs étiquettes ;",
              "accompagnés de leur emballage d'origine si possible.",
            ],
          },
          { type: "p", text: "Pour des raisons d'hygiène, certains articles (sous-vêtements, accessoires portés près du corps) ne peuvent être ni repris ni échangés." },
        ],
      },
      {
        heading: "Comment procéder",
        blocks: [
          {
            type: "list",
            items: [
              "Contactez-nous par téléphone ou par e-mail en indiquant votre numéro de commande et l'article concerné.",
              "Notre équipe vous indique la marche à suivre : remise du colis au livreur ou dépôt en bureau de livraison.",
              "Dès réception et contrôle de l'article, nous procédons à l'échange (selon disponibilité) ou au remboursement.",
            ],
          },
        ],
      },
      {
        heading: "Article défectueux ou erroné",
        blocks: [
          { type: "p", text: "Si vous recevez un article défectueux ou différent de votre commande, signalez-le-nous dès que possible : les frais de retour sont alors à notre charge." },
        ],
      },
      {
        heading: "Frais de retour et remboursement",
        blocks: [
          { type: "p", text: "Sauf article défectueux ou erreur de notre part, les frais d'expédition du retour sont à la charge du client. Le remboursement s'effectue selon le mode convenu avec notre équipe, après contrôle de l'article." },
          TEMPLATE_NOTICE,
        ],
      },
    ],
  },
  {
    slug: "guide-des-tailles",
    title: "Guide des tailles",
    description: "Tableau de correspondance des tailles et conseils pour prendre vos mesures.",
    intro: "Trouvez votre taille en comparant vos mensurations aux tableaux ci-dessous. En cas d'hésitation entre deux tailles, prenez la plus grande pour un tombé plus confortable.",
    sections: [
      {
        heading: "Comment prendre ses mesures",
        blocks: [
          {
            type: "list",
            items: [
              "Poitrine : mesurez le tour de poitrine à l'endroit le plus fort, mètre ruban à l'horizontale.",
              "Taille : mesurez le tour de taille à l'endroit le plus fin, sans serrer.",
              "Hanches : mesurez le tour de hanches à l'endroit le plus large.",
            ],
          },
          { type: "p", text: "Prenez vos mesures à même la peau ou sur des sous-vêtements fins, mètre ruban souple bien à plat." },
        ],
      },
      {
        heading: "Femme",
        blocks: [
          {
            type: "table",
            caption: "Tailles femme (mesures du corps, en centimètres)",
            head: ["Taille", "Équivalent numérique", "Poitrine", "Taille (tour)", "Hanches"],
            rows: [
              ["XS", "36", "80 – 84", "62 – 66", "86 – 90"],
              ["S", "38", "84 – 88", "66 – 70", "90 – 94"],
              ["M", "40", "88 – 92", "70 – 74", "94 – 98"],
              ["L", "42", "92 – 96", "74 – 78", "98 – 102"],
              ["XL", "44", "96 – 102", "78 – 84", "102 – 108"],
              ["XXL", "46", "102 – 108", "84 – 90", "108 – 114"],
            ],
          },
        ],
      },
      {
        heading: "Homme",
        blocks: [
          {
            type: "table",
            caption: "Tailles homme (mesures du corps, en centimètres)",
            head: ["Taille", "Équivalent numérique", "Poitrine", "Taille (tour)", "Hanches"],
            rows: [
              ["S", "44", "88 – 94", "76 – 82", "92 – 98"],
              ["M", "46", "94 – 100", "82 – 88", "98 – 104"],
              ["L", "48", "100 – 106", "88 – 94", "104 – 110"],
              ["XL", "50", "106 – 112", "94 – 100", "110 – 116"],
              ["XXL", "52", "112 – 118", "100 – 106", "116 – 122"],
            ],
          },
        ],
      },
      {
        heading: "Bon à savoir",
        blocks: [
          { type: "p", text: "Les coupes varient selon les modèles (ajustée, droite, ample) : la description de chaque fiche produit précise la coupe. Les tailles des accessoires sont indiquées « Unique »." },
          { type: "p", text: "Un doute ? Contactez-nous avant de commander, nous vous conseillerons volontiers." },
        ],
      },
    ],
  },
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    description: "Informations légales relatives à l'éditeur et à l'hébergement du site.",
    intro: "Conformément à la réglementation applicable, voici les informations relatives à l'éditeur de ce site.",
    sections: [
      {
        heading: "Éditeur du site",
        blocks: [
          TEMPLATE_NOTICE,
          {
            type: "list",
            items: [
              "Dénomination ou raison sociale : [À compléter]",
              "Forme juridique : [À compléter]",
              "Adresse du siège : [À compléter]",
              "Numéro de registre du commerce : [À compléter]",
              "Numéro d'identification fiscale (NIF) : [À compléter]",
              "Directeur de la publication : [À compléter]",
            ],
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          { type: "p", text: "Les coordonnées de la boutique (téléphone, e-mail, adresse) figurent dans le pied de page de chaque page du site." },
        ],
      },
      {
        heading: "Hébergement",
        blocks: [{ type: "list", items: ["Hébergeur : [À compléter]", "Adresse de l'hébergeur : [À compléter]"] }],
      },
      {
        heading: "Propriété intellectuelle",
        blocks: [
          { type: "p", text: "L'ensemble des contenus de ce site (textes, visuels, logos, photographies) est protégé. Toute reproduction ou réutilisation sans autorisation écrite préalable est interdite." },
        ],
      },
    ],
  },
  {
    slug: "conditions-generales",
    title: "Conditions générales de vente",
    description: "Conditions applicables aux commandes passées sur la boutique en ligne.",
    intro: "Les présentes conditions encadrent les commandes passées sur ce site. En validant une commande, vous les acceptez.",
    sections: [
      {
        heading: "1. Produits et prix",
        blocks: [
          { type: "p", text: "Les produits sont proposés dans la limite des stocks disponibles, par taille et par couleur. Les prix sont indiqués en dinars algériens (DA), toutes taxes comprises, hors frais de livraison, qui sont affichés séparément avant la validation." },
        ],
      },
      {
        heading: "2. Commande",
        blocks: [
          { type: "p", text: "La commande est enregistrée après validation du formulaire. Notre équipe peut contacter le client par téléphone pour la confirmer. Nous nous réservons le droit de refuser ou d'annuler une commande en cas d'indisponibilité d'un article, d'erreur manifeste de prix ou de coordonnées injoignables." },
        ],
      },
      {
        heading: "3. Paiement",
        blocks: [
          { type: "p", text: "Le paiement s'effectue exclusivement à la livraison, en espèces et en dinars algériens. Aucune somme n'est encaissée avant la remise de la commande." },
        ],
      },
      {
        heading: "4. Livraison",
        blocks: [
          { type: "p", text: "La livraison est assurée à domicile ou en bureau de livraison, dans les wilayas desservies. Les délais et tarifs figurent sur la page Livraison. En cas d'absence répétée ou de refus du colis, la commande peut être annulée." },
        ],
      },
      {
        heading: "5. Retours et échanges",
        blocks: [{ type: "p", text: "Les conditions de retour et d'échange sont détaillées sur la page Retours & échanges." }],
      },
      {
        heading: "6. Données personnelles",
        blocks: [{ type: "p", text: "Le traitement des données personnelles est décrit dans la politique de confidentialité." }],
      },
      {
        heading: "7. Droit applicable",
        blocks: [
          { type: "p", text: "Les présentes conditions sont soumises au droit algérien. Tout litige relève des juridictions compétentes : [À compléter]." },
          TEMPLATE_NOTICE,
        ],
      },
    ],
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    description: "Quelles données personnelles nous collectons, pourquoi, et comment exercer vos droits.",
    intro: "Nous collectons uniquement les informations nécessaires au traitement et à la livraison de vos commandes.",
    sections: [
      {
        heading: "Données collectées",
        blocks: [
          {
            type: "list",
            items: [
              "Identité et coordonnées : nom, prénom, numéro de téléphone, adresse e-mail (facultative).",
              "Adresse de livraison : wilaya, commune, adresse ou bureau de livraison choisi.",
              "Informations de commande : articles, montants, statut de la commande.",
            ],
          },
        ],
      },
      {
        heading: "Finalités",
        blocks: [
          { type: "p", text: "Ces données servent à confirmer, préparer, livrer et assurer le suivi de vos commandes, à répondre à vos demandes et, si vous y consentez, à vous adresser notre lettre d'information." },
        ],
      },
      {
        heading: "Conservation et partage",
        blocks: [
          { type: "p", text: "Vos données sont conservées le temps nécessaire à la gestion de la commande et aux obligations légales. Elles ne sont communiquées qu'aux prestataires indispensables à la livraison. Elles ne sont jamais vendues." },
        ],
      },
      {
        heading: "Stockage local et mode démonstration",
        blocks: [
          { type: "p", text: "Votre panier, vos favoris et votre session d'espace client sont conservés dans le navigateur de votre appareil (stockage local) afin d'améliorer votre expérience. Vous pouvez les supprimer à tout moment en vidant les données du site dans votre navigateur." },
        ],
      },
      {
        heading: "Vos droits",
        blocks: [
          { type: "p", text: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données en nous contactant aux coordonnées indiquées dans le pied de page. Responsable du traitement : [À compléter]." },
          TEMPLATE_NOTICE,
        ],
      },
    ],
  },
];

export function getInfoPage(slug: string): InfoPage | undefined {
  return INFO_PAGES.find((p) => p.slug === slug);
}

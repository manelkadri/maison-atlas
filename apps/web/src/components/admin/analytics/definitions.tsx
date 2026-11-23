import { Info } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

/** Bloc repliable : définitions explicites des chiffres (jamais confondues). */
export function Definitions() {
  return (
    <Card className="gap-0 py-0">
      <Accordion type="single" collapsible>
        <AccordionItem value="definitions" className="border-b-0">
          <AccordionTrigger className="items-center px-5">
            <span className="flex items-center gap-2">
              <Info className="text-muted-foreground size-4" aria-hidden /> Comment lire ces chiffres
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-5">
            <dl className="space-y-3 text-sm leading-relaxed">
              <div>
                <dt className="font-semibold">Chiffre d&apos;affaires</dt>
                <dd className="text-muted-foreground">
                  Somme des ventes des commandes <strong className="text-foreground">livrées</strong>, remises déduites,{" "}
                  <strong className="text-foreground">hors frais de livraison</strong>. En paiement à la livraison, une commande non livrée n&apos;est pas encaissée : elle n&apos;entre pas dans le chiffre d&apos;affaires.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Bénéfice brut estimé</dt>
                <dd className="text-muted-foreground">
                  Chiffre d&apos;affaires − coût d&apos;achat des marchandises vendues (prix d&apos;achat × quantité, figé à la vente). La <em>marge brute</em> est ce bénéfice rapporté au chiffre d&apos;affaires.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Bénéfice net</dt>
                <dd className="text-muted-foreground">
                  <strong className="text-foreground">Non calculable ici.</strong> Loyer, salaires, publicité, frais de livraison payés au transporteur et autres charges ne sont pas connus de l&apos;application : le bénéfice brut ne doit pas être lu comme un gain net.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Commandes et taux d&apos;annulation</dt>
                <dd className="text-muted-foreground">
                  « Commandes » compte toutes les commandes passées sur la période (quel que soit leur statut). Le taux d&apos;annulation est la part de commandes annulées, refusées, en échec de livraison ou retournées.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Période</dt>
                <dd className="text-muted-foreground">Les commandes sont rattachées à la période par leur <strong className="text-foreground">date de création</strong>, pas par leur date de livraison.</dd>
              </div>
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

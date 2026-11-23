"use client";

import { Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MEASURING_TIPS, SIZE_GUIDE, type SizeGuideKind } from "./size-guide-data";

function SizeTable({ kind }: { kind: SizeGuideKind }) {
  const { rows, title } = SIZE_GUIDE[kind];
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[26rem] text-sm">
        <caption className="sr-only">Correspondance des tailles {title.toLowerCase()} (mesures du corps en centimètres)</caption>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium">Taille</th>
            <th scope="col" className="px-3 py-2.5 font-medium">N°</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Poitrine</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Taille (cm)</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Hanches</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.letter} className="border-t">
              <th scope="row" className="px-3 py-2.5 text-left font-medium">{row.letter}</th>
              <td className="px-3 py-2.5">{row.numeric}</td>
              <td className="px-3 py-2.5">{row.chest}</td>
              <td className="px-3 py-2.5">{row.waist}</td>
              <td className="px-3 py-2.5">{row.hips}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bouton + fenêtre « Guide des tailles » avec tableau de correspondance (mesures du corps, en cm). */
export function SizeGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm underline underline-offset-4">
          <Ruler className="size-4" aria-hidden />
          Guide des tailles
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Guide des tailles</DialogTitle>
          <DialogDescription>Mesures du corps en centimètres. En cas d&apos;hésitation entre deux tailles, choisissez la plus grande.</DialogDescription>
        </DialogHeader>

        <SizeTable kind="women" />

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Comment se mesurer ?</h3>
          <ul className="text-muted-foreground space-y-1.5 text-sm leading-relaxed">
            {MEASURING_TIPS.map((tip) => (
              <li key={tip.label}>
                <span className="text-foreground font-medium">{tip.label} : </span>
                {tip.text}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

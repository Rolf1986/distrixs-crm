"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Maakt de omliggende tabelrij klikbaar. Vervangt het oude patroon met een
 * onzichtbare <Link className="absolute inset-0"> in een <tr class="relative">:
 * Safari negeert position:relative op <tr>, waardoor die overlay zich over de
 * hele tabel uitstrekte en elke klik op één (verkeerde) rij uitkwam.
 * Klikken op links/knoppen/invoervelden binnen de rij blijven gewoon werken.
 * Modifier-kliks gedragen zich als een echte link: cmd/ctrl+klik en middelklik
 * openen een nieuw tabblad, shift+klik een nieuw venster.
 */
export function RowLink({ href }: { href: string }) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = ref.current?.closest("tr");
    if (!row) return;

    const isInteractive = (e: MouseEvent) =>
      !!(e.target as HTMLElement).closest("a,button,input,select,textarea,label");

    const handler = (e: MouseEvent) => {
      if (isInteractive(e)) return;
      if (e.metaKey || e.ctrlKey) {
        window.open(href, "_blank");
        return;
      }
      if (e.shiftKey) {
        window.open(href);
        return;
      }
      router.push(href);
    };

    // Middelklik (auxclick) → nieuw tabblad, net als bij een echte link
    const auxHandler = (e: MouseEvent) => {
      if (e.button !== 1 || isInteractive(e)) return;
      e.preventDefault();
      window.open(href, "_blank");
    };

    row.style.cursor = "pointer";
    row.addEventListener("click", handler);
    row.addEventListener("auxclick", auxHandler);
    return () => {
      row.removeEventListener("click", handler);
      row.removeEventListener("auxclick", auxHandler);
    };
  }, [href, router]);

  return <span ref={ref} className="hidden" />;
}

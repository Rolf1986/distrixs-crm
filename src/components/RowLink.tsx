"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Maakt de omliggende tabelrij klikbaar. Vervangt het oude patroon met een
 * onzichtbare <Link className="absolute inset-0"> in een <tr class="relative">:
 * Safari negeert position:relative op <tr>, waardoor die overlay zich over de
 * hele tabel uitstrekte en elke klik op één (verkeerde) rij uitkwam.
 * Klikken op links/knoppen/invoervelden binnen de rij blijven gewoon werken.
 */
export function RowLink({ href }: { href: string }) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = ref.current?.closest("tr");
    if (!row) return;
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
      router.push(href);
    };
    row.style.cursor = "pointer";
    row.addEventListener("click", handler);
    return () => row.removeEventListener("click", handler);
  }, [href, router]);

  return <span ref={ref} className="hidden" />;
}

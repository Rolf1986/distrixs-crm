"use client";

import { useEffect, useRef, useState } from "react";

// useState-variant die de waarde per tabblad onthoudt (sessionStorage), zodat
// zoektermen en filters blijven staan wanneer je terugnavigeert naar een
// overzichtspagina. Eerste render gebruikt de initiële waarde (geen
// hydration-mismatch); direct daarna wordt de bewaarde waarde teruggezet.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // sessionStorage niet beschikbaar → gewoon zonder persistentie werken
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

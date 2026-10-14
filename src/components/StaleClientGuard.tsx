"use client";

import { useEffect, useRef } from "react";

// Na een deploy blijven open tabbladen en de telefoon-PWA op de oude
// interface hangen; acties praten dan mis met de nieuwe server (Server
// Reference-fouten, mislukkende knoppen). Deze wacht vergelijkt de build-id
// van de server met die waarmee deze client geladen is en herlaadt éénmalig
// automatisch zodra er een nieuwe versie draait. Vangt ook chunk-laadfouten
// op (oude bundel vraagt om verdwenen bestanden).
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data.buildId ?? null;
  } catch {
    // Netwerk/deploy-moment — stil negeren, volgende check komt vanzelf
    return null;
  }
}

function reloadOnce(reason: string) {
  try {
    // Max één automatische reload per 2 minuten: nooit een herlaad-lus
    const last = Number(sessionStorage.getItem("stale-reload-at") ?? 0);
    if (Date.now() - last < 2 * 60 * 1000) return;
    sessionStorage.setItem("stale-reload-at", String(Date.now()));
  } catch { /* private mode */ }
  console.info(`[stale-client] interface verouderd (${reason}) — verversen`);
  window.location.reload();
}

export function StaleClientGuard() {
  const initialBuildId = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;

    async function check() {
      const id = await fetchBuildId();
      if (stopped || !id) return;
      if (initialBuildId.current === null) {
        initialBuildId.current = id;
      } else if (id !== initialBuildId.current) {
        reloadOnce(`build ${initialBuildId.current} → ${id}`);
      }
    }

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    // Telefoon/PWA die uit de achtergrond terugkomt → direct controleren
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Oude bundel vraagt om een chunk die na de deploy niet meer bestaat
    const onError = (e: ErrorEvent) => {
      const msg = String(e.message ?? "");
      if (/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(msg)) {
        reloadOnce("chunk-laadfout");
      }
    };
    window.addEventListener("error", onError);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}

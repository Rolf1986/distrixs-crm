"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "distrixs-install-hint-dismissed";

export function InstallAppHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Al geïnstalleerd (draait als app) → niets tonen
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    // Chrome/Edge/Android: vang de installatie-prompt op
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS heeft geen beforeinstallprompt → toon de handmatige instructie
    if (ios) setVisible(true);

    const onInstalled = () => { setVisible(false); localStorage.setItem(DISMISS_KEY, "1"); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl p-4">
      <button onClick={dismiss} className="absolute top-2.5 right-2.5 text-slate-300 hover:text-slate-500" aria-label="Sluiten">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-brand-blue/10 shrink-0">
          <Download className="w-5 h-5 text-brand-blue" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Distrixs CRM als app</p>
          {isIos ? (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Tik op <Share className="w-3.5 h-3.5 inline -mt-0.5" /> <strong>Deel</strong> en kies{" "}
              <strong>“Zet op beginscherm”</strong> om de app te installeren.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Installeer de CRM als app — opent in een eigen venster, snel bij de hand.
              </p>
              <button
                onClick={install}
                className="mt-2.5 inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Installeren
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

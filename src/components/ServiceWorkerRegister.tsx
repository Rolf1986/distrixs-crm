"use client";

import { useEffect } from "react";

// Registreert de service worker zodat de app installeerbaar is (PWA).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // stil falen — PWA is progressieve verbetering
      });
    }
  }, []);
  return null;
}

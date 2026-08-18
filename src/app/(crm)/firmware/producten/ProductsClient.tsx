"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, Sparkles, Trash2 } from "lucide-react";

export interface FirmwareProductRow {
  id: string;
  label: string;
  releaseCount: number;
  latestVersion: string | null;
  latestDate: string | null;
  registrationCount: number;
  links: Array<{ id: string; productId: string; sku: string; title: string; isSuggested: boolean }>;
}

export interface CrmProductOption {
  id: string;
  sku: string;
  title: string;
}

/**
 * Koppelingen leggen tussen onze artikelen en de producten zoals ACME ze noemt.
 * Die koppeling is nodig om uit de factuurhistorie te kunnen afleiden welke klant
 * welk armatuur heeft.
 */
export function ProductsClient({
  firmwareProducts,
  crmProducts,
  initialQuery = "",
}: {
  firmwareProducts: FirmwareProductRow[];
  crmProducts: CrmProductOption[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [onlyLinked, setOnlyLinked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return firmwareProducts
      .filter((p) => (onlyLinked ? p.links.length > 0 : true))
      .filter((p) => (q ? p.label.toLowerCase().includes(q) : true))
      .slice(0, 200);
  }, [firmwareProducts, query, onlyLinked]);

  const suggestedCount = useMemo(
    () => firmwareProducts.reduce((n, p) => n + p.links.filter((l) => l.isSuggested).length, 0),
    [firmwareProducts]
  );

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return crmProducts.slice(0, 20);
    return crmProducts
      .filter((p) => `${p.sku} ${p.title}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [crmProducts, productQuery]);

  async function autoSuggest() {
    setBusy("auto");
    setMessage(null);
    const res = await fetch("/api/firmware/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSuggest: true }),
    });
    const data = await res.json();
    setBusy(null);
    setMessage(
      data.suggested === 0
        ? "Geen nieuwe koppelingen gevonden op naamgelijkenis."
        : `${data.suggested} voorstel${data.suggested === 1 ? "" : "len"} toegevoegd — controleer ze hieronder.`
    );
    router.refresh();
  }

  async function confirmAll() {
    if (
      !confirm(
        `Alle ${suggestedCount} openstaande voorstellen bevestigen? Je kunt losse koppelingen daarna nog verwijderen.`
      )
    )
      return;
    setBusy("confirmAll");
    const res = await fetch("/api/firmware/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmAll: true }),
    });
    const data = await res.json();
    setBusy(null);
    setMessage(`${data.confirmed} koppeling${data.confirmed === 1 ? "" : "en"} bevestigd.`);
    router.refresh();
  }

  async function link(firmwareProductId: string, productId: string) {
    setBusy(firmwareProductId);
    await fetch("/api/firmware/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmwareProductId, productId }),
    });
    setBusy(null);
    setLinkTarget(null);
    setProductQuery("");
    router.refresh();
  }

  async function confirmSuggestion(firmwareProductId: string, productId: string) {
    await link(firmwareProductId, productId);
  }

  async function unlink(linkId: string) {
    setBusy(linkId);
    await fetch(`/api/firmware/links?id=${linkId}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek ACME-product…"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} />
          alleen gekoppelde
        </label>
        <button
          onClick={autoSuggest}
          disabled={busy === "auto"}
          className="ml-auto inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "auto" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Koppelingen voorstellen
        </button>
        {suggestedCount > 0 && (
          <button
            onClick={confirmAll}
            disabled={busy === "confirmAll"}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            {busy === "confirmAll" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Alle {suggestedCount} voorstellen bevestigen
          </button>
        )}
      </div>

      {message && <p className="text-sm text-slate-600 bg-slate-100 rounded-lg px-3 py-2">{message}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">ACME-product</th>
              <th className="px-4 py-3 font-medium">Nieuwste</th>
              <th className="px-4 py-3 font-medium">Ons artikel</th>
              <th className="px-4 py-3 font-medium">Aangemeld</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-400">{p.releaseCount} releases</div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-slate-700">{p.latestVersion ?? "—"}</span>
                  {p.latestDate && <div className="text-xs text-slate-400">{p.latestDate}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {p.links.map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            l.isSuggested
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {l.sku}
                        </span>
                        <span className="text-xs text-slate-500 truncate max-w-[220px]">{l.title}</span>
                        {l.isSuggested && (
                          <button
                            onClick={() => confirmSuggestion(p.id, l.productId)}
                            title="Voorstel bevestigen"
                            className="p-1 rounded text-green-600 hover:bg-green-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => unlink(l.id)}
                          title="Koppeling verwijderen"
                          className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {linkTarget === p.id ? (
                      <div className="mt-1 space-y-1">
                        <input
                          autoFocus
                          type="text"
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          placeholder="Zoek ons artikel op SKU of naam…"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                        />
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded">
                          {productMatches.map((cp) => (
                            <button
                              key={cp.id}
                              onClick={() => link(p.id, cp.id)}
                              className="block w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                            >
                              <span className="font-mono text-slate-500">{cp.sku}</span> {cp.title}
                            </button>
                          ))}
                          {productMatches.length === 0 && (
                            <p className="px-2 py-2 text-xs text-slate-400">Geen artikel gevonden.</p>
                          )}
                        </div>
                        <button
                          onClick={() => setLinkTarget(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          annuleren
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setLinkTarget(p.id);
                          setProductQuery("");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {busy === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        artikel koppelen
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{p.registrationCount || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Maximaal 200 producten tegelijk zichtbaar — verfijn met het zoekveld.
      </p>
    </div>
  );
}

/**
 * Distrixs webshop-analytics — first-party tracking-snippet.
 *
 * Wordt door de CRM geserveerd (…/track.js) en op de WooCommerce-site geladen via
 * de mu-plugin `distrixs-analytics.php`. Die plugin levert:
 *   window.dxConfig  = { endpoint, consentCategory }   // verplicht
 *   window.dxUser    = { wcId, email, name }            // alleen bij ingelogde klant
 *   window.dxProduct = { sku, id, name }                // alleen op productpagina's
 *
 * Consent: er wordt PAS iets opgeslagen of verstuurd nadat de bezoeker toestemming
 * heeft gegeven in "GDPR Cookie Compliance" (cookie `moove_gdpr_popup`).
 */
(function () {
  "use strict";

  var cfg = window.dxConfig || {};
  var ENDPOINT = cfg.endpoint;
  var CONSENT_CATEGORY = cfg.consentCategory || "thirdparty"; // Moove-categorie voor statistiek
  if (!ENDPOINT) return; // zonder endpoint doen we niets

  // ── Consent-check (GDPR Cookie Compliance / Moove) ──────────────────────────
  function hasConsent() {
    var raw = readCookie("moove_gdpr_popup");
    if (!raw) return false;
    try {
      var data = JSON.parse(decodeURIComponent(raw));
      var v = data[CONSENT_CATEGORY];
      return v === "1" || v === 1 || v === true || v === "true";
    } catch (e) {
      return false;
    }
  }

  function readCookie(name) {
    var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? m[1] : null;
  }

  if (!hasConsent()) return; // geen toestemming ⇒ geen tracking

  // ── Bezoeker-id (first-party, in localStorage van de webshop) ────────────────
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var vid;
  try {
    vid = localStorage.getItem("dx_vid");
    if (!vid) {
      vid = uuid();
      localStorage.setItem("dx_vid", vid);
    }
  } catch (e) {
    vid = uuid(); // localStorage geblokkeerd ⇒ sessie-only id
  }

  // ── Context: campagne (UTM), referrer, landing, device ──────────────────────
  function qp(name) {
    var m = location.search.match("[?&]" + name + "=([^&]*)");
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function device() {
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (/Mobi|Android|iPhone|iPod/i.test(navigator.userAgent) || w < 768) return "mobile";
    if (/iPad|Tablet/i.test(navigator.userAgent) || w < 1024) return "tablet";
    return "desktop";
  }

  var ctx = {
    landingPath: location.pathname + location.search,
    referrer: document.referrer || null,
    utmSource: qp("utm_source"),
    utmMedium: qp("utm_medium"),
    utmCampaign: qp("utm_campaign"),
    utmContent: qp("utm_content"),
    utmTerm: qp("utm_term"),
    device: device(),
  };

  var user = window.dxUser && window.dxUser.wcId ? window.dxUser : null;

  // ── Verzenden (sendBeacon, met fetch-fallback) ──────────────────────────────
  function send(events) {
    var payload = JSON.stringify({
      vid: vid,
      ua: navigator.userAgent,
      ctx: ctx,
      user: user,
      events: events,
    });
    var ok = false;
    try {
      if (navigator.sendBeacon) {
        ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }));
      }
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      try {
        fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true, mode: "cors" });
      } catch (e) {
        /* stil falen — tracking mag de site nooit breken */
      }
    }
  }

  function track(type, extra) {
    var ev = { type: type, path: location.pathname, title: document.title, ts: Date.now() };
    if (extra) for (var k in extra) ev[k] = extra[k];
    send([ev]);
  }

  // ── Pageview + eventuele login/product-view ─────────────────────────────────
  var initial = [
    { type: "pageview", path: location.pathname, title: document.title, ts: Date.now() },
  ];

  // Login-event één keer per (vid, account) — zodat je "net ingelogd" ziet.
  if (user) {
    try {
      if (localStorage.getItem("dx_wc") !== String(user.wcId)) {
        initial.push({ type: "login", path: location.pathname, ts: Date.now() });
        localStorage.setItem("dx_wc", String(user.wcId));
      }
    } catch (e) {
      /* negeer */
    }
  }

  // Productpagina: view met SKU (server-side geïnjecteerd, betrouwbaar).
  if (window.dxProduct && window.dxProduct.sku) {
    initial.push({
      type: "product_view",
      path: location.pathname,
      title: document.title,
      productSku: String(window.dxProduct.sku),
      metadata: { id: window.dxProduct.id || null, name: window.dxProduct.name || null },
      ts: Date.now(),
    });
  }

  // Zoekopdracht (WooCommerce ?s=…).
  var search = qp("s");
  if (search) initial.push({ type: "search", path: location.pathname, metadata: { q: search }, ts: Date.now() });

  send(initial);

  // ── Interactie: toevoegen-aan-winkelwagen ───────────────────────────────────
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest
        ? e.target.closest(".add_to_cart_button, .single_add_to_cart_button")
        : null;
      if (!el) return;
      var sku =
        el.getAttribute("data-product_sku") ||
        (window.dxProduct && window.dxProduct.sku) ||
        null;
      var id = el.getAttribute("data-product_id") || null;
      track("add_to_cart", { productSku: sku ? String(sku) : null, metadata: { id: id } });
    },
    true
  );
})();

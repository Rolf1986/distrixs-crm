<?php
/**
 * Plugin Name: Distrixs Analytics
 * Description: First-party gedrags-tracking voor het CRM-dashboard. Laadt track.js
 *              vanaf de CRM en injecteert ingelogde-klant- en product-context.
 * Version: 1.0.0
 * Author: Distrixs
 *
 * Installatie: plaats dit bestand in  wp-content/mu-plugins/  (must-use plugin,
 * activeert automatisch). Zie README.md voor de volledige uitleg.
 */

if (!defined('ABSPATH')) {
    exit;
}

// ── Configuratie ──────────────────────────────────────────────────────────────
// Basis-URL van de CRM, ZONDER trailing slash. Pas aan naar je eigen domein.
if (!defined('DX_CRM_BASE')) {
    define('DX_CRM_BASE', 'https://crm.distrixs.nl');
}
// Onder welke "GDPR Cookie Compliance"-categorie valt statistiek?
// Distrixs-config heeft: strict | thirdparty | advanced | performance | preference.
// Analytics/statistiek hoort onder 'performance' (standaard-benaming voor statistiek-cookies).
if (!defined('DX_CONSENT_CATEGORY')) {
    define('DX_CONSENT_CATEGORY', 'performance');
}

add_action('wp_enqueue_scripts', function () {
    if (is_admin()) {
        return;
    }

    // 1. Config vóór het snippet klaarzetten.
    $config = array(
        'endpoint'        => DX_CRM_BASE . '/api/track',
        'consentCategory' => DX_CONSENT_CATEGORY,
    );
    $inline = 'window.dxConfig = ' . wp_json_encode($config) . ';';

    // 2. Ingelogde klant → dxUser (identiteit-van-record = WooCommerce user-ID).
    if (is_user_logged_in()) {
        $u = wp_get_current_user();
        $inline .= 'window.dxUser = ' . wp_json_encode(array(
            'wcId'  => (int) $u->ID,
            'email' => $u->user_email,
            'name'  => $u->display_name,
        )) . ';';
    }

    // 3. Productpagina → dxProduct (server-side, dus betrouwbare SKU).
    if (function_exists('is_product') && is_product()) {
        $product = function_exists('wc_get_product') ? wc_get_product(get_the_ID()) : null;
        if ($product) {
            $inline .= 'window.dxProduct = ' . wp_json_encode(array(
                'sku'  => $product->get_sku(),
                'id'   => $product->get_id(),
                'name' => $product->get_name(),
            )) . ';';
        }
    }

    // 4. Snippet registreren, config eraan hangen, laden (in de footer).
    wp_register_script('distrixs-analytics', DX_CRM_BASE . '/track.js', array(), '1.0.0', true);
    wp_add_inline_script('distrixs-analytics', $inline, 'before');
    wp_enqueue_script('distrixs-analytics');
});

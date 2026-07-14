/**
 * Barion Full Pixel — engedd-el (Engedd el, ami tönkretesz)
 *
 * Base loader + Full Pixel event helpers + GDPR consent banner (HU).
 * Mandatory events per https://docs.barion.com/Implementing_the_Full_Barion_Pixel:
 *   grantConsent, setEncryptedEmail, contentView, addToCart,
 *   initiateCheckout, initiatePurchase OR purchase
 *
 * Events are always sent (Barion fraud-management legitimate interest);
 * grantConsent/rejectConsent only flags whether Barion may use the data
 * for marketing. Consent choice persists in localStorage.
 *
 * Ref: https://docs.barion.com/Barion_Pixel_API_reference
 * Loaded early (non-deferred) in <head> of every page.
 */
(function () {
  'use strict';

  var PIXEL_ID = 'BP-dkCRBIpG0P-26';
  var CONSENT_KEY = 'barion_pixel_consent'; // 'granted' | 'rejected'

  // ── Base pixel: bp() command queue stub + async loader ──
  window['bp'] = window['bp'] || function () {
    (window['bp'].q = window['bp'].q || []).push(arguments);
  };
  window['bp'].l = 1 * new Date();

  var scriptElement = document.createElement('script');
  var firstScript = document.getElementsByTagName('script')[0];
  scriptElement.async = true;
  scriptElement.src = 'https://pixel.barion.com/bp.js';
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(scriptElement, firstScript);
  } else {
    document.head.appendChild(scriptElement);
  }

  window['barion_pixel_id'] = PIXEL_ID;
  bp('init', 'addBarionPixelId', window['barion_pixel_id']);

  // ── Helpers ──
  function cfg() { return window.PROJECT_CONFIG || null; }

  function mainProductProps(overrides) {
    var c = cfg();
    var p = (c && c.mainProduct) || {};
    var props = {
      contentType: 'Product',
      currency: p.currency || 'HUF',
      id: p.variantId || p.handle || 'engedd-el-ami-tonkretesz',
      name: p.name || 'Engedd el, ami tönkretesz',
      quantity: 1.0,
      unit: 'db',
      unitPrice: Number(p.price) || 0,
      category: 'könyvek|önfejlesztés',
      list: 'ProductPage'
    };
    if (overrides) {
      for (var k in overrides) { if (Object.prototype.hasOwnProperty.call(overrides, k)) props[k] = overrides[k]; }
    }
    return props;
  }

  function contentsFor(qty, unitPrice) {
    var base = mainProductProps();
    return [{
      contentType: 'Product',
      currency: base.currency,
      id: base.id,
      name: base.name,
      quantity: Number(qty) || 1,
      totalItemPrice: (Number(qty) || 1) * (Number(unitPrice) || base.unitPrice),
      unit: 'db',
      unitPrice: Number(unitPrice) || base.unitPrice
    }];
  }

  // ── Public API for page scripts ──
  window.BarionPixel = {
    // Generic passthrough
    track: function (eventName, props) {
      try { bp('track', eventName, props || {}); } catch (e) { /* never break the page */ }
    },

    // contentView — Product on funnel pages, Page elsewhere
    contentViewProduct: function (overrides) {
      this.track('contentView', mainProductProps(overrides));
    },
    contentViewPage: function () {
      this.track('contentView', {
        contentType: 'Page',
        id: (location.pathname.replace(/\W+/g, '_') || 'page'),
        name: document.title || 'Engedd el, ami tönkretesz',
        list: 'Misc'
      });
    },

    setEncryptedEmail: function (email) {
      if (!email || String(email).indexOf('@') === -1) return;
      try { bp('identity', 'setEncryptedEmail', String(email).trim().toLowerCase()); } catch (e) {}
    },

    addToCart: function (qty, unitPrice, list) {
      var q = Number(qty) || 1;
      var base = mainProductProps();
      var up = Number(unitPrice) || base.unitPrice;
      this.track('addToCart', {
        contentType: 'Product',
        currency: base.currency,
        id: base.id,
        name: base.name,
        quantity: q,
        totalItemPrice: q * up,
        unit: 'db',
        unitPrice: up,
        list: list || 'ProductPage'
      });
    },

    initiateCheckout: function (qty, totalPrice) {
      var q = Number(qty) || 1;
      var total = Number(totalPrice) || mainProductProps().unitPrice;
      this.track('initiateCheckout', {
        contents: contentsFor(q, total / q),
        currency: 'HUF',
        revenue: total,
        step: 1,
        contentType: 'Product',
        list: 'Checkout',
        shipping: 0.0
      });
    },

    addPaymentInfo: function (method, qty, totalPrice) {
      var q = Number(qty) || 1;
      var total = Number(totalPrice) || mainProductProps().unitPrice;
      this.track('addPaymentInfo', {
        contents: contentsFor(q, total / q),
        paymentMethod: method || 'Barion',
        step: 2,
        contentType: 'Product',
        currency: 'HUF',
        revenue: total,
        list: 'Checkout'
      });
    },

    initiatePurchase: function (qty, totalPrice, orderNumber) {
      var q = Number(qty) || 1;
      var total = Number(totalPrice) || mainProductProps().unitPrice;
      this.track('initiatePurchase', {
        contents: contentsFor(q, total / q),
        currency: 'HUF',
        revenue: total,
        step: 3,
        contentType: 'Product',
        list: 'Checkout',
        shipping: 0.0,
        orderNumber: orderNumber || undefined
      });
    },

    purchase: function (qty, totalPrice, orderNumber, successful) {
      var q = Number(qty) || 1;
      var total = Number(totalPrice) || mainProductProps().unitPrice;
      this.track('purchase', {
        contents: contentsFor(q, total / q),
        currency: 'HUF',
        revenue: total,
        step: successful === false ? -1 : 4,
        contentType: 'Product',
        list: 'Checkout',
        shipping: 0.0,
        orderNumber: orderNumber || undefined
      });
    }
  };

  // ── Consent management (GDPR) ──
  function sendConsent(choice) {
    try { bp('consent', choice === 'granted' ? 'grantConsent' : 'rejectConsent'); } catch (e) {}
  }

  function storedConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }

  function saveConsent(choice) {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch (e) {}
    sendConsent(choice);
    var bar = document.getElementById('barion-consent-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }
  window.BarionPixel.grantConsent = function () { saveConsent('granted'); };
  window.BarionPixel.rejectConsent = function () { saveConsent('rejected'); };

  function showConsentBar() {
    if (document.getElementById('barion-consent-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'barion-consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Süti beállítások');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#2D1B3D;color:#fff;padding:14px 18px;font-family:inherit;font-size:13px;line-height:1.5;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;box-shadow:0 -4px 16px rgba(0,0,0,0.25);';
    bar.innerHTML =
      '<span style="max-width:640px;">Weboldalunk sütiket használ a vásárlási élmény javítására és marketing célokra, beleértve a Barion Pixel szolgáltatást (Barion Payment Zrt.). Részletek: <a href="adatvedelem.html" style="color:#D9A4C0;text-decoration:underline;">Adatvédelmi tájékoztató</a>.</span>' +
      '<span style="display:inline-flex;gap:8px;flex-shrink:0;">' +
      '<button type="button" id="barion-consent-accept" style="background:#C27BA0;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;">Elfogadom</button>' +
      '<button type="button" id="barion-consent-reject" style="background:transparent;color:#D9A4C0;border:1px solid #D9A4C0;border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer;">Elutasítom</button>' +
      '</span>';
    document.body.appendChild(bar);
    document.getElementById('barion-consent-accept').addEventListener('click', window.BarionPixel.grantConsent);
    document.getElementById('barion-consent-reject').addEventListener('click', window.BarionPixel.rejectConsent);
  }

  // ── On DOM ready: replay consent, auto contentView ──
  function onReady() {
    var choice = storedConsent();
    if (choice === 'granted' || choice === 'rejected') {
      sendConsent(choice);
    } else {
      showConsentBar();
    }

    // Automatic contentView: Product on funnel pages, Page on legal/info pages
    var path = (location.pathname || '').toLowerCase();
    var isFunnelPage = /(^\/$|index|checkout|thank-you)/.test(path) || path === '' ;
    if (isFunnelPage && cfg() && cfg().mainProduct) {
      var isCheckout = path.indexOf('checkout') !== -1;
      var isThankYou = path.indexOf('thank-you') !== -1;
      window.BarionPixel.contentViewProduct({
        list: isCheckout || isThankYou ? 'Checkout' : 'ProductPage',
        step: isCheckout ? 1 : (isThankYou ? 4 : undefined)
      });
    } else {
      window.BarionPixel.contentViewPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();

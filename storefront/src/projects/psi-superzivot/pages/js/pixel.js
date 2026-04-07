/**
 * MetaTracker — Facebook Pixel + Conversions API (CAPI) integration.
 *
 * This script:
 *  1. Fetches pixel_id from the backend via /store/meta-pixel-config/:projectId
 *  2. Loads the Facebook Pixel SDK (fbevents.js) dynamically
 *  3. Fires PageView on load
 *  4. Provides MetaTracker.track*() methods that fire both:
 *     - Browser pixel (fbq) — immediate
 *     - Server CAPI (POST /store/meta-capi) — with identical event_id for deduplication
 *
 * All PII is sent raw to the backend, which hashes it server-side before
 * forwarding to Facebook. Access tokens are NEVER exposed to the frontend.
 */
(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────
  var PROJECT_ID = (typeof PROJECT_CONFIG !== 'undefined' && PROJECT_CONFIG.projectId)
    ? PROJECT_CONFIG.projectId
    : 'dehondenbijbel';

  var MEDUSA_URL = (typeof PROJECT_CONFIG !== 'undefined' && PROJECT_CONFIG.medusaUrl)
    ? PROJECT_CONFIG.medusaUrl
    : 'https://backend-production-aefbc.up.railway.app';

  // ─── State ──────────────────────────────────────────────────────
  var pixelId = null;
  var pixelReady = false;
  var queuedEvents = [];
  var advancedMatchingData = {};

  // ─── Helpers ────────────────────────────────────────────────────

  /** Generate a UUID v4 for event deduplication */
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Read a cookie value by name */
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  /** Get or create a persistent external_id for this browser */
  function getOrCreateExternalId() {
    var key = '_mt_ext_id';
    var stored = localStorage.getItem(key);
    if (stored) return stored;
    var id = uuid();
    try { localStorage.setItem(key, id); } catch (e) { /* quota */ }
    return id;
  }

  // ─── Facebook Pixel SDK loader ──────────────────────────────────

  function loadPixelSDK(pid) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    // Init with advanced matching data (if available)
    var initData = {};
    if (advancedMatchingData.em) initData.em = advancedMatchingData.em;
    if (advancedMatchingData.ph) initData.ph = advancedMatchingData.ph;
    if (advancedMatchingData.fn) initData.fn = advancedMatchingData.fn;
    if (advancedMatchingData.ln) initData.ln = advancedMatchingData.ln;
    if (advancedMatchingData.ct) initData.ct = advancedMatchingData.ct;
    if (advancedMatchingData.zp) initData.zp = advancedMatchingData.zp;
    if (advancedMatchingData.country) initData.country = advancedMatchingData.country;
    if (advancedMatchingData.st) initData.st = advancedMatchingData.st;

    var externalId = getOrCreateExternalId();
    initData.external_id = externalId;

    fbq('init', pid, initData);
    fbq('track', 'PageView');
    console.log('[MetaTracker] Pixel initialized:', pid);

    pixelReady = true;

    // Flush any queued events
    while (queuedEvents.length) {
      var queued = queuedEvents.shift();
      fireEvent(queued.eventName, queued.customData, queued.userData, queued.options);
    }
  }

  // ─── Core event dispatcher ──────────────────────────────────────

  /**
   * Fire an event via both browser pixel AND server CAPI (in parallel).
   *
   * @param {string}  eventName  - Facebook standard event name
   * @param {object}  customData - Event custom_data (value, currency, content_ids, etc.)
   * @param {object}  userData   - PII for CAPI (em, ph, fn, ln, ct, zp, country, st)
   * @param {object}  options    - { event_id: string } for dedup override
   */
  function fireEvent(eventName, customData, userData, options) {
    if (!pixelReady) {
      queuedEvents.push({ eventName: eventName, customData: customData, userData: userData, options: options });
      return;
    }

    var eventId = (options && options.event_id) ? options.event_id : uuid();
    customData = customData || {};
    userData = userData || {};

    // ── 1) Browser pixel (fbq) ──
    try {
      fbq('track', eventName, customData, { eventID: eventId });
      console.log('[MetaTracker] fbq:', eventName, '| eventID:', eventId);
    } catch (e) {
      console.warn('[MetaTracker] fbq error:', e);
    }

    // ── 2) Server CAPI ──
    var capiUserData = {};
    // Merge stored advanced matching data + event-specific userData
    var merged = {};
    var k;
    for (k in advancedMatchingData) {
      if (advancedMatchingData.hasOwnProperty(k)) merged[k] = advancedMatchingData[k];
    }
    for (k in userData) {
      if (userData.hasOwnProperty(k)) merged[k] = userData[k];
    }

    // Copy PII fields
    if (merged.em) capiUserData.em = merged.em;
    if (merged.ph) capiUserData.ph = merged.ph;
    if (merged.fn) capiUserData.fn = merged.fn;
    if (merged.ln) capiUserData.ln = merged.ln;
    if (merged.ct) capiUserData.ct = merged.ct;
    if (merged.st) capiUserData.st = merged.st;
    if (merged.zp) capiUserData.zp = merged.zp;
    if (merged.country) capiUserData.country = merged.country;

    // Add browser identifiers
    capiUserData.fbc = getCookie('_fbc') || '';
    capiUserData.fbp = getCookie('_fbp') || '';
    capiUserData.external_id = getOrCreateExternalId();

    var capiPayload = {
      project_id: PROJECT_ID,
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      referrer_url: document.referrer || undefined,
      user_data: capiUserData,
      custom_data: customData
    };

    // Fire & forget — don't block the page
    try {
      var capiUrl = MEDUSA_URL + '/public/meta-capi';
      fetch(capiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload),
        keepalive: true
      }).then(function (res) {
        return res.json();
      }).then(function (data) {
        if (data.success) {
          console.log('[MetaTracker] CAPI:', eventName, '| fbtrace:', data.fbtrace_id);
        } else {
          console.warn('[MetaTracker] CAPI error:', data.error);
        }
      }).catch(function (err) {
        console.warn('[MetaTracker] CAPI fetch error:', err);
      });
    } catch (e) {
      console.warn('[MetaTracker] CAPI error:', e);
    }
  }

  // ─── Public API: MetaTracker ────────────────────────────────────

  window.MetaTracker = {
    /**
     * Update advanced matching data (email, phone, name, etc.)
     * Called progressively as user fills in form fields.
     */
    setUserData: function (data) {
      if (!data) return;
      for (var key in data) {
        if (data.hasOwnProperty(key) && data[key]) {
          advancedMatchingData[key] = data[key];
        }
      }
      // Also update fbq's advanced matching if pixel is loaded
      if (pixelReady && typeof fbq !== 'undefined') {
        try { fbq('init', pixelId, advancedMatchingData); } catch (e) { /* ignore */ }
      }
    },

    /** Get _fbc cookie (click ID) */
    getFbc: function () {
      return getCookie('_fbc');
    },

    /** Get _fbp cookie (browser ID) */
    getFbp: function () {
      return getCookie('_fbp');
    },

    /** Get persistent external_id */
    getExternalId: function () {
      return getOrCreateExternalId();
    },

    /**
     * ViewContent — fires when user views a product page (index.html)
     * @param {object} data - { content_name, content_ids, value, currency }
     */
    trackViewContent: function (data) {
      fireEvent('ViewContent', {
        content_type: 'product',
        content_name: data.content_name || '',
        content_ids: data.content_ids || [],
        value: data.value || 0,
        currency: data.currency || 'EUR'
      });
    },

    /**
     * AddToCart — fires when user clicks a CTA to go to checkout
     * @param {object} data - { content_name, content_ids, value, currency, num_items }
     */
    trackAddToCart: function (data) {
      fireEvent('AddToCart', {
        content_type: 'product',
        content_name: data.content_name || '',
        content_ids: data.content_ids || [],
        value: data.value || 0,
        currency: data.currency || 'EUR',
        num_items: data.num_items || 1
      });
    },

    /**
     * InitiateCheckout — fires when checkout form first renders
     * @param {object} data - { content_ids, value, currency, num_items }
     */
    trackInitiateCheckout: function (data) {
      fireEvent('InitiateCheckout', {
        content_type: 'product',
        content_ids: data.content_ids || [],
        value: data.value || 0,
        currency: data.currency || 'EUR',
        num_items: data.num_items || 1
      });
    },

    /**
     * AddPaymentInfo — fires when user enters email + selects quantity
     * @param {object} data - { content_ids, value, currency, num_items }
     */
    trackAddPaymentInfo: function (data) {
      fireEvent('AddPaymentInfo', {
        content_type: 'product',
        content_ids: data.content_ids || [],
        value: data.value || 0,
        currency: data.currency || 'EUR',
        num_items: data.num_items || 1
      });
    },

    /**
     * Purchase — fires on thank-you page after successful order
     * @param {object} data     - { content_ids, contents, value, currency, num_items, order_id }
     * @param {object} userData - { em, ph, fn, ln, ct, zp, country, st } for maximum EMQ
     * @param {object} options  - { event_id } — MUST use 'purchase_' + orderId for dedup
     */
    trackPurchase: function (data, userData, options) {
      fireEvent('Purchase', {
        content_type: 'product',
        content_ids: data.content_ids || [],
        contents: data.contents || [],
        value: data.value || 0,
        currency: data.currency || 'EUR',
        num_items: data.num_items || 1,
        order_id: data.order_id || ''
      }, userData || {}, options);
    }
  };

  // ─── AnalyticsTracker (lightweight internal analytics) ──────────

  window.AnalyticsTracker = {
    PROJECT_ID: PROJECT_ID,
    visitorId: getOrCreateExternalId(),
    sessionId: (function () {
      var key = '_mt_session';
      var stored = sessionStorage.getItem(key);
      if (stored) return stored;
      var id = uuid();
      try { sessionStorage.setItem(key, id); } catch (e) { /* */ }
      return id;
    })(),
    trackEvent: function (name, data) {
      console.log('[AnalyticsTracker]', name, data || '');
    }
  };

  // ─── Initialize: fetch pixel config + load SDK ─────────────────

  function init() {
    var configUrl = MEDUSA_URL + '/public/meta-pixel-config/' + PROJECT_ID;

    fetch(configUrl)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.pixel_id && data.enabled) {
          pixelId = data.pixel_id;
          loadPixelSDK(pixelId);
        } else {
          console.log('[MetaTracker] Pixel not configured or disabled for', PROJECT_ID);
          // Mark as ready so events don't queue forever (they'll just log to console)
          pixelReady = true;
        }
      })
      .catch(function (err) {
        console.warn('[MetaTracker] Failed to fetch pixel config:', err);
        // Mark ready to prevent infinite queue — events will still fire fbq if loaded externally
        pixelReady = true;
      });
  }

  // Start immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

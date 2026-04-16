/*!
 * Marketing HQ — storefront tracking snippet
 * Load via: <script async src="https://www.marketing-hq.eu/public/marketing/marketing.js"
 *                   data-brand="loslatenboek"
 *                   data-api="https://www.marketing-hq.eu"></script>
 *
 * Exposes a global `window.Marketing` with:
 *   Marketing.identify(email, traits?)
 *   Marketing.track(event_type, properties?)
 *   Marketing.page(properties?)
 *   Marketing.subscribe(email, formId?)
 *   Marketing.reset()
 *
 * Design goals:
 *   - Never block page render (fire-and-forget with keepalive).
 *   - Graceful degradation: queue up to 10 events in sessionStorage, retry on next load.
 *   - Debounce rapid tracks (100ms coalesce).
 */
(function (global) {
  'use strict';

  if (global.Marketing && global.Marketing.__v) {
    // Already initialized — don't double-bind.
    return;
  }

  // ─── Config ──────────────────────────────────────────────────────────────
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('marketing.js') !== -1) return scripts[i];
      }
      return null;
    })();

  var dataset = (currentScript && currentScript.dataset) || {};
  var BRAND = dataset.brand || '';
  var API =
    (dataset.api || '').replace(/\/+$/, '') ||
    (currentScript && currentScript.src
      ? currentScript.src.replace(/\/public\/marketing\/.*$/, '')
      : '');

  var MAX_QUEUE = 10;
  var DEBOUNCE_MS = 100;
  var RETRY_KEY = 'mkt_retry_queue';
  var EMAIL_KEY = 'mkt_email';
  var TRAITS_KEY = 'mkt_traits';
  var SESSION_KEY = 'mkt_sid';

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function safeLocalGet(k) {
    try { return global.localStorage && global.localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeLocalSet(k, v) {
    try { global.localStorage && global.localStorage.setItem(k, v); } catch (e) {}
  }
  function safeLocalDel(k) {
    try { global.localStorage && global.localStorage.removeItem(k); } catch (e) {}
  }
  function safeSessionGet(k) {
    try { return global.sessionStorage && global.sessionStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSessionSet(k, v) {
    try { global.sessionStorage && global.sessionStorage.setItem(k, v); } catch (e) {}
  }

  function uuid() {
    // RFC4122 v4-ish, browser-safe without crypto.randomUUID dependence.
    if (global.crypto && global.crypto.randomUUID) {
      try { return global.crypto.randomUUID(); } catch (e) {}
    }
    var d = Date.now();
    if (global.performance && typeof global.performance.now === 'function') {
      d += global.performance.now();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getSessionId() {
    var sid = safeSessionGet(SESSION_KEY);
    if (!sid) {
      sid = uuid();
      safeSessionSet(SESSION_KEY, sid);
    }
    return sid;
  }

  function getEmail() { return safeLocalGet(EMAIL_KEY) || null; }
  function setEmail(v) { if (v) safeLocalSet(EMAIL_KEY, v); else safeLocalDel(EMAIL_KEY); }

  function getTraits() {
    try {
      var raw = safeLocalGet(TRAITS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function setTraits(t) {
    try { safeLocalSet(TRAITS_KEY, JSON.stringify(t || {})); } catch (e) {}
  }

  // ─── Network ─────────────────────────────────────────────────────────────
  function post(path, body) {
    if (!API) return Promise.reject(new Error('marketing: no api'));
    var url = API + path;
    var payload = JSON.stringify(body || {});

    // Prefer fetch with keepalive (survives page unload).
    if (global.fetch) {
      try {
        return global.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
          credentials: 'omit',
          mode: 'cors'
        });
      } catch (e) {
        // fall through
      }
    }
    // Fallback: sendBeacon (no response, but reliable on unload).
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([payload], { type: 'application/json' });
        var ok = navigator.sendBeacon(url, blob);
        return ok ? Promise.resolve() : Promise.reject(new Error('beacon failed'));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return Promise.reject(new Error('no transport'));
  }

  // ─── Retry queue (graceful degradation) ──────────────────────────────────
  function loadQueue() {
    try {
      var raw = safeSessionGet(RETRY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveQueue(arr) {
    try { safeSessionSet(RETRY_KEY, JSON.stringify((arr || []).slice(-MAX_QUEUE))); } catch (e) {}
  }
  function enqueue(path, body) {
    var q = loadQueue();
    q.push({ p: path, b: body, t: Date.now() });
    saveQueue(q);
  }
  function flushQueue() {
    var q = loadQueue();
    if (!q.length) return;
    // Clear optimistically; re-enqueue failures.
    saveQueue([]);
    q.forEach(function (item) {
      post(item.p, item.b).catch(function () { enqueue(item.p, item.b); });
    });
  }

  function send(path, body) {
    return post(path, body).catch(function () { enqueue(path, body); });
  }

  // ─── Debounce / coalesce rapid track calls ───────────────────────────────
  var pending = []; // queued events within debounce window
  var timer = null;

  function flushPending() {
    timer = null;
    var events = pending;
    pending = [];
    events.forEach(function (ev) { send('/public/marketing/track', ev); });
  }

  function scheduleTrack(body) {
    pending.push(body);
    if (timer) return;
    timer = setTimeout(flushPending, DEBOUNCE_MS);
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  function buildBase(properties) {
    return {
      brand_slug: BRAND,
      email: getEmail(),
      session_id: getSessionId(),
      properties: Object.assign(
        {
          url: global.location && global.location.href,
          path: global.location && global.location.pathname,
          referrer: global.document && global.document.referrer,
          title: global.document && global.document.title,
          user_agent: global.navigator && global.navigator.userAgent,
          screen_w: global.screen && global.screen.width,
          screen_h: global.screen && global.screen.height,
          lang: (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || ''
        },
        properties || {}
      )
    };
  }

  function track(event_type, properties) {
    if (!event_type) return;
    var body = buildBase(properties);
    body.event_type = event_type;
    scheduleTrack(body);
  }

  function page(properties) {
    track('page_viewed', properties || {});
  }

  function identify(email, traits) {
    if (!email) return;
    setEmail(email);
    if (traits && typeof traits === 'object') {
      var merged = Object.assign({}, getTraits(), traits);
      setTraits(merged);
    }
    track('identified', traits || {});
  }

  function subscribe(email, formId) {
    if (!email) return Promise.reject(new Error('marketing: email required'));
    setEmail(email);
    var body = {
      brand_slug: BRAND,
      form_id: formId || null,
      email: email,
      properties: {
        session_id: getSessionId(),
        source_url: global.location && global.location.href,
        referrer: global.document && global.document.referrer,
        user_agent: global.navigator && global.navigator.userAgent
      }
    };
    return send('/public/marketing/form-submit', body);
  }

  function reset() {
    setEmail(null);
    safeLocalDel(TRAITS_KEY);
  }

  global.Marketing = {
    __v: 1,
    identify: identify,
    track: track,
    page: page,
    subscribe: subscribe,
    reset: reset,
    _config: function () { return { brand: BRAND, api: API }; }
  };

  // ─── Auto-init ───────────────────────────────────────────────────────────
  function autoInit() {
    // Retry anything queued from a previous page.
    flushQueue();
    // Auto page view.
    page();
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // Flush again right before unload (best-effort).
  if (global.addEventListener) {
    global.addEventListener('pagehide', function () {
      if (timer) {
        clearTimeout(timer);
        flushPending();
      }
    });
  }
})(typeof window !== 'undefined' ? window : this);

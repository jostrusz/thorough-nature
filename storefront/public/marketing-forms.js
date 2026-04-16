/*!
 * Marketing HQ — popup / embedded / flyout / banner form renderer
 * Load via:
 *   <script async src="https://www.marketing-hq.eu/public/marketing/marketing-forms.js"
 *           data-brand="loslatenboek"
 *           data-form="FORM_ID"
 *           data-api="https://www.marketing-hq.eu"></script>
 *
 * Behavior:
 *   - GET /public/marketing/form/{form_id}/config
 *   - Renders one of: popup | embedded | flyout | banner
 *   - Respects form.status === 'live'
 *   - Popup trigger: form.config.delay_ms or form.config.exit_intent === true
 *   - Embedded target: <div id="mkt-form-{id}"></div>
 *   - Submits to POST /public/marketing/form-submit
 *   - Calls window.Marketing.track('form_dismissed', {form_id}) on close if available
 */
(function (global) {
  'use strict';

  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('marketing-forms.js') !== -1) return scripts[i];
      }
      return null;
    })();

  var dataset = (currentScript && currentScript.dataset) || {};
  var BRAND = dataset.brand || '';
  var FORM_ID = dataset.form || '';
  var API =
    (dataset.api || '').replace(/\/+$/, '') ||
    (currentScript && currentScript.src
      ? currentScript.src.replace(/\/public\/marketing\/.*$/, '')
      : '');

  if (!FORM_ID) {
    console.warn('[marketing-forms] missing data-form attribute');
    return;
  }

  var SEEN_KEY = 'mkt_form_seen_' + FORM_ID;
  var SUBMITTED_KEY = 'mkt_form_submitted_' + FORM_ID;

  function safeGet(store, k) { try { return store && store.getItem(k); } catch (e) { return null; } }
  function safeSet(store, k, v) { try { store && store.setItem(k, v); } catch (e) {} }

  function track(event, props) {
    if (global.Marketing && typeof global.Marketing.track === 'function') {
      global.Marketing.track(event, props || {});
    }
  }

  // ─── Styles (minimal, inlined) ───────────────────────────────────────────
  var CSS = [
    '.mkt-hidden{display:none!important}',
    '.mkt-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;animation:mktFade .25s ease}',
    '.mkt-popup{background:#fff;border-radius:12px;max-width:440px;width:100%;padding:28px 24px;box-shadow:0 10px 40px rgba(0,0,0,.25);position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#222}',
    '.mkt-flyout{position:fixed;right:20px;bottom:20px;max-width:360px;width:calc(100% - 40px);background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:20px;z-index:2147483600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#222;animation:mktSlideUp .3s ease}',
    '.mkt-banner{position:fixed;left:0;right:0;z-index:2147483600;background:#111;color:#fff;padding:12px 48px 12px 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center}',
    '.mkt-banner.mkt-top{top:0}.mkt-banner.mkt-bottom{bottom:0}',
    '.mkt-embedded{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#222;border:1px solid #e5e5e5;border-radius:10px;padding:20px;background:#fff}',
    '.mkt-close{position:absolute;top:8px;right:10px;width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:#666;font-size:22px;line-height:1;cursor:pointer}',
    '.mkt-close:hover{background:rgba(0,0,0,.06);color:#000}',
    '.mkt-banner .mkt-close{position:static;color:inherit;width:auto;height:auto;font-size:20px;padding:0 4px}',
    '.mkt-title{margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.3}',
    '.mkt-subtitle{margin:0 0 16px;font-size:14px;line-height:1.5;color:#555}',
    '.mkt-field{margin:0 0 12px}',
    '.mkt-field label{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#333}',
    '.mkt-field input,.mkt-field textarea,.mkt-field select{width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box;font-family:inherit;background:#fff;color:#222}',
    '.mkt-field input:focus,.mkt-field textarea:focus,.mkt-field select:focus{outline:2px solid #3b82f6;outline-offset:-1px;border-color:#3b82f6}',
    '.mkt-consent{font-size:12px;color:#666;margin:12px 0;line-height:1.4;display:flex;gap:6px;align-items:flex-start}',
    '.mkt-consent input{margin-top:2px}',
    '.mkt-btn{width:100%;padding:12px;background:#111;color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}',
    '.mkt-btn:hover{background:#333}',
    '.mkt-btn:disabled{opacity:.6;cursor:not-allowed}',
    '.mkt-err{color:#c0392b;font-size:13px;margin:6px 0 0;min-height:16px}',
    '.mkt-ok{color:#27ae60;font-size:14px;text-align:center;padding:12px 0;line-height:1.5}',
    '.mkt-banner .mkt-field{margin:0;flex:1;min-width:200px;max-width:300px}',
    '.mkt-banner .mkt-field input{background:#fff;color:#111}',
    '.mkt-banner .mkt-btn{width:auto;padding:8px 16px}',
    '.mkt-banner .mkt-title{font-size:15px;margin:0}',
    '@keyframes mktFade{from{opacity:0}to{opacity:1}}',
    '@keyframes mktSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
    '@media(max-width:480px){.mkt-flyout{right:10px;left:10px;bottom:10px;max-width:none;width:auto}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('mkt-forms-css')) return;
    var style = document.createElement('style');
    style.id = 'mkt-forms-css';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'style') el.setAttribute('style', attrs[k]);
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }

  // ─── Config fetch ────────────────────────────────────────────────────────
  function fetchConfig() {
    return fetch(API + '/public/marketing/form/' + encodeURIComponent(FORM_ID) + '/config', {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) throw new Error('config fetch failed: ' + r.status);
      return r.json();
    });
  }

  // ─── Submit ──────────────────────────────────────────────────────────────
  function submit(form, fieldValues) {
    var body = {
      brand_slug: BRAND,
      form_id: FORM_ID,
      email: fieldValues.email || '',
      properties: Object.assign({}, fieldValues, {
        source_url: global.location && global.location.href,
        referrer: document.referrer,
        user_agent: navigator.userAgent
      })
    };
    return fetch(API + '/public/marketing/form-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) throw new Error('submit failed: ' + r.status);
      return r.json().catch(function () { return {}; });
    });
  }

  // ─── Form body builder ───────────────────────────────────────────────────
  function buildFormBody(form, onSuccess) {
    var cfg = form.config || {};
    var fields = (cfg.fields && cfg.fields.length) ? cfg.fields : [{ name: 'email', type: 'email', label: 'Email', required: true }];

    var title = cfg.title || form.name || '';
    var subtitle = cfg.subtitle || cfg.description || '';
    var buttonLabel = cfg.button_label || cfg.submit_label || 'Subscribe';
    var consentText = cfg.consent_text || '';
    var consentRequired = cfg.consent_required !== false && !!consentText;

    var inputs = {};
    var fieldEls = fields.map(function (f) {
      var id = 'mkt-f-' + FORM_ID + '-' + f.name;
      var attrs = {
        id: id,
        name: f.name,
        type: f.type || 'text',
        placeholder: f.placeholder || ''
      };
      if (f.required) attrs.required = 'required';
      if (f.autocomplete) attrs.autocomplete = f.autocomplete;
      var input = h('input', attrs);
      inputs[f.name] = input;
      return h('div', { class: 'mkt-field' }, [
        f.label ? h('label', { for: id, text: f.label }) : null,
        input
      ]);
    });

    var errEl = h('div', { class: 'mkt-err' });
    var successMsg = (form.success_action && form.success_action.message) || cfg.success_message || 'Thanks! Check your inbox.';

    var consentEl = null;
    var consentInput = null;
    if (consentText) {
      consentInput = h('input', { type: 'checkbox', id: 'mkt-consent-' + FORM_ID });
      consentEl = h('label', { class: 'mkt-consent', for: 'mkt-consent-' + FORM_ID }, [
        consentInput,
        h('span', { text: consentText })
      ]);
    }

    var submitBtn = h('button', { type: 'submit', class: 'mkt-btn', text: buttonLabel });

    var formEl = h('form', {
      novalidate: 'novalidate',
      onsubmit: function (e) {
        e.preventDefault();
        errEl.textContent = '';

        // Collect values + required validation
        var values = {};
        var missing = null;
        fields.forEach(function (f) {
          var v = (inputs[f.name].value || '').trim();
          values[f.name] = v;
          if (f.required && !v) missing = f;
          if (f.type === 'email' && v && v.indexOf('@') === -1) missing = f;
        });
        if (missing) {
          errEl.textContent = 'Please fill in ' + (missing.label || missing.name);
          inputs[missing.name].focus();
          return;
        }
        if (consentRequired && consentInput && !consentInput.checked) {
          errEl.textContent = 'Please accept to continue.';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '…';

        submit(form, values).then(function () {
          safeSet(global.localStorage, SUBMITTED_KEY, '1');
          onSuccess(successMsg, form.success_action);
        }).catch(function (err) {
          errEl.textContent = (err && err.message) || 'Something went wrong. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = buttonLabel;
        });
      }
    }, [
      title ? h('h3', { class: 'mkt-title', text: title }) : null,
      subtitle ? h('p', { class: 'mkt-subtitle', text: subtitle }) : null
    ].concat(fieldEls).concat([
      consentEl,
      submitBtn,
      errEl
    ]));

    return formEl;
  }

  function showSuccess(container, message, successAction) {
    container.innerHTML = '';
    container.appendChild(h('div', { class: 'mkt-ok', text: message }));
    if (successAction && successAction.type === 'redirect' && successAction.url) {
      setTimeout(function () { global.location.href = successAction.url; }, 1200);
    }
  }

  // ─── Renderers ───────────────────────────────────────────────────────────
  function renderPopup(form) {
    var cfg = form.config || {};
    var overlay = h('div', { class: 'mkt-overlay', role: 'dialog', 'aria-modal': 'true' });
    var popup = h('div', { class: 'mkt-popup' });
    var closeBtn = h('button', { type: 'button', class: 'mkt-close', 'aria-label': 'Close', html: '&times;' });

    var contentHost = h('div');
    var formBody = buildFormBody(form, function (msg, action) {
      showSuccess(contentHost, msg, action);
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 2500);
    });
    contentHost.appendChild(formBody);

    function close(reason) {
      if (!overlay.parentNode) return;
      overlay.parentNode.removeChild(overlay);
      track('form_dismissed', { form_id: FORM_ID, reason: reason || 'close' });
    }
    closeBtn.addEventListener('click', function () { close('close_btn'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close('backdrop'); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && overlay.parentNode) {
        close('escape');
        document.removeEventListener('keydown', onKey);
      }
    });

    popup.appendChild(closeBtn);
    popup.appendChild(contentHost);
    overlay.appendChild(popup);

    function show() {
      if (safeGet(global.localStorage, SUBMITTED_KEY)) return;
      if (document.body) document.body.appendChild(overlay);
      safeSet(global.sessionStorage, SEEN_KEY, '1');
      track('form_shown', { form_id: FORM_ID, type: 'popup' });
    }

    // Trigger: delay or exit_intent
    var delay = Number(cfg.delay_ms || cfg.delay || 0);
    var exitIntent = cfg.exit_intent === true;

    if (exitIntent) {
      var armed = false;
      document.addEventListener('mouseout', function onOut(e) {
        if (!e.relatedTarget && e.clientY <= 0 && !armed) {
          armed = true;
          show();
          document.removeEventListener('mouseout', onOut);
        }
      });
    }
    if (delay > 0) {
      setTimeout(function () {
        if (!overlay.parentNode) show();
      }, delay);
    }
    if (!exitIntent && !delay) {
      show();
    }
  }

  function renderEmbedded(form) {
    var target = document.getElementById('mkt-form-' + FORM_ID);
    if (!target) {
      console.warn('[marketing-forms] embedded target #mkt-form-' + FORM_ID + ' not found');
      return;
    }
    var wrap = h('div', { class: 'mkt-embedded' });
    var host = h('div');
    var formBody = buildFormBody(form, function (msg, action) { showSuccess(host, msg, action); });
    host.appendChild(formBody);
    wrap.appendChild(host);
    target.innerHTML = '';
    target.appendChild(wrap);
    track('form_shown', { form_id: FORM_ID, type: 'embedded' });
  }

  function renderFlyout(form) {
    if (safeGet(global.localStorage, SUBMITTED_KEY)) return;
    var cfg = form.config || {};
    var delay = Number(cfg.delay_ms || cfg.delay || 3000);

    var flyout = h('div', { class: 'mkt-flyout', role: 'dialog' });
    var closeBtn = h('button', { type: 'button', class: 'mkt-close', 'aria-label': 'Close', html: '&times;' });
    var host = h('div');
    var formBody = buildFormBody(form, function (msg, action) {
      showSuccess(host, msg, action);
      setTimeout(function () { if (flyout.parentNode) flyout.parentNode.removeChild(flyout); }, 2500);
    });
    host.appendChild(formBody);
    closeBtn.addEventListener('click', function () {
      if (flyout.parentNode) flyout.parentNode.removeChild(flyout);
      track('form_dismissed', { form_id: FORM_ID, reason: 'close_btn' });
    });
    flyout.appendChild(closeBtn);
    flyout.appendChild(host);

    setTimeout(function () {
      if (document.body) {
        document.body.appendChild(flyout);
        track('form_shown', { form_id: FORM_ID, type: 'flyout' });
      }
    }, delay);
  }

  function renderBanner(form) {
    if (safeGet(global.localStorage, SUBMITTED_KEY)) return;
    var cfg = form.config || {};
    var position = cfg.position === 'bottom' ? 'bottom' : 'top';

    var banner = h('div', { class: 'mkt-banner mkt-' + position, role: 'region' });
    var fields = (cfg.fields && cfg.fields.length) ? cfg.fields : [{ name: 'email', type: 'email', placeholder: 'Your email', required: true }];
    var inputs = {};
    var title = cfg.title || form.name || '';
    var buttonLabel = cfg.button_label || cfg.submit_label || 'Subscribe';

    if (title) banner.appendChild(h('strong', { class: 'mkt-title', text: title }));

    fields.forEach(function (f) {
      var input = h('input', {
        type: f.type || 'text',
        name: f.name,
        placeholder: f.placeholder || f.label || '',
        'aria-label': f.label || f.name
      });
      if (f.required) input.required = true;
      inputs[f.name] = input;
      banner.appendChild(h('div', { class: 'mkt-field' }, [input]));
    });

    var submitBtn = h('button', { type: 'button', class: 'mkt-btn', text: buttonLabel });
    var closeBtn = h('button', { type: 'button', class: 'mkt-close', 'aria-label': 'Close', html: '&times;' });
    submitBtn.addEventListener('click', function () {
      var values = {};
      var missing = null;
      fields.forEach(function (f) {
        var v = (inputs[f.name].value || '').trim();
        values[f.name] = v;
        if (f.required && !v) missing = f;
      });
      if (missing) { inputs[missing.name].focus(); return; }

      submitBtn.disabled = true;
      submit(form, values).then(function () {
        safeSet(global.localStorage, SUBMITTED_KEY, '1');
        banner.innerHTML = '';
        banner.appendChild(h('span', { class: 'mkt-ok', text: (form.success_action && form.success_action.message) || cfg.success_message || 'Thanks!' }));
        setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 2500);
      }).catch(function () {
        submitBtn.disabled = false;
      });
    });
    closeBtn.addEventListener('click', function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      track('form_dismissed', { form_id: FORM_ID, reason: 'close_btn' });
    });

    banner.appendChild(submitBtn);
    banner.appendChild(closeBtn);

    if (document.body) {
      document.body.appendChild(banner);
      track('form_shown', { form_id: FORM_ID, type: 'banner' });
    }
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────
  function init() {
    injectCss();
    fetchConfig().then(function (form) {
      if (!form || form.status !== 'live') return;

      var type = form.type || 'popup';
      if (type === 'popup') return renderPopup(form);
      if (type === 'embedded') return renderEmbedded(form);
      if (type === 'flyout') return renderFlyout(form);
      if (type === 'banner') return renderBanner(form);
      console.warn('[marketing-forms] unknown form type:', type);
    }).catch(function (err) {
      // Silent fail — don't break host page.
      if (global.console && console.warn) console.warn('[marketing-forms]', err && err.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);

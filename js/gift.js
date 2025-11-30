/* ========================================================================== */
/*  GIFT MODE (NahlTime) – js/gift.js                                         */
/* ========================================================================== */
/* 
  This file adds a “Gift Booking” mode on top of the main booking flow
  implemented in app.js. It is designed to be **additive** and safe:

  - Uses the same pages / steps from app.js.
  - Only toggles UI and sets nForm.isGift for the backend.
  - Never breaks normal booking if gift UI elements are not present.
  
  How to use in HTML (examples – optional, adapt to your design):

    <button id="btnGiftModeOn" type="button">🎁 حجز كهدية</button>
    <button id="btnGiftModeOff" type="button" class="d-none">⬅️ رجوع لحجز عادي</button>

    <!-- Example switch -->
    <label class="gift-switch">
      <input id="giftToggle" type="checkbox">
      <span>حجز كهدية</span>
    </label>

    <!-- Elements visible only in gift mode -->
    <div data-visible-when="gift">
      <!-- Gift-only inputs: receiver name, note, etc. -->
    </div>

    <!-- Elements visible only in normal (non-gift) mode -->
    <div data-visible-when="normal">
      <!-- Normal-only content -->
    </div>

  The backend can check nForm.isGift === true to treat the booking as a gift.
*/
/* ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------ */
  /*  1) INTERNAL STATE                                                       */
  /* ------------------------------------------------------------------------ */

  // Main toggle (accessible through helpers below)
  let giftMode = false;

  // Safeguard nForm global
  if (!window.nForm) {
    // Ensure nForm exists so we can safely extend it
    window.nForm = {
      isGift: false
    };
  } else if (typeof window.nForm.isGift === 'undefined') {
    window.nForm.isGift = false;
  }

  // Helper: Are we in English?
  function isEnglishLocaleSafe() {
    if (typeof window.isEnglishLocale === 'function') {
      try {
        return !!window.isEnglishLocale();
      } catch (e) {}
    }
    const raw = (document.documentElement.lang || 'ar').toLowerCase();
    return raw.startsWith('en');
  }

  /* ------------------------------------------------------------------------ */
  /*  2) GIFT SUMMARY CHIP (PATCH renderSummary)                              */
  /* ------------------------------------------------------------------------ */

  function renderGiftSummaryAddon() {
    const wrap = document.getElementById('summaryChips');
    if (!wrap) return;

    // Clean any old gift chip(s)
    wrap.querySelectorAll('.gift-chip').forEach((el) => el.remove());

    if (!window.nForm || !window.nForm.isGift) {
      return;
    }

    const isEn = isEnglishLocaleSafe();

    const chip = document.createElement('div');
    chip.className = 'chip gift-chip current';
    chip.innerHTML = `
      <i class="fa-solid fa-gift"></i>
      <span class="title">${isEn ? 'Type' : 'نوع الحجز'}:</span>
      <span class="value">${isEn ? 'Gift booking' : 'حجز كهدية'}</span>
    `;
    wrap.appendChild(chip);
  }

  // Monkey-patch renderSummary once app.js has defined it
  function patchRenderSummary() {
    const base = window.renderSummary;
    if (typeof base !== 'function') return;

    if (base.__giftPatched) {
      // Already patched
      return;
    }

    function wrappedRenderSummary(currentId) {
      base(currentId);
      try {
        renderGiftSummaryAddon();
      } catch (e) {
        console.warn('[gift] renderGiftSummaryAddon error:', e);
      }
    }
    wrappedRenderSummary.__giftPatched = true;
    window.renderSummary = wrappedRenderSummary;
  }

  /* ------------------------------------------------------------------------ */
  /*  3) APPLY GIFT MODE TO UI                                               */
  /* ------------------------------------------------------------------------ */

  function applyGiftModeUI() {
    const isEn = isEnglishLocaleSafe();

    // Mark on <html> for CSS
    document.documentElement.classList.toggle('gift-mode', giftMode);

    // Store on the shared form model (read by backend)
    window.nForm.isGift = !!giftMode;

    // Optional hero titles (if exist)
    const normalTitle = document.getElementById('heroTitleNormal');
    const giftTitle   = document.getElementById('heroTitleGift');
    if (normalTitle && giftTitle) {
      normalTitle.style.display = giftMode ? 'none' : '';
      giftTitle.style.display   = giftMode ? '' : 'none';
    }

    // Optional hero badge
    const heroBadge = document.getElementById('giftHeroBadge');
    if (heroBadge) {
      heroBadge.style.display = giftMode ? 'inline-flex' : 'none';
      heroBadge.textContent   = isEn ? 'Gift' : 'هدية';
    }

    // Toggle switch checkbox (if present)
    const giftToggle = document.getElementById('giftToggle');
    if (giftToggle && giftToggle.type === 'checkbox') {
      giftToggle.checked = giftMode;
    }

    // Show/hide normal / gift blocks
    const sections = document.querySelectorAll('[data-visible-when]');
    sections.forEach((el) => {
      const mode = (el.getAttribute('data-visible-when') || '').trim().toLowerCase();
      let show   = false;
      if (mode === 'gift') {
        show = giftMode;
      } else if (mode === 'normal') {
        show = !giftMode;
      }
      el.style.display = show ? '' : 'none';
    });

    // Optional button text tweaks
    const giftBtnOn  = document.getElementById('btnGiftModeOn');
    const giftBtnOff = document.getElementById('btnGiftModeOff');

    if (giftBtnOn && giftBtnOff) {
      giftBtnOn.classList.toggle('d-none', giftMode);
      giftBtnOff.classList.toggle('d-none', !giftMode);

      giftBtnOn.textContent = isEn ? 'Book as a gift 🎁' : 'حجز كهدية 🎁';
      giftBtnOff.textContent = isEn ? 'Back to normal booking' : 'الرجوع لحجز عادي';
    }

    // Re-render summary so the "Gift" chip appears / disappears
    if (typeof window.renderSummary === 'function') {
      try {
        window.renderSummary();
      } catch (e) {
        console.warn('[gift] renderSummary() error:', e);
      }
    }

    // Re-evaluate "Next" button availability if needed
    if (typeof window.updateNextAvailability === 'function') {
      try {
        window.updateNextAvailability();
      } catch (e) {
        console.warn('[gift] updateNextAvailability() error:', e);
      }
    }

    // Small friendly toast
    if (typeof window.showToast === 'function') {
      const msg = giftMode
        ? (isEn ? 'Gift booking mode enabled.' : 'تم تفعيل وضع الحجز كهدية 🎁')
        : (isEn ? 'Normal booking mode.' : 'تم الرجوع لوضع الحجز العادي');
      window.showToast('info', msg);
    }
  }

  function setGiftMode(on) {
    giftMode = !!on;
    applyGiftModeUI();
  }

  function toggleGiftMode() {
    setGiftMode(!giftMode);
  }

  /* ------------------------------------------------------------------------ */
  /*  4) INIT + URL PARAM HANDLING                                           */
  /* ------------------------------------------------------------------------ */

  function initGiftFlow() {
    // Ensure summary patch is installed
    patchRenderSummary();

    // URL params: ?gift=1 or ?mode=gift turn ON gift mode by default
    let defaultGift = false;
    try {
      const params = new URLSearchParams(window.location.search || '');
      const giftParam = (params.get('gift') || '').toLowerCase();
      const modeParam = (params.get('mode') || '').toLowerCase();
      if (giftParam === '1' || giftParam === 'true' || modeParam === 'gift') {
        defaultGift = true;
      }
    } catch (e) {
      console.warn('[gift] URLSearchParams failed', e);
    }

    // Wire buttons / toggles
    const giftToggle = document.getElementById('giftToggle');
    if (giftToggle && giftToggle.type === 'checkbox') {
      giftToggle.addEventListener('change', function (e) {
        setGiftMode(!!e.target.checked);
      });
    }

    const giftBtnOn  = document.getElementById('btnGiftModeOn');
    const giftBtnOff = document.getElementById('btnGiftModeOff');

    if (giftBtnOn) {
      giftBtnOn.addEventListener('click', function () {
        setGiftMode(true);
      });
    }
    if (giftBtnOff) {
      giftBtnOff.addEventListener('click', function () {
        setGiftMode(false);
      });
    }

    // Fallback: any element with data-action="gift-on" / "gift-off" / "gift-toggle"
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = (btn.getAttribute('data-action') || '').toLowerCase();
      if (action === 'gift-on') {
        setGiftMode(true);
      } else if (action === 'gift-off') {
        setGiftMode(false);
      } else if (action === 'gift-toggle') {
        toggleGiftMode();
      }
    });

    // Initial state
    setGiftMode(defaultGift);
  }

  /* ------------------------------------------------------------------------ */
  /*  5) EXPORT PUBLIC HELPERS                                               */
  /* ------------------------------------------------------------------------ */

  window.setGiftMode   = setGiftMode;
  window.toggleGiftMode = toggleGiftMode;
  window.initGiftFlow   = initGiftFlow;

  /* ------------------------------------------------------------------------ */
  /*  6) AUTO-INIT WHEN DOM READY                                            */
  /* ------------------------------------------------------------------------ */

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Slight delay to ensure app.js initialises first
    setTimeout(initGiftFlow, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initGiftFlow, 0);
    });
  }
})();

/* ========================================================================== */
/* TERMS MODAL (DYNAMIC FROM GOOGLE SHEET BY appId)                           */
/* ========================================================================== */

const TERMS_API_URL = `${API_BASE}/api/terms`;

let termsLoaded      = false;
let termsLoading     = false;
let termsCache       = null;

/**
 * Fetch terms content from backend via /api/terms
 * based on APP_ID + current locale (ar/en).
 */
async function fetchTermsForModal() {
  if (termsLoaded || termsLoading) {
    return termsCache;
  }
  termsLoading = true;

  try {
    const lang = isEnglishLocale() ? 'en' : 'ar';
    const params = new URLSearchParams({
      appId: APP_ID,
      lang
    });

    const url = `${TERMS_API_URL}?${params.toString()}`;
    console.log('[terms] Fetching terms from', url);

    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('[terms] JSON parse error:', parseErr, text);
      if (typeof showToast === 'function') {
        showToast('error', 'تعذر قراءة إعدادات الشروط من الخادم.');
      }
      termsCache = null;
      return null;
    }

    console.log('[terms] API response:', data);

    if (!data || data.ok === false || !data.terms) {
      const msg = (data && data.error) || 'لم يتم العثور على نص الشروط.';
      if (typeof showToast === 'function') {
        showToast('error', msg);
      }
      termsCache = null;
      return null;
    }

    termsCache   = data.terms;
    termsLoaded  = true;
    return termsCache;
  } catch (err) {
    console.error('[terms] fetchTermsForModal error:', err);
    if (typeof showToast === 'function') {
      showToast('error', 'تعذر تحميل الشروط والأحكام الآن.');
    }
    termsCache = null;
    return null;
  } finally {
    termsLoading = false;
  }
}

/**
 * Apply terms data into the modal DOM.
 * The sheet stores HTML (BodyAr/BodyEn) which is injected into .offers-list.
 */
function applyTermsToModal(terms) {
  const modal = document.getElementById('termsModal');
  if (!modal) return;

  const titleEl = document.getElementById('termsTitle');
  const bodyEl  = modal.querySelector('.offers-list');

  if (!bodyEl) return;

  const isEn   = isEnglishLocale();
  const title  = isEn
    ? (terms.titleEn || terms.titleAr || 'Terms & Conditions')
    : (terms.titleAr || terms.titleEn || 'الشروط والأحكام');

  const bodyHtml = isEn
    ? (terms.bodyEn || terms.bodyAr || '')
    : (terms.bodyAr || terms.bodyEn || '');

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (bodyHtml && bodyHtml.trim()) {
    // ⚠️ يتم حفظ نص HTML في الشيت مباشرة
    bodyEl.innerHTML = bodyHtml;
  } else {
    bodyEl.innerHTML = isEn
      ? '<p>No terms are configured yet for this business.</p>'
      : '<p>لم تتم إضافة نص الشروط والأحكام لهذه الخدمة بعد.</p>';
  }
}

/**
 * Open terms modal & ensure content is loaded from backend.
 */
async function openTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('offers-open');

  const bodyEl = modal.querySelector('.offers-list');
  if (bodyEl) {
    bodyEl.innerHTML = isEnglishLocale()
      ? '<p>Loading terms…</p>'
      : '<p>جاري تحميل الشروط…</p>';
  }

  const terms = await fetchTermsForModal();
  if (terms) {
    applyTermsToModal(terms);
  }
}

/**
 * Close terms modal (no state change for acceptance)
 */
function closeTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('offers-open');
}

/**
 * Wire interactions inside terms modal:
 * - backdrop click
 * - dismiss buttons
 * - accept button (sets global termsAccepted = true)
 * - ESC key to close
 */
function wireTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;

  // Click on backdrop or buttons with data-terms-dismiss="1"
  modal.addEventListener('click', (e) => {
    if (
      e.target.classList.contains('offers-backdrop') ||
      e.target.dataset.termsDismiss === '1'
    ) {
      closeTermsModal();
    }
  });

  const btnAccept = document.getElementById('btnAcceptTerms');
  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      // ✅ قبول الشروط
      termsAccepted = true;
      closeTermsModal();
      if (typeof showToast === 'function') {
        showToast(
          'success',
          isEnglishLocale()
            ? 'Terms accepted, you can continue booking ✅'
            : 'تمت الموافقة على الشروط، يمكنك إكمال الحجز ✅'
        );
      }
    });
  }

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.classList.contains('show')) {
        closeTermsModal();
      }
    }
  });
}

// 🧩 شغّل الربط بعد تحميل الـ DOM
document.addEventListener('DOMContentLoaded', wireTermsModal);

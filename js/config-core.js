// /js/config-core.js
// ✅ Global config, endpoints, and shared toast helper

// App & Backend URLs
const APP_ID = '21eddbf5-efe5-4a5d-9134-b581717b17ff';

const defaultLink2 = `https://b0sk44sswgc4kcswoo8sk0og.nahls.app/api/app/AM/general/${APP_ID}/form`;
const RESERVE_URL_PRIMARY  = `${defaultLink2}/reserveAppointment`;
const RESERVE_URL_FALLBACK = `${defaultLink2.replace(/\/form\/?$/, '')}/reserveAppointment`;

const API_BASE = window.location.origin.replace(/\/$/, '');

// Feature endpoints
const ADDITIONAL_SERVICES_URL = `${API_BASE}/api/additional-services`;
const COUPONS_API_URL         = `${API_BASE}/api/coupons/validate`;
const AREA_BOUNDS_URL         = `${API_BASE}/api/area-bounds`;
const PAYMENT_METHODS_URL     = `${API_BASE}/api/payment-methods`;
const OFFERS_API_URL          = `${API_BASE}/api/offers`;

/* ⭐⭐ REVIEW FEATURE: constants (review link + delay + API endpoint) */
const REVIEW_FORM_BASE_URL    = 'https://nahltimereview.nahl.app/?bookingid='; // ⭐ REVIEW: base URL of review form
const REVIEW_DELAY_MINUTES    = 30;                                            // ⭐ REVIEW: delay (minutes)
const REVIEW_SCHEDULE_API_URL = `${API_BASE}/api/review`;                      // ⭐ REVIEW: proxy endpoint

/* 🔐 OTP API endpoints (via proxy → Code.gs → Green API / WhatsApp) */
const OTP_REQUEST_URL = `${API_BASE}/api/otp/request`;
const OTP_VERIFY_URL  = `${API_BASE}/api/otp/verify`;

/* 🔄 Toggle OTP feature ON/OFF from here (no backend change required) */
const OTP_ENABLED        = true;  // 🟢 true = require OTP verify, 🔴 false = skip OTP
const OTP_CODE_LENGTH    = 4;
const OTP_RESEND_SECONDS = 60;

/**
 * Global toast helper (used everywhere)
 * type: 'info' | 'success' | 'error'
 */
function showToast(type = 'info', msg = '') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) {
    console.warn('[toast] toastWrap element not found');
    return;
  }

  const div = document.createElement('div');
  div.style.minWidth      = '260px';
  div.style.color         = '#fff';
  div.style.padding       = '10px 14px';
  div.style.borderRadius  = '10px';
  div.style.boxShadow     = '0 10px 28px rgba(11,38,48,.14)';
  div.style.background =
    type === 'error'   ? '#dc2626' :
    type === 'success' ? '#16a34a' :
                          '#0284c7';

  div.textContent = msg;
  wrap.appendChild(div);

  setTimeout(() => {
    div.style.opacity   = '0';
    div.style.transform = 'translateY(-6px)';
    setTimeout(() => div.remove(), 180);
  }, 2400);
}

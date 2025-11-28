// /js/booking-core.js
// 🎯 Core booking flow: state, navigation, summary, time slots, payload building

// Luxon shortcut
const DateTime = luxon.DateTime;

// Network controllers for abortable fetches
let controllers = [];

// Global booking state
let selectedTime       = null;
let servicesCache      = null;
let categoriesCache    = null;
let itiPhone           = null;
let positionUrl        = "";
let lastSelectedISO    = "";
let isSubmitting       = false;
let currentTimeFilter  = 'all';

// Pricing + extras
let additionalServicesList   = [];
let baseServicePrice         = 0;
let additionalServicesTotal  = 0;

// Coupon state
let couponCodeApplied   = '';
let couponDiscountAmount = 0;
let couponMeta          = null;

// OTP state (used by trust-verification.js)
let otpRequested      = false;
let otpVerified       = false;
let otpLastSentAt     = null;
let otpCountdownTimer = null;

// Terms & Conditions state
let termsAccepted = false;

// Main form model
const nForm = {
  date: '',
  time: '',
  location: '',
  service: '',
  serviceCount: '1',
  serviceCat: '',
  customerM: '',
  customerN: '',
  paymentMethod: '',
  urlLocation: '',
  locationDescription: '',
  locale: 'ar',
  additionalServicesIds: [],
  additionalServicesLabels: [],
  couponCode: ''
};

// Steps & pages
const orderedPages = ["page1", "page2", "page3", "page4", "page5", "page6", "page7"];
const STEPS_LABELS    = ["الترحيب", "الخدمة", "الوقت", "البيانات", "الدفع", "الموقع", "تم"];
const STEPS_LABELS_EN = ["Welcome", "Service", "Time", "Details", "Payment", "Location", "Done"];

const PAGE_BACKGROUNDS = {
  page1: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG1.jpg",
  page2: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG2.jpg",
  page3: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG3.jpg",
  page4: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG4.jpg",
  page5: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG5.jpg",
  page6: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG6.jpg",
  page7: "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG7.jpg"
};

const STEP_GROUP_INDEX = {
  page1: 0,
  page2: 1,
  page3: 2,
  page4: 3,
  page5: 4,
  page6: 5,
  page7: 6
};

/* ─────────────────────────────
 *  Networking helpers
 * ────────────────────────────*/

async function callContent2(path, cb, abortable = false, retries = 3) {
  let signal = '';
  if (abortable) {
    controllers.forEach(([c]) => c.abort());
    controllers = [];
    const controller = new AbortController();
    signal = controller.signal;
    controllers.push([controller, signal]);
  }
  try {
    await new Promise(r => setTimeout(r, 200));
    const res = await fetch(defaultLink2 + path, {
      method: 'GET',
      redirect: 'follow',
      ...(abortable && { signal }),
      cache: 'no-store'
    });
    if (!res.ok) {
      if (retries > 0) return callContent2(path, cb, abortable, retries - 1);
      throw new Error('Network');
    }
    cb(await res.json());
  } catch (e) {
    if (!String(e).includes('AbortError') && retries > 0) {
      setTimeout(() => callContent2(path, cb, abortable, retries - 1), 600);
    }
  }
}

async function postReservationTry(url, payload, contentType = 'text/plain;charset=UTF-8') {
  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) {}
    return { ok: res.ok, status: res.status, data, raw };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

async function postReservation(payload) {
  let r = await postReservationTry(RESERVE_URL_PRIMARY, payload, 'text/plain;charset=UTF-8');
  if (!r.ok && (r.status === 415 || r.status === 406 || r.status === 0)) {
    r = await postReservationTry(RESERVE_URL_PRIMARY, payload, 'application/json;charset=UTF-8');
  }
  if (!r.ok && r.status === 404) {
    r = await postReservationTry(RESERVE_URL_FALLBACK, payload, 'text/plain;charset=UTF-8');
  }
  return r;
}

/* ─────────────────────────────
 *  Locale helpers
 * ────────────────────────────*/

// 🌐 ضبط اللغة من بارامتر ?lang=en أو افتراضي عربي
(function initLocale() {
  try {
    const params   = new URLSearchParams(window.location.search || '');
    const langParam = (params.get('lang') || '').toLowerCase();
    if (langParam === 'en') {
      nForm.locale = 'en';
      document.documentElement.lang = 'en';
      document.documentElement.dir  = 'ltr';
    } else {
      nForm.locale = 'ar';
      document.documentElement.lang = 'ar';
      document.documentElement.dir  = 'rtl';
    }
  } catch (e) {
    console.warn('Locale init failed', e);
  }
})();

function isEnglishLocale() {
  const localeRaw = (nForm.locale || document.documentElement.lang || 'ar').toLowerCase();
  return localeRaw.startsWith('en');
}

/* ─────────────────────────────
 *  Service description & pricing
 * ────────────────────────────*/

function getServiceDescription(s) {
  const isEnglish = isEnglishLocale();
  if (isEnglish) {
    return (s.TS_service_descriptionEN || s.TS_service_descriptionAR || '').trim();
  } else {
    return (s.TS_service_descriptionAR || s.TS_service_descriptionEN || '').trim();
  }
}

function formatServicePrice(priceRaw) {
  if (priceRaw === null || priceRaw === undefined || priceRaw === '') return '';
  const num = Number(priceRaw);
  const isEnglish = isEnglishLocale();

  if (!isFinite(num)) {
    return isEnglish
      ? `${priceRaw} SAR (incl. VAT)`
      : `${priceRaw} ر.س (شامل الضريبة)`;
  }

  const formatter = new Intl.NumberFormat(isEnglish ? 'en-SA' : 'ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const formatted = formatter.format(num);
  return isEnglish
    ? `${formatted} SAR (incl. VAT)`
    : `${formatted} ر.س (شامل الضريبة)`;
}

function formatTotalAmount(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const isEnglish = isEnglishLocale();
  const formatter = new Intl.NumberFormat(isEnglish ? 'en-SA' : 'ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const formatted = formatter.format(value);
  return isEnglish ? `${formatted} SAR` : `${formatted} ر.س`;
}

function getCarCount() {
  const raw = $('#serviceCount').val() || '1';
  const n   = parseInt(raw, 10);
  return (!isNaN(n) && n > 0) ? n : 1;
}

function getOrderSubtotal() {
  const carCount = getCarCount();
  const perCar   = (Number(baseServicePrice) || 0) + (Number(additionalServicesTotal) || 0);
  return perCar * carCount;
}

function updateFooterTotal() {
  const subtotal = getOrderSubtotal();
  const discount = Math.min(subtotal, Number(couponDiscountAmount) || 0);
  const finalTotal = Math.max(0, subtotal - discount);
  const el = document.getElementById('footer-total-value');
  if (el) {
    el.textContent = formatTotalAmount(finalTotal);
  }
}

/* ─────────────────────────────
 *  Page navigation & progress
 * ────────────────────────────*/

function setPageBackground(id) {
  document.documentElement.style.setProperty(
    '--page-bg',
    `url("${PAGE_BACKGROUNDS[id] || PAGE_BACKGROUNDS.page1}")`
  );
}

function getActiveIndex() {
  const id = document.querySelector('.page.active')?.id;
  return Math.max(0, orderedPages.indexOf(id));
}

function syncProgress(i) {
  const pct = ((i + 1) / orderedPages.length) * 100;
  const bar = document.getElementById('miniBarFill');
  if (bar) bar.style.width = pct + '%';

  const isEn   = isEnglishLocale();
  const labels = isEn ? STEPS_LABELS_EN : STEPS_LABELS;
  const titleEl = document.getElementById('miniStepTitle');
  if (titleEl) {
    titleEl.textContent = labels[Math.min(i, labels.length - 1)];
  }

  const prev = document.getElementById('footer-prev');
  const next = document.getElementById('footer-next');
  const wait = document.getElementById('footer-wait');
  const onThanks = (orderedPages[i] === 'page7');

  if (prev) prev.classList.toggle('hidden', i === 0 || onThanks);
  if (next) next.classList.toggle('hidden', onThanks);
  if (wait) wait.classList.remove('show');

  if (next) {
    if (isEn) {
      next.textContent = (i === 0) ? 'Skip intro' : 'Next';
    } else {
      next.textContent = (i === 0) ? 'تخطي العرض' : 'التالي';
    }
  }
}

function showPage(idx) {
  const cur  = document.querySelector('.page.active');
  const next = document.getElementById(orderedPages[idx]);
  if (!next || cur === next) return;

  if (cur && cur.id === 'page1' && typeof stopWelcomeDeck === 'function') {
    stopWelcomeDeck();
  }
  if (cur) {
    cur.classList.remove('active');
    cur.classList.add('exit');
  }

  next.style.display = 'flex';
  requestAnimationFrame(() => {
    next.classList.add('active');
    setTimeout(() => {
      if (cur) {
        cur.classList.remove('exit');
        cur.style.display = 'none';
      }
    }, 240);
  });

  syncProgress(idx);
  setPageBackground(next.id);
  renderSummary(next.id);
  updateNextAvailability();

  if (next.id === 'page1' && typeof startWelcomeDeck === 'function') {
    startWelcomeDeck();
  }

  if (next.id === 'page6' && typeof requestAreaBoundsForCurrentArea === 'function') {
    requestAreaBoundsForCurrentArea();
  }
}

function setLoadingTimes(on) {
  const el = document.getElementById('timeLoading');
  if (el) el.classList.toggle('show', !!on);
}

function setLoadingServices(on) {
  const el = document.getElementById('servicesLoading');
  if (el) el.classList.toggle('show', !!on);
}

/* ─────────────────────────────
 *  Plate helper (nice UX)
 * ────────────────────────────*/

function isSpecialPlate(num) {
  if (!/^\d+$/.test(num) || num.length < 3) return false;
  const same       = /^(\d)\1+$/.test(num);
  const asc        = ('01234567890123456789').includes(num);
  const desc       = ('98765432109876543210').includes(num);
  const pal        = num === num.split('').reverse().join('');
  const pairRepeat = (num.length % 2 === 0) && /^(\d{2})\1+$/.test(num);
  return same || asc || desc || pal || pairRepeat;
}

function updatePlateHint() {
  const raw = ($('#plateNumber').val() || '');
  const v   = raw.replace(/\D/g, '');

  $('#plateNumber').val(v);
  const txt = v
    ? (isSpecialPlate(v) ? 'رقم مميز 👌 — ممتاز للتوثيق السريع.' : 'اختياري — يساعد فريقنا على التعرف على مركبتك.')
    : 'اختياري — يساعد فريقنا على التعرف على مركبتك';

  $('#plateHelp').text(txt);
  const pe = document.getElementById('err-plate');
  if (pe) pe.style.display = 'none';
}

/* ─────────────────────────────
 *  Step summary chips
 * ────────────────────────────*/

function renderSummary(currentId) {
  const wrap = document.getElementById('summaryChips');
  if (!wrap) return;

  const activeId  = currentId || (document.querySelector('.page.active')?.id) || 'page1';
  const currGroup = STEP_GROUP_INDEX[activeId] ?? 0;

  wrap.style.display = currGroup === 0 ? 'none' : 'flex';
  if (currGroup === 0) {
    wrap.innerHTML = '';
    return;
  }

  const areaTxt = $('#area').find(':selected').text() || '';
  const srvTxt  = $('#service').find(':selected').text() || '';
  const dt      = nForm.date ? DateTime.fromISO(nForm.date).toFormat('d LLL yyyy') : '';
  const tm      = nForm.time || '';
  const pay     = (nForm.paymentMethod || '');
  const locOk   = !!positionUrl;
  const extras  = (nForm.additionalServicesLabels || []).join('، ');
  const couponTxt = couponCodeApplied ? couponCodeApplied : '';

  const chips = [
    { i: 'fa-location-dot',     t: 'المنطقة',        v: areaTxt,   g: 1 },
    { i: 'fa-screwdriver-wrench', t: 'الخدمة',      v: srvTxt,    g: 1 },
    { i: 'fa-plus',             t: 'خدمات إضافية',  v: extras,    g: 1 },
    { i: 'fa-ticket',           t: 'الكوبون',       v: couponTxt, g: 4 },
    { i: 'fa-clock',            t: 'الموعد',        v: (dt && tm) ? `${dt} • ${tm}` : '', g: 2 },
    { i: 'fa-credit-card',      t: 'الدفع',         v: (pay ? pay.toUpperCase() : ''),   g: 4 },
    { i: 'fa-map-pin',          t: 'الموقع',        v: (locOk ? 'تم التحديد' : ''),      g: 5 }
  ];

  wrap.innerHTML = '';
  chips
    .filter(c => c.v && c.g <= currGroup)
    .forEach(c => {
      const el = document.createElement('div');
      el.className = 'chip' + (c.g === currGroup ? ' current' : '');
      el.innerHTML =
        `<i class="fa-solid ${c.i}"></i>` +
        `<span class="title">${c.t}:</span>` +
        `<span class="value">${c.v}</span>`;
      wrap.appendChild(el);
    });
}

/* ─────────────────────────────
 *  Welcome deck (slides on page1)
 *  (full logic will be in ux-intro.js, but globals here)
 * ────────────────────────────*/

let deckTimers = [];
let deckIndex  = 0;
let deckRunning = false;
const SLIDE_MS = 2600;
const GAP_MS   = 220;

// NOTE: real implementations will be in /js/ux-intro.js
// Here we just declare stubs to avoid ReferenceError
// if ux-intro.js is not yet loaded.
function startWelcomeDeck() {
  // Implemented in ux-intro.js (or override here if needed)
}

function stopWelcomeDeck() {
  // Implemented in ux-intro.js (or override here if needed)
}

/* ─────────────────────────────
 *  Time slots helpers
 * ────────────────────────────*/

function parseTimeToLuxon(raw) {
  let t = DateTime.fromISO(String(raw || '').trim(), { setZone: true });
  if (!t.isValid) t = DateTime.fromFormat(String(raw || ''), 'HH:mm:ss', { setZone: true });
  if (!t.isValid) t = DateTime.fromFormat(String(raw || ''), 'H:mm a',   { setZone: true });
  if (!t.isValid) t = DateTime.fromFormat(String(raw || ''), 'H:mm',     { setZone: true });
  return t.isValid ? t : null;
}

function normalizeAvailability(r) {
  const s = String(r.TS_status || r.status || r.TS_appointment_status || '').toLowerCase();
  const f = (typeof r.isAvailable === 'boolean') ? r.isAvailable : undefined;
  const b = Number(r.TS_booked   ?? r.booked);
  const c = Number(r.TS_capacity ?? r.capacity);
  let rem = Number(r.TS_remaining ?? r.remaining);
  if (!Number.isFinite(rem) && Number.isFinite(c) && Number.isFinite(b)) rem = c - b;
  const open =
    f === true ||
    ['available', 'open', 'free', 'empty', 'vacant', 'canceled'].includes(s) ||
    (Number.isFinite(rem) ? rem > 0 : (f !== false && !s));
  return { looksOpen: open, remaining: rem };
}

let dayTimes   = [];
let timesLoaded = false;

function timeInMins(h, m) {
  return (h * 60) + m;
}

function passesFilter(mins) {
  if (currentTimeFilter === 'all')       return true;
  if (currentTimeFilter === 'morning')   return mins >= timeInMins(6, 0)  && mins < timeInMins(11, 0);
  if (currentTimeFilter === 'afternoon') return mins >= timeInMins(11, 0) && mins < timeInMins(16, 0);
  if (currentTimeFilter === 'evening')   return mins >= timeInMins(16, 0) && mins < timeInMins(21, 0);
  if (currentTimeFilter === 'night')     return mins >= timeInMins(21, 0) && mins < timeInMins(24, 0);
  return true;
}

function fetchTimesForSelectedDate() {
  const dateEl        = document.getElementById('date');
  const timeContainer = document.getElementById('time-container');
  const loc           = $('#area').val()   || '';
  const srv           = $('#service').val() || '';

  const selectedISO = (dateEl.value || DateTime.now().toFormat('yyyy-LL-dd')).trim();
  lastSelectedISO   = selectedISO;

  if (!loc || !srv) {
    if (timeContainer) {
      timeContainer.innerHTML =
        `<div style="grid-column:1/-1;justify-self:center" class="text-muted">` +
        `اختر المنطقة والخدمة لعرض المواعيد</div>`;
    }
    window.selectedTime = null;
    selectedTime = null;
    updateNextAvailability();
    return;
  }

  dateEl.disabled = true;
  setLoadingTimes(true);
  if (timeContainer) {
    timeContainer.innerHTML =
      `<div class="spinner-border text-info" role="status" style="grid-column:1/-1;justify-self:center;"></div>`;
  }

  const now     = DateTime.now().setZone('Asia/Riyadh');
  const isToday = selectedISO === now.toISODate();

  const qs = `/appointments?startDate=${encodeURIComponent(selectedISO)}` +
             `&location=${encodeURIComponent(loc)}` +
             `&service=${encodeURIComponent(srv)}` +
             `&onlyAvailable=1`;

  callContent2(qs, (res) => {
    const rows = (res?.data?.appointments || []);
    const filtered = rows.filter(r => {
      const d = DateTime.fromISO(r.TS_appointment_date, { setZone: true });
      if (!d.isValid || d.toISODate() !== selectedISO) return false;
      const t = parseTimeToLuxon(r.TS_appointment_time);
      if (!t) return false;
      const { looksOpen } = normalizeAvailability(r);
      if (!looksOpen) return false;
      if (isToday) {
        const slot = now.set({ hour: t.hour, minute: t.minute, second: 0 });
        if (slot < now.plus({ minutes: 5 })) return false;
      }
      return true;
    });

    const list = filtered.map(r => {
      const t    = parseTimeToLuxon(r.TS_appointment_time);
      const mins = t.hour * 60 + t.minute;
      return {
        label: t.toLocaleString(DateTime.TIME_SIMPLE),
        h: t.hour,
        m: t.minute,
        mins
      };
    });

    const seen = new Set();
    dayTimes = list.filter(x => {
      if (seen.has(x.mins)) return false;
      seen.add(x.mins);
      return true;
    });
    timesLoaded = true;

    renderSelectedDateTimes(selectedISO);
    dateEl.disabled = false;
    setLoadingTimes(false);
  }, true);
}

function renderSelectedDateTimes(selectedISO) {
  const timeContainer = document.getElementById('time-container');
  if (!timeContainer) return;

  timeContainer.innerHTML = '';

  if (!timesLoaded) {
    timeContainer.innerHTML =
      `<div class="spinner-border text-info" role="status" style="grid-column:1/-1;justify-self:center;"></div>`;
    return;
  }

  const viewList = dayTimes
    .filter(x => passesFilter(x.mins))
    .sort((a, b) => a.mins - b.mins);

  if (!viewList.length) {
    timeContainer.innerHTML =
      `<div style="grid-column:1/-1;justify-self:center" class="text-muted">` +
      `لا توجد مواعيد ضمن الفلتر المحدد</div>`;
    return;
  }

  viewList.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-option';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('dir', 'ltr');
    btn.textContent = t.label;

    btn.addEventListener('click', () => {
      [...timeContainer.children].forEach(el => el.setAttribute('aria-checked', 'false'));
      btn.setAttribute('aria-checked', 'true');
      const parsed = DateTime.fromObject({ hour: t.h, minute: t.m });

      nForm.date = selectedISO;
      nForm.time = parsed.toFormat('HH:mm');
      window.selectedTime = { ui: t.label, iso: nForm.time };
      selectedTime = window.selectedTime;

      renderSummary('page3');
      updateNextAvailability();
      showPage(3);
    });

    timeContainer.appendChild(btn);
  });
}

/* ─────────────────────────────
 *  Layout helpers
 * ────────────────────────────*/

function installResizeObservers() {
  const header = document.getElementById('siteHeader');
  const footer = document.getElementById('siteFooter');
  const ro = new ResizeObserver(entries => {
    entries.forEach(entry => {
      if (entry.target.id === 'siteHeader') {
        document.documentElement
          .style
          .setProperty('--header-h', entry.contentRect.height + 'px');
      }
      if (entry.target.id === 'siteFooter') {
        document.documentElement
          .style
          .setProperty('--footer-h', entry.contentRect.height + 'px');
      }
    });
  });
  if (header) ro.observe(header);
  if (footer) ro.observe(footer);
}

/* ─────────────────────────────
 *  Payload builder (for reservation)
 * ────────────────────────────*/

function buildPayload() {
  const loc  = $('#area').val();
  const svcC = $('#serviceCat').val();
  const svc  = $('#service').val();
  const cnt  = $('#serviceCount').val() || '1';
  const phoneDigits = itiPhone?.getNumber?.()?.replace(/^\+/, '') || '';

  return {
    date: nForm.date,
    time: nForm.time,
    location:      (loc  !== null && loc  !== '') ? String(loc)  : undefined,
    service:       (svc  !== null && svc  !== '') ? String(svc)  : undefined,
    serviceCount:  String(cnt),
    serviceCat:    (svcC !== null && svcC !== '') ? String(svcC) : undefined,
    customerM: phoneDigits,
    customerN: nForm.customerN,
    paymentMethod: (nForm.paymentMethod || '').toLowerCase(),
    urlLocation:   nForm.urlLocation,
    locationDescription: nForm.locationDescription || '',
    locale: isEnglishLocale() ? 'en' : 'ar',
    additionalServices: (nForm.additionalServicesIds || []).join(','),
    couponCode:          couponCodeApplied || '',
    couponDiscountAmount: couponDiscountAmount || 0
  };
}

/* ─────────────────────────────
 *  Next button enable logic
 * ────────────────────────────*/

function updateNextAvailability() {
  const i      = getActiveIndex();
  const nextBtn = document.getElementById('footer-next');
  if (!nextBtn) return;

  let enable = true;

  if (i === 0) {
    enable = true;
  } else if (i === 1) {
    enable = !!($('#area').val() && $('#service').val());
  } else if (i === 2) {
    enable = !!selectedTime;
  } else if (i === 3) {
    const nameOk  = ($('#name').val() || '').trim().length > 0;
    const phoneOk = (window.itiPhone ? itiPhone.isValidNumber() : true);
    const otpOk   = (!OTP_ENABLED) || otpVerified;
    enable = nameOk && phoneOk && otpOk;
  } else if (i === 4) {
    enable = !!(document.querySelector('#payGroup input:checked'));
  } else if (i === 5) {
    enable = !!positionUrl;
  }

  nextBtn.disabled = !enable;
  nextBtn.classList.toggle('disabled', !enable);
}

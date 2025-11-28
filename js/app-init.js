// /js/app-init.js
// 🚀 App bootstrap: step navigation, DOM wiring, basic layout & booking flow
//
// Depends on other files for:
//  - Config: APP_ID, defaultLink2, RESERVE_URL_PRIMARY, RESERVE_URL_FALLBACK,
//            API_BASE, OTP_ENABLED, DateTime=luxon.DateTime, etc.
//  - Helpers: callContent2(), postReservation(), buildPayload(),
//             renderSummary(), scheduleReviewForBooking(), showToast(),
//             isEnglishLocale(), loadAdditionalServices(), loadPaymentMethods(),
//             wireOffersUI(), requestAreaBoundsForCurrentArea(), updateFooterTotal()
//  - Trust: termsAccepted, openTermsModal(), otpVerified, resetOtpState()  (trust-verification.js)
//  - UX:   startWelcomeDeck(), stopWelcomeDeck() (ux-intro.js)

// Progress / steps config
const orderedPages = ['page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7'];
const STEPS_LABELS = ['الترحيب', 'الخدمة', 'الوقت', 'البيانات', 'الدفع', 'الموقع', 'تم'];
const STEPS_LABELS_EN = ['Welcome', 'Service', 'Time', 'Details', 'Payment', 'Location', 'Done'];

// Background images per page (used via CSS var --page-bg)
const PAGE_BACKGROUNDS = {
  page1:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG1.jpg',
  page2:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG2.jpg',
  page3:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG3.jpg',
  page4:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG4.jpg',
  page5:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG5.jpg',
  page6:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG6.jpg',
  page7:
    'https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG7.jpg'
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

// Deck globals (used by ux-intro.js)
let deckTimers = [];
let deckIndex = 0;
let deckRunning = false;
const SLIDE_MS = 2600;
const GAP_MS = 220;

// Time selection globals
let selectedTime = null;
let lastSelectedISO = '';
let isSubmitting = false;

// These should be shared with pricing/booking core
let currentTimeFilter = 'all';

// Resize helper: keep header/footer height in CSS vars
function installResizeObservers() {
  const header = document.getElementById('siteHeader');
  const footer = document.getElementById('siteFooter');

  if (!('ResizeObserver' in window)) return;

  const ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.id === 'siteHeader') {
        document.documentElement.style.setProperty(
          '--header-h',
          entry.contentRect.height + 'px'
        );
      }
      if (entry.target.id === 'siteFooter') {
        document.documentElement.style.setProperty(
          '--footer-h',
          entry.contentRect.height + 'px'
        );
      }
    });
  });

  if (header) ro.observe(header);
  if (footer) ro.observe(footer);
}

// Background helper for current page
function setPageBackground(id) {
  document.documentElement.style.setProperty(
    '--page-bg',
    `url("${PAGE_BACKGROUNDS[id] || PAGE_BACKGROUNDS.page1}")`
  );
}

// Step navigation helpers
function getActiveIndex() {
  const id = document.querySelector('.page.active')?.id;
  return Math.max(0, orderedPages.indexOf(id));
}

function syncProgress(i) {
  const pct = ((i + 1) / orderedPages.length) * 100;
  const bar = document.getElementById('miniBarFill');
  if (bar) bar.style.width = pct + '%';

  const isEn = isEnglishLocale();
  const labels = isEn ? STEPS_LABELS_EN : STEPS_LABELS;

  const titleEl = document.getElementById('miniStepTitle');
  if (titleEl) {
    titleEl.textContent = labels[Math.min(i, labels.length - 1)];
  }

  const prev = document.getElementById('footer-prev');
  const next = document.getElementById('footer-next');
  const wait = document.getElementById('footer-wait');
  const onThanks = orderedPages[i] === 'page7';

  if (prev) prev.classList.toggle('hidden', i === 0 || onThanks);
  if (next) next.classList.toggle('hidden', onThanks);
  if (wait) wait.classList.remove('show');

  if (next) {
    if (isEn) {
      next.textContent = i === 0 ? 'Skip intro' : 'Next';
    } else {
      next.textContent = i === 0 ? 'تخطي العرض' : 'التالي';
    }
  }
}

// For showing spinners on time/service sections
function setLoadingTimes(on) {
  const el = document.getElementById('timeLoading');
  if (el) el.classList.toggle('show', !!on);
}
function setLoadingServices(on) {
  const el = document.getElementById('servicesLoading');
  if (el) el.classList.toggle('show', !!on);
}

// Next button enabler (used also from trust-verification.js & map-location.js)
function updateNextAvailability() {
  const i = getActiveIndex();
  const nextBtn = document.getElementById('footer-next');
  if (!nextBtn) return;

  let enable = true;

  if (i === 0) {
    enable = true;
  } else if (i === 1) {
    // Page 2: service selection
    enable = !!($('#area').val() && $('#service').val());
  } else if (i === 2) {
    // Page 3: time
    enable = !!selectedTime;
  } else if (i === 3) {
    // Page 4: details (name + mobile + OTP if enabled)
    const nameOk = ($('#name').val() || '').trim().length > 0;
    const phoneOk = window.itiPhone ? itiPhone.isValidNumber() : true;
    const otpOk = !window.OTP_ENABLED || window.otpVerified;
    enable = nameOk && phoneOk && otpOk;
  } else if (i === 4) {
    // Page 5: payment
    enable = !!document.querySelector('#payGroup input:checked');
  } else if (i === 5) {
    // Page 6: location
    enable = !!window.positionUrl;
  }

  nextBtn.disabled = !enable;
  nextBtn.classList.toggle('disabled', !enable);
}

// Expose for other modules
window.updateNextAvailability = updateNextAvailability;

// Main page switcher
function showPage(idx) {
  const cur = document.querySelector('.page.active');
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
  if (typeof renderSummary === 'function') {
    renderSummary(next.id);
  }
  updateNextAvailability();

  if (next.id === 'page1' && typeof startWelcomeDeck === 'function') {
    startWelcomeDeck();
  }
  if (next.id === 'page6' && typeof requestAreaBoundsForCurrentArea === 'function') {
    requestAreaBoundsForCurrentArea();
  }
}

// Expose showPage for other modules (ux-intro.js)
window.showPage = showPage;

// ✅ Main bootstrap when DOM is ready
$(function initBookingApp() {
  // 1) Layout + assets
  installResizeObservers();

  // Preload background images
  Object.values(PAGE_BACKGROUNDS).forEach((src) => {
    const i = new Image();
    i.src = src;
  });

  // 2) Select2s & phone input
  $('#area').select2({
    width: '100%',
    placeholder: 'اختر المنطقة لخدمة العناية الفاخرة',
    dir: 'rtl'
  });
  $('#serviceCat').select2({
    width: '100%',
    placeholder: 'فئة الخدمة',
    dir: 'rtl'
  });
  $('#service').select2({
    width: '100%',
    placeholder: 'باقتك المختارة',
    dir: 'rtl'
  });
  $('#carBrand').select2({
    width: '100%',
    placeholder: 'اختر ماركة المركبة (الأسماء الفاخرة أولاً)',
    dir: 'rtl'
  });
  $('#area, #serviceCat, #service, #carBrand').on('select2:open', () => {
    $('.select2-search__field').attr('dir', 'rtl');
  });

  // intl-tel-input for mobile
  window.itiPhone = window.intlTelInput(document.querySelector('#mobile'), {
    initialCountry: 'sa',
    onlyCountries: ['sa', 'ae', 'bh', 'kw', 'om', 'qa'],
    separateDialCode: true,
    placeholderNumberType: 'MOBILE',
    utilsScript:
      'https://cdn.jsdelivr.net/npm/intl-tel-input@24.4.0/build/js/utils.js'
  });

  $('#mobile')
    .attr({
      placeholder: 'رقم التواصل الخاص — مثال 5XXXXXXXX',
      inputmode: 'tel',
      autocomplete: 'tel'
    })
    .on('blur', () => {
      const ok = window.itiPhone && itiPhone.isValidNumber();
      const err = document.getElementById('err-mobile');
      if (err) err.style.display = ok ? 'none' : 'block';
      updateNextAvailability();
    })
    .on('input', () => {
      if (window.OTP_ENABLED && typeof resetOtpState === 'function') {
        resetOtpState(false);
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      updateNextAvailability();
    });

  $('#name')
    .attr('placeholder', 'الاسم كما سيظهر في الفاتورة')
    .on('input', function () {
      if (window.nForm) {
        nForm.customerN = this.value.trim();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      updateNextAvailability();
    });

  $('#carName')
    .attr('placeholder', 'الموديل/الفئة — مثال: S-Class، LX 570')
    .on('input', () => {
      updateNextAvailability();
    });

  $('#plateNumber')
    .attr('placeholder', 'أرقام اللوحة — اختياري')
    .on('input', () => {
      if (typeof updatePlateHint === 'function') {
        updatePlateHint();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      updateNextAvailability();
    });

  // Car brands suggestion order
  const luxuryFirstBrands = [
    'Rolls-Royce',
    'Bentley',
    'Mercedes-Benz (Maybach)',
    'Aston Martin',
    'Ferrari',
    'Lamborghini',
    'McLaren',
    'Maserati',
    'Porsche',
    'Land Rover (Range Rover)',
    'Mercedes-Benz',
    'BMW',
    'Audi',
    'Lexus',
    'Genesis',
    'Jaguar',
    'Cadillac',
    'Infiniti',
    'GMC',
    'Toyota',
    'Nissan',
    'Hyundai',
    'Kia',
    'Honda',
    'Chevrolet',
    'Ford',
    'Mazda',
    'Mitsubishi',
    'Other'
  ].map((b) => ({ id: b, text: b }));
  $('#carBrand')
    .empty()
    .select2({
      data: luxuryFirstBrands,
      width: '100%',
      placeholder: 'اختر ماركة المركبة (الأسماء الفاخرة أولاً)',
      dir: 'rtl'
    });

  // 3) Date defaults
  const today = luxon.DateTime.now().toFormat('yyyy-LL-dd');
  $('#date')
    .val(today)
    .attr('min', today)
    .on('change', () => {
      if (typeof fetchTimesForSelectedDate === 'function') {
        fetchTimesForSelectedDate();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page3');
      }
    });

  $('#timeFilter').on('change', function () {
    currentTimeFilter = this.value;
    if (typeof renderSelectedDateTimes === 'function') {
      renderSelectedDateTimes(lastSelectedISO);
    }
  });

  // 4) Locations & services loading
  setLoadingServices(true);
  callContent2('/locations', (res) => {
    const list = res?.data || [];
    const ds = list.map((l) => ({
      id: l.id,
      text: l.TS_location_arabic_name
    }));

    $('#area')
      .empty()
      .select2({
        data: ds,
        width: '100%',
        placeholder: 'اختر المنطقة لخدمة العناية الفاخرة',
        dir: 'rtl'
      });

    if (ds.length) {
      $('#area').val(ds[0].id).trigger('change');
    } else {
      setLoadingServices(false);
      if (typeof showToast === 'function') {
        showToast('error', 'لا توجد مناطق متاحة حالياً');
      }
    }

    if (typeof renderSummary === 'function') {
      renderSummary('page2');
    }
  });

  $('#area').on('change', function () {
    if (window.nForm) nForm.location = this.value;
    if (typeof requestAreaBoundsForCurrentArea === 'function') {
      requestAreaBoundsForCurrentArea();
    }

    setLoadingServices(true);
    callContent2(
      `/services?location=${encodeURIComponent(this.value)}`,
      (res) => {
        window.servicesCache = res?.data?.services || [];
        window.categoriesCache = res?.data?.servicesCat || [];

        const cats =
          window.categoriesCache.map((c) => ({
            id: c.TS_category_id,
            text: c.TS_category_arabic_name
          })) || [];

        $('#serviceCat')
          .empty()
          .select2({
            data: cats,
            width: '100%',
            placeholder: 'فئة الخدمة',
            dir: 'rtl'
          });

        if (cats.length) $('#serviceCat').val(cats[0].id).trigger('change');
        setLoadingServices(false);

        if (typeof renderSummary === 'function') {
          renderSummary('page2');
        }
        updateNextAvailability();
      },
      true
    );
  });

  $('#serviceCat').on('change', function () {
    if (window.nForm) nForm.serviceCat = this.value;
    const cid = Number(this.value);

    const items =
      (window.servicesCache || [])
        .filter((s) => Number(s.TS_category_id) === cid)
        .sort((a, b) => a.TS_service_id - b.TS_service_id)
        .map((s) => ({ id: s.TS_service_id, text: s.TS_service_arabic_name })) || [];

    $('#service')
      .empty()
      .select2({
        data: items,
        width: '100%',
        placeholder: 'باقتك المختارة',
        dir: 'rtl'
      });

    if (items.length) $('#service').val(items[0].id).trigger('change');

    if (typeof renderSummary === 'function') {
      renderSummary('page2');
    }
    updateNextAvailability();
  });

  $('#service').on('change', function () {
    if (window.nForm) nForm.service = this.value || '';

    const selectedId = this.value ? String(this.value) : '';
    let selectedService = null;

    if (window.servicesCache && Array.isArray(window.servicesCache)) {
      selectedService = window.servicesCache.find(
        (s) => String(s.TS_service_id) === selectedId
      );
    }

    // Description box
    const descBox = document.getElementById('serviceDetails');
    if (descBox) {
      let desc = '';
      if (selectedService && typeof getServiceDescription === 'function') {
        desc = getServiceDescription(selectedService);
      }
      if (desc) {
        descBox.textContent = desc;
      } else {
        descBox.textContent = isEnglishLocale()
          ? 'No details are available for this service yet.'
          : 'لا توجد تفاصيل متاحة لهذه الخدمة حاليًا.';
      }
    }

    // Price box
    const priceBox = document.getElementById('servicePrice');
    const priceRaw = selectedService
      ? selectedService.TS_service_final_price
      : '';

    if (typeof window !== 'undefined') {
      window.baseServicePrice = !isNaN(Number(priceRaw))
        ? Number(priceRaw)
        : 0;
    }

    if (priceBox && typeof formatServicePrice === 'function') {
      const priceText = formatServicePrice(priceRaw);
      priceBox.textContent = priceText || '—';
    }

    if (typeof renderSummary === 'function') {
      renderSummary('page2');
    }
    if (typeof updateFooterTotal === 'function') {
      updateFooterTotal();
    }
    updateNextAvailability();
  });

  $('#serviceCount').on('change', function () {
    if (window.nForm) nForm.serviceCount = this.value || '1';
    if (typeof renderSummary === 'function') {
      renderSummary('page2');
    }
    if (typeof updateFooterTotal === 'function') {
      updateFooterTotal();
    }
    updateNextAvailability();
  });

  // 5) Time selection wiring (functions implemented in another module)
  if (typeof fetchTimesForSelectedDate === 'function') {
    fetchTimesForSelectedDate();
  }

  // 6) Step navigation (Next/Prev + main flow)
  const $prev = document.getElementById('footer-prev');
  const $next = document.getElementById('footer-next');
  const $wait = document.getElementById('footer-wait');

  async function gotoNext() {
    const i = getActiveIndex();
    const id = orderedPages[i];

    if (id === 'page1') {
      if (typeof stopWelcomeDeck === 'function') stopWelcomeDeck();
      showPage(1);
      return;
    }

    if (id === 'page2') {
      const areaOk = !!$('#area').val();
      const catOk = !!$('#serviceCat').val();
      const svcOk = !!$('#service').val();

      document.getElementById('err-area').style.display = areaOk ? 'none' : 'block';
      document.getElementById('err-serviceCat').style.display =
        catOk ? 'none' : 'block';
      document.getElementById('err-service').style.display =
        svcOk ? 'none' : 'block';

      if (!areaOk || !catOk || !svcOk) {
        if (typeof showToast === 'function') {
          showToast('error', 'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة');
        }
        return;
      }

      showPage(2);
      document.getElementById('date').dispatchEvent(new Event('change'));
      return;
    }

    if (id === 'page3') {
      if (!selectedTime) {
        if (typeof showToast === 'function') {
          showToast('error', 'الرجاء اختيار وقت');
        }
        return;
      }
      showPage(3);
      return;
    }

    if (id === 'page4') {
      const nameOk = ($('#name').val() || '').trim().length > 0;
      const phoneOk = window.itiPhone && itiPhone.isValidNumber();

      document.getElementById('err-name').style.display = nameOk ? 'none' : 'block';
      document.getElementById('err-mobile').style.display =
        phoneOk ? 'none' : 'block';

      if (!nameOk || !phoneOk) {
        if (typeof showToast === 'function') {
          showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
        }
        return;
      }

      if (window.OTP_ENABLED && !window.otpVerified) {
        const errOtp = document.getElementById('err-otp');
        if (errOtp) {
          errOtp.textContent =
            'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
          errOtp.style.display = 'block';
        }
        if (typeof showToast === 'function') {
          showToast(
            'error',
            'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة'
          );
        }
        return;
      }

      const errOtp = document.getElementById('err-otp');
      if (errOtp) errOtp.style.display = 'none';

      if (window.nForm) {
        nForm.customerN = $('#name').val().trim();
        nForm.customerM = itiPhone.getNumber().replace(/^\+/, '');
        nForm.locationDescription = [
          $('#carBrand').val() || '',
          $('#carName').val() || '',
          $('#plateNumber').val() || ''
        ]
          .filter(Boolean)
          .join(', ');
      }

      showPage(4);
      return;
    }

    if (id === 'page5') {
      if (!window.nForm || !nForm.paymentMethod) {
        const errPay = document.getElementById('err-pay');
        if (errPay) errPay.style.display = 'block';
        if (typeof showToast === 'function') {
          showToast('error', 'اختر طريقة الدفع');
        }
        return;
      }
      const errPay = document.getElementById('err-pay');
      if (errPay) errPay.style.display = 'none';
      showPage(5);
      return;
    }

    if (id === 'page6') {
      // Terms check
      if (!window.termsAccepted && typeof openTermsModal === 'function') {
        openTermsModal();
        if (typeof showToast === 'function') {
          showToast(
            'info',
            'من فضلك اقرأ ووافق على الشروط والأحكام قبل إكمال الحجز'
          );
        }
        return;
      }

      if (!window.positionUrl) {
        const errMap = document.getElementById('err-map');
        if (errMap) errMap.style.display = 'block';
        if (typeof showToast === 'function') {
          showToast('error', 'الرجاء تحديد الموقع');
        }
        return;
      }

      const errMap = document.getElementById('err-map');
      if (errMap) errMap.style.display = 'none';

      if (window.nForm) nForm.urlLocation = window.positionUrl;

      if (isSubmitting) return;
      isSubmitting = true;

      if ($next) $next.style.display = 'none';
      if ($prev) $prev.style.display = 'none';
      if ($wait) $wait.classList.add('show');

      const payload = typeof buildPayload === 'function' ? buildPayload() : {};
      console.log('[booking] Sending reservation payload', payload);

      const r = await postReservation(payload);
      console.log('[booking] Reservation response:', r);

      if (r.ok && r.data?.success) {
        if (typeof showToast === 'function') {
          showToast('success', 'تم إنشاء الحجز');
        }

        const bookingId =
          r.data.bookingId ??
          r.data.bookingID ??
          r.data.id ??
          r.data.BookingId ??
          r.data.BookingID ??
          null;

        console.log('[booking] Derived bookingId for review:', bookingId);

        if (typeof scheduleReviewForBooking === 'function') {
          scheduleReviewForBooking(bookingId);
        }

        // Populate thanks page
        document.getElementById('ts-area').textContent =
          $('#area').find(':selected').text() || '—';
        document.getElementById('ts-service').textContent =
          $('#service').find(':selected').text() || '—';

        const dt =
          window.nForm && nForm.date
            ? luxon.DateTime.fromISO(nForm.date).toFormat('d LLL yyyy')
            : '';
        const tm = window.nForm && nForm.time ? nForm.time : '';

        document.getElementById('ts-dt').textContent =
          (dt ? dt : '') + (tm ? ' • ' + tm : '');

        document.getElementById('ts-pay').textContent =
          (window.nForm && nForm.paymentMethod
            ? nForm.paymentMethod.toUpperCase()
            : '') || '—';

        const waMsg = encodeURIComponent(
          `تم إرسال طلب حجز: \nالخدمة: ${$('#service')
            .find(':selected')
            .text()}\nالتاريخ: ${
            window.nForm ? nForm.date : ''
          } ${window.nForm ? nForm.time : ''}\nالرابط: ${location.href}`
        );
        document.getElementById(
          'ts-whatsapp'
        ).href = `https://wa.me/?text=${waMsg}`;

        if ($wait) $wait.classList.remove('show');
        isSubmitting = false;
        showPage(6);
      } else {
        const msg =
          r?.data?.msgAR ||
          (r.status === 404 ? 'المسار غير موجود' : 'تعذر إنشاء الحجز');
        if (typeof showToast === 'function') {
          showToast('error', msg);
        }
        isSubmitting = false;
        if ($wait) $wait.classList.remove('show');
        if ($next) $next.style.display = '';
        if ($prev) $prev.style.display = '';
        return;
      }

      return;
    }

    // Default: move to next page if exists
    showPage(Math.min(i + 1, orderedPages.length - 1));
  }

  if ($next) $next.addEventListener('click', gotoNext);
  if ($prev) {
    $prev.addEventListener('click', () => {
      const i = getActiveIndex();
      showPage(Math.max(i - 1, 0));
    });
  }

  // "Book again" button should stay on index.html
  $('#rebook').on('click', () => {
    window.location.href = 'index.html';
  });

  // 7) Coupon apply button (validateCouponAndApply in another module)
  const applyBtn = document.getElementById('applyCouponBtn');
  if (applyBtn && typeof validateCouponAndApply === 'function') {
    applyBtn.addEventListener('click', validateCouponAndApply);
  }

  // 8) Dynamic extras + payment methods + offers
  if (typeof loadAdditionalServices === 'function') {
    loadAdditionalServices();
  }
  if (typeof loadPaymentMethods === 'function') {
    loadPaymentMethods();
  }
  if (typeof wireOffersUI === 'function') {
    wireOffersUI();
  }

  // 9) Initial state: page1 hero + deck
  setPageBackground('page1');
  if (typeof renderSummary === 'function') renderSummary('page1');
  syncProgress(0);
  if (typeof startWelcomeDeck === 'function') startWelcomeDeck();

  // 10) EN translations for some labels
  if (isEnglishLocale()) {
    const lblDetails = document.getElementById('serviceDetailsLabel');
    if (lblDetails) lblDetails.textContent = 'Service details';
    const lblPrice = document.getElementById('servicePriceLabel');
    if (lblPrice) lblPrice.textContent = 'Service price (incl. VAT)';
    const footerTotalLabel = document.getElementById('footer-total-label');
    if (footerTotalLabel) footerTotalLabel.textContent = 'Order total:';

    const offersTitle = document.getElementById('offersTitle');
    if (offersTitle) offersTitle.textContent = "Today's offers";

    const offersBtn = document.getElementById('btnShowOffers');
    if (offersBtn) {
      offersBtn.innerHTML =
        '<i class="fa-solid fa-gift"></i><span>Today\'s offers</span>';
    }

    const filterWrap = document.getElementById('offersFilters');
    if (filterWrap) {
      filterWrap.querySelectorAll('[data-type]').forEach((chip) => {
        const t = chip.dataset.type;
        if (t === 'all') chip.textContent = 'All';
        else if (t === 'image') chip.textContent = 'Images';
        else if (t === 'text') chip.textContent = 'Text';
        else if (t === 'coupon') chip.textContent = 'Coupons';
      });
    }
  }

  // 11) Initial price summary
  if (typeof updateFooterTotal === 'function') {
    updateFooterTotal();
  }

  updateNextAvailability();
});

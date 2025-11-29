// 🎁 NahlTime Gift Workflow (frontend)
// - Gift flow is processed by a separated Google Apps Script backend (GAS)
// - This file hooks into the existing booking UI without changing core app.js logic

(function (window, $) {
  'use strict';

  /* ====================================================================== */
  /* 1) CONFIG: SEPARATE GIFT WORKFLOW BACKEND (GOOGLE APPS SCRIPT)         */
  /* ====================================================================== */

  // 🔗 Backend responsible for GIFT workflow (NOT nahl-platform.vercel.app)
  // Make sure this URL matches your deployed WebApp (latest deployment)
  const GIFT_GAS_BASE =
    'https://script.google.com/macros/s/AKfycbzdn5KpXRD3n3B4GA0-HEN9z_Vkp40ESUhVbn_nb3J5MS-4w1nNRF_uH-0NzKqYBYZKhw/exec';

  // Endpoint that will receive gift requests:
  // Frontend always calls with POST → doPost() in Code.gs
  const GIFT_REQUEST_URL = `${GIFT_GAS_BASE}?action=gift.request`;

  /* ====================================================================== */
  /* 2) LOCAL STATE                                                         */
  /* ====================================================================== */

  let giftMode = false; // true when user toggles "Send as gift"
  let receiverPhoneDigits = ''; // full numeric receiver phone (country + local if available)

  // helpers to access globals defined in app.js
  const DateTime = window.luxon ? window.luxon.DateTime : null;

  function isGiftFlowActive() {
    return !!giftMode;
  }

  /* ====================================================================== */
  /* 3) UI HELPERS                                                          */
  /* ====================================================================== */

  function hideCarInfoSection(on) {
    // Prefer a dedicated wrapper if exists
    const carWrapper = document.getElementById('carInfoSection');
    if (carWrapper) {
      carWrapper.style.display = on ? 'none' : '';
      return;
    }

    // Fallback: hide the card that contains #carBrand and its heading (معلومات المركبة)
    const carBrandEl = document.getElementById('carBrand');
    if (!carBrandEl) return;
    const card = carBrandEl.closest('.card');
    if (card) {
      card.style.display = on ? 'none' : '';
      const prev = card.previousElementSibling;
      if (prev && prev.tagName === 'H1') {
        prev.style.display = on ? 'none' : '';
      }
    }
  }

  function toggleGiftUI(on) {
    giftMode = !!on;

    // Show / hide receiver card
    const card = document.getElementById('giftReceiverCard');
    if (card) {
      card.style.display = giftMode ? 'block' : 'none';
    }

    // Hide / show car info section in gift mode
    hideCarInfoSection(giftMode);

    // Store flag in form model
    if (!window.nForm) window.nForm = {};
    window.nForm.isGift = giftMode;

    // Refresh summary + footer buttons
    if (typeof window.renderSummary === 'function') {
      const activeId =
        document.querySelector('.page.active')?.id || 'page1';
      window.renderSummary(activeId);
    }
    if (typeof window.updateNextAvailability === 'function') {
      window.updateNextAvailability();
    }
  }

  function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) el.textContent = msg;
    el.style.display = 'block';
  }

  function hideFieldError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'none';
  }

  /* ====================================================================== */
  /* 4) VALIDATION FOR SENDER & RECEIVER (GIFT FLOW)                        */
  /* ====================================================================== */

  function validateSenderBase() {
    const nameVal = ($('#name').val() || '').trim();
    const nameOk = nameVal.length > 0;

    const phoneOk =
      window.itiPhone && window.itiPhone.isValidNumber
        ? window.itiPhone.isValidNumber()
        : false;

    const errName = document.getElementById('err-name');
    const errMobile = document.getElementById('err-mobile');

    if (errName) errName.style.display = nameOk ? 'none' : 'block';
    if (errMobile) errMobile.style.display = phoneOk ? 'none' : 'block';

    if (!nameOk || !phoneOk) {
      if (window.showToast) {
        window.showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
      }
      return false;
    }

    if (window.OTP_ENABLED && !window.otpVerified) {
      const errOtp = document.getElementById('err-otp');
      if (errOtp) {
        errOtp.textContent =
          'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
        errOtp.style.display = 'block';
      }
      if (window.showToast) {
        window.showToast(
          'error',
          'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة'
        );
      }
      return false;
    }

    // Update base form model
    if (window.nForm && window.itiPhone) {
      window.nForm.customerN = nameVal;
      window.nForm.customerM =
        window.itiPhone.getNumber().replace(/^\+/, '');
    }

    return true;
  }

  function validateReceiverForGift() {
    if (!isGiftFlowActive()) return true; // no validation if not gift

    const receiverName = ($('#giftReceiverName').val() || '').trim();
    const receiverMobileRaw =
      ($('#giftReceiverMobile').val() || '').trim();
    const countryCodeRaw =
      ($('#giftReceiverCountryCode').val() || '').trim();

    const localDigits = receiverMobileRaw.replace(/\D/g, '');
    const countryDigits = countryCodeRaw.replace(/\D/g, '');

    let ok = true;

    if (!receiverName) {
      showFieldError(
        'err-giftReceiverName',
        'يرجى إدخال اسم المستلم'
      );
      ok = false;
    } else {
      hideFieldError('err-giftReceiverName');
    }

    if (!localDigits || localDigits.length < 8) {
      showFieldError(
        'err-giftReceiverMobile',
        'يرجى إدخال رقم جوال المستلم بشكل صحيح'
      );
      ok = false;
    } else {
      hideFieldError('err-giftReceiverMobile');
    }

    // Compose full receiver phone (country + local)
    let fullPhone = localDigits;
    if (countryDigits) {
      fullPhone = countryDigits + localDigits;
    }
    receiverPhoneDigits = fullPhone;

    if (!ok && window.showToast) {
      window.showToast(
        'error',
        'يرجى استكمال بيانات المستلم قبل المتابعة'
      );
    }

    return ok;
  }

  /* ====================================================================== */
  /* 5) BUILD GIFT PAYLOAD                                                  */
  /* ====================================================================== */

  function buildGiftPayload() {
    const appId = window.APP_ID || '';

    const loc = $('#area').val();
    const svcC = $('#serviceCat').val();
    const svc = $('#service').val();
    const cnt = $('#serviceCount').val() || '1';

    const senderName = ($('#name').val() || '').trim();
    const senderPhone =
      window.itiPhone && window.itiPhone.getNumber
        ? window.itiPhone.getNumber().replace(/^\+/, '')
        : '';

    const receiverName =
      ($('#giftReceiverName').val() || '').trim();
    const receiverMobileRaw =
      ($('#giftReceiverMobile').val() || '').trim();
    const receiverCountryCodeRaw =
      ($('#giftReceiverCountryCode').val() || '').trim();

    const giftMessage = ($('#giftMessage').val() || '').trim();

    const locale =
      (window.isEnglishLocale && window.isEnglishLocale()) ||
      (document.documentElement.lang || 'ar')
        .toLowerCase()
        .startsWith('en')
        ? 'en'
        : 'ar';

    const additionalServices =
      (window.nForm && window.nForm.additionalServicesIds) || [];
    const couponCode = window.nForm?.couponCode || '';
    const couponDiscountAmount =
      window.nForm?.couponDiscountAmount || 0;

    // This payload is designed for Code.gs → GAS gift workflow
    return {
      appId: appId,
      isGift: true,
      flowType: 'GIFT',

      // selected service
      location: loc ? String(loc) : '',
      serviceCat: svcC ? String(svcC) : '',
      service: svc ? String(svc) : '',
      serviceCount: String(cnt || '1'),

      // sender
      senderName,
      senderPhone,

      // receiver
      receiverName,
      receiverPhone: receiverPhoneDigits, // final digits (country+local if any)
      receiverPhoneCountryCode: receiverCountryCodeRaw,
      receiverPhoneLocal: receiverMobileRaw,
      giftMessage,

      // booking data (gift has no date/time yet)
      date: '',
      time: '',
      locale,

      // extra
      additionalServices: additionalServices.join(','),
      couponCode,
      couponDiscountAmount,

      // client meta (optional)
      clientUrl:
        typeof window.location !== 'undefined'
          ? window.location.href
          : ''
    };
  }

  /* ====================================================================== */
  /* 6) SEND GIFT REQUEST TO GAS BACKEND                                    */
  /* ====================================================================== */

  async function sendGiftRequest() {
    if (!isGiftFlowActive()) return;

    if (!window.nForm) window.nForm = {};

    const payload = buildGiftPayload();
    const locale = payload.locale || 'ar';

    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const waitDiv = document.getElementById('footer-wait');

    if (window.isSubmitting) return;
    window.isSubmitting = true;

    if (waitDiv) waitDiv.classList.add('show');
    if (nextBtn) nextBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';

    console.log('[gift] Sending gift request to backend:', {
      url: GIFT_REQUEST_URL,
      payload
    });

    try {
      const res = await fetch(GIFT_REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn('[gift] Invalid JSON from gift API:', raw);
        data = { ok: false, error: 'Invalid JSON', raw };
      }

      console.log('[gift] API response:', {
        status: res.status,
        data
      });

      if (!res.ok || data.ok === false || data.success === false) {
        const msg =
          data.messageAr ||
          data.message ||
          data.error ||
          'تعذر إرسال طلب الهدية حاليًا، حاول مرة أخرى.';

        if (window.showToast) window.showToast('error', msg);

        // Let user try again (show buttons)
        if (nextBtn) nextBtn.style.display = '';
        if (prevBtn) prevBtn.style.display = '';
        if (waitDiv) waitDiv.classList.remove('show');
        window.isSubmitting = false;
        return;
      }

      // Success 🎉
      if (window.showToast) {
        window.showToast(
          'success',
          'تم إرسال طلب الهدية بنجاح ✅ سيتم متابعة الهدية عبر واتساب.'
        );
      }

      // Fill final summary (Page 7)
      const areaTxt =
        $('#area').find(':selected').text() ||
        (window.isEnglishLocale && window.isEnglishLocale()
          ? 'Area'
          : 'المنطقة');
      const srvTxt =
        $('#service').find(':selected').text() ||
        (window.isEnglishLocale && window.isEnglishLocale()
          ? 'Service'
          : 'الخدمة');

      const tsArea = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt = document.getElementById('ts-dt');
      const tsPay = document.getElementById('ts-pay');
      const tsWa = document.getElementById('ts-whatsapp');

      if (tsArea) tsArea.textContent = areaTxt || '—';
      if (tsService) tsService.textContent = srvTxt || '—';

      const dtText =
        locale === 'en'
          ? 'Gift request – receiver will choose the date.'
          : 'طلب هدية — سيقوم المستلم باختيار الموعد المناسب.';

      if (tsDt) tsDt.textContent = dtText;

      const payMethod =
        (window.nForm && window.nForm.paymentMethod) || '';
      if (tsPay)
        tsPay.textContent = payMethod
          ? payMethod.toUpperCase()
          : '—';

      // Build WhatsApp share message for the sender
      const waMsg = encodeURIComponent(
        `تم إرسال هدية غسيل سيارة:\n` +
          `المستلم: ${payload.receiverName}\n` +
          `الخدمة: ${srvTxt}\n` +
          `سيصله رابط الحجز وكوبون الهدية بعد الموافقة من المتجر.\n\n` +
          `رقم المتابعة (إن وجد): ${
            data.giftId || data.id || '—'
          }`
      );
      if (tsWa) {
        tsWa.href = `https://wa.me/?text=${waMsg}`;
      }

      // Move to "thank you" page (page7)
      if (typeof window.showPage === 'function') {
        window.showPage('page7');
      }
    } catch (err) {
      console.error('[gift] sendGiftRequest error:', err);
      if (window.showToast) {
        window.showToast(
          'error',
          'حدث خطأ أثناء إرسال طلب الهدية، حاول مرة أخرى.'
        );
      }
      if (nextBtn) nextBtn.style.display = '';
      if (prevBtn) prevBtn.style.display = '';
    } finally {
      if (waitDiv) waitDiv.classList.remove('show');
      window.isSubmitting = false;
    }
  }

  /* ====================================================================== */
  /* 7) GIFT-AWARE NEXT/PREV BUTTON LOGIC                                   */
  /* ====================================================================== */

  function giftAwareGotoNextFactory() {
    // We override footer "Next" but call window.originalGotoNext
    // for all non-gift steps to keep normal logic.
    return async function giftAwareGotoNext() {
      if (
        !window.orderedPages ||
        !window.getActiveIndex ||
        !window.originalGotoNext
      ) {
        return;
      }

      const i = window.getActiveIndex();
      const id = window.orderedPages[i];

      // If gift mode is OFF → normal behavior
      if (!isGiftFlowActive()) {
        return window.originalGotoNext();
      }

      // From here: GIFT MODE ON

      // PAGE 1 → same as original (just go to next)
      if (id === 'page1') {
        return window.originalGotoNext();
      }

      // PAGE 2: area/service validation + skip time (page3) when gift
      if (id === 'page2') {
        const areaOk = !!$('#area').val();
        const catOk = !!$('#serviceCat').val();
        const svcOk = !!$('#service').val();

        document.getElementById('err-area').style.display = areaOk
          ? 'none'
          : 'block';
        document.getElementById(
          'err-serviceCat'
        ).style.display = catOk ? 'none' : 'block';
        document.getElementById('err-service').style.display = svcOk
          ? 'none'
          : 'block';

        if (!areaOk || !catOk || !svcOk) {
          if (window.showToast) {
            window.showToast(
              'error',
              'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة'
            );
          }
          return;
        }

        // Save selection to nForm (like original)
        if (!window.nForm) window.nForm = {};
        window.nForm.areaId = $('#area').val();
        window.nForm.areaName =
          $('#area').find(':selected').text() || '';
        window.nForm.serviceCatId = $('#serviceCat').val();
        window.nForm.serviceCatName =
          $('#serviceCat').find(':selected').text() || '';
        window.nForm.serviceId = $('#service').val();
        window.nForm.serviceName =
          $('#service').find(':selected').text() || '';
        window.nForm.serviceCount =
          parseInt($('#serviceCount').val() || '1', 10) || 1;

        // Gift? → skip time (page3) and go directly to contact (page4)
        // Also clear any selected time/date for gift
        window.selectedTime = null;
        window.nForm.date = '';
        window.nForm.time = '';

        if (typeof window.renderSummary === 'function') {
          window.renderSummary('page2');
        }
        if (typeof window.updateNextAvailability === 'function') {
          window.updateNextAvailability();
        }
        if (typeof window.showPage === 'function') {
          window.showPage('page4');
        }
        return;
      }

      // PAGE 3: should normally be skipped in gift mode, but handle just in case
      if (id === 'page3') {
        if (typeof window.showPage === 'function') {
          window.showPage('page4');
        }
        return;
      }

      // PAGE 4: sender + receiver validation
      if (id === 'page4') {
        // 1) validate sender
        if (!validateSenderBase()) return;

        // 2) validate receiver for gift
        if (!validateReceiverForGift()) return;

        // Car info (for gift we don't require it, but we can still store if present)
        if (window.nForm) {
          const carBrand = $('#carBrand').val() || '';
          const carName = $('#carName').val() || '';
          const plateNumber = $('#plateNumber').val() || '';
          window.nForm.locationDescription = [
            carBrand,
            carName,
            plateNumber
          ]
            .filter(Boolean)
            .join(', ');
        }

        if (typeof window.renderSummary === 'function') {
          window.renderSummary('page4');
        }
        if (typeof window.updateNextAvailability === 'function') {
          window.updateNextAvailability();
        }

        if (typeof window.showPage === 'function') {
          window.showPage('page5');
        }
        return;
      }

      // PAGE 5: payment → send gift request instead of normal booking
      if (id === 'page5') {
        if (!window.nForm || !window.nForm.paymentMethod) {
          const err = document.getElementById('err-pay');
          if (err) err.style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'اختر طريقة الدفع');
          }
          return;
        }
        const err = document.getElementById('err-pay');
        if (err) err.style.display = 'none';

        // ✅ Terms check before sending gift
        if (window.termsAccepted === false) {
          if (typeof window.openTermsModal === 'function') {
            window.openTermsModal();
          }
          if (window.showToast) {
            window.showToast(
              'info',
              'من فضلك اقرأ ووافق على الشروط والأحكام قبل إكمال طلب الهدية'
            );
          }
          return;
        }

        // Now send the gift request to GAS
        await sendGiftRequest();
        return;
      }

      // PAGE 6 or PAGE 7 in gift mode:
      // For safety, just fallback to original behavior
      return window.originalGotoNext();
    };
  }

  function patchPrevButton() {
    const prev = document.getElementById('footer-prev');
    if (!prev) return;
    const cloned = prev.cloneNode(true);
    prev.parentNode.replaceChild(cloned, prev);

    cloned.addEventListener('click', function () {
      if (!window.orderedPages || !window.getActiveIndex) return;
      const i = window.getActiveIndex();
      const id = window.orderedPages[i];

      // Special case: in gift flow from page4 go back to page2 (skip time)
      if (isGiftFlowActive() && id === 'page4') {
        if (typeof window.showPage === 'function') {
          window.showPage('page2');
        }
        if (typeof window.updateNextAvailability === 'function') {
          window.updateNextAvailability();
        }
        return;
      }

      // Default behavior: simple previous step
      if (typeof window.showPage === 'function') {
        window.showPage(Math.max(i - 1, 0));
      }
    });
  }

  function patchNextButton(giftAwareGotoNext) {
    const next = document.getElementById('footer-next');
    if (!next) return;
    const cloned = next.cloneNode(true);
    next.parentNode.replaceChild(cloned, next);
    cloned.addEventListener('click', giftAwareGotoNext);
  }

  /* ====================================================================== */
  /* 8) INIT: WIRE TOGGLE + PATCH BUTTONS                                   */
  /* ====================================================================== */

  $(function () {
    // Toggle gift mode
    $('#isGiftToggle').on('change', function () {
      toggleGiftUI(this.checked);
    });

    // If you want gift default OFF on load, just ensure checkbox is unchecked:
    const giftToggle = document.getElementById('isGiftToggle');
    if (giftToggle) {
      toggleGiftUI(giftToggle.checked);
    }

    // Patch Next & Prev after app.js has initialized everything
    const giftAwareNext = giftAwareGotoNextFactory();
    patchNextButton(giftAwareNext);
    patchPrevButton();

    console.log(
      '[gift] Gift workflow initialized with backend:',
      GIFT_REQUEST_URL
    );
  });

  /* ====================================================================== */
  /* 9) PUBLIC API (OPTIONAL)                                               */
  /* ====================================================================== */

  window.nahlGift = {
    isGiftFlowActive,
    buildGiftPayload
  };
})(window, jQuery);

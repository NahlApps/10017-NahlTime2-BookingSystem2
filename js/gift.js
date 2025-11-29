// 🎁 NahlTime Gift Workflow (frontend)
// - Gift flow is handled by separated backend on nahl-platform.vercel.app
//   (this then talks to Google Apps Script gift backend)

(function (window, $) {
  'use strict';

  /* ====================================================================== */
  /* 1) CONFIG                                                              */
  /* ====================================================================== */

  const GIFT_WORKFLOW_BASE = 'https://nahl-platform.vercel.app';
  const GIFT_REQUEST_URL   = `${GIFT_WORKFLOW_BASE}/api/gift/request`;

  /* ====================================================================== */
  /* 2) LOCAL STATE                                                         */
  /* ====================================================================== */

  let giftMode            = false;
  let receiverPhoneDigits = '';
  const DateTime          = window.luxon ? window.luxon.DateTime : null;

  function isGiftFlowActive() {
    return !!giftMode;
  }

  /* ====================================================================== */
  /* 3) UI HELPERS                                                          */
  /* ====================================================================== */

  function toggleGiftUI(on) {
    giftMode = !!on;

    // Show / hide receiver card
    const card = document.getElementById('giftReceiverCard');
    if (card) card.style.display = giftMode ? 'block' : 'none';

    // Show / hide car info
    const carInfoSection = document.getElementById('carInfoSection');
    if (carInfoSection) carInfoSection.style.display = giftMode ? 'none' : 'block';

    // mark on form model
    if (window.nForm) {
      window.nForm.isGift = giftMode;
      if (giftMode) {
        window.nForm.date = '';
        window.nForm.time = '';
      }
    }
    if (giftMode) {
      window.selectedTime = null;
    }

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
  /* 4) VALIDATION                                                          */
  /* ====================================================================== */

  function validateSenderBase() {
    const nameVal = ($('#name').val() || '').trim();
    const nameOk  = nameVal.length > 0;
    const phoneOk =
      window.itiPhone && window.itiPhone.isValidNumber
        ? window.itiPhone.isValidNumber()
        : false;

    document.getElementById('err-name').style.display   = nameOk  ? 'none' : 'block';
    document.getElementById('err-mobile').style.display = phoneOk ? 'none' : 'block';

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

    if (window.nForm && window.itiPhone) {
      window.nForm.customerN = nameVal;
      window.nForm.customerM =
        window.itiPhone.getNumber().replace(/^\+/, '');
    }

    return true;
  }

  function validateReceiverForGift() {
    if (!isGiftFlowActive()) return true;

    const receiverName = ($('#giftReceiverName').val() || '').trim();
    const mobileRaw    = ($('#giftReceiverMobile').val() || '').trim();
    const cc           = ($('#giftReceiverCountryCode').val() || '966')
                          .replace(/\D/g, '');
    const digitsOnly   = mobileRaw.replace(/\D/g, '');

    let ok = true;

    if (!receiverName) {
      showFieldError('err-giftReceiverName', 'يرجى إدخال اسم المستلم');
      ok = false;
    } else {
      hideFieldError('err-giftReceiverName');
    }

    if (!digitsOnly || digitsOnly.length < 8) {
      showFieldError(
        'err-giftReceiverMobile',
        'يرجى إدخال رقم جوال المستلم بشكل صحيح'
      );
      ok = false;
    } else {
      hideFieldError('err-giftReceiverMobile');
    }

    if (!ok) {
      receiverPhoneDigits = '';
      if (window.showToast) {
        window.showToast(
          'error',
          'يرجى استكمال بيانات المستلم قبل المتابعة'
        );
      }
      return false;
    }

    receiverPhoneDigits = cc + digitsOnly;
    return true;
  }

  /* ====================================================================== */
  /* 5) BUILD PAYLOAD                                                       */
  /* ====================================================================== */

  function buildGiftPayload() {
    const appId = window.APP_ID || '';

    const loc  = $('#area').val();
    const svcC = $('#serviceCat').val();
    const svc  = $('#service').val();
    const cnt  = $('#serviceCount').val() || '1';

    const senderName = ($('#name').val() || '').trim();
    const senderPhone =
      window.itiPhone && window.itiPhone.getNumber
        ? window.itiPhone.getNumber().replace(/^\+/, '')
        : '';

    const receiverName = ($('#giftReceiverName').val() || '').trim();
    const giftMessage  = ($('#giftMessage').val() || '').trim();

    const locale =
      (window.isEnglishLocale && window.isEnglishLocale()) ||
      (document.documentElement.lang || 'ar').toLowerCase().startsWith('en')
        ? 'en'
        : 'ar';

    const additionalServices =
      (window.nForm && window.nForm.additionalServicesIds) || [];
    const couponCode           = window.couponCodeApplied || '';
    const couponDiscountAmount = window.couponDiscountAmount || 0;

    if (!receiverPhoneDigits) {
      validateReceiverForGift();
    }

    const cc = ($('#giftReceiverCountryCode').val() || '966').replace(/\D/g, '');

    return {
      appId,
      isGift: true,
      flowType: 'GIFT',

      // service
      location:     loc  ? String(loc)  : '',
      serviceCat:   svcC ? String(svcC) : '',
      service:      svc  ? String(svc)  : '',
      serviceCount: String(cnt || '1'),

      // sender
      senderName,
      senderPhone,

      // receiver
      receiverName,
      receiverPhone: receiverPhoneDigits,
      receiverCountryCode: cc,
      giftMessage,

      // booking data (gift chooses later)
      date: '',
      time: '',
      locale,

      additionalServices: additionalServices.join(','),
      couponCode,
      couponDiscountAmount,

      clientUrl:
        typeof window.location !== 'undefined'
          ? window.location.href
          : '',
    };
  }

  /* ====================================================================== */
  /* 6) SEND GIFT REQUEST                                                   */
  /* ====================================================================== */

  async function sendGiftRequest() {
    if (!isGiftFlowActive()) return;

    if (!validateSenderBase() || !validateReceiverForGift()) return;

    const payload = buildGiftPayload();

    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const waitDiv = document.getElementById('footer-wait');

    if (window.isSubmitting) return;
    window.isSubmitting = true;

    if (waitDiv) waitDiv.classList.add('show');
    if (nextBtn) nextBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';

    console.log('[gift] Sending gift request:', { url: GIFT_REQUEST_URL, payload });

    try {
      const res = await fetch(GIFT_REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn('[gift] Invalid JSON from gift API:', raw);
        data = { ok: false, error: 'Invalid JSON', raw };
      }

      console.log('[gift] API response:', { status: res.status, data });

      if (!res.ok || data.ok === false || data.success === false) {
        const msg =
          data.messageAr ||
          data.message ||
          data.error ||
          'تعذر إرسال طلب الهدية حاليًا، حاول مرة أخرى.';
        if (window.showToast) window.showToast('error', msg);
        if (nextBtn) nextBtn.style.display = '';
        if (prevBtn) prevBtn.style.display = '';
        if (waitDiv) waitDiv.classList.remove('show');
        window.isSubmitting = false;
        return;
      }

      // ✅ Success
      if (window.showToast) {
        window.showToast(
          'success',
          'تم إرسال طلب الهدية بنجاح ✅ سيتم متابعة الهدية عبر واتساب.'
        );
      }

      const isEn   = (payload.locale || '').toLowerCase() === 'en';
      const areaTxt =
        $('#area').find(':selected').text() ||
        (isEn ? 'Area' : 'المنطقة');
      const srvTxt =
        $('#service').find(':selected').text() ||
        (isEn ? 'Service' : 'الخدمة');

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');
      const tsWa      = document.getElementById('ts-whatsapp');

      if (tsArea)    tsArea.textContent    = areaTxt || '—';
      if (tsService) tsService.textContent = srvTxt  || '—';

      const dtText = isEn
        ? 'Gift request – receiver will choose the date.'
        : 'طلب هدية — سيقوم المستلم باختيار الموعد المناسب.';
      if (tsDt) tsDt.textContent = dtText;

      const payMethod =
        (window.nForm && window.nForm.paymentMethod) || '';
      if (tsPay) tsPay.textContent = payMethod ? payMethod.toUpperCase() : '—';

      const waMsg = encodeURIComponent(
        `تم إرسال هدية غسيل سيارة:\n` +
          `المستلم: ${payload.receiverName}\n` +
          `الخدمة: ${srvTxt}\n` +
          `سيصله رابط الحجز وكوبون الهدية بعد الموافقة من المتجر.\n\n` +
          `رقم المتابعة (إن وجد): ${data.giftId || data.id || '—'}`
      );
      if (tsWa) tsWa.href = `https://wa.me/?text=${waMsg}`;

      if (typeof window.showPage === 'function') {
        window.showPage(6); // page7
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
  /* 7) GIFT-AWARE NEXT/PREV                                                */
  /* ====================================================================== */

  function giftAwareGotoNextFactory() {
    return async function giftAwareGotoNext() {
      if (!window.orderedPages || !window.getActiveIndex) return;

      const i  = window.getActiveIndex();
      const id = window.orderedPages[i];

      // PAGE 1
      if (id === 'page1') {
        if (typeof window.stopWelcomeDeck === 'function') {
          window.stopWelcomeDeck();
        }
        if (typeof window.showPage === 'function') {
          window.showPage(1); // page2
        }
        return;
      }

      // PAGE 2: area/service
      if (id === 'page2') {
        const areaOk = !!$('#area').val();
        const catOk  = !!$('#serviceCat').val();
        const svcOk  = !!$('#service').val();

        document.getElementById('err-area').style.display      = areaOk ? 'none' : 'block';
        document.getElementById('err-serviceCat').style.display= catOk  ? 'none' : 'block';
        document.getElementById('err-service').style.display   = svcOk  ? 'none' : 'block';

        if (!areaOk || !catOk || !svcOk) {
          if (window.showToast) {
            window.showToast(
              'error',
              'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة'
            );
          }
          return;
        }

        if (isGiftFlowActive()) {
          window.selectedTime = null;
          if (window.nForm) {
            window.nForm.date = '';
            window.nForm.time = '';
          }
          if (typeof window.showPage === 'function') {
            window.showPage(3); // page4
          }
          if (typeof window.updateNextAvailability === 'function') {
            window.updateNextAvailability();
          }
          return;
        }

        if (typeof window.showPage === 'function') {
          window.showPage(2); // page3
        }
        const dateEl = document.getElementById('date');
        if (dateEl) dateEl.dispatchEvent(new Event('change'));
        return;
      }

      // PAGE 3: time (only normal booking)
      if (id === 'page3') {
        if (isGiftFlowActive()) {
          if (typeof window.showPage === 'function') {
            window.showPage(3); // page4
          }
          return;
        }

        if (!window.selectedTime) {
          if (window.showToast) {
            window.showToast('error', 'الرجاء اختيار وقت');
          }
          return;
        }
        if (typeof window.showPage === 'function') {
          window.showPage(3); // page4
        }
        return;
      }

      // PAGE 4: contact + gift receiver
      if (id === 'page4') {
        if (!validateSenderBase()) return;
        if (isGiftFlowActive() && !validateReceiverForGift()) return;

        if (window.nForm) {
          const carBrand    = $('#carBrand').val() || '';
          const carName     = $('#carName').val() || '';
          const plateNumber = $('#plateNumber').val() || '';
          window.nForm.locationDescription = [carBrand, carName, plateNumber]
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
          window.showPage(4); // page5
        }
        return;
      }

      // PAGE 5: payment
      if (id === 'page5') {
        if (!window.nForm || !window.nForm.paymentMethod) {
          document.getElementById('err-pay').style.display = 'block';
          if (window.showToast) window.showToast('error', 'اختر طريقة الدفع');
          return;
        }
        document.getElementById('err-pay').style.display = 'none';

        if (isGiftFlowActive()) {
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
          await sendGiftRequest();
          return;
        }

        if (typeof window.showPage === 'function') {
          window.showPage(5); // page6
        }
        return;
      }

      // PAGE 6: keep original behavior for normal booking
      if (id === 'page6') {
        if (isGiftFlowActive()) {
          if (window.showToast) {
            window.showToast(
              'error',
              'طلب الهدية لا يحتاج لتحديد موقع، يرجى العودة للخلف في حال الخطأ.'
            );
          }
          return;
        }
        if (typeof window.originalGotoNext === 'function') {
          return window.originalGotoNext();
        }
      }

      if (typeof window.showPage === 'function') {
        window.showPage(Math.min(i + 1, window.orderedPages.length - 1));
      }
    };
  }

  function patchPrevButton() {
    const prev = document.getElementById('footer-prev');
    if (!prev) return;

    const cloned = prev.cloneNode(true);
    prev.parentNode.replaceChild(cloned, prev);

    cloned.addEventListener('click', function () {
      if (!window.orderedPages || !window.getActiveIndex) return;
      const i  = window.getActiveIndex();
      const id = window.orderedPages[i];

      // Special: in gift flow from page4 go back to page2 (skip time)
      if (isGiftFlowActive() && id === 'page4') {
        if (typeof window.showPage === 'function') {
          window.showPage(1); // page2
        }
        if (typeof window.updateNextAvailability === 'function') {
          window.updateNextAvailability();
        }
        return;
      }

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
  /* 8) INIT                                                                */
  /* ====================================================================== */

  $(function () {
    $('#isGiftToggle').on('change', function () {
      toggleGiftUI(this.checked);
    });

    const giftAwareNext = giftAwareGotoNextFactory();
    patchNextButton(giftAwareNext);
    patchPrevButton();

    console.log('[gift] Gift workflow initialized:', { GIFT_REQUEST_URL });
  });

  /* ====================================================================== */
  /* 9) PUBLIC API                                                          */
  /* ====================================================================== */

  window.nahlGift = {
    isGiftFlowActive,
    buildGiftPayload,
  };
})(window, jQuery);

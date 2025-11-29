// 🎁 NahlTime Gift Workflow (frontend)
// - Gift flow is processed by a separated backend (GAS WebApp)
// - This file hooks into the existing booking UI without changing core app.js logic

(function (window, $) {
  'use strict';

  /* ====================================================================== */
  /* 1) CONFIG: SEPARATED GIFT WORKFLOW BACKEND (GAS WEBAPP)                */
  /* ====================================================================== */

  // 🔗 Backend responsible for gift workflow (Google Apps Script WebApp)
  // ⛳️ استبدل هذا الرابط برابط الويب آب الخاص بك في جوجل
  const GIFT_WORKFLOW_BASE =
    window.GIFT_GAS_URL ||
    'https://script.google.com/macros/s/AKfycbzdn5KpXRD3n3B4GA0-HEN9z_Vkp40ESUhVbn_nb3J5MS-4w1nNRF_uH-0NzKqYBYZKhw/exec';

  // Endpoint that will receive gift requests and orchestrate:
  // Request → Admin approval → Notify sender → Send gift to receiver → Track receiver booking
  const GIFT_REQUEST_URL = `${GIFT_WORKFLOW_BASE}?action=gift.request`;

  /* ====================================================================== */
  /* 2) LOCAL STATE                                                         */
  /* ====================================================================== */

  let giftMode = false; // true when user toggles "Send as gift"
  let receiverPhoneDigits = ''; // full numeric receiver phone (with country code)

  // helpers to access globals defined in app.js
  const DateTime = window.luxon ? window.luxon.DateTime : null;

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
    if (card) {
      card.style.display = giftMode ? 'block' : 'none';
    }

    // Hide / show car info section in gift mode
    const carInfoSection = document.getElementById('carInfoSection');
    if (carInfoSection) {
      carInfoSection.style.display = giftMode ? 'none' : 'block';
    }

    // Store flag in form model
    if (window.nForm) {
      window.nForm.isGift = giftMode;
    }

    // Refresh summary + buttons
    if (typeof window.renderSummary === 'function') {
      const activeId =
        document.querySelector('.page.active')?.id || 'page1';
      window.renderSummary(activeId);
    }
    if (typeof window.updateNextAvailability === 'function') {
      window.updateNextAvailability();
    }

    console.log('[gift] Gift mode toggled:', giftMode);
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

  // ✅ أخفّف التحقق من رقم جوال المرسل حتى لا يوقف الانتقال
  function validateSenderBase() {
    const nameVal = ($('#name').val() || '').trim();
    const rawPhone = ($('#mobile').val() || '').trim();
    const digits = rawPhone.replace(/\D/g, '');

    const nameOk = !!nameVal;
    // فقط نتحقق من عدد الأرقام (٨ أو أكثر) بدل isValidNumber
    const phoneOk = digits.length >= 8;

    document.getElementById('err-name').style.display = nameOk
      ? 'none'
      : 'block';
    document.getElementById('err-mobile').style.display = phoneOk
      ? 'none'
      : 'block';

    if (!nameOk || !phoneOk) {
      if (window.showToast) {
        window.showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
      }
      console.log('[gift] validateSenderBase failed', {
        nameOk,
        phoneOk,
        rawPhone,
        digitsLen: digits.length,
      });
      return false;
    }

    // OTP requirement (لو مفعّل في الإعدادات)
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
      console.log('[gift] validateSenderBase failed: OTP not verified');
      return false;
    }

    // Update base form model
    if (window.nForm) {
      window.nForm.customerN = nameVal;

      if (window.itiPhone && window.itiPhone.getNumber) {
        window.nForm.customerM =
          window.itiPhone.getNumber().replace(/^\+/, '');
      } else {
        window.nForm.customerM = digits;
      }
    }

    console.log('[gift] validateSenderBase OK', {
      name: nameVal,
      phoneDigits: digits,
    });
    return true;
  }

  function validateReceiverForGift() {
    if (!isGiftFlowActive()) return true;

    const receiverName = ($('#giftReceiverName').val() || '').trim();
    const countryCode =
      $('#giftReceiverCountryCode').val() || '966';
    const receiverMobileRaw =
      ($('#giftReceiverMobile').val() || '').trim();
    const digits = receiverMobileRaw.replace(/\D/g, '');

    let ok = true;

    if (!receiverName) {
      showFieldError('err-giftReceiverName', 'يرجى إدخال اسم المستلم');
      ok = false;
    } else {
      hideFieldError('err-giftReceiverName');
    }

    if (!digits || digits.length < 8) {
      showFieldError(
        'err-giftReceiverMobile',
        'يرجى إدخال رقم جوال المستلم بشكل صحيح'
      );
      ok = false;
    } else {
      hideFieldError('err-giftReceiverMobile');
    }

    // Store full receiver phone with country code (بدون +)
    receiverPhoneDigits = String(countryCode) + digits;

    if (!ok) {
      if (window.showToast) {
        window.showToast(
          'error',
          'يرجى استكمال بيانات المستلم قبل المتابعة'
        );
      }
      console.log('[gift] validateReceiverForGift failed', {
        receiverName,
        countryCode,
        digitsLen: digits.length,
      });
    } else {
      console.log('[gift] validateReceiverForGift OK', {
        receiverName,
        receiverPhoneDigits,
      });
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
    const senderPhoneDigits =
      (window.nForm && window.nForm.customerM) ||
      ($('#mobile').val() || '').replace(/\D/g, '');

    const receiverName = ($('#giftReceiverName').val() || '').trim();
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
    const couponCode = window.couponCodeApplied || '';
    const couponDiscountAmount = window.couponDiscountAmount || 0;

    const payload = {
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
      senderPhone: senderPhoneDigits,

      // receiver
      receiverName,
      receiverPhone: receiverPhoneDigits,
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
          : '',
    };

    console.log('[gift] buildGiftPayload()', payload);
    return payload;
  }

  /* ====================================================================== */
  /* 6) SEND GIFT REQUEST TO SEPARATED WORKFLOW                             */
  /* ====================================================================== */

  async function sendGiftRequest() {
    if (!isGiftFlowActive()) return;

    if (!window.nForm) window.nForm = {};
    // Build gift payload
    const payload = buildGiftPayload();

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
      payload,
    });

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
        payload.locale === 'en'
          ? 'Gift request – receiver will choose the date.'
          : 'طلب هدية — سيقوم المستلم باختيار الموعد المناسب.';

      if (tsDt) tsDt.textContent = dtText;

      const payMethod =
        (window.nForm && window.nForm.paymentMethod) || '';
      if (tsPay)
        tsPay.textContent = payMethod
          ? String(payMethod).toUpperCase()
          : '—';

      // Build WhatsApp share message for the sender
      const waMsg = encodeURIComponent(
        `تم إرسال هدية غسيل سيارة:\n` +
          `المستلم: ${payload.receiverName}\n` +
          `الخدمة: ${srvTxt}\n` +
          `سيصله رابط الحجز وكوبون الهدية بعد الموافقة من المتجر.\n\n` +
          `رقم المتابعة (إن وجد): ${data.giftId || data.id || '—'}`
      );
      if (tsWa) {
        tsWa.href = `https://wa.me/?text=${waMsg}`;
      }

      // Move to "thank you" page (page7 → index 6 in orderedPages)
      if (typeof window.showPage === 'function') {
        window.showPage(6);
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
  /* 7) PATCH NEXT/PREV BUTTON LOGIC TO SUPPORT GIFT FLOW                   */
  /* ====================================================================== */

  function giftAwareGotoNextFactory() {
    // We essentially re-implement gotoNext but add gift-specific branches.
    return async function giftAwareGotoNext() {
      if (!window.orderedPages || !window.getActiveIndex) return;

      const i = window.getActiveIndex();
      const id = window.orderedPages[i];

      console.log('[gift] footer-next clicked on page', id, {
        giftMode: isGiftFlowActive(),
      });

      // PAGE 1 → same behavior
      if (id === 'page1') {
        if (typeof window.stopWelcomeDeck === 'function') {
          window.stopWelcomeDeck();
        }
        if (typeof window.showPage === 'function') {
          window.showPage(1); // page2
        }
        return;
      }

      // PAGE 2: area/service validation + skip time if gift
      if (id === 'page2') {
        const areaOk = !!$('#area').val();
        const catOk = !!$('#serviceCat').val();
        const svcOk = !!$('#service').val();

        document.getElementById('err-area').style.display = areaOk
          ? 'none'
          : 'block';
        document.getElementById('err-serviceCat').style.display = catOk
          ? 'none'
          : 'block';
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
          console.log('[gift] Page2 validation failed', {
            areaOk,
            catOk,
            svcOk,
          });
          return;
        }

        // Gift? → skip time (page3) and go to contact (page4)
        if (isGiftFlowActive()) {
          // Clear any selected time
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
          console.log('[gift] Skipping time page due to gift flow');
          return;
        }

        // Normal booking → go to time page and load times
        if (typeof window.showPage === 'function') {
          window.showPage(2); // page3
        }
        const dateEl = document.getElementById('date');
        if (dateEl) {
          dateEl.dispatchEvent(new Event('change'));
        }
        return;
      }

      // PAGE 3: time selection (should not be reached in gift flow, but safe)
      if (id === 'page3') {
        if (isGiftFlowActive()) {
          // gift: we don't need time, just go to contact (page4)
          if (typeof window.showPage === 'function') {
            window.showPage(3);
          }
          console.log('[gift] Page3 in gift mode -> jump to page4');
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

      // PAGE 4: contact info
      if (id === 'page4') {
        // 1) validate sender + OTP like original
        if (!validateSenderBase()) return;

        // 2) validate receiver if gift
        if (isGiftFlowActive() && !validateReceiverForGift()) return;

        // car details -> locationDescription (فقط لو ليست هدية)
        if (window.nForm && !isGiftFlowActive()) {
          const carBrand = $('#carBrand').val() || '';
          const carName = $('#carName').val() || '';
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

        // move to payment step (page5)
        if (typeof window.showPage === 'function') {
          window.showPage(4);
        }
        return;
      }

      // PAGE 5: payment
      if (id === 'page5') {
        if (!window.nForm || !window.nForm.paymentMethod) {
          document.getElementById('err-pay').style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'اختر طريقة الدفع');
          }
          return;
        }
        document.getElementById('err-pay').style.display = 'none';

        // Gift flow: send gift to separated workflow instead of going to map
        if (isGiftFlowActive()) {
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

          await sendGiftRequest();
          return;
        }

        // Normal booking → go to map (page6)
        if (typeof window.showPage === 'function') {
          window.showPage(5);
        }
        return;
      }

      // PAGE 6: map + final booking (unchanged, handled in app.js originally)
      if (id === 'page6') {
        // we keep original logic here for normal bookings.
        // For safety, if gift is ON we just prevent this step.
        if (isGiftFlowActive()) {
          if (window.showToast) {
            window.showToast(
              'error',
              'طلب الهدية لا يحتاج لتحديد موقع، يرجى العودة للخلف في حال الخطأ.'
            );
          }
          return;
        }

        // Defer to original booking logic in app.js (لو مخزّن)
        if (typeof window.originalGotoNext === 'function') {
          return window.originalGotoNext();
        }
      }

      // Fallback: go to next page index
      if (typeof window.showPage === 'function') {
        window.showPage(
          Math.min(i + 1, window.orderedPages.length - 1)
        );
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
      const i = window.getActiveIndex();
      const id = window.orderedPages[i];

      console.log('[gift] footer-prev clicked on page', id, {
        giftMode: isGiftFlowActive(),
      });

      // Special case: in gift flow from page4 go back to page2 (skip time)
      if (isGiftFlowActive() && id === 'page4') {
        if (typeof window.showPage === 'function') {
          window.showPage(1); // page2
        }
        if (typeof window.updateNextAvailability === 'function') {
          window.updateNextAvailability();
        }
        return;
      }

      // Default behavior
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
    buildGiftPayload,
  };
})(window, jQuery);

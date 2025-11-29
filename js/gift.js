// 🎁 NahlTime Gift Workflow (frontend)
// - Gift flow is processed by a *separate* Google Apps Script backend
// - Normal booking still uses the existing workflow (RESERVE_URL_* in app.js)
// - This file hooks into the existing booking UI without changing core app.js logic

(function (window, $) {
  'use strict';

  /* ====================================================================== */
  /* 1) CONFIG: SEPARATE GIFT WEBAPP (GOOGLE APPS SCRIPT)                   */
  /* ====================================================================== */

  /**
   * 🔗 Google Apps Script WebApp URL for Gift Workflow ONLY
   * - Deploy your gift Code.gs as a WebApp and paste the URL below.
   * - Example: https://script.google.com/macros/s/XXXXXXX/exec
   */
  const GIFT_GAS_WEBAPP_URL = 'https://script.google.com/macros/s/YOUR_GIFT_WEBAPP_ID/exec';

  // Endpoint that will receive gift requests and orchestrate:
  // Request → Admin approval → Auto-create coupon → Notify sender → Send gift to receiver
  const GIFT_REQUEST_URL = GIFT_GAS_WEBAPP_URL; // we POST JSON to doPost(e)


  /* ====================================================================== */
  /* 2) LOCAL STATE                                                         */
  /* ====================================================================== */

  let giftMode = false;             // true when user toggles "Send as gift"
  let receiverPhoneDigits = '';     // numeric receiver phone (no +, no spaces)

  // Access some globals defined in app.js
  const DateTime = window.luxon ? window.luxon.DateTime : null;

  function isGiftFlowActive() {
    return !!giftMode;
  }


  /* ====================================================================== */
  /* 3) UI HELPERS                                                          */
  /* ====================================================================== */

  function toggleGiftUI(on) {
    giftMode = !!on;

    const card = document.getElementById('giftReceiverCard');
    if (card) {
      card.style.display = giftMode ? 'block' : 'none';
    }

    if (window.nForm) {
      window.nForm.isGift = giftMode;
    }

    // Refresh summary + next button state
    if (typeof window.renderSummary === 'function') {
      const activeId = document.querySelector('.page.active')?.id || 'page1';
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

  // ✅ Same sender validation as core flow (page 4 in app.js) but reusable
  function validateSenderBase() {
    const nameVal = ($('#name').val() || '').trim();
    const nameOk = nameVal.length > 0;
    const phoneOk =
      window.itiPhone && window.itiPhone.isValidNumber
        ? window.itiPhone.isValidNumber()
        : false;

    document.getElementById('err-name').style.display = nameOk ? 'none' : 'block';
    document.getElementById('err-mobile').style.display = phoneOk ? 'none' : 'block';

    if (!nameOk || !phoneOk) {
      if (window.showToast) {
        window.showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
      }
      return false;
    }

    // OTP requirement if enabled
    if (window.OTP_ENABLED && !window.otpVerified) {
      const errOtp = document.getElementById('err-otp');
      if (errOtp) {
        errOtp.textContent = 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
        errOtp.style.display = 'block';
      }
      if (window.showToast) {
        window.showToast('error', 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة');
      }
      return false;
    }

    const errOtp = document.getElementById('err-otp');
    if (errOtp) errOtp.style.display = 'none';

    // Update base nForm
    if (window.nForm && window.itiPhone) {
      window.nForm.customerN = nameVal;
      window.nForm.customerM = window.itiPhone.getNumber().replace(/^\+/, '');
    }

    return true;
  }

  function validateReceiverForGift() {
    // ❗ Only validate receiver if GIFT is enabled
    if (!isGiftFlowActive()) return true;

    const receiverName = ($('#receiverName').val() || '').trim();
    const receiverMobileRaw = ($('#receiverMobile').val() || '').trim();
    const digits = receiverMobileRaw.replace(/\D/g, '');

    let ok = true;

    if (!receiverName) {
      showFieldError('err-receiverName', 'يرجى إدخال اسم المستلم');
      ok = false;
    } else {
      hideFieldError('err-receiverName');
    }

    if (!digits || digits.length < 8) {
      showFieldError('err-receiverMobile', 'يرجى إدخال رقم جوال المستلم بشكل صحيح');
      ok = false;
    } else {
      hideFieldError('err-receiverMobile');
    }

    receiverPhoneDigits = digits;

    if (!ok && window.showToast) {
      window.showToast('error', 'يرجى استكمال بيانات المستلم قبل المتابعة');
    }

    return ok;
  }


  /* ====================================================================== */
  /* 5) BUILD GIFT PAYLOAD                                                  */
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

    const receiverName   = ($('#receiverName').val() || '').trim();
    const giftMessage    = ($('#giftMessage').val() || '').trim();

    const locale =
      (window.isEnglishLocale && window.isEnglishLocale()) ||
      (document.documentElement.lang || 'ar').toLowerCase().startsWith('en')
        ? 'en'
        : 'ar';

    const additionalServices =
      (window.nForm && window.nForm.additionalServicesIds) || [];
    const couponCode           = window.couponCodeApplied || '';
    const couponDiscountAmount = window.couponDiscountAmount || 0;

    // 📌 Send pricing hints to backend so it can generate a correct gift coupon
    const subtotal = typeof window.getOrderSubtotal === 'function'
      ? window.getOrderSubtotal()
      : 0;
    const discount = couponDiscountAmount || 0;
    const totalAmount = Math.max(0, subtotal - discount);

    return {
      action: 'gift.request',  // for Code.gs routing
      
      appId: appId,
      isGift: true,
      flowType: 'GIFT',

      // Selected service
      location:    loc ? String(loc) : '',
      serviceCat:  svcC ? String(svcC) : '',
      service:     svc ? String(svc) : '',
      serviceCount:String(cnt || '1'),

      // Sender
      senderName,
      senderPhone,

      // Receiver
      receiverName,
      receiverPhone: receiverPhoneDigits,
      giftMessage,

      // Gift has no date/time yet → receiver will choose later
      date: '',
      time: '',
      locale,

      // Extra
      additionalServices: additionalServices.join(','),
      couponCode,
      couponDiscountAmount,

      // Pricing hints for gift-coupon creation
      subtotal,
      discountAmount: discount,
      totalAmount,

      // meta
      clientUrl:
        typeof window.location !== 'undefined' ? window.location.href : '',
    };
  }


  /* ====================================================================== */
  /* 6) SEND GIFT REQUEST TO GIFT WEBAPP                                    */
  /* ====================================================================== */

  async function sendGiftRequest() {
    if (!isGiftFlowActive()) return;

    if (!window.nForm) window.nForm = {};

    const payload = buildGiftPayload();

    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const waitDiv = document.getElementById('footer-wait');

    if (window.isSubmitting) return;
    window.isSubmitting = true;

    if (waitDiv) waitDiv.classList.add('show');
    if (nextBtn) nextBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';

    console.log('[gift] Sending gift request to GAS backend:', {
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

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');
      const tsWa      = document.getElementById('ts-whatsapp');

      if (tsArea)    tsArea.textContent    = areaTxt || '—';
      if (tsService) tsService.textContent = srvTxt || '—';

      const dtText =
        payload.locale === 'en'
          ? 'Gift request – receiver will choose the date.'
          : 'طلب هدية — سيقوم المستلم باختيار الموعد المناسب.';

      if (tsDt) tsDt.textContent = dtText;

      const payMethod = (window.nForm && window.nForm.paymentMethod) || '';
      if (tsPay) tsPay.textContent = payMethod ? payMethod.toUpperCase() : '—';

      // WhatsApp share message for sender
      const waMsg = encodeURIComponent(
        `تم إرسال هدية غسيل سيارة:\n` +
          `المستلم: ${payload.receiverName}\n` +
          `الخدمة: ${srvTxt}\n` +
          `سيصله رابط الحجز وكوبون الهدية بعد الموافقة من المتجر.\n\n` +
          `رقم المتابعة: ${data.giftId || data.id || '—'}`
      );
      if (tsWa) {
        tsWa.href = `https://wa.me/?text=${waMsg}`;
      }

      // Go to "thank you" page (page7 → index 6 in orderedPages)
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
  /* 7) GIFT-AWARE NEXT/PREV BUTTON LOGIC                                   */
  /* ====================================================================== */

  function giftAwareGotoNextFactory() {
    // Re-implements gotoNext from app.js, but adds gift branches
    return async function giftAwareGotoNext() {
      if (!window.orderedPages || !window.getActiveIndex) return;

      const i  = window.getActiveIndex();
      const id = window.orderedPages[i];

      const nextBtn = document.getElementById('footer-next');
      const prevBtn = document.getElementById('footer-prev');
      const waitDiv = document.getElementById('footer-wait');

      // PAGE 1: welcome
      if (id === 'page1') {
        if (typeof window.stopWelcomeDeck === 'function') {
          window.stopWelcomeDeck();
        }
        if (typeof window.showPage === 'function') {
          window.showPage(1); // → page2
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
            window.showToast('error', 'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة');
          }
          return;
        }

        // 🎁 Gift: skip time page (page3) → directly to contact (page4)
        if (isGiftFlowActive()) {
          window.selectedTime = null;
          if (window.nForm) {
            window.nForm.date = '';
            window.nForm.time = '';
          }
          if (typeof window.showPage === 'function') {
            window.showPage(3); // index 3 → page4
          }
          if (typeof window.updateNextAvailability === 'function') {
            window.updateNextAvailability();
          }
          return;
        }

        // Normal booking: go to time page (page3)
        if (typeof window.showPage === 'function') {
          window.showPage(2); // index 2 → page3
        }
        const dateEl = document.getElementById('date');
        if (dateEl) {
          dateEl.dispatchEvent(new Event('change'));
        }
        return;
      }

      // PAGE 3: time
      if (id === 'page3') {
        // In gift flow we don't really use this page, but if user reached here:
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
          window.showPage(3); // → page4
        }
        return;
      }

      // PAGE 4: contact (sender + car + gift receiver)
      if (id === 'page4') {
        // 1) Sender validation (same as core)
        if (!validateSenderBase()) return;

        // 2) Gift receiver validation ONLY if giftMode
        if (isGiftFlowActive() && !validateReceiverForGift()) return;

        // 3) Car details → locationDescription
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

        // Move to payment (page5)
        if (typeof window.showPage === 'function') {
          window.showPage(4);
        }
        return;
      }

      // PAGE 5: payment + coupons
      if (id === 'page5') {
        if (!window.nForm || !window.nForm.paymentMethod) {
          document.getElementById('err-pay').style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'اختر طريقة الدفع');
          }
          return;
        }
        document.getElementById('err-pay').style.display = 'none';

        // 🎁 Gift flow: send gift request instead of going to map
        if (isGiftFlowActive()) {
          // Terms must be accepted BEFORE sending gift
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

      // PAGE 6: map + final CONFIRMATION (normal bookings ONLY)
      if (id === 'page6') {
        // Gift flow should never reach here
        if (isGiftFlowActive()) {
          if (window.showToast) {
            window.showToast(
              'error',
              'طلب الهدية لا يحتاج لتحديد موقع، يرجى العودة للخلف في حال الخطأ.'
            );
          }
          return;
        }

        // ✅ Terms check (same as app.js)
        if (window.termsAccepted === false) {
          if (typeof window.openTermsModal === 'function') {
            window.openTermsModal();
          }
          if (window.showToast) {
            window.showToast(
              'info',
              'من فضلك اقرأ ووافق على الشروط والأحكام قبل إكمال الحجز'
            );
          }
          return;
        }

        if (!window.positionUrl) {
          document.getElementById('err-map').style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'الرجاء تحديد الموقع');
          }
          return;
        }
        document.getElementById('err-map').style.display = 'none';
        window.nForm.urlLocation = window.positionUrl;

        if (window.isSubmitting) return;
        window.isSubmitting = true;

        if (nextBtn) nextBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (waitDiv) waitDiv.classList.add('show');

        const payload = typeof window.buildPayload === 'function'
          ? window.buildPayload()
          : {};
        console.log('[booking] Sending reservation payload', payload);

        try {
          const r = await window.postReservation(payload);
          console.log('[booking] Reservation response:', r);

          if (r.ok && r.data?.success) {
            if (window.showToast) window.showToast('success', 'تم إنشاء الحجز');

            const bookingId =
              (r.data.bookingId ??
                r.data.bookingID ??
                r.data.id ??
                r.data.BookingId ??
                r.data.BookingID) || null;

            console.log('[booking] Derived bookingId for review:', bookingId);

            // ⭐ Review scheduling (same as core)
            if (typeof window.scheduleReviewForBooking === 'function') {
              window.scheduleReviewForBooking(bookingId);
            }

            const $service = $('#service').find(':selected').text() || '—';

            const tsArea    = document.getElementById('ts-area');
            const tsService = document.getElementById('ts-service');
            const tsDt      = document.getElementById('ts-dt');
            const tsPay     = document.getElementById('ts-pay');
            const tsWa      = document.getElementById('ts-whatsapp');

            if (tsArea) {
              tsArea.textContent =
                $('#area').find(':selected').text() || '—';
            }
            if (tsService) tsService.textContent = $service;

            if (tsDt && DateTime && window.nForm) {
              tsDt.textContent =
                (window.nForm.date
                  ? DateTime.fromISO(window.nForm.date).toFormat('d LLL yyyy')
                  : '') +
                (window.nForm.time ? ' • ' + window.nForm.time : '');
            }

            if (tsPay) {
              const payMethod = (window.nForm.paymentMethod || '').toUpperCase();
              tsPay.textContent = payMethod || '—';
            }

            const waMsg = encodeURIComponent(
              `تم إرسال طلب حجز: \nالخدمة: ${$service}\nالتاريخ: ${window.nForm.date} ${window.nForm.time}\nالرابط: ${location.href}`
            );
            if (tsWa) {
              tsWa.href = `https://wa.me/?text=${waMsg}`;
            }

            if (waitDiv) waitDiv.classList.remove('show');
            window.isSubmitting = false;
            if (typeof window.showPage === 'function') {
              window.showPage(6); // page7
            }
          } else {
            const msg =
              r?.data?.msgAR ||
              (r.status === 404 ? 'المسار غير موجود' : 'تعذر إنشاء الحجز');
            if (window.showToast) window.showToast('error', msg);
            window.isSubmitting = false;
            if (waitDiv) waitDiv.classList.remove('show');
            if (nextBtn) nextBtn.style.display = '';
            if (prevBtn) prevBtn.style.display = '';
          }
        } catch (err) {
          console.error('[booking] Error in booking flow:', err);
          if (window.showToast) {
            window.showToast('error', 'حدث خطأ أثناء إنشاء الحجز');
          }
          window.isSubmitting = false;
          if (waitDiv) waitDiv.classList.remove('show');
          if (nextBtn) nextBtn.style.display = '';
          if (prevBtn) prevBtn.style.display = '';
        }

        return;
      }

      // Fallback: next index
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

      // 🎁 Special case: in gift flow from page4 back → page2 (skip time)
      if (isGiftFlowActive() && id === 'page4') {
        if (typeof window.showPage === 'function') {
          window.showPage(1); // index 1 → page2
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
    // Gift toggle
    $('#isGiftToggle').on('change', function () {
      toggleGiftUI(this.checked);
    });

    // Patch Next & Prev after app.js has initialized
    const giftAwareNext = giftAwareGotoNextFactory();
    patchNextButton(giftAwareNext);
    patchPrevButton();

    console.log(
      '[gift] Gift workflow initialized with GAS backend:',
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

// 🎁 NahlTime Gift Workflow (frontend)
// - Gift flow is processed by a separated backend on nahl-platform.vercel.app
// - This file hooks into the existing booking UI without changing core app.js logic

(function (window, $) {
  'use strict';

  /* ====================================================================== */
  /* 1) CONFIG: SEPARATED GIFT WORKFLOW BACKEND (NAHL PLATFORM)             */
  /* ====================================================================== */

  // 🔗 Backend responsible for gift workflow (Vercel -> Code.gs)
  const GIFT_WORKFLOW_BASE = 'https://nahl-platform.vercel.app';

  // Endpoint that will receive gift requests and orchestrate:
  // Request → Admin approval → Notify sender → Send gift to receiver → Track receiver booking
  const GIFT_REQUEST_URL = `${GIFT_WORKFLOW_BASE}/api/gift/request`;

  /* ====================================================================== */
  /* 2) LOCAL STATE                                                         */
  /* ====================================================================== */

  let giftMode = false;           // true when user toggles "Send as gift"
  let receiverPhoneDigits = '';   // simple numeric receiver phone

  // helpers to access luxon if needed
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

    // Store flag in form model if present
    if (typeof nForm !== 'undefined') {
      nForm.isGift = giftMode;
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
  }

  function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || el.textContent || '';
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
      typeof itiPhone !== 'undefined' &&
      itiPhone &&
      typeof itiPhone.isValidNumber === 'function'
        ? itiPhone.isValidNumber()
        : false;

    const errNameEl   = document.getElementById('err-name');
    const errMobileEl = document.getElementById('err-mobile');

    if (errNameEl)   errNameEl.style.display   = nameOk ? 'none' : 'block';
    if (errMobileEl) errMobileEl.style.display = phoneOk ? 'none' : 'block';

    if (!nameOk || !phoneOk) {
      if (window.showToast) {
        window.showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
      }
      return false;
    }

    // OTP check (re-use globals from app.js)
    if (typeof OTP_ENABLED !== 'undefined' &&
        OTP_ENABLED &&
        typeof otpVerified !== 'undefined' &&
        !otpVerified) {
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
    if (typeof nForm !== 'undefined' && itiPhone) {
      nForm.customerN = nameVal;
      nForm.customerM = itiPhone.getNumber().replace(/^\+/, '');
    }

    return true;
  }

  function validateReceiverForGift() {
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
      showFieldError(
        'err-receiverMobile',
        'يرجى إدخال رقم جوال المستلم بشكل صحيح'
      );
      ok = false;
    } else {
      hideFieldError('err-receiverMobile');
    }

    receiverPhoneDigits = digits;

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
    const appId =
      (typeof APP_ID !== 'undefined' && APP_ID) ? APP_ID : '';

    const loc  = $('#area').val();
    const svcC = $('#serviceCat').val();
    const svc  = $('#service').val();
    const cnt  = $('#serviceCount').val() || '1';

    const senderName = ($('#name').val() || '').trim();
    const senderPhone =
      itiPhone && itiPhone.getNumber
        ? itiPhone.getNumber().replace(/^\+/, '')
        : '';

    const receiverName = ($('#receiverName').val() || '').trim();
    const giftMessage  = ($('#giftMessage').val() || '').trim();

    const locale =
      (typeof window.isEnglishLocale === 'function' &&
        window.isEnglishLocale()) ||
      (document.documentElement.lang || 'ar')
        .toLowerCase()
        .startsWith('en')
        ? 'en'
        : 'ar';

    const additionalServices =
      (typeof nForm !== 'undefined' && nForm.additionalServicesIds) || [];
    const couponCode =
      (typeof couponCodeApplied !== 'undefined' && couponCodeApplied) || '';
    const couponDiscountAmount =
      (typeof couponDiscountAmount !== 'undefined' && couponDiscountAmount) || 0;

    // This payload is designed for Code.gs → NAHL Platform gift workflow
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
  }

  /* ====================================================================== */
  /* 6) SEND GIFT REQUEST TO SEPARATED WORKFLOW                             */
  /* ====================================================================== */

  async function sendGiftRequest() {
    if (!isGiftFlowActive()) return;

    if (typeof nForm === 'undefined') {
      console.error('[gift] nForm is not defined; aborting gift request.');
      return;
    }

    // Build gift payload
    const payload = buildGiftPayload();
    const locale  = payload.locale || 'ar';

    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const waitDiv = document.getElementById('footer-wait');

    if (typeof isSubmitting !== 'undefined' && isSubmitting) return;
    if (typeof isSubmitting !== 'undefined') {
      isSubmitting = true;
    }

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

        if (nextBtn) nextBtn.style.display = '';
        if (prevBtn) prevBtn.style.display = '';
        if (waitDiv) waitDiv.classList.remove('show');
        if (typeof isSubmitting !== 'undefined') {
          isSubmitting = false;
        }
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
        (typeof window.isEnglishLocale === 'function' &&
        window.isEnglishLocale()
          ? 'Area'
          : 'المنطقة');
      const srvTxt =
        $('#service').find(':selected').text() ||
        (typeof window.isEnglishLocale === 'function' &&
        window.isEnglishLocale()
          ? 'Service'
          : 'الخدمة');

      const tsArea   = document.getElementById('ts-area');
      const tsService= document.getElementById('ts-service');
      const tsDt     = document.getElementById('ts-dt');
      const tsPay    = document.getElementById('ts-pay');
      const tsWa     = document.getElementById('ts-whatsapp');

      if (tsArea)   tsArea.textContent   = areaTxt || '—';
      if (tsService)tsService.textContent= srvTxt || '—';

      const dtText =
        locale === 'en'
          ? 'Gift request – receiver will choose the date.'
          : 'طلب هدية — سيقوم المستلم باختيار الموعد المناسب.';

      if (tsDt) tsDt.textContent = dtText;

      const payMethod =
        (typeof nForm !== 'undefined' && nForm.paymentMethod) || '';
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
      if (typeof isSubmitting !== 'undefined') {
        isSubmitting = false;
      }
    }
  }

  /* ====================================================================== */
  /* 7) GIFT-AWARE NEXT FLOW (OVERRIDES ORIGINAL BUTTON HANDLER)            */
  /* ====================================================================== */

  function giftAwareGotoNextFactory() {
    // Re-implements gotoNext with gift-specific branches.
    return async function giftAwareGotoNext() {
      if (typeof orderedPages === 'undefined' ||
          typeof getActiveIndex !== 'function') return;

      const i  = getActiveIndex();
      const id = orderedPages[i];

      const nextBtn = document.getElementById('footer-next');
      const prevBtn = document.getElementById('footer-prev');
      const waitDiv = document.getElementById('footer-wait');

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
        const catOk  = !!$('#serviceCat').val();
        const svcOk  = !!$('#service').val();

        const errArea   = document.getElementById('err-area');
        const errCat    = document.getElementById('err-serviceCat');
        const errSvc    = document.getElementById('err-service');

        if (errArea) errArea.style.display = areaOk ? 'none' : 'block';
        if (errCat)  errCat.style.display  = catOk  ? 'none' : 'block';
        if (errSvc)  errSvc.style.display  = svcOk  ? 'none' : 'block';

        if (!areaOk || !catOk || !svcOk) {
          if (window.showToast) {
            window.showToast(
              'error',
              'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة'
            );
          }
          return;
        }

        // Gift? → skip time (page3) and go to contact (page4)
        if (isGiftFlowActive()) {
          // Clear any selected time
          if (typeof selectedTime !== 'undefined') {
            selectedTime = null;
          }
          if (typeof nForm !== 'undefined') {
            nForm.date = '';
            nForm.time = '';
          }
          if (typeof window.showPage === 'function') {
            window.showPage(3); // page4
          }
          if (typeof window.updateNextAvailability === 'function') {
            window.updateNextAvailability();
          }
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
          return;
        }

        if (typeof selectedTime === 'undefined' || !selectedTime) {
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

        // car details -> locationDescription
        if (typeof nForm !== 'undefined') {
          const carBrand    = $('#carBrand').val() || '';
          const carName     = $('#carName').val() || '';
          const plateNumber = $('#plateNumber').val() || '';
          nForm.locationDescription = [carBrand, carName, plateNumber]
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
        if (typeof nForm === 'undefined') return;

        if (!nForm.paymentMethod) {
          const errPay = document.getElementById('err-pay');
          if (errPay) errPay.style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'اختر طريقة الدفع');
          }
          return;
        }
        const errPay = document.getElementById('err-pay');
        if (errPay) errPay.style.display = 'none';

        // Gift flow: send gift to separated workflow instead of going to map
        if (isGiftFlowActive()) {
          // ✅ Terms check before sending gift
          if (typeof termsAccepted !== 'undefined' && !termsAccepted) {
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

      // PAGE 6: map + final booking (normal bookings only)
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

        // ✅ Terms & Conditions check before final submit
        if (typeof termsAccepted !== 'undefined' && !termsAccepted) {
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

        if (typeof positionUrl === 'undefined' || !positionUrl) {
          const errMap = document.getElementById('err-map');
          if (errMap) errMap.style.display = 'block';
          if (window.showToast) {
            window.showToast('error', 'الرجاء تحديد الموقع');
          }
          return;
        }
        const errMap = document.getElementById('err-map');
        if (errMap) errMap.style.display = 'none';

        if (typeof nForm !== 'undefined') {
          nForm.urlLocation = positionUrl;
        }

        if (typeof isSubmitting !== 'undefined' && isSubmitting) return;
        if (typeof isSubmitting !== 'undefined') {
          isSubmitting = true;
        }

        if (nextBtn) nextBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (waitDiv) waitDiv.classList.add('show');

        const payload = (typeof buildPayload === 'function')
          ? buildPayload()
          : {};
        console.log('[booking] Sending reservation payload', payload);

        try {
          const r = (typeof postReservation === 'function')
            ? await postReservation(payload)
            : { ok: false, status: 0 };

          console.log('[booking] Reservation response:', r);

          if (r.ok && r.data?.success) {
            if (window.showToast) {
              window.showToast('success', 'تم إنشاء الحجز');
            }

            const bookingId =
              (r.data.bookingId ??
               r.data.bookingID ??
               r.data.id ??
               r.data.BookingId ??
               r.data.BookingID) || null;

            console.log('[booking] Derived bookingId for review:', bookingId);

            // ⭐ REVIEW: schedule sending review form after N minutes via backend
            if (typeof scheduleReviewForBooking === 'function') {
              scheduleReviewForBooking(bookingId);
            }

            const tsArea    = document.getElementById('ts-area');
            const tsService = document.getElementById('ts-service');
            const tsDt      = document.getElementById('ts-dt');
            const tsPay     = document.getElementById('ts-pay');
            const tsWa      = document.getElementById('ts-whatsapp');

            if (tsArea)
              tsArea.textContent =
                $('#area').find(':selected').text() || '—';
            if (tsService)
              tsService.textContent =
                $('#service').find(':selected').text() || '—';
            if (tsDt) {
              const dtTxt =
                (nForm.date
                  ? DateTime.fromISO(nForm.date).toFormat('d LLL yyyy')
                  : '') +
                (nForm.time ? ' • ' + nForm.time : '');
              tsDt.textContent = dtTxt;
            }
            if (tsPay) {
              tsPay.textContent =
                (nForm.paymentMethod || '').toUpperCase() || '—';
            }

            const waMsg = encodeURIComponent(
              `تم إرسال طلب حجز: \n` +
              `الخدمة: ${$('#service').find(':selected').text()}\n` +
              `التاريخ: ${nForm.date} ${nForm.time}\n` +
              `الرابط: ${location.href}`
            );
            if (tsWa) {
              tsWa.href = `https://wa.me/?text=${waMsg}`;
            }

            if (waitDiv) waitDiv.classList.remove('show');
            if (typeof isSubmitting !== 'undefined') {
              isSubmitting = false;
            }
            if (typeof window.showPage === 'function') {
              window.showPage(6);
            }
          } else {
            const msg =
              r?.data?.msgAR ||
              (r.status === 404
                ? 'المسار غير موجود'
                : 'تعذر إنشاء الحجز');
            if (window.showToast) {
              window.showToast('error', msg);
            }
            if (waitDiv) waitDiv.classList.remove('show');
            if (nextBtn) nextBtn.style.display = '';
            if (prevBtn) prevBtn.style.display = '';
            if (typeof isSubmitting !== 'undefined') {
              isSubmitting = false;
            }
          }
        } catch (err) {
          console.error('[booking] Reservation error:', err);
          if (window.showToast) {
            window.showToast('error', 'تعذر إنشاء الحجز');
          }
          if (waitDiv) waitDiv.classList.remove('show');
          if (nextBtn) nextBtn.style.display = '';
          if (prevBtn) prevBtn.style.display = '';
          if (typeof isSubmitting !== 'undefined') {
            isSubmitting = false;
          }
        }
        return;
      }

      // Fallback: go to next page index
      if (typeof window.showPage === 'function') {
        window.showPage(
          Math.min(i + 1, orderedPages.length - 1)
        );
      }
    };
  }

  /* ====================================================================== */
  /* 8) PATCH PREV/NEXT BUTTONS                                             */
  /* ====================================================================== */

  function patchPrevButton() {
    const prev = document.getElementById('footer-prev');
    if (!prev) return;
    const cloned = prev.cloneNode(true);
    prev.parentNode.replaceChild(cloned, prev);

    cloned.addEventListener('click', function () {
      if (typeof orderedPages === 'undefined' ||
          typeof getActiveIndex !== 'function') return;

      const i  = getActiveIndex();
      const id = orderedPages[i];

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
  /* 9) INIT: WIRE TOGGLE + PATCH BUTTONS                                   */
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
  /* 10) PUBLIC API (OPTIONAL)                                              */
  /* ====================================================================== */

  window.nahlGift = {
    isGiftFlowActive,
    buildGiftPayload,
  };
})(window, jQuery);

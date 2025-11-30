// js/gift.js
// 🎁 NahlTime – Gift Workflow (front-end)

/* 
  Depends on globals from app.js:
  - APP_ID
  - nForm
  - isEnglishLocale()
  - buildPayload()
  - showToast()
  - orderedPages
  - getActiveIndex()
  - showPage(idx)
  - updateNextAvailability()
  - window.originalGotoNext (set in app.js)
  - window.termsAccepted (from terms-modal.js)
  - openTermsModal() (from terms-modal.js)
*/

(function () {
  'use strict';

  // Simple state object for gift mode
  const giftState = {
    isGiftMode: false
  };
  window.giftState = giftState; // expose for debugging

  function logGift(...args) {
    console.log('[gift]', ...args);
  }

  /* ================================================================
   * 1) UI SYNC: TOGGLE GIFT MODE
   * ================================================================ */

  function syncGiftUI() {
    const toggle = document.getElementById('isGiftToggle');
    const giftReceiverCard = document.getElementById('giftReceiverCard');
    const carInfoSection   = document.getElementById('carInfoSection');

    const isOn = !!(toggle && toggle.checked);
    giftState.isGiftMode = isOn;
    nForm.isGift = isOn;

    if (giftReceiverCard) {
      giftReceiverCard.style.display = isOn ? '' : 'none';
    }
    if (carInfoSection) {
      // في وضع الهدية لا نحتاج بيانات السيارة
      carInfoSection.style.display = isOn ? 'none' : '';
    }

    logGift('Gift mode =', isOn);
    updateNextAvailability();
  }

  function installGiftToggleHandler() {
    const toggle = document.getElementById('isGiftToggle');
    if (!toggle) return;
    toggle.addEventListener('change', syncGiftUI);
    syncGiftUI(); // initial
  }

  /* ================================================================
   * 2) VALIDATION HELPERS – SENDER & RECEIVER
   * ================================================================ */

  function validateSenderFields() {
    const nameInput   = document.getElementById('name');
    const mobileErr   = document.getElementById('err-mobile');
    const nameErr     = document.getElementById('err-name');
    const otpErr      = document.getElementById('err-otp');

    const nameValue   = (nameInput?.value || '').trim();
    const nameOk      = nameValue.length > 0;
    const phoneOk     = window.itiPhone ? window.itiPhone.isValidNumber() : true;
    const otpOk       = (!window.OTP_ENABLED) || !!window.otpVerified;

    if (nameErr)   nameErr.style.display   = nameOk  ? 'none' : 'block';
    if (mobileErr) mobileErr.style.display = phoneOk ? 'none' : 'block';

    if (window.OTP_ENABLED && !otpOk && otpErr) {
      otpErr.textContent   = 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
      otpErr.style.display = 'block';
    } else if (otpErr) {
      otpErr.style.display = 'none';
    }

    if (!nameOk || !phoneOk || !otpOk) {
      showToast('error', 'يرجى التحقق من الاسم، رقم الجوال، وكود التحقق قبل المتابعة');
      return false;
    }

    // sync form model
    nForm.customerN = nameValue;
    if (window.itiPhone && typeof window.itiPhone.getNumber === 'function') {
      nForm.customerM = window.itiPhone.getNumber().replace(/^\+/, '');
    }

    return true;
  }

  function validateGiftReceiverFields() {
    const nameInput    = document.getElementById('giftReceiverName');
    const mobileInput  = document.getElementById('giftReceiverMobile');
    const countryInput = document.getElementById('giftReceiverCountry');

    const nameErr   = document.getElementById('err-giftReceiverName');
    const mobileErr = document.getElementById('err-giftReceiverMobile');

    const name  = (nameInput?.value || '').trim();
    const local = (mobileInput?.value || '').trim();
    const cc    = (countryInput?.value || '').trim();

    const nameOk  = name.length > 0;
    const phoneOk = local.length >= 8; // simple check (5XXXXXXXX)

    if (nameErr)   nameErr.style.display   = nameOk  ? 'none' : 'block';
    if (mobileErr) mobileErr.style.display = phoneOk ? 'none' : 'block';

    if (!nameOk || !phoneOk) {
      showToast('error', 'يرجى إدخال اسم وجوال المستلم بشكل صحيح');
      return false;
    }

    return true;
  }

  /* ================================================================
   * 3) BUILD GIFT PAYLOAD (WHAT WE SEND TO /api/gift/request)
   * ================================================================ */

  function buildGiftPayload() {
    const base = buildPayload(); // from app.js (location, service, serviceCat, customer, etc.)

    const receiverNameInput   = document.getElementById('giftReceiverName');
    const receiverMobileInput = document.getElementById('giftReceiverMobile');
    const receiverCountrySel  = document.getElementById('giftReceiverCountry');
    const giftMsgInput        = document.getElementById('giftMessage');

    const receiverName   = (receiverNameInput?.value || '').trim();
    const receiverLocal  = (receiverMobileInput?.value || '').trim();
    const receiverCC     = (receiverCountrySel?.value || '').trim() || '966';
    const receiverPhone  = receiverCC + receiverLocal.replace(/^0+/, '');
    const giftMessage    = (giftMsgInput?.value || '').trim();

    const isEn           = isEnglishLocale();

    const payload = {
      // core
      appId:              APP_ID,
      isGift:             true,
      flowType:           'gift-only',
      // from base payload / app.js
      location:           base.location || nForm.location || '',
      serviceCat:         base.serviceCat || nForm.serviceCat || '',
      service:            base.service   || nForm.service   || '',
      serviceCount:       base.serviceCount || nForm.serviceCount || '1',
      // sender
      senderName:         nForm.customerN || '',
      senderPhone:        base.customerM || nForm.customerM || '',
      // receiver
      receiverName:             receiverName,
      receiverPhone:            receiverPhone,
      receiverPhoneCountryCode: receiverCC,
      receiverPhoneLocal:       receiverLocal,
      giftMessage:              giftMessage,
      // time / date (optional for gift, but we pass anyway in case you want it later)
      date:               nForm.date || '',
      time:               nForm.time || '',
      // locale
      locale:             isEn ? 'en' : 'ar',
      // extra meta
      additionalServices: base.additionalServices || '',
      couponCode:         base.couponCode || '',
      couponDiscountAmount: base.couponDiscountAmount || 0,
      clientUrl:          window.location.href
    };

    logGift('Gift payload built:', payload);
    return payload;
  }

  /* ================================================================
   * 4) SUBMIT GIFT REQUEST (CALL /api/gift/request)
   * ================================================================ */

  async function submitGiftRequestFromPage4() {
    if (window.isSubmitting) {
      logGift('Already submitting, ignore click.');
      return;
    }

    // 1) Validate sender + receiver
    if (!validateSenderFields()) return;
    if (!validateGiftReceiverFields()) return;

    // 2) Terms (same requirement as normal booking)
    if (window.termsAccepted === false) {
      if (typeof window.openTermsModal === 'function') {
        window.openTermsModal();
      }
      showToast('info', 'من فضلك اقرأ ووافق على الشروط والأحكام قبل إرسال طلب الهدية');
      return;
    }

    // 3) UI: show loading state (same style as normal submit)
    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const waitBox = document.getElementById('footer-wait');

    window.isSubmitting = true;
    if (nextBtn) nextBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (waitBox) waitBox.classList.add('show');

    try {
      const payload = buildGiftPayload();

      logGift('Submitting gift request to /api/gift/request …', payload);

      const res = await fetch('/api/gift/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        logGift('Gift API response is not JSON:', rawText);
        data = { ok: false, error: 'Invalid JSON from gift API', raw: rawText };
      }

      logGift('Gift API response:', { status: res.status, ok: res.ok, body: data });

      if (!res.ok || data.ok === false) {
        const msg = data && (data.error || data.message) 
          ? (data.error || data.message)
          : 'تعذر تسجيل طلب الهدية، حاول مرة أخرى.';
        showToast('error', msg);
        throw new Error(msg);
      }

      // SUCCESS 🎉
      const isEn = isEnglishLocale();
      showToast(
        'success',
        isEn
          ? 'Gift request registered successfully.'
          : 'تم تسجيل طلب الهدية بنجاح ✅'
      );

      // optional: show giftId / couponCode in console for debugging
      logGift('Gift created with:', {
        giftId:     data.giftId,
        couponCode: data.couponCode
      });

      // Fill thanks page
      const areaText    = $('#area').find(':selected').text() || '—';
      const serviceText = $('#service').find(':selected').text() || '—';
      const receiverName = $('#giftReceiverName').val() || '';

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');
      const tsWa      = document.getElementById('ts-whatsapp');

      if (tsArea)    tsArea.textContent    = areaText;
      if (tsService) tsService.textContent = serviceText;

      if (tsDt) {
        tsDt.textContent = isEn
          ? 'Gift – time will be arranged with the recipient'
          : 'هدية – سيتم التنسيق على الموعد مع المستلم';
      }

      if (tsPay) {
        tsPay.textContent = isEn ? 'Gift Coupon' : 'كوبون هدية';
      }

      if (tsWa) {
        const msg = isEn
          ? `A car wash gift has been requested for ${receiverName}.`
          : `تم طلب هدية غسيل سيارة باسم ${receiverName}.`;
        const href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        tsWa.href = href;
      }

      // Go to final "thank you" page (index 6 = page7)
      showPage(6);

    } catch (err) {
      console.error('[gift] submitGiftRequestFromPage4 error:', err);
      const msg = isEnglishLocale()
        ? 'Could not submit gift request, please try again.'
        : 'تعذر إرسال طلب الهدية، حاول مرة أخرى.';
      showToast('error', msg);

      // restore controls
      if (nextBtn) nextBtn.style.display = '';
      if (prevBtn) prevBtn.style.display = '';
      if (waitBox) waitBox.classList.remove('show');
    } finally {
      window.isSubmitting = false;
    }
  }

  /* ================================================================
   * 5) OVERRIDE NEXT BUTTON FLOW (GIFT-AWARE)
   * ================================================================ */

  function gotoNextGiftAware(e) {
    const i  = getActiveIndex();
    const id = orderedPages[i] || '';

    const isGift = !!giftState.isGiftMode;
    logGift('Next click on page', id, 'giftMode?', isGift);

    // If gift mode is OFF → use normal flow
    if (!isGift) {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext(e);
      }
      return;
    }

    // --- Gift mode ON: customise a few pages ---

    // PAGE 1: same as normal (skip intro)
    if (id === 'page1') {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext(e);
      }
      return;
    }

    // PAGE 2: validate area/service but SKIP time page → go directly to contact (page4)
    if (id === 'page2') {
      const areaOk = !!$('#area').val();
      const catOk  = !!$('#serviceCat').val();
      const svcOk  = !!$('#service').val();

      document.getElementById('err-area').style.display      = areaOk ? 'none' : 'block';
      document.getElementById('err-serviceCat').style.display= catOk  ? 'none' : 'block';
      document.getElementById('err-service').style.display   = svcOk  ? 'none' : 'block';

      if (!areaOk || !catOk || !svcOk) {
        showToast('error', 'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة');
        return;
      }

      // skip time selection (page3) → jump to page4 (index 3)
      logGift('Skipping time step for gift flow → going to page4');
      showPage(3);
      return;
    }

    // PAGE 3: in theory we never reach here in gift mode; if we do, jump to page4
    if (id === 'page3') {
      logGift('Unexpected gift flow at page3; jumping to page4');
      showPage(3);
      return;
    }

    // PAGE 4: instead of going to payment/map, we SUBMIT GIFT HERE
    if (id === 'page4') {
      submitGiftRequestFromPage4();
      return;
    }

    // PAGE 5 & PAGE 6 won't normally be visited in gift mode,
    // but if the user somehow gets there, fallback to normal handler.
    if (typeof window.originalGotoNext === 'function') {
      return window.originalGotoNext(e);
    }
  }

  function wireGiftAwareNextButton() {
    const btn = document.getElementById('footer-next');
    if (!btn) return;

    // Remove the original handler (stored as window.originalGotoNext in app.js)
    if (typeof window.originalGotoNext === 'function') {
      btn.removeEventListener('click', window.originalGotoNext);
    }

    btn.addEventListener('click', gotoNextGiftAware);
    logGift('Gift-aware next button wired.');
  }

  /* ================================================================
   * 6) INIT ON DOM READY
   * ================================================================ */

  function initGiftWorkflow() {
    try {
      installGiftToggleHandler();
      wireGiftAwareNextButton();
      logGift('Gift workflow initialized.');
    } catch (err) {
      console.error('[gift] init error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGiftWorkflow);
  } else {
    initGiftWorkflow();
  }
})();

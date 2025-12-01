// js/gift.js
// 🎁 Gift Workflow Frontend Logic (NahlTime)
// ----------------------------------------
// - يعتمد على APP_ID, nForm, showPage, orderedPages, updateNextAvailability من app.js
// - مسار الهدية الآن:
//   page1 → page2 (الخدمة + تفعيل الهدية) → page4 (بيانات المرسل/المستلم)
//   → page5 (اختيار طريقة الدفع) → handleGiftSubmitFromPayment → Code.gs (gift.request) → page7

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // 1) Helpers عامة
  // -------------------------------------------------------------------
  function isGiftFlowActive() {
    if (typeof window.safeIsGiftOn === 'function') {
      return !!window.safeIsGiftOn();
    }
    return false;
  }

  function getTelInstance() {
    if (typeof window.itiPhone !== 'undefined' && window.itiPhone) return window.itiPhone;
    if (typeof itiPhone !== 'undefined' && itiPhone) return itiPhone;
    return null;
  }

  // -------------------------------------------------------------------
  // 2) التحقق من بيانات المرسل / المستلم + OTP
  //    (تتماشى مع الحقول المطلوبة في handleGiftRequest_ في Code.gs)
  // -------------------------------------------------------------------
  function validateGiftBeforeSubmit() {
    const giftOn = isGiftFlowActive();
    if (!giftOn) return true; // لو مو هدية نترك الحجز العادي

    const senderName = ($('#name').val() || '').trim();
    const tel        = getTelInstance();

    const senderOk = senderName.length > 0;
    const phoneOk  = tel && typeof tel.isValidNumber === 'function'
      ? tel.isValidNumber()
      : false;

    const otpOk = (!window.OTP_ENABLED) || !!window.otpVerified;

    const recName   = ($('#giftReceiverName').val() || '').trim();
    const recMobile = ($('#giftReceiverMobile').val() || '').trim();
    const recNameOk   = recName.length > 0;
    const recMobileDigits = recMobile.replace(/\D/g, '');
    const recMobileOk = recMobileDigits.length >= 6;

    // عناصر الأخطاء في الواجهة
    const errSenderName = document.getElementById('err-name');
    const errMobile     = document.getElementById('err-mobile');
    const errGiftName   = document.getElementById('err-giftReceiverName');
    const errGiftMobile = document.getElementById('err-giftReceiverMobile');
    const errOtp        = document.getElementById('err-otp');

    if (errSenderName) errSenderName.style.display = senderOk    ? 'none' : 'block';
    if (errMobile)     errMobile.style.display     = phoneOk     ? 'none' : 'block';
    if (errGiftName)   errGiftName.style.display   = recNameOk   ? 'none' : 'block';
    if (errGiftMobile) errGiftMobile.style.display = recMobileOk ? 'none' : 'block';
    if (errOtp)        errOtp.style.display        = otpOk       ? 'none' : 'block';

    const allOk = senderOk && phoneOk && otpOk && recNameOk && recMobileOk;

    if (!allOk) {
      console.log('[gift][validate] senderOk=', senderOk,
        'phoneOk=', phoneOk,
        'otpOk=', otpOk,
        'recNameOk=', recNameOk,
        'recMobileOk=', recMobileOk);

      if (typeof window.showToast === 'function') {
        window.showToast(
          'error',
          'يرجى التأكد من إكمال بيانات المرسل والمستلم قبل إرسال الهدية.'
        );
      }
      return false;
    }

    // حفظ قيم المستلم في nForm لاستخدامها لاحقًا في الـ payload
    const rCodeRaw = ($('#giftReceiverCountry').val() || '966')
      .toString()
      .trim()
      .replace(/^\+/, '');
    const rLocal = recMobile;

    if (window.nForm) {
      window.nForm.giftReceiverName        = recName;
      window.nForm.giftReceiverCountry     = rCodeRaw;
      window.nForm.giftReceiverMobileLocal = rLocal;
      window.nForm.giftReceiverPhoneFull   = `+${rCodeRaw}${recMobileDigits}`;
      window.nForm.giftMessage             = ($('#giftMessage').val() || '').trim();
    }

    return true;
  }

  // ن expose الفنكشن لو حبيت تناديها من مكان آخر
  window.validateGiftBeforeSubmit = validateGiftBeforeSubmit;

  // -------------------------------------------------------------------
  // 3) بناء الـ payload كما يتوقع handleGiftRequest_ في Code.gs
  // -------------------------------------------------------------------
  function buildGiftPayload() {
    const tel = getTelInstance();

    const senderName = ($('#name').val() || '').trim();
    const senderPhone = tel && typeof tel.getNumber === 'function'
      ? tel.getNumber().replace(/^\+/, '')
      : '';

    const recName        = ($('#giftReceiverName').val() || '').trim();
    const recMobileRaw   = ($('#giftReceiverMobile').val() || '').trim();
    const recMobileDigits= recMobileRaw.replace(/\D/g, '');
    const countryRaw     = ($('#giftReceiverCountry').val() || '966')
      .toString()
      .trim()
      .replace(/^\+/, '');
    const receiverFull   = countryRaw + recMobileDigits;

    const giftMessage = ($('#giftMessage').val() || '').trim();

    const locId        = $('#area').val()       || '';
    const catId        = $('#serviceCat').val() || '';
    const svcId        = $('#service').val()    || '';
    const serviceCount = $('#serviceCount').val() || '1';

    const locale = (window.isEnglishLocale && window.isEnglishLocale()) ? 'en' : 'ar';

    const additionalServices =
      (window.nForm && Array.isArray(window.nForm.additionalServicesIds))
        ? window.nForm.additionalServicesIds.join(',')
        : '';

    const payload = {
      // مهم: الـ action هنا حتى doPost في Code.gs يعرف أنها gift.request
      action: 'gift.request',

      appId:  window.APP_ID,
      isGift: true,
      flowType: 'gift-with-payment',

      location:     locId,
      serviceCat:   catId,
      service:      svcId,
      serviceCount: serviceCount,

      senderName:  senderName,
      senderPhone: senderPhone,

      receiverName:              recName,
      receiverPhone:             receiverFull,
      receiverPhoneCountryCode:  countryRaw,
      receiverPhoneLocal:        recMobileRaw,

      giftMessage: giftMessage,

      // اختيارية، لو حاب تستخدمها لاحقًا
      date:   window.nForm ? (window.nForm.date || '') : '',
      time:   window.nForm ? (window.nForm.time || '') : '',
      locale: locale,

      additionalServices:   additionalServices,
      couponCode:           window.couponCodeApplied    || '',
      couponDiscountAmount: window.couponDiscountAmount || 0,

      clientUrl: window.location.href
    };

    // Logging مفيد للتتبع
    console.log('[gift] buildGiftPayload()', payload);
    return payload;
  }

  // -------------------------------------------------------------------
  // 4) الفنكشن الرئيسية: تُستدعى من app.js في خطوة الدفع (page5)
  // -------------------------------------------------------------------
  async function handleGiftSubmitFromPayment() {
    const giftOn = isGiftFlowActive();

    // لو مو Gift → رجّع للمنطق الأصلي (حجز عادي)
    if (!giftOn) {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext();
      }
      return;
    }

    // ✅ تحقق من بيانات المرسل والمستلم + OTP
    if (!validateGiftBeforeSubmit()) return;

    // ✅ تحقق من الموافقة على الشروط قبل الإرسال
    if (window.termsAccepted === false) {
      if (typeof window.openTermsModal === 'function') {
        window.openTermsModal();
      }
      if (typeof window.showToast === 'function') {
        window.showToast(
          'info',
          'من فضلك اقرأ ووافق على الشروط والأحكام قبل إتمام طلب الهدية.'
        );
      }
      return;
    }

    if (window.isSubmitting) return;
    window.isSubmitting = true;

    const nextBtn = document.getElementById('footer-next');
    const prevBtn = document.getElementById('footer-prev');
    const wait    = document.getElementById('footer-wait');

    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
    }
    if (prevBtn) prevBtn.style.display = 'none';
    if (wait)    wait.classList.add('show');

    try {
      const payload = buildGiftPayload();

      console.log('[gift] sending to /api/gift/request', payload);

      const res = await fetch('/api/gift/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('[gift] Non-JSON response from proxy:', text);
        data = { ok: false, error: 'Invalid JSON from proxy', raw: text };
      }

      console.log('[gift] proxy response:', data);

      if (!res.ok || data.ok === false) {
        const msg = data.error || data.messageAr || 'تعذر تسجيل طلب الهدية حالياً.';
        if (typeof window.showToast === 'function') {
          window.showToast('error', msg);
        }
        window.isSubmitting = false;
        if (wait)    wait.classList.remove('show');
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled');
        }
        if (prevBtn) prevBtn.style.display = '';
        return;
      }

      // ✅ نجاح – سجلنا الهدية والكوبون في Google Sheets
      if (typeof window.showToast === 'function') {
        window.showToast(
          'success',
          'تم تسجيل طلب الهدية بنجاح، وسيتم استكماله من قِبل المتجر 🎁'
        );
      }

      // تحديث صفحة "تم" بمعلومات مختصرة
      const areaTxt    = $('#area').find(':selected').text()    || '—';
      const serviceTxt = $('#service').find(':selected').text() || '—';

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');
      const waBtn     = document.getElementById('ts-whatsapp');

      if (tsArea)    tsArea.textContent    = areaTxt;
      if (tsService) tsService.textContent = serviceTxt;
      if (tsDt)      tsDt.textContent      = 'طلب هدية (بدون موعد محدد)';
      if (tsPay)     tsPay.textContent     =
        (window.nForm?.paymentMethod || '').toUpperCase() || '—';

      if (waBtn) {
        const msg =
          `🎁 تم إصدار هدية غسيل سيارة!\n` +
          `من: ${($('#name').val() || '').trim()}\n` +
          `الخدمة: ${serviceTxt}\n` +
          `سيصلك رابط الحجز وكوبون الخصم على واتساب قريباً بإذن الله.`;
        waBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      }

      if (wait) wait.classList.remove('show');
      window.isSubmitting = false;

      // الانتقال إلى صفحة "تم" (page7)
      if (typeof window.showPage === 'function') {
        const idx = window.orderedPages
          ? window.orderedPages.indexOf('page7')
          : 6;
        window.showPage(idx >= 0 ? idx : 6);
      }
    } catch (err) {
      console.error('[gift] handleGiftSubmitFromPayment error:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'تعذر إرسال طلب الهدية حالياً، حاول مرة أخرى.');
      }
      window.isSubmitting = false;
      if (wait)    wait.classList.remove('show');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('disabled');
      }
      if (prevBtn) prevBtn.style.display = '';
    }
  }

  // نعرّفها على window عشان app.js يقدر يستدعيها من gotoNext
  window.handleGiftSubmitFromPayment = handleGiftSubmitFromPayment;

  // -------------------------------------------------------------------
  // 5) تحسين تفعيل زر "التالي" عند الكتابة في حقول الهدية
  // -------------------------------------------------------------------
  $(function () {
    ['giftReceiverName', 'giftReceiverMobile', 'giftMessage', 'name', 'mobile']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => {
            if (typeof window.updateNextAvailability === 'function') {
              window.updateNextAvailability();
            }
          });
        }
      });
  });

})();

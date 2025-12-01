// js/gift.js
// 🎁 Gift Workflow Frontend Logic (NahlTime)
// ----------------------------------------
// - يعتمد على APP_ID, nForm, showPage, orderedPages, updateNextAvailability,
//   buildPayload, postReservation من app.js
// - مسار الهدية الآن:
//   page1 → page2 (اختيار الخدمة + تفعيل الهدية) → page4 (بيانات المرسل/المستلم)
//   → page5 (اختيار طريقة الدفع) → handleGiftSubmitFromPayment → page7

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // 1) هل مسار الهدية فعّال حالياً؟ (باستخدام safeIsGiftOn من app.js)
  // -------------------------------------------------------------------
  function isGiftFlowActive() {
    if (typeof window.safeIsGiftOn === 'function') {
      return !!window.safeIsGiftOn();
    }
    return false;
  }

  // -------------------------------------------------------------------
  // 2) Helpers لإعطاء قيم افتراضية متوافقة مع الـ backend
  // -------------------------------------------------------------------
  function getFallbackDate() {
    try {
      const input = document.getElementById('date');
      const raw   = (input?.value || '').trim();
      if (raw) return raw;

      if (window.DateTime) {
        return window.DateTime.now().toFormat('yyyy-LL-dd');
      }
    } catch (e) {
      console.warn('[gift] getFallbackDate error', e);
    }
    return '1970-01-01';
  }

  function getFallbackTime() {
    // وقت افتراضي فقط لتمرير الفالديشن في السيرفر
    return '00:00';
  }

  function getFallbackLocationUrl() {
    // رابط خرائط افتراضي (رياض مثلاً) لتمرير الفالديشن
    return 'https://www.google.com/maps/search/?api=1&query=24.7136,46.6753';
  }

  // -------------------------------------------------------------------
  // 3) التحقق من اكتمال بيانات المرسل والمستلم قبل إرسال الهدية
  // -------------------------------------------------------------------
  function validateGiftBeforeSubmit() {
    const giftOn = (typeof window.safeIsGiftOn === 'function')
      ? window.safeIsGiftOn()
      : false;

    if (!giftOn) return true; // لو مو هدية، نخلي الحجز العادي يكمل

    const senderName = ($('#name').val() || '').trim();
    const senderOk   = senderName.length > 0;

    // نحاول نستخدم instance أينما كانت
    const telInstance =
      (typeof window.itiPhone !== 'undefined' && window.itiPhone) ||
      (typeof itiPhone !== 'undefined' && itiPhone) ||
      null;

    const phoneOk = telInstance && typeof telInstance.isValidNumber === 'function'
      ? telInstance.isValidNumber()
      : false;

    const otpOk = (!window.OTP_ENABLED) || !!window.otpVerified;

    const recName   = ($('#giftReceiverName').val() || '').trim();
    const recMobile = ($('#giftReceiverMobile').val() || '').trim();
    const recNameOk   = recName.length > 0;
    const recMobileOk = recMobile.replace(/\D/g, '').length >= 6;

    // تحديث رسائل الأخطاء البصرية
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

    // حفظ قيم المستلم في nForm (تستخدم لاحقاً في الـ payload)
    const rCodeRaw = ($('#giftReceiverCountry').val() || '966')
      .trim()
      .replace(/^\+/, '');
    const rLocal = recMobile;
    const digits = rLocal.replace(/\D/g, '');

    if (window.nForm) {
      window.nForm.giftReceiverName        = recName;
      window.nForm.giftReceiverCountry     = rCodeRaw;
      window.nForm.giftReceiverMobileLocal = rLocal;
      window.nForm.giftReceiverPhoneFull   = `+${rCodeRaw}${digits}`;
      window.nForm.giftMessage             = ($('#giftMessage').val() || '').trim();
    }

    return true;
  }

  // نخليها متاحة عالمياً لو احتجتها من أي ملف آخر
  window.validateGiftBeforeSubmit = validateGiftBeforeSubmit;

  // -------------------------------------------------------------------
  // 4) إرسال طلب الهدية عبر postReservation (نفس مسار الحجز العادي)
  // -------------------------------------------------------------------
  async function handleGiftSubmitFromPayment() {
    const giftOn = isGiftFlowActive();

    // لو مو Gift → رجّع للمنطق الأصلي (حجز عادي) لو موجود
    if (!giftOn) {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext();
      }
      return;
    }

    // ✅ تحقق من بيانات المرسل والمستلم + OTP
    if (!validateGiftBeforeSubmit()) return;

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
      // نستخدم نفس الـ payload تبع الحجز، لكن:
      // - نخلي date/time/locationUrl لها قيم افتراضية
      // - نضيف بيانات الهدية
      const payload = (typeof window.buildPayload === 'function')
        ? window.buildPayload()
        : {};

      payload.isGift = true;

      if (!payload.date || !String(payload.date).trim()) {
        payload.date = getFallbackDate();
      }
      if (!payload.time || !String(payload.time).trim()) {
        payload.time = getFallbackTime();
      }
      if (!payload.urlLocation || !String(payload.urlLocation).trim()) {
        payload.urlLocation = getFallbackLocationUrl();
      }

      if (window.nForm) {
        payload.giftReceiverName        = window.nForm.giftReceiverName;
        payload.giftReceiverCountry     = window.nForm.giftReceiverCountry;
        payload.giftReceiverMobileLocal = window.nForm.giftReceiverMobileLocal;
        payload.giftReceiverPhoneFull   = window.nForm.giftReceiverPhoneFull;
        payload.giftMessage             = window.nForm.giftMessage || '';
      }

      console.log('[gift] sending gift payload via postReservation', payload);
      const r = await window.postReservation(payload);
      console.log('[gift] response', r);

      if (r.ok && r.data?.success) {
        if (typeof window.showToast === 'function') {
          window.showToast('success', 'تم إرسال طلب الهدية بنجاح 🎁');
        }

        // تحديث صفحة "تم"
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

        if (typeof window.showPage === 'function') {
          const idx = window.orderedPages
            ? window.orderedPages.indexOf('page7')
            : 6;
          window.showPage(idx >= 0 ? idx : 6);
        }
      } else {
        const msg =
          r?.data?.msgAR ||
          (r.status === 404 ? 'المسار غير موجود' : 'تعذر إرسال الهدية حالياً');
        if (typeof window.showToast === 'function') {
          window.showToast('error', msg);
        }
        if (wait) wait.classList.remove('show');
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled');
        }
        if (prevBtn) prevBtn.style.display = '';
        window.isSubmitting = false;
      }
    } catch (err) {
      console.error('[gift] handleGiftSubmitFromPayment error:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'تعذر إرسال الهدية حالياً، حاول مرة أخرى.');
      }
      if (wait) wait.classList.remove('show');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('disabled');
      }
      if (prevBtn) prevBtn.style.display = '';
      window.isSubmitting = false;
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

// js/gift.js
// 🎁 Gift Workflow Frontend Logic (NahlTime)
// ----------------------------------------
// - يعتمد على APP_ID, nForm, showPage, orderedPages, updateNextAvailability من app.js
// - مسار الهدية الآن:
//   page1 → page2 (اختيار الخدمة + تفعيل الهدية) → page4 (بيانات المرسل/المستلم)
//   → page5 (اختيار طريقة الدفع) → استدعاء sendGiftRequestAndFinish → page7

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // 1) هل مسار الهدية فعّال حالياً؟
  //    نعتمد على safeIsGiftOn من app.js
  // -------------------------------------------------------------------
  function isGiftFlowActive() {
    if (typeof window.safeIsGiftOn === 'function') {
      return !!window.safeIsGiftOn();
    }
    return false;
  }

  // -------------------------------------------------------------------
  // 2) بناء بيانات الهدية (payload) من الفورم
  // -------------------------------------------------------------------
  function buildGiftPayload() {
    const giftMsgEl          = document.getElementById('giftMessage');
    const receiverCodeEl     = document.getElementById('giftReceiverCountry');
    const receiverPhoneLocal = document.getElementById('giftReceiverMobile');
    const receiverNameEl     = document.getElementById('giftReceiverName');
    const senderNameEl       = document.getElementById('name');

    const receiverCodeRaw = (receiverCodeEl?.value || '966').trim();
    const receiverCode    = receiverCodeRaw.replace(/^\+/, '');

    const receiverLocalRaw = (receiverPhoneLocal?.value || '').trim();
    const receiverDigits   = receiverLocalRaw.replace(/\D/g, '');
    const receiverFull     = receiverCode + receiverDigits;

    const giftMessage = giftMsgEl ? giftMsgEl.value.trim() : '';

    const senderPhone =
      (window.itiPhone && typeof window.itiPhone.getNumber === 'function')
        ? window.itiPhone.getNumber().replace(/^\+/, '')
        : '';

    return {
      appId:         window.APP_ID,
      isGift:        true,
      flowType:      'gift-with-payment',

      // الخدمة المختارة
      location:      $('#area').val()       || '',
      serviceCat:    $('#serviceCat').val() || '',
      service:       $('#service').val()    || '',
      serviceCount:  $('#serviceCount').val() || '1',

      // بيانات المرسل
      senderName:    (senderNameEl?.value || '').trim(),
      senderPhone,

      // بيانات المستلم
      receiverName:  (receiverNameEl?.value || '').trim(),
      receiverPhone: receiverFull,
      receiverPhoneCountryCode: receiverCode,
      receiverPhoneLocal:       receiverLocalRaw,

      // رسالة الهدية
      giftMessage,

      // اللغة الحالية
      locale:        (window.isEnglishLocale && window.isEnglishLocale()) ? 'en' : 'ar',

      // خدمات إضافية + كوبون
      additionalServices:   (window.nForm?.additionalServicesIds || []).join(','),
      couponCode:           window.couponCodeApplied    || '',
      couponDiscountAmount: window.couponDiscountAmount || 0,

      clientUrl: window.location.href
    };
  }

  // -------------------------------------------------------------------
  // 3) إرسال طلب الهدية عبر /api/gift/request ثم الانتقال لصفحة "تم"
  // -------------------------------------------------------------------
  async function sendGiftRequestAndFinish() {
    if (!isGiftFlowActive()) {
      // لو موضع الهدية غير مفعّل نخرج بهدوء
      return;
    }

    // ✅ التحقق من الشروط والأحكام قبل الإرسال
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

    const payload = buildGiftPayload();

    // فحص بسيط جداً لوجود بعض الحقول الأساسية
    if (!payload.senderName || !payload.senderPhone ||
        !payload.receiverName || !payload.receiverPhone) {
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'يرجى التأكد من إكمال بيانات المرسل والمستلم قبل إرسال الهدية.');
      }
      return;
    }

    const nextBtn  = document.getElementById('footer-next');
    const prevBtn  = document.getElementById('footer-prev');
    const waitWrap = document.getElementById('footer-wait');

    if (window.isSubmitting) return;
    window.isSubmitting = true;

    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
    }
    if (prevBtn) {
      prevBtn.style.display = 'none';
    }
    if (waitWrap) {
      waitWrap.classList.add('show');
    }

    try {
      console.log('[gift] sending payload to /api/gift/request', payload);

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
        const msg = data.error || 'تعذر تسجيل طلب الهدية حالياً.';
        if (typeof window.showToast === 'function') {
          window.showToast('error', msg);
        }
        window.isSubmitting = false;
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled');
        }
        if (prevBtn) prevBtn.style.display = '';
        if (waitWrap) waitWrap.classList.remove('show');
        return;
      }

      // ✅ نجاح
      if (typeof window.showToast === 'function') {
        window.showToast(
          'success',
          'تم تسجيل طلب الهدية بنجاح، وسيتم التواصل مع المستلم عبر واتساب 🌟'
        );
      }

      // تحديث ملخص الشكر
      const areaText    = $('#area').find(':selected').text()    || '—';
      const serviceText = $('#service').find(':selected').text() || '—';

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');
      const waBtn     = document.getElementById('ts-whatsapp');

      if (tsArea)    tsArea.textContent    = areaText;
      if (tsService) tsService.textContent = serviceText;
      if (tsDt)      tsDt.textContent      = '— (هدية)';
      if (tsPay)     tsPay.textContent     = 'كوبون هدية';

      if (waBtn) {
        const msg =
          `🎁 تم إصدار هدية غسيل سيارة!\n` +
          `من: ${payload.senderName}\n` +
          `الخدمة: ${serviceText}\n` +
          `سيصلك رابط الحجز وكوبون الخصم على واتساب قريباً بإذن الله.`;
        waBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      }

      if (waitWrap) waitWrap.classList.remove('show');
      window.isSubmitting = false;

      // الانتقال إلى صفحة "تم" (page7)
      if (typeof window.showPage === 'function') {
        const idx = window.orderedPages
          ? window.orderedPages.indexOf('page7')
          : 6;
        window.showPage(idx >= 0 ? idx : 6);
      }
    } catch (err) {
      console.error('[gift] sendGiftRequestAndFinish error:', err);
      if (typeof window.showToast === 'function') {
        window.showToast(
          'error',
          'حدث خطأ أثناء إرسال طلب الهدية، حاول مرة أخرى.'
        );
      }
      window.isSubmitting = false;
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('disabled');
      }
      if (prevBtn) prevBtn.style.display = '';
      if (waitWrap) waitWrap.classList.remove('show');
    }
  }

  // -------------------------------------------------------------------
  // 4) تحسين تفعيل زر "التالي" عند الكتابة في حقول الهدية
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

  // -------------------------------------------------------------------
  // 5) ربط gift.js مع app.js
  //    app.js (في خطوة الدفع page5) يستدعي handleGiftSubmitFromPayment
  // -------------------------------------------------------------------
  window.handleGiftSubmitFromPayment = sendGiftRequestAndFinish;

})();

async function handleGiftSubmitFromPayment() {
  const giftOn = safeIsGiftOn();

  // لو مو Gift → رجّع للمنطق الأصلي (حجز عادي)
  if (!giftOn) {
    if (typeof window.originalGotoNext === 'function') {
      return window.originalGotoNext();
    }
    return;
  }

  // تحقق من اكتمال بيانات المرسل والمستلم فقط
  if (!validateGiftBeforeSubmit()) return;

  if (window.isSubmitting) return;
  window.isSubmitting = true;

  const nextBtn = document.getElementById('footer-next');
  const prevBtn = document.getElementById('footer-prev');
  const wait    = document.getElementById('footer-wait');

  if (nextBtn) nextBtn.style.display = 'none';
  if (prevBtn) prevBtn.style.display = 'none';
  if (wait)    wait.classList.add('show');

  try {
    // نستخدم نفس الـ payload مع تعزيز قيم الهدية
    const payload = buildPayload();

    payload.isGift                     = true;
    payload.date                       = payload.date || ''; // بدون وقت / تاريخ إلزامي
    payload.time                       = payload.time || '';

    payload.giftReceiverName           = nForm.giftReceiverName;
    payload.giftReceiverCountry        = nForm.giftReceiverCountry;
    payload.giftReceiverMobileLocal    = nForm.giftReceiverMobileLocal;
    payload.giftReceiverPhoneFull      = nForm.giftReceiverPhoneFull;
    payload.giftMessage                = nForm.giftMessage || '';

    console.log('[gift] sending gift payload', payload);
    const r = await postReservation(payload);
    console.log('[gift] response', r);

    if (r.ok && r.data?.success) {
      showToast('success', 'تم إرسال طلب الهدية بنجاح 🎁');

      // نستخدم صفحة "تم" نفسها لكن بنص مختلف بسيط للموعد
      const areaTxt    = $('#area').find(':selected').text()    || '—';
      const serviceTxt = $('#service').find(':selected').text() || '—';

      document.getElementById('ts-area').textContent    = areaTxt;
      document.getElementById('ts-service').textContent = serviceTxt;
      document.getElementById('ts-dt').textContent      = 'طلب هدية (بدون موعد محدد)';
      document.getElementById('ts-pay').textContent     =
        (nForm.paymentMethod || '').toUpperCase() || '—';

      if (wait) wait.classList.remove('show');
      window.isSubmitting = false;
      showPage(6); // page7 (تم)
    } else {
      const msg =
        r?.data?.msgAR ||
        (r.status === 404 ? 'المسار غير موجود' : 'تعذر إرسال الهدية حالياً');
      showToast('error', msg);
      if (wait) wait.classList.remove('show');
      if (nextBtn) nextBtn.style.display = '';
      if (prevBtn) prevBtn.style.display = '';
      window.isSubmitting = false;
    }
  } catch (err) {
    console.error('[gift] handleGiftSubmitFromPayment error:', err);
    showToast('error', 'تعذر إرسال الهدية حالياً، حاول مرة أخرى.');
    if (wait) wait.classList.remove('show');
    if (nextBtn) nextBtn.style.display = '';
    if (prevBtn) prevBtn.style.display = '';
    window.isSubmitting = false;
  }
}

window.handleGiftSubmitFromPayment = handleGiftSubmitFromPayment;

function validateGiftBeforeSubmit() {
  const giftOn = (typeof safeIsGiftOn === 'function') ? safeIsGiftOn() : false;
  if (!giftOn) return true; // لو مو هدية، نخلي الحجز العادي يكمل

  const senderName = ($('#name').val() || '').trim();
  const senderOk   = senderName.length > 0;

  // نحاول نستخدم instance أينما كانت
  const telInstance =
    (typeof itiPhone !== 'undefined' && itiPhone) ||
    (window.itiPhone || null);

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
    showToast('error', 'يرجى التأكد من إكمال بيانات المرسل والمستلم قبل إرسال الهدية.');
    return false;
  }

  return true;
}

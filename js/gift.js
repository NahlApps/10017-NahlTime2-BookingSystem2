// js/gift.js
// 🎁 Gift Workflow Frontend Logic (NahlTime)
// ----------------------------------------
// - يعتمد على APP_ID, nForm, showPage, getActiveIndex, updateNextAvailability من app.js
// - يضيف مسار حجز خاص بالهدايا:
//   page1 → page2 (تفعيل الهدية) → page4 (بيانات المرسل/المستلم) → إرسال WebApp → page7

(function () {
  'use strict';

  // 🔁 حالة الهدية على مستوى التطبيق
  window.isGiftMode = window.isGiftMode || false;

  function isGiftFlowActive() {
    return !!window.isGiftMode;
  }

  // -------------------------------------------------------------------
  // 1) مزامنة واجهة الهدية (إظهار/إخفاء الأقسام)
  // -------------------------------------------------------------------
  function syncGiftToggleUI(isOn) {
    const giftCard      = document.getElementById('giftReceiverCard');
    const carInfo       = document.getElementById('carInfoSection');
    const serviceCount  = document.getElementById('serviceCount');
    const giftMsg       = document.getElementById('giftMessage');
    const receiverName  = document.getElementById('giftReceiverName');
    const receiverPhone = document.getElementById('giftReceiverMobile');

    window.isGiftMode = !!isOn;

    if (giftCard) giftCard.style.display = isOn ? 'block' : 'none';
    // في وضع الهدية نخفي بيانات السيارة لأنها ليست مطلوبة
    if (carInfo)  carInfo.style.display  = isOn ? 'none'  : 'block';

    // في وضع الهدية، يفضّل إجمالي 1 سيارة (لكن نتركه لو حابب تعدل)
    if (isOn && serviceCount && !serviceCount.dataset._giftLocked) {
      serviceCount.dataset._giftLocked = '1';
      // لو حاب تسويه دائماً 1:
      // serviceCount.value = '1';
      // $(serviceCount).trigger('change');
    }

    // تنظيف أخطاء الحقول
    const errRName   = document.getElementById('err-giftReceiverName');
    const errRMobile = document.getElementById('err-giftReceiverMobile');
    if (!isOn) {
      if (giftMsg)      giftMsg.value      = '';
      if (receiverName) receiverName.value = '';
      if (receiverPhone)receiverPhone.value= '';
      if (errRName)     errRName.style.display   = 'none';
      if (errRMobile)   errRMobile.style.display = 'none';
    }

    if (typeof updateNextAvailability === 'function') {
      updateNextAvailability();
    }
  }

  // -------------------------------------------------------------------
  // 2) فحص صحة بيانات الهدية (page4)
  // -------------------------------------------------------------------
  function validateGiftPage() {
    const receiverName  = document.getElementById('giftReceiverName');
    const receiverPhone = document.getElementById('giftReceiverMobile');
    const receiverCode  = document.getElementById('giftReceiverCountry');
    const senderName    = document.getElementById('name');
    const errRName      = document.getElementById('err-giftReceiverName');
    const errRMobile    = document.getElementById('err-giftReceiverMobile');
    const errName       = document.getElementById('err-name');
    const errMobile     = document.getElementById('err-mobile');

    let ok = true;

    // اسم المرسل + جوال المرسل
    const senderNameVal = (senderName?.value || '').trim();
    if (!senderNameVal) {
      if (errName) errName.style.display = 'block';
      ok = false;
    } else if (errName) {
      errName.style.display = 'none';
    }

    const phoneOk = (window.itiPhone ? window.itiPhone.isValidNumber() : false);
    if (!phoneOk) {
      if (errMobile) errMobile.style.display = 'block';
      ok = false;
    } else if (errMobile) {
      errMobile.style.display = 'none';
    }

    // التحقق من OTP (لو مفعّل)
    if (window.OTP_ENABLED && !window.otpVerified) {
      const errOtp = document.getElementById('err-otp');
      if (errOtp) {
        errOtp.textContent = 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل إتمام الهدية.';
        errOtp.style.display = 'block';
      }
      if (typeof showToast === 'function') {
        showToast('error', 'يرجى التحقق من رقم جوالك قبل إتمام طلب الهدية.');
      }
      ok = false;
    }

    // اسم المستلم
    const rName = (receiverName?.value || '').trim();
    if (!rName) {
      if (errRName) errRName.style.display = 'block';
      ok = false;
    } else if (errRName) {
      errRName.style.display = 'none';
    }

    // جوال المستلم
    const rPhone = (receiverPhone?.value || '').trim();
    const rCode  = (receiverCode?.value || '966').trim();
    if (!rPhone || rPhone.length < 7) {
      if (errRMobile) errRMobile.style.display = 'block';
      ok = false;
    } else if (errRMobile) {
      errRMobile.style.display = 'none';
    }

    if (!ok) {
      if (typeof showToast === 'function') {
        showToast('error', 'يرجى إكمال بيانات المرسل والمستلم قبل إرسال الهدية.');
      }
      return null;
    }

    // تركيب رقم المستلم الدولي بدون +
    const receiverFull = String(rCode).replace(/^\+/, '') + String(rPhone).replace(/\D/g, '');

    return {
      senderName: senderNameVal,
      senderPhone: window.itiPhone
        ? window.itiPhone.getNumber().replace(/^\+/, '')
        : '',
      receiverName: rName,
      receiverPhone: receiverFull
    };
  }

  // -------------------------------------------------------------------
  // 3) إرسال طلب الهدية إلى WebApp عبر /api/gift/request
  // -------------------------------------------------------------------
  async function sendGiftRequestAndFinish() {
    if (!isGiftFlowActive()) {
      return;
    }

    const meta = validateGiftPage();
    if (!meta) return;

    // بناء الـ payload من nForm + حقول الهدية
    const giftMsgEl = document.getElementById('giftMessage');
    const giftMessage = giftMsgEl ? giftMsgEl.value.trim() : '';

    const receiverCode  = document.getElementById('giftReceiverCountry')?.value || '966';
    const receiverPhoneLocal = document.getElementById('giftReceiverMobile')?.value || '';

    const payload = {
      appId:         window.APP_ID,
      isGift:        true,
      flowType:      'gift-only',

      location:      $('#area').val() || '',
      serviceCat:    $('#serviceCat').val() || '',
      service:       $('#service').val() || '',
      serviceCount:  $('#serviceCount').val() || '1',

      senderName:    meta.senderName,
      senderPhone:   meta.senderPhone,
      receiverName:  meta.receiverName,
      receiverPhone: meta.receiverPhone,

      receiverPhoneCountryCode: receiverCode,
      receiverPhoneLocal:       receiverPhoneLocal,

      giftMessage:   giftMessage,

      // نستخدم لغة الفورم الحاليّة
      locale:        window.isEnglishLocale && window.isEnglishLocale() ? 'en' : 'ar',

      // نمرر الخدمات الإضافية والكوبون (لو موجود)
      additionalServices: (window.nForm?.additionalServicesIds || []).join(','),
      couponCode:         window.couponCodeApplied || '',
      couponDiscountAmount: window.couponDiscountAmount || 0,

      clientUrl: window.location.href
    };

    console.log('[gift] sending payload to /api/gift/request', payload);

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
        if (typeof showToast === 'function') {
          showToast('error', msg);
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

      // ✅ نجاح — نعرض صفحة "شكراً لكم" بنفس الشكل، لكن تعتبرها نتيجة هدية
      if (typeof showToast === 'function') {
        showToast('success', 'تم تسجيل طلب الهدية بنجاح، وسيتم التواصل مع المستلم عبر واتساب 🌟');
      }

      // نحدّث ملخص الشكر ببعض المعلومات المفيدة
      const areaText    = $('#area').find(':selected').text()   || '—';
      const serviceText = $('#service').find(':selected').text()|| '—';

      const tsArea    = document.getElementById('ts-area');
      const tsService = document.getElementById('ts-service');
      const tsDt      = document.getElementById('ts-dt');
      const tsPay     = document.getElementById('ts-pay');

      if (tsArea)    tsArea.textContent    = areaText;
      if (tsService) tsService.textContent = serviceText;
      if (tsDt)      tsDt.textContent      = '— (هدية)';    // لا يوجد موعد محدد بعد
      if (tsPay)     tsPay.textContent     = 'كوبون هدية';

      // رابط مشاركة عبر واتساب (مرسل → صديقه مثلاً)
      const waBtn = document.getElementById('ts-whatsapp');
      if (waBtn) {
        const msg =
          `🎁 تم إصدار هدية غسيل سيارة لك!\n` +
          `من: ${meta.senderName}\n` +
          `الخدمة: ${serviceText}\n` +
          `سيصلك رابط الحجز وكوبون الخصم على واتساب قريباً بإذن الله.`;
        waBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      }

      if (waitWrap) waitWrap.classList.remove('show');
      window.isSubmitting = false;

      // ننتقل مباشرة لصفحة "تم" (page7)
      if (typeof showPage === 'function') {
        const idx = window.orderedPages
          ? window.orderedPages.indexOf('page7')
          : 6;
        showPage(idx >= 0 ? idx : 6);
      }
    } catch (err) {
      console.error('[gift] sendGiftRequestAndFinish error:', err);
      if (typeof showToast === 'function') {
        showToast('error', 'حدث خطأ أثناء إرسال طلب الهدية، حاول مرة أخرى.');
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
  // 4) زر "التالي" مخصص لمسار الهدية
  // -------------------------------------------------------------------
  function giftAwareGotoNext() {
    const idx = typeof getActiveIndex === 'function'
      ? getActiveIndex()
      : 0;
    const id = window.orderedPages ? window.orderedPages[idx] : null;

    const giftOn = isGiftFlowActive();

    // لو ليست هدية → نستعمل المسار العادي
    if (!giftOn || !id) {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext();
      }
      return;
    }

    // ----- page1: نفس السلوك العادي -----
    if (id === 'page1') {
      if (typeof window.originalGotoNext === 'function') {
        return window.originalGotoNext();
      }
      return;
    }

    // ----- page2: تحقق من المنطقة/الخدمة ثم انتقل مباشرة إلى page4 -----
    if (id === 'page2') {
      const areaOk = !!$('#area').val();
      const catOk  = !!$('#serviceCat').val();
      const svcOk  = !!$('#service').val();

      document.getElementById('err-area').style.display       = areaOk ? 'none' : 'block';
      document.getElementById('err-serviceCat').style.display = catOk ? 'none' : 'block';
      document.getElementById('err-service').style.display    = svcOk ? 'none' : 'block';

      if (!areaOk || !catOk || !svcOk) {
        if (typeof showToast === 'function') {
          showToast('error', 'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة أولاً.');
        }
        return;
      }

      // نحفظ القيم في nForm (لو احتجناها في الهدية)
      if (window.nForm) {
        window.nForm.location   = $('#area').val()      || '';
        window.nForm.serviceCat = $('#serviceCat').val()|| '';
        window.nForm.service    = $('#service').val()   || '';
      }

      if (typeof renderSummary === 'function') {
        renderSummary('page2');
      }
      if (typeof showPage === 'function') {
        // index 3 → page4
        showPage(3);
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
      return;
    }

    // ----- page4: إرسال طلب الهدية بدلاً من الذهاب للدفع -----
    if (id === 'page4') {
      sendGiftRequestAndFinish();
      return;
    }

    // في أي صفحة أخرى (لو وصل لها المستخدم لأسباب ما) → fallback للسلوك العادي
    if (typeof window.originalGotoNext === 'function') {
      return window.originalGotoNext();
    }
  }

  // -------------------------------------------------------------------
  // 5) زر "السابق" مخصص لمسار الهدية
  // -------------------------------------------------------------------
  function giftAwarePrev() {
    const idx = typeof getActiveIndex === 'function'
      ? getActiveIndex()
      : 0;
    const id = window.orderedPages ? window.orderedPages[idx] : null;

    if (isGiftFlowActive()) {
      // من صفحة بيانات المرسل/المستلم نرجع إلى صفحة الخدمة مباشرة
      if (id === 'page4') {
        if (typeof showPage === 'function') {
          showPage(1); // index 1 → page2
        }
        if (typeof updateNextAvailability === 'function') {
          updateNextAvailability();
        }
        return;
      }
      // من صفحة "تم" لا يظهر زر السابق أصلاً؛ لذا لا حاجة للتعامل معها
    }

    if (typeof window.originalPrevHandler === 'function') {
      return window.originalPrevHandler();
    }
  }

  // -------------------------------------------------------------------
  // 6) ربط الأحداث عند تحميل الصفحة
  // -------------------------------------------------------------------
  $(function () {
    const toggle = document.getElementById('isGiftToggle');
    if (toggle) {
      toggle.addEventListener('change', function () {
        const on = !!this.checked;
        syncGiftToggleUI(on);
      });
    }

    // مزامنة مبدئية لو تم تفعيل الهدية من السيرفر أو URL
    if (toggle && toggle.checked) {
      syncGiftToggleUI(true);
    }

    // إعادة ربط زر "التالي" ليستخدم مسار الهدية عند الحاجة
    const nextBtn = document.getElementById('footer-next');
    if (nextBtn) {
      const orig = window.originalGotoNext;
      if (typeof orig === 'function') {
        nextBtn.removeEventListener('click', orig);
      }
      nextBtn.addEventListener('click', giftAwareGotoNext);
    }

    // إعادة ربط زر "السابق" ليكون واعي لوضع الهدية
    const prevBtn = document.getElementById('footer-prev');
    if (prevBtn) {
      const origPrev = window.originalPrevHandler;
      if (typeof origPrev === 'function') {
        prevBtn.removeEventListener('click', origPrev);
      }
      prevBtn.addEventListener('click', giftAwarePrev);
    }

    // تحديث تفعيل زر التالي بناءً على إدخال بيانات المستلم
    ['giftReceiverName', 'giftReceiverMobile', 'giftMessage', 'name', 'mobile']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', () => {
            if (typeof updateNextAvailability === 'function') {
              updateNextAvailability();
            }
          });
        }
      });
  });

  // -------------------------------------------------------------------
  // 7) جعل updateNextAvailability يعرف وضع الهدية (مساعدة فقط)
  // -------------------------------------------------------------------
  const originalUpdateNext = window.updateNextAvailability;
  if (typeof originalUpdateNext === 'function') {
    window.updateNextAvailability = function () {
      originalUpdateNext();

      const nextBtn = document.getElementById('footer-next');
      if (!nextBtn || !isGiftFlowActive()) return;

      const idx = typeof getActiveIndex === 'function'
        ? getActiveIndex()
        : 0;
      const id = window.orderedPages ? window.orderedPages[idx] : null;

      // في page2: نكتفي بالمنطقة + الخدمة (نفس المنطق الموجود أصلاً)
      if (id === 'page2') {
        const areaOk = !!$('#area').val();
        const svcOk  = !!$('#service').val();
        const enable = areaOk && svcOk;
        nextBtn.disabled = !enable;
        nextBtn.classList.toggle('disabled', !enable);
      }

      // في page4 (وضع الهدية): نعيد التقييم حسب validateGiftPage ولكن بشكل مبسط
      if (id === 'page4') {
        const senderNameOk = ($('#name').val() || '').trim().length > 0;
        const phoneOk      = (window.itiPhone ? window.itiPhone.isValidNumber() : false);
        const rNameOk      = ($('#giftReceiverName').val() || '').trim().length > 0;
        const rPhoneRaw    = ($('#giftReceiverMobile').val() || '').trim();
        const rPhoneOk     = rPhoneRaw.length >= 7;
        const otpOk        = (!window.OTP_ENABLED) || window.otpVerified;

        const enable = senderNameOk && phoneOk && rNameOk && rPhoneOk && otpOk;
        nextBtn.disabled = !enable;
        nextBtn.classList.toggle('disabled', !enable);
      }
    };
  }

})();

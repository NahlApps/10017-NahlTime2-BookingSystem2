/* ========================================================================== */
/*  GIFT FEATURE - NahlTime                                                   */
/*  - Toggle "gift" on page 2                                                 */
/*  - Validate receiver info on page 4                                        */
/*  - Submit gift request instead of normal booking                           */
/* ========================================================================== */

/* يعتمد على:
   - APP_ID
   - API_BASE
   - buildPayload()
   - getOrderSubtotal()
   - couponDiscountAmount
   - showPage()
   - showToast()
   - isEnglishLocale()
*/

const GIFT_API_URL = `${API_BASE}/api/gift`;

// 🎁 حالة الهدية (global)
window.giftState = {
  isGift: false,
  sender: {},
  receiver: {},
  message: ''
};

/* ========================================================================== */
/*  1) INIT GIFT UI                                                           */
/* ========================================================================== */

window.initGiftFeature = function () {
  const toggle       = document.getElementById('isGiftToggle');
  const receiverCard = document.getElementById('giftReceiverCard');

  if (toggle) {
    toggle.addEventListener('change', () => {
      giftState.isGift = !!toggle.checked;

      if (receiverCard) {
        receiverCard.style.display = giftState.isGift ? 'block' : 'none';
      }

      if (window.nForm) {
        nForm.isGift = giftState.isGift;
      }

      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });
  }

  if (receiverCard) {
    receiverCard.style.display = 'none';
  }
};

/* ========================================================================== */
/*  2) HOOKS للسير في الواجهات (يتم استدعاؤها من app.js)                     */
/* ========================================================================== */

/**
 * يُستدعى بعد التأكد من صحة المنطقة/التصنيف/الخدمة في page2.
 * لو كانت حجز كهدية → تخطي صفحة الوقت والانتقال مباشرة لصفحة بيانات الاتصال (page4).
 */
window.giftAfterPage2Validated = function () {
  if (!window.giftState || !giftState.isGift) return false;

  // orderedPages = ["page1","page2","page3","page4","page5","page6","page7"]
  // index 3 => "page4"
  showPage(3);
  return true;
};

/**
 * يُستدعى داخل تحقق page4 بعد التحقق من المرسل.
 * هنا نتحقق من بيانات المستلم + رسالة الهدية (اختيارية).
 */
window.giftValidatePage4 = function () {
  if (!window.giftState || !giftState.isGift) return true;

  const nameEl   = document.getElementById('receiverName');
  const phoneEl  = document.getElementById('receiverMobile');
  const msgEl    = document.getElementById('giftMessage');

  const errName  = document.getElementById('err-receiverName');
  const errPhone = document.getElementById('err-receiverMobile');

  const name  = (nameEl?.value || '').trim();
  const phone = (phoneEl?.value || '').trim();
  const msg   = (msgEl?.value || '').trim();

  let ok = true;

  if (!name) {
    if (errName) errName.style.display = 'block';
    ok = false;
  } else if (errName) {
    errName.style.display = 'none';
  }

  if (!phone || !/^\d{8,15}$/.test(phone)) {
    if (errPhone) errPhone.style.display = 'block';
    ok = false;
  } else if (errPhone) {
    errPhone.style.display = 'none';
  }

  if (!ok) {
    if (typeof showToast === 'function') {
      showToast(
        'error',
        isEnglishLocale()
          ? 'Please fill receiver name and mobile correctly.'
          : 'يرجى تعبئة اسم وجوال المستلم بشكل صحيح.'
      );
    }
    return false;
  }

  giftState.receiver = { name, mobile: phone };
  giftState.message  = msg;

  return true;
};

/**
 * يُستدعى بعد اختيار طريقة الدفع في page5.
 * لو كانت كهدية → لا نذهب إلى صفحة الخريطة، بل نرسل طلب الهدية مباشرة.
 */
window.giftAfterPage5Validated = async function () {
  if (!window.giftState || !giftState.isGift) return false;

  const nextBtn = document.getElementById('footer-next');
  const prevBtn = document.getElementById('footer-prev');
  const waitEl  = document.getElementById('footer-wait');

  if (window.isSubmitting) return true;
  window.isSubmitting = true;

  if (nextBtn) nextBtn.style.display = 'none';
  if (prevBtn) prevBtn.style.display = 'none';
  if (waitEl)  waitEl.classList.add('show');

  try {
    const subtotal = getOrderSubtotal();
    const discount = Math.min(
      subtotal,
      Number(window.couponDiscountAmount || 0)
    );
    const finalTotal = Math.max(0, subtotal - discount);

    const basePayload = buildPayload();

    const senderPhone =
      window.itiPhone && typeof itiPhone.getNumber === 'function'
        ? itiPhone.getNumber().replace(/^\+/, '')
        : (basePayload.customerM || '');

    giftState.sender = {
      name: basePayload.customerN || '',
      mobile: senderPhone
    };

    const giftPayload = {
      action: 'createGift',
      appId: APP_ID,
      isGift: true,
      giftSender:   giftState.sender,
      giftReceiver: giftState.receiver,
      giftMessage:  giftState.message,
      subtotal,
      discountAmount: discount,
      finalTotal,
      bookingFormUrl: window.location.href,
      // copy booking-related data (بدون وقت)
      ...basePayload
    };

    console.log('[gift] Sending gift payload', {
      url: GIFT_API_URL,
      giftPayload
    });

    const res  = await fetch(GIFT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftPayload)
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('[gift] Response is not valid JSON:', text);
      data = { success: false, error: 'Invalid JSON', raw: text };
    }

    console.log('[gift] Gift API response:', {
      status: res.status,
      ok: res.ok,
      data
    });

    if (!res.ok || data.success === false || data.ok === false) {
      const msg =
        data && (data.error || data.message)
          ? data.error || data.message
          : (isEnglishLocale()
              ? 'Could not submit the gift request.'
              : 'تعذر إرسال طلب الهدية حالياً.');
      if (typeof showToast === 'function') {
        showToast('error', msg);
      }
      return true;
    }

    if (typeof showToast === 'function') {
      showToast(
        'success',
        isEnglishLocale()
          ? 'Gift request submitted successfully 🎁'
          : 'تم إرسال طلب الهدية بنجاح 🎁'
      );
    }

    const giftId = data.giftId || data.id || null;
    console.log('[gift] Created giftId:', giftId);

    // 🧾 تعبئة ملخص الشكر مثل الحجز العادي (بدون وقت)
    const areaText    = $('#area').find(':selected').text() || '—';
    const serviceText = $('#service').find(':selected').text() || '—';

    const tsArea   = document.getElementById('ts-area');
    const tsServ   = document.getElementById('ts-service');
    const tsDt     = document.getElementById('ts-dt');
    const tsPay    = document.getElementById('ts-pay');
    const tsWhats  = document.getElementById('ts-whatsapp');

    if (tsArea) tsArea.textContent = areaText;
    if (tsServ) tsServ.textContent = serviceText;
    if (tsDt) {
      tsDt.textContent = isEnglishLocale()
        ? 'The receiver will choose the date later.'
        : 'سيقوم المستلم بتحديد الموعد لاحقاً.';
    }
    if (tsPay) {
      tsPay.textContent =
        (window.nForm?.paymentMethod || '').toUpperCase() || '—';
    }

    if (tsWhats) {
      const msg = isEnglishLocale()
        ? `I just sent you a car wash gift on NahlTime.\nService: ${serviceText}\nGift ID (optional): ${giftId || ''}`
        : `أرسلت لك هدية غسيل عبر NahlTime.\nالخدمة: ${serviceText}\nرقم الهدية (اختياري): ${giftId || ''}`;
      const waMsg = encodeURIComponent(msg);
      tsWhats.href = `https://wa.me/?text=${waMsg}`;
    }

    if (waitEl)  waitEl.classList.remove('show');
    window.isSubmitting = false;

    // ✅ صفحة الشكر (index 6 = page7)
    showPage(6);

    return true;
  } catch (err) {
    console.error('[gift] Error while sending gift:', err);
    if (typeof showToast === 'function') {
      showToast(
        'error',
        isEnglishLocale()
          ? 'Unexpected error while sending gift.'
          : 'حدث خطأ غير متوقع أثناء إرسال الهدية.'
      );
    }
    return true;
  } finally {
    const nextBtn2 = document.getElementById('footer-next');
    const prevBtn2 = document.getElementById('footer-prev');
    const waitEl2  = document.getElementById('footer-wait');

    if (waitEl2)  waitEl2.classList.remove('show');
    if (nextBtn2) nextBtn2.style.display = '';
    if (prevBtn2) prevBtn2.style.display = '';
    window.isSubmitting = false;
  }
};

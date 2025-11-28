// /js/trust-verification.js
// 🔐 OTP verification + 📃 Terms & Conditions helpers
// Depends on globals from:
//  - config-core.js  (OTP_* constants, APP_ID, showToast)
//  - booking-core.js (nForm, otp* state, updateNextAvailability, isEnglishLocale, itiPhone, termsAccepted)

/* 📃 Terms & Conditions Helpers */

function openTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('offers-open');
}

function closeTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('offers-open');
}

function wireTermsModal() {
  const modal = document.getElementById('termsModal');
  if (!modal) return;

  // Click backdrop or X button
  modal.addEventListener('click', (e) => {
    if (
      e.target.classList.contains('offers-backdrop') ||
      e.target.dataset.termsDismiss === '1'
    ) {
      closeTermsModal();
    }
  });

  const btnAccept = document.getElementById('btnAcceptTerms');
  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      termsAccepted = true;
      closeTermsModal();
      if (typeof showToast === 'function') {
        const msg = isEnglishLocale()
          ? 'Terms accepted, you can complete your booking ✅'
          : 'تمت الموافقة على الشروط، يمكنك إكمال الحجز ✅';
        showToast('success', msg);
      }
      // المستخدم سيضغط "التالي" مرة أخرى بعد الموافقة
    });
  }

  // Close on ESC when open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.classList.contains('show')) {
        closeTermsModal();
      }
    }
  });
}

/* 🔐 OTP Helpers */

function resetOtpState(fullReset) {
  if (!OTP_ENABLED) return;

  otpRequested   = false;
  otpVerified    = false;
  otpLastSentAt  = null;

  if (otpCountdownTimer) {
    clearInterval(otpCountdownTimer);
    otpCountdownTimer = null;
  }

  const statusEl  = document.getElementById('otpStatus');
  const errEl     = document.getElementById('err-otp');
  const codeEl    = document.getElementById('otpCode');
  const verifyRow = document.getElementById('otpVerifyRow');
  const sendBtn   = document.getElementById('btnSendOtp');

  if (statusEl) {
    statusEl.className   = 'small text-muted';
    statusEl.textContent = isEnglishLocale()
      ? 'A 4-digit code will be sent via WhatsApp to verify your number.'
      : 'سيتم إرسال كود من 4 أرقام للتحقق من رقمك عبر واتساب.';
  }
  if (errEl) {
    errEl.style.display = 'none';
  }
  if (codeEl) {
    codeEl.removeAttribute('readonly');
    if (fullReset) codeEl.value = '';
  }
  if (verifyRow) {
    verifyRow.style.display = 'none';
  }
  if (sendBtn) {
    sendBtn.disabled  = false;
    sendBtn.textContent = isEnglishLocale()
      ? 'Send code via WhatsApp'
      : 'إرسال كود على واتساب';
  }
}

function startOtpCountdown() {
  const sendBtn  = document.getElementById('btnSendOtp');
  const statusEl = document.getElementById('otpStatus');
  if (!sendBtn || !statusEl) return;

  otpRequested  = true;
  otpVerified   = false;
  otpLastSentAt = Date.now();
  let remaining = OTP_RESEND_SECONDS;

  const baseMsgAr = 'تم إرسال الكود، يمكنك إعادة الإرسال بعد ';
  const baseMsgEn = 'Code sent, you can resend after ';

  statusEl.className   = 'small text-muted';
  statusEl.textContent = (isEnglishLocale()
    ? `${baseMsgEn}${remaining} seconds.`
    : `${baseMsgAr}${remaining} ثانية.`);

  sendBtn.disabled  = true;
  sendBtn.textContent = isEnglishLocale()
    ? `Resend (${remaining})`
    : `إعادة الإرسال (${remaining})`;

  if (otpCountdownTimer) {
    clearInterval(otpCountdownTimer);
  }

  otpCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
      sendBtn.disabled  = false;
      sendBtn.textContent = isEnglishLocale()
        ? 'Resend code'
        : 'إعادة إرسال الكود';

      statusEl.textContent = isEnglishLocale()
        ? 'If you did not receive the code within a minute, press "Resend code".'
        : 'إذا لم يصلك الكود خلال دقيقة، اضغط "إعادة إرسال الكود".';
    } else {
      sendBtn.textContent = isEnglishLocale()
        ? `Resend (${remaining})`
        : `إعادة الإرسال (${remaining})`;

      statusEl.textContent = isEnglishLocale()
        ? `${baseMsgEn}${remaining} seconds.`
        : `${baseMsgAr}${remaining} ثانية.`;
    }
  }, 1000);
}

async function requestOtpForMobile() {
  if (!OTP_ENABLED) return;

  const sendBtn  = document.getElementById('btnSendOtp');
  const statusEl = document.getElementById('otpStatus');
  const errEl    = document.getElementById('err-otp');
  const errMobile = document.getElementById('err-mobile');

  if (errEl) errEl.style.display = 'none';
  if (errMobile) errMobile.style.display = 'none';

  if (!itiPhone || !itiPhone.isValidNumber()) {
    if (errMobile) errMobile.style.display = 'block';
    showToast('error', isEnglishLocale()
      ? 'Please enter a valid mobile number before requesting the code.'
      : 'من فضلك أدخل رقم جوال صحيح قبل طلب الكود');
    return;
  }

  const mobile = itiPhone.getNumber().replace(/^\+/, '');

  try {
    if (sendBtn) {
      sendBtn.disabled  = true;
      sendBtn.textContent = isEnglishLocale()
        ? 'Sending…'
        : 'جاري الإرسال…';
    }
    if (statusEl) {
      statusEl.className   = 'small text-muted';
      statusEl.textContent = isEnglishLocale()
        ? 'Sending verification code to WhatsApp…'
        : 'جاري إرسال كود التحقق إلى واتساب…';
    }

    const res = await fetch(OTP_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: APP_ID, mobileNumber: mobile })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.success === false) {
      const msg = data && data.message
        ? data.message
        : (isEnglishLocale()
          ? 'Could not send verification code, please try again.'
          : 'تعذر إرسال كود التحقق الآن، حاول مرة أخرى.');

      showToast('error', msg);

      if (statusEl) {
        statusEl.className   = 'small text-danger';
        statusEl.textContent = msg;
      }
      if (sendBtn) {
        sendBtn.disabled  = false;
        sendBtn.textContent = isEnglishLocale()
          ? 'Send code via WhatsApp'
          : 'إرسال كود على واتساب';
      }
      return;
    }

    const verifyRow = document.getElementById('otpVerifyRow');
    if (verifyRow) {
      verifyRow.style.display = 'flex';
    }
    if (statusEl) {
      statusEl.className   = 'small text-success';
      statusEl.textContent = isEnglishLocale()
        ? 'Code sent to WhatsApp. Please enter the 4-digit code to verify your number.'
        : 'تم إرسال الكود إلى واتساب، من فضلك أدخل الكود المكون من 4 أرقام للتحقق من رقمك.';
    }

    showToast('success', isEnglishLocale()
      ? 'Verification code sent to WhatsApp.'
      : 'تم إرسال كود التحقق إلى واتساب');

    startOtpCountdown();
  } catch (err) {
    console.error('requestOtpForMobile error:', err);
    if (statusEl) {
      statusEl.className   = 'small text-danger';
      statusEl.textContent = isEnglishLocale()
        ? 'Error while sending code, please try again.'
        : 'حدث خطأ أثناء إرسال الكود، حاول مرة أخرى.';
    }
    if (sendBtn) {
      sendBtn.disabled  = false;
      sendBtn.textContent = isEnglishLocale()
        ? 'Send code via WhatsApp'
        : 'إرسال كود على واتساب';
    }
    showToast('error', isEnglishLocale()
      ? 'Could not send verification code.'
      : 'تعذر إرسال كود التحقق الآن');
  }
}

async function verifyOtpCode() {
  if (!OTP_ENABLED) return;

  const codeInput = document.getElementById('otpCode');
  const statusEl  = document.getElementById('otpStatus');
  const errEl     = document.getElementById('err-otp');
  const btn       = document.getElementById('btnVerifyOtp');
  const errMobile = document.getElementById('err-mobile');

  if (!codeInput || !btn) return;

  const raw = (codeInput.value || '').trim();
  const codeRegex = new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`);

  if (!codeRegex.test(raw)) {
    if (errEl) {
      errEl.textContent   = isEnglishLocale()
        ? `Please enter a ${OTP_CODE_LENGTH}-digit code.`
        : `رجاءً أدخل كود مكون من ${OTP_CODE_LENGTH} أرقام`;
      errEl.style.display = 'block';
    }
    showToast('error', isEnglishLocale()
      ? `Verification code must be ${OTP_CODE_LENGTH} digits.`
      : `كود التحقق يجب أن يكون ${OTP_CODE_LENGTH} أرقام`);
    return;
  }

  if (!itiPhone || !itiPhone.isValidNumber()) {
    if (errMobile) errMobile.style.display = 'block';
    showToast('error', isEnglishLocale()
      ? 'Please check your mobile number first.'
      : 'من فضلك تأكد من صحة رقم الجوال أولاً');
    return;
  }

  const mobile = itiPhone.getNumber().replace(/^\+/, '');

  try {
    btn.disabled  = true;
    btn.textContent = isEnglishLocale()
      ? 'Verifying…'
      : 'جاري التحقق…';

    if (errEl) errEl.style.display = 'none';
    if (statusEl) {
      statusEl.className   = 'small text-muted';
      statusEl.textContent = isEnglishLocale()
        ? 'Verifying code…'
        : 'جاري التحقق من كود التحقق…';
    }

    const res = await fetch(OTP_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: APP_ID,
        mobileNumber: mobile,
        otp: raw
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.success === false) {
      const msg = data && data.message
        ? data.message
        : (isEnglishLocale()
          ? 'The verification code is invalid or expired.'
          : 'كود التحقق غير صحيح أو منتهي.');

      if (errEl) {
        errEl.textContent   = msg;
        errEl.style.display = 'block';
      }
      if (statusEl) {
        statusEl.className   = 'small text-danger';
        statusEl.textContent = msg;
      }
      showToast('error', msg);
      otpVerified = false;
      updateNextAvailability();
      return;
    }

    otpVerified = true;

    if (statusEl) {
      statusEl.className   = 'small text-success';
      statusEl.textContent = isEnglishLocale()
        ? 'Mobile number verified ✅ you can continue.'
        : 'تم التحقق من رقم الجوال بنجاح ✅ يمكنك المتابعة لإكمال الحجز.';
    }
    if (errEl) errEl.style.display = 'none';

    if (codeInput) {
      codeInput.setAttribute('readonly', 'readonly');
    }
    const sendBtn = document.getElementById('btnSendOtp');
    if (sendBtn) {
      sendBtn.disabled  = true;
      sendBtn.textContent = isEnglishLocale()
        ? 'Verified'
        : 'تم التحقق';
    }
    if (otpCountdownTimer) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
    }

    showToast('success', isEnglishLocale()
      ? 'Your mobile number is verified.'
      : 'تم التحقق من رقم جوالك');

    updateNextAvailability();
  } catch (err) {
    console.error('verifyOtpCode error:', err);
    if (statusEl) {
      statusEl.className   = 'small text-danger';
      statusEl.textContent = isEnglishLocale()
        ? 'Could not verify the code, please try again.'
        : 'تعذر التحقق من الكود الآن، حاول مرة أخرى.';
    }
    showToast('error', isEnglishLocale()
      ? 'Error while verifying the code.'
      : 'حدث خطأ أثناء التحقق من الكود');
  } finally {
    if (btn && !otpVerified) {
      btn.disabled  = false;
      btn.textContent = isEnglishLocale()
        ? 'Confirm'
        : 'تأكيد';
    }
  }
}

/* 🔌 Auto-wire OTP + Terms on DOM ready */

document.addEventListener('DOMContentLoaded', () => {
  // Terms modal
  wireTermsModal();

  // OTP controls
  const otpControls = document.getElementById('otpControls');
  const verifyRow   = document.getElementById('otpVerifyRow');
  const errOtp      = document.getElementById('err-otp');

  if (OTP_ENABLED) {
    if (otpControls) otpControls.style.display = 'flex';
    if (verifyRow)   verifyRow.style.display   = 'none';
    if (errOtp)      errOtp.style.display      = 'none';

    const btnSendOtp   = document.getElementById('btnSendOtp');
    const btnVerifyOtp = document.getElementById('btnVerifyOtp');

    if (btnSendOtp)   btnSendOtp.addEventListener('click', requestOtpForMobile);
    if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', verifyOtpCode);

    resetOtpState(true);
  } else {
    if (otpControls) otpControls.style.display = 'none';
    if (verifyRow)   verifyRow.style.display   = 'none';
    if (errOtp)      errOtp.style.display      = 'none';
  }

  updateNextAvailability();
});

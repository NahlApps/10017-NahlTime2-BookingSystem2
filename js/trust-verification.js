// /js/trust-verification.js
// 🔐 OTP verification + 📃 Terms & Conditions state & helpers

/* 🔐 OTP API endpoints (via proxy → Code.gs → Green API) */
const OTP_REQUEST_URL         = `${API_BASE}/api/otp/request`;
const OTP_VERIFY_URL          = `${API_BASE}/api/otp/verify`;

/* 🔄 Toggle OTP feature ON/OFF from here (no backend change required) */
const OTP_ENABLED             = true;   // 🟢 true = require OTP verify, 🔴 false = skip OTP
const OTP_CODE_LENGTH         = 4;
const OTP_RESEND_SECONDS      = 60;

/* 🔐 OTP state */
let otpRequested = false;
let otpVerified  = false;
let otpLastSentAt = null;
let otpCountdownTimer = null;

/* 📃 Terms & Conditions state */
let termsAccepted = false;

/* 🔐 OTP Helpers */

function resetOtpState(fullReset){
  if(!OTP_ENABLED) return;
  otpRequested = false;
  otpVerified  = false;
  otpLastSentAt = null;
  if(otpCountdownTimer){
    clearInterval(otpCountdownTimer);
    otpCountdownTimer = null;
  }
  const statusEl = document.getElementById('otpStatus');
  const errEl    = document.getElementById('err-otp');
  const codeEl   = document.getElementById('otpCode');
  const verifyRow= document.getElementById('otpVerifyRow');
  const sendBtn  = document.getElementById('btnSendOtp');

  if(statusEl){
    statusEl.className = 'small text-muted';
    statusEl.textContent = 'سيتم إرسال كود من 4 أرقام للتحقق من رقمك عبر واتساب.';
  }
  if(errEl){
    errEl.style.display = 'none';
  }
  if(codeEl){
    codeEl.removeAttribute('readonly');
    if(fullReset) codeEl.value = '';
  }
  if(verifyRow){
    verifyRow.style.display = 'none';
  }
  if(sendBtn){
    sendBtn.disabled = false;
    sendBtn.textContent = 'إرسال كود على واتساب';
  }
}

function startOtpCountdown(){
  const sendBtn  = document.getElementById('btnSendOtp');
  const statusEl = document.getElementById('otpStatus');
  if(!sendBtn || !statusEl) return;

  otpRequested   = true;
  otpVerified    = false;
  otpLastSentAt  = Date.now();
  let remaining  = OTP_RESEND_SECONDS;

  statusEl.className = 'small text-muted';
  statusEl.textContent = `تم إرسال الكود، يمكنك إعادة الإرسال بعد ${remaining} ثانية.`;
  sendBtn.disabled = true;
  sendBtn.textContent = `إعادة الإرسال (${remaining})`;

  if(otpCountdownTimer){
    clearInterval(otpCountdownTimer);
  }
  otpCountdownTimer = setInterval(()=>{
    remaining--;
    if(remaining <= 0){
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
      sendBtn.disabled = false;
      sendBtn.textContent = 'إعادة إرسال الكود';
      statusEl.textContent = 'إذا لم يصلك الكود خلال دقيقة، اضغط "إعادة إرسال الكود".';
    }else{
      sendBtn.textContent = `إعادة الإرسال (${remaining})`;
      statusEl.textContent = `تم إرسال الكود، يمكنك إعادة الإرسال بعد ${remaining} ثانية.`;
    }
  }, 1000);
}

async function requestOtpForMobile(){
  if(!OTP_ENABLED) return;
  const sendBtn  = document.getElementById('btnSendOtp');
  const statusEl = document.getElementById('otpStatus');
  const errEl    = document.getElementById('err-otp');

  if(errEl) errEl.style.display = 'none';

  if(!itiPhone || !itiPhone.isValidNumber()){
    document.getElementById('err-mobile').style.display = 'block';
    showToast('error','من فضلك أدخل رقم جوال صحيح قبل طلب الكود');
    return;
  }

  const mobile = itiPhone.getNumber().replace(/^\+/, '');

  try{
    if(sendBtn){
      sendBtn.disabled = true;
      sendBtn.textContent = 'جاري الإرسال…';
    }
    if(statusEl){
      statusEl.className = 'small text-muted';
      statusEl.textContent = 'جاري إرسال كود التحقق إلى واتساب…';
    }

    const res = await fetch(OTP_REQUEST_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ appId: APP_ID, mobileNumber: mobile })
    });

    const data = await res.json().catch(()=>null);

    if(!res.ok || !data || data.success === false){
      const msg = data && data.message ? data.message : 'تعذر إرسال كود التحقق الآن، حاول مرة أخرى.';
      showToast('error', msg);
      if(statusEl){
        statusEl.className = 'small text-danger';
        statusEl.textContent = msg;
      }
      if(sendBtn){
        sendBtn.disabled = false;
        sendBtn.textContent = 'إرسال كود على واتساب';
      }
      return;
    }

    const verifyRow = document.getElementById('otpVerifyRow');
    if(verifyRow){
      verifyRow.style.display = 'flex';
    }
    if(statusEl){
      statusEl.className = 'small text-success';
      statusEl.textContent = 'تم إرسال الكود إلى واتساب، من فضلك أدخل الكود المكون من 4 أرقام للتحقق من رقمك.';
    }

    showToast('success','تم إرسال كود التحقق إلى واتساب');
    startOtpCountdown();
  }catch(err){
    console.error('requestOtpForMobile error:', err);
    if(statusEl){
      statusEl.className = 'small text-danger';
      statusEl.textContent = 'حدث خطأ أثناء إرسال الكود، حاول مرة أخرى.';
    }
    if(sendBtn){
      sendBtn.disabled = false;
      sendBtn.textContent = 'إرسال كود على واتساب';
    }
    showToast('error','تعذر إرسال كود التحقق الآن');
  }
}

async function verifyOtpCode(){
  if(!OTP_ENABLED) return;
  const codeInput = document.getElementById('otpCode');
  const statusEl  = document.getElementById('otpStatus');
  const errEl     = document.getElementById('err-otp');
  const btn       = document.getElementById('btnVerifyOtp');
  if(!codeInput || !btn) return;

  const raw = (codeInput.value || '').trim();
  if(!new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(raw)){
    if(errEl){
      errEl.textContent = `رجاءً أدخل كود مكون من ${OTP_CODE_LENGTH} أرقام`;
      errEl.style.display = 'block';
    }
    showToast('error',`كود التحقق يجب أن يكون ${OTP_CODE_LENGTH} أرقام`);
    return;
  }

  if(!itiPhone || !itiPhone.isValidNumber()){
    document.getElementById('err-mobile').style.display='block';
    showToast('error','من فضلك تأكد من صحة رقم الجوال أولاً');
    return;
  }

  const mobile = itiPhone.getNumber().replace(/^\+/, '');

  try{
    btn.disabled = true;
    btn.textContent = 'جاري التحقق…';
    if(errEl) errEl.style.display = 'none';
    if(statusEl){
      statusEl.className = 'small text-muted';
      statusEl.textContent = 'جاري التحقق من كود التحقق…';
    }

    const res = await fetch(OTP_VERIFY_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ appId: APP_ID, mobileNumber: mobile, otp: raw })
    });

    const data = await res.json().catch(()=>null);

    if(!res.ok || !data || data.success === false){
      const msg = data && data.message ? data.message : 'كود التحقق غير صحيح أو منتهي.';
      if(errEl){
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      if(statusEl){
        statusEl.className = 'small text-danger';
        statusEl.textContent = msg;
      }
      showToast('error', msg);
      otpVerified = false;
      updateNextAvailability();
      return;
    }

    otpVerified = true;
    if(statusEl){
      statusEl.className = 'small text-success';
      statusEl.textContent = 'تم التحقق من رقم الجوال بنجاح ✅ يمكنك المتابعة لإكمال الحجز.';
    }
    if(errEl) errEl.style.display = 'none';
    if(codeInput){
      codeInput.setAttribute('readonly','readonly');
    }
    const sendBtn = document.getElementById('btnSendOtp');
    if(sendBtn){
      sendBtn.disabled = true;
      sendBtn.textContent = 'تم التحقق';
    }
    if(otpCountdownTimer){
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
    }
    showToast('success','تم التحقق من رقم جوالك');
    updateNextAvailability();
  }catch(err){
    console.error('verifyOtpCode error:', err);
    if(statusEl){
      statusEl.className = 'small text-danger';
      statusEl.textContent = 'تعذر التحقق من الكود الآن، حاول مرة أخرى.';
    }
    showToast('error','حدث خطأ أثناء التحقق من الكود');
  }finally{
    if(btn && !otpVerified){
      btn.disabled=false;
      btn.textContent='تأكيد';
    }
  }
}

/* 📃 Terms & Conditions Helpers */

function openTermsModal(){
  const modal = document.getElementById('termsModal');
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('offers-open');
}

function closeTermsModal(){
  const modal = document.getElementById('termsModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('offers-open');
}

function wireTermsModal(){
  const modal = document.getElementById('termsModal');
  if (!modal) return;

  modal.addEventListener('click', (e) => {
    if (
      e.target.classList.contains('offers-backdrop') ||
      e.target.dataset.termsDismiss === '1'
    ) {
      closeTermsModal();
    }
  });

  const btnAccept = document.getElementById('btnAcceptTerms');
  if (btnAccept){
    btnAccept.addEventListener('click', () => {
      termsAccepted = true;
      closeTermsModal();
      if (typeof showToast === 'function'){
        showToast('success', 'تمت الموافقة على الشروط، يمكنك إكمال الحجز ✅');
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

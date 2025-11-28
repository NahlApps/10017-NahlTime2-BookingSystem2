// /js/review-postbooking.js
// ⭐⭐ Review feature: constants + bookingId generator + scheduling helper

/* ⭐⭐ REVIEW FEATURE: constants (review link + delay + API endpoint) */
const REVIEW_FORM_BASE_URL    = 'https://nahltimereview.nahl.app/?bookingid='; // ⭐ REVIEW: base URL of review form
const REVIEW_DELAY_MINUTES    = 30; // ⭐ REVIEW: change this value to control delay (in minutes)
const REVIEW_SCHEDULE_API_URL = `${API_BASE}/api/review`; // ⭐ REVIEW: proxy endpoint to Apps Script

/* ⭐⭐ REVIEW FEATURE: BookingId generator (reviews-only) */
function generateReviewBookingId(){
  const now = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  const datePart = now.getFullYear().toString()
    + pad(now.getMonth()+1)
    + pad(now.getDate())
    + pad(now.getHours())
    + pad(now.getMinutes())
    + pad(now.getSeconds());
  const rand = Math.floor(Math.random()*1000000).toString().padStart(6,'0');
  return `R-${datePart}-${rand}`;
}

/* ⭐⭐ REVIEW FEATURE: helper to schedule sending review form via WhatsApp after booking */
async function scheduleReviewForBooking(bookingIdFromReservation){
  try{
    const reviewBookingId = bookingIdFromReservation || generateReviewBookingId();

    const phoneDigits =
      (itiPhone && typeof itiPhone.getNumber === 'function')
        ? itiPhone.getNumber().replace(/^\+/, '')
        : '';

    if(!phoneDigits){
      console.warn('[review] No customer mobile, skipping review schedule.');
      return;
    }

    const payload = {
      action:        'scheduleReview',
      appId:         APP_ID,
      bookingId:     reviewBookingId,         // 🔹 BookingId خاص بالتقييم (أو القادم من الحجز)
      customerPhone: phoneDigits,            // للـ proxy /api/review.js
      mobile:        phoneDigits,            // لو استُخدم الاتصال مباشرة مع GAS
      delayMinutes:  REVIEW_DELAY_MINUTES,
      locale:        isEnglishLocale() ? 'en' : 'ar'
    };

    console.log('[review] Scheduling review message…', {
      url: REVIEW_SCHEDULE_API_URL,
      payload
    });

    const res = await fetch(REVIEW_SCHEDULE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try{
      data = JSON.parse(text);
    }catch(parseErr){
      console.warn('[review] Response is not valid JSON:', text);
      data = { ok:false, error:'Invalid JSON', raw:text };
    }

    console.log('[review] Review API response:', {
      status: res.status,
      ok: res.ok,
      data
    });

    if(!res.ok || data.ok === false || data.success === false){
      console.warn('[review] scheduleReview API indicates failure', data);
      if(typeof showToast === 'function'){
        showToast('error', isEnglishLocale()
          ? 'Could not queue review message.'
          : 'تعذر جدولة رسالة التقييم حالياً.');
      }
      return;
    }

    if(typeof showToast === 'function'){
      showToast('success', isEnglishLocale()
        ? 'Review message queued successfully.'
        : 'تم جدولة رسالة التقييم بنجاح ✅');
    }

  }catch(err){
    console.error('[review] scheduleReviewForBooking error:', err);
    if(typeof showToast === 'function'){
      showToast('error', isEnglishLocale()
        ? 'Error while scheduling review message.'
        : 'حدث خطأ أثناء جدولة رسالة التقييم.');
    }
  }
}

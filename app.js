  <!-- libs -->
  <script src="https://code.jquery.com/jquery-3.6.3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/intl-tel-input@24.4.0/build/js/intlTelInputWithUtils.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

  <script>
    const APP_ID = '21eddbf5-efe5-4a5d-9134-b581717b17ff';

    const defaultLink2 = `https://b0sk44sswgc4kcswoo8sk0og.nahls.app/api/app/AM/general/${APP_ID}/form`;
    const RESERVE_URL_PRIMARY  = `${defaultLink2}/reserveAppointment`;
    const RESERVE_URL_FALLBACK = `${defaultLink2.replace(/\/form\/?$/,'')}/reserveAppointment`;

    const API_BASE = window.location.origin.replace(/\/$/, '');
    const ADDITIONAL_SERVICES_URL = `${API_BASE}/api/additional-services`;
    const COUPONS_API_URL         = `${API_BASE}/api/coupons/validate`;
    const AREA_BOUNDS_URL         = `${API_BASE}/api/area-bounds`;
    const PAYMENT_METHODS_URL     = `${API_BASE}/api/payment-methods`;
    const OFFERS_API_URL          = `${API_BASE}/api/offers`;
    // Skip local /api route & go directly to Apps Script backend

    /* ⭐⭐ REVIEW FEATURE: constants (review link + delay + API endpoint) */
    const REVIEW_FORM_BASE_URL    = 'https://nahltimereview.nahl.app/?bookingid='; // ⭐ REVIEW: base URL of review form
    const REVIEW_DELAY_MINUTES    = 30; // ⭐ REVIEW: change this value to control delay (in minutes)
    const REVIEW_SCHEDULE_API_URL = `${API_BASE}/api/review`; // ⭐ REVIEW: proxy endpoint to Apps Script

    /* 🔐 OTP API endpoints (via proxy → Code.gs → Green API) */
    const OTP_REQUEST_URL         = `${API_BASE}/api/otp/request`;
    const OTP_VERIFY_URL          = `${API_BASE}/api/otp/verify`;

    /* 🔄 Toggle OTP feature ON/OFF from here (no backend change required) */
    const OTP_ENABLED             = true;   // 🟢 true = require OTP verify, 🔴 false = skip OTP
    const OTP_CODE_LENGTH         = 4;
    const OTP_RESEND_SECONDS      = 60;

    let controllers = [];
    async function callContent2(path, cb, abortable=false, retries=3){
      let signal='';
      if(abortable){
        controllers.forEach(([c])=>c.abort()); controllers=[];
        const controller=new AbortController(); signal=controller.signal; controllers.push([controller,signal]);
      }
      try{
        await new Promise(r=>setTimeout(r, 200));
        const res=await fetch(defaultLink2+path,{method:'GET',redirect:'follow',...(abortable&&{signal}),cache:'no-store'});
        if(!res.ok){ if(retries>0) return callContent2(path,cb,abortable,retries-1); throw new Error('Network');}
        cb(await res.json());
      }catch(e){
        if(!String(e).includes('AbortError') && retries>0) setTimeout(()=>callContent2(path,cb,abortable,retries-1),600);
      }
    }
    async function postReservationTry(url, payload, contentType='text/plain;charset=UTF-8'){
      try{
        const res=await fetch(url,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':contentType,'Accept':'application/json'},body:JSON.stringify(payload)});
        const raw=await res.text(); let data=null; try{ data=JSON.parse(raw);}catch(_){}
        return {ok:res.ok,status:res.status,data,raw};
      }catch(err){ return {ok:false,status:0,error:String(err)} }
    }
    async function postReservation(payload){
      let r=await postReservationTry(RESERVE_URL_PRIMARY,payload,'text/plain;charset=UTF-8');
      if(!r.ok && (r.status===415||r.status===406||r.status===0)) r=await postReservationTry(RESERVE_URL_PRIMARY,payload,'application/json;charset=UTF-8');
      if(!r.ok && r.status===404) r=await postReservationTry(RESERVE_URL_FALLBACK,payload,'text/plain;charset=UTF-8');
      return r;
    }

    function showToast(type='info', msg=''){
      const wrap=document.getElementById('toastWrap');
      const div=document.createElement('div');
      div.style.minWidth='260px'; div.style.color='#fff'; div.style.padding='10px 14px';
      div.style.borderRadius='10px'; div.style.boxShadow='0 10px 28px rgba(11,38,48,.14)';
      div.style.background = type==='error' ? '#dc2626' : type==='success' ? '#16a34a' : '#0284c7';
      div.textContent=msg; wrap.appendChild(div);
      setTimeout(()=>{ div.style.opacity='0'; div.style.transform='translateY(-6px)'; setTimeout(()=>div.remove(), 180); }, 2400);
    }

    const DateTime=luxon.DateTime;
    const orderedPages=["page1","page2","page3","page4","page5","page6","page7"];
    const STEPS_LABELS=["الترحيب","الخدمة","الوقت","البيانات","الدفع","الموقع","تم"];
    const STEPS_LABELS_EN=["Welcome","Service","Time","Details","Payment","Location","Done"];
    const PAGE_BACKGROUNDS={
      page1:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG1.jpg",
      page2:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG2.jpg",
      page3:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG3.jpg",
      page4:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG4.jpg",
      page5:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG5.jpg",
      page6:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG6.jpg",
      page7:"https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/NahlTimeProFrom/NahlDemoBG7.jpg"
    };
    const STEP_GROUP_INDEX={page1:0,page2:1,page3:2,page4:3,page5:4,page6:5,page7:6};
    let selectedTime=null, servicesCache=null, categoriesCache=null, itiPhone=null, positionUrl="";
    let lastSelectedISO="";
    let isSubmitting=false;
    let currentTimeFilter='all';

    let additionalServicesList = [];

    let baseServicePrice = 0;
    let additionalServicesTotal = 0;

    let couponCodeApplied = '';
    let couponDiscountAmount = 0;
    let couponMeta = null;

    /* 🔐 OTP state */
    let otpRequested = false;
    let otpVerified  = false;
    let otpLastSentAt = null;
    let otpCountdownTimer = null;

    /* 📃 Terms & Conditions state */
    let termsAccepted = false;

    const nForm={
      date:'',time:'',location:'',service:'',serviceCount:'1',serviceCat:'',
      customerM:'',customerN:'',paymentMethod:'',urlLocation:'',locationDescription:'', locale:'ar',
      additionalServicesIds:[],
      additionalServicesLabels:[],
      couponCode:''
    };

    // 🌐 ضبط اللغة من بارامتر ?lang=en أو افتراضي عربي
    (function initLocale() {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const langParam = (params.get('lang') || '').toLowerCase();
        if (langParam === 'en') {
          nForm.locale = 'en';
          document.documentElement.lang = 'en';
          document.documentElement.dir  = 'ltr';
        } else {
          nForm.locale = 'ar';
          document.documentElement.lang = 'ar';
          document.documentElement.dir  = 'rtl';
        }
      } catch(e) {
        console.warn('Locale init failed', e);
      }
    })();

    function isEnglishLocale(){
      const localeRaw = (nForm.locale || document.documentElement.lang || 'ar').toLowerCase();
      return localeRaw.startsWith('en');
    }

    function getServiceDescription(s) {
      const isEnglish = isEnglishLocale();
      if (isEnglish) {
        return (s.TS_service_descriptionEN || s.TS_service_descriptionAR || '').trim();
      } else {
        return (s.TS_service_descriptionAR || s.TS_service_descriptionEN || '').trim();
      }
    }

    function formatServicePrice(priceRaw) {
      if (priceRaw === null || priceRaw === undefined || priceRaw === '') return '';
      const num = Number(priceRaw);
      const isEnglish = isEnglishLocale();

      if (!isFinite(num)) {
        return isEnglish
          ? `${priceRaw} SAR (incl. VAT)`
          : `${priceRaw} ر.س (شامل الضريبة)`;
      }

      const formatter = new Intl.NumberFormat(isEnglish ? 'en-SA' : 'ar-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const formatted = formatter.format(num);
      return isEnglish
        ? `${formatted} SAR (incl. VAT)`
        : `${formatted} ر.س (شامل الضريبة)`;
    }

    function formatTotalAmount(value){
      if (value === null || value === undefined || isNaN(value)) return '—';
      const isEnglish = isEnglishLocale();
      const formatter = new Intl.NumberFormat(isEnglish ? 'en-SA' : 'ar-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const formatted = formatter.format(value);
      return isEnglish ? `${formatted} SAR` : `${formatted} ر.س`;
    }

    function getCarCount(){
      const raw = $('#serviceCount').val() || '1';
      const n = parseInt(raw, 10);
      return (!isNaN(n) && n > 0) ? n : 1;
    }

    function getOrderSubtotal(){
      const carCount = getCarCount();
      const perCar = (Number(baseServicePrice) || 0) + (Number(additionalServicesTotal) || 0);
      return perCar * carCount;
    }

    function updateFooterTotal(){
      const subtotal = getOrderSubtotal();
      const discount = Math.min(subtotal, Number(couponDiscountAmount) || 0);
      const finalTotal = Math.max(0, subtotal - discount);
      const el = document.getElementById('footer-total-value');
      if (el){
        el.textContent = formatTotalAmount(finalTotal);
      }
    }

    function setPageBackground(id){ document.documentElement.style.setProperty('--page-bg', `url("${PAGE_BACKGROUNDS[id]||PAGE_BACKGROUNDS.page1}")`); }

    function showPage(idx){
      const cur=document.querySelector('.page.active');
      const next=document.getElementById(orderedPages[idx]); if(!next||cur===next) return;
      if(cur && cur.id==='page1') stopWelcomeDeck();
      if(cur){ cur.classList.remove('active'); cur.classList.add('exit'); }
      next.style.display='flex';
      requestAnimationFrame(()=>{ next.classList.add('active'); setTimeout(()=>{ if(cur){cur.classList.remove('exit'); cur.style.display='none';} }, 240); });

      syncProgress(idx);
      setPageBackground(next.id);
      renderSummary(next.id);
      updateNextAvailability();
      if(next.id==='page1') startWelcomeDeck();
      if(next.id==='page6'){
        requestAreaBoundsForCurrentArea();
      }
    }
    function getActiveIndex(){ const id=document.querySelector('.page.active')?.id; return Math.max(0, orderedPages.indexOf(id)); }
    function syncProgress(i){
      const pct=((i+1)/orderedPages.length)*100;
      document.getElementById('miniBarFill').style.width=pct+'%';

      const isEn = isEnglishLocale();
      const labels = isEn ? STEPS_LABELS_EN : STEPS_LABELS;
      document.getElementById('miniStepTitle').textContent=labels[Math.min(i,labels.length-1)];

      const prev=document.getElementById('footer-prev');
      const next=document.getElementById('footer-next');
      const wait=document.getElementById('footer-wait');
      const onThanks=(orderedPages[i]==='page7');
      prev.classList.toggle('hidden', i===0 || onThanks);
      next.classList.toggle('hidden', onThanks);
      wait.classList.remove('show');

      if (isEn){
        next.textContent = (i===0) ? 'Skip intro' : 'Next';
      } else {
        next.textContent = (i===0) ? 'تخطي العرض' : 'التالي';
      }
    }

    function setLoadingTimes(on){ document.getElementById('timeLoading').classList.toggle('show', !!on); }
    function setLoadingServices(on){ document.getElementById('servicesLoading').classList.toggle('show', !!on); }

    function isSpecialPlate(num){
      if(!/^\d+$/.test(num) || num.length < 3) return false;
      const same = /^(\d)\1+$/.test(num);
      const asc  = ('01234567890123456789').includes(num);
      const desc = ('98765432109876543210').includes(num);
      const pal  = num === num.split('').reverse().join('');
      const pairRepeat = (num.length%2===0) && /^(\d{2})\1+$/.test(num);
      return same || asc || desc || pal || pairRepeat;
    }
    function updatePlateHint(){
      const raw = ($('#plateNumber').val()||'');
      const v   = raw.replace(/\D/g,'');

      $('#plateNumber').val(v);
      const txt = v
        ? (isSpecialPlate(v) ? 'رقم مميز 👌 — ممتاز للتوثيق السريع.' : 'اختياري — يساعد فريقنا على التعرف على مركبتك.')
        : 'اختياري — يساعد فريقنا على التعرف على مركبتك';

      $('#plateHelp').text(txt);
      const pe=document.getElementById('err-plate'); if(pe) pe.style.display='none';
    }

    function renderSummary(currentId){
      const wrap=document.getElementById('summaryChips'); if(!wrap) return;
      const activeId=currentId || (document.querySelector('.page.active')?.id) || 'page1';
      const currGroup=STEP_GROUP_INDEX[activeId] ?? 0;

      wrap.style.display = currGroup === 0 ? 'none' : 'flex';
      if(currGroup===0){ wrap.innerHTML=''; return; }

      const areaTxt=$('#area').find(':selected').text()||'';
      const srvTxt=$('#service').find(':selected').text()||'';
      const dt=nForm.date ? DateTime.fromISO(nForm.date).toFormat('d LLL yyyy') : '';
      const tm=nForm.time||'';
      const pay=(nForm.paymentMethod||'');
      const locOk=!!positionUrl;
      const extras=(nForm.additionalServicesLabels||[]).join('، ');
      const couponTxt = couponCodeApplied ? couponCodeApplied : '';

      const chips=[
        {i:'fa-location-dot',t:'المنطقة',v:areaTxt,g:1},
        {i:'fa-screwdriver-wrench',t:'الخدمة',v:srvTxt,g:1},
        {i:'fa-plus',t:'خدمات إضافية',v:extras,g:1},
        {i:'fa-ticket',t:'الكوبون',v:couponTxt,g:4},
        {i:'fa-clock',t:'الموعد',v:(dt&&tm)?`${dt} • ${tm}`:'',g:2},
        {i:'fa-credit-card',t:'الدفع',v:(pay?pay.toUpperCase():''),g:4},
        {i:'fa-map-pin',t:'الموقع',v:(locOk?'تم التحديد':''),g:5},
      ];

      wrap.innerHTML='';
      chips.filter(c=>c.v && c.g<=currGroup).forEach(c=>{
        const el=document.createElement('div');
        el.className='chip'+(c.g===currGroup?' current':'' );
        el.innerHTML=`<i class="fa-solid ${c.i}"></i><span class="title">${c.t}:</span><span class="value">${c.v}</span>`;
        wrap.appendChild(el);
      });
    }

    let deckTimers=[]; let deckIndex=0; let deckRunning=false;
    const SLIDE_MS=2600; const GAP_MS=220;
    function startWelcomeDeck(){
      const deck=document.getElementById('pptDeck'); if(!deck) return;
      const slides=[...deck.querySelectorAll('.ppt-slide')];
      const dotsWrap=document.getElementById('pptDots');
      dotsWrap.innerHTML=slides.map((_,i)=>`<span class="ppt-dot${i===0?' active':''}"></span>`).join('');
      const dots=[...dotsWrap.children];

      const setActive=(i,ex=-1)=>{
        slides.forEach((s,idx)=>{ s.classList.remove('is-active','is-exiting'); if(idx===i){s.classList.add('is-active'); s.style.zIndex=2;} else if(idx===ex){s.classList.add('is-exiting'); s.style.zIndex=1;} else{s.style.zIndex=0;} });
        dots.forEach((d,idx)=>d.classList.toggle('active', idx===i));
      };
      deckRunning=true; deckIndex=0; setActive(0,-1);
      const advance=()=>{ if(!deckRunning) return; const prev=deckIndex; deckIndex++; if(deckIndex>=slides.length){ stopWelcomeDeck(); showPage(1); return; } setActive(deckIndex,prev); schedule(); };
      const schedule=()=>{ deckTimers.push(setTimeout(advance, SLIDE_MS+GAP_MS)); };
      schedule();
    }
    function stopWelcomeDeck(){ deckRunning=false; deckTimers.forEach(clearTimeout); deckTimers=[]; }

    function parseTimeToLuxon(raw){
      let t=DateTime.fromISO(String(raw||'').trim(),{setZone:true});
      if(!t.isValid) t=DateTime.fromFormat(String(raw||''),'HH:mm:ss',{setZone:true});
      if(!t.isValid) t=DateTime.fromFormat(String(raw||''),'H:mm a',{setZone:true});
      if(!t.isValid) t=DateTime.fromFormat(String(raw||''),'H:mm',{setZone:true});
      return t.isValid?t:null;
    }
    function normalizeAvailability(r){
      const s=String(r.TS_status||r.status||r.TS_appointment_status||'').toLowerCase();
      const f=(typeof r.isAvailable==='boolean')?r.isAvailable:undefined;
      const b=Number(r.TS_booked ?? r.booked); const c=Number(r.TS_capacity ?? r.capacity);
      let rem=Number(r.TS_remaining ?? r.remaining);
      if(!Number.isFinite(rem)&&Number.isFinite(c)&&Number.isFinite(b)) rem=c-b;
      const open=f===true||['available','open','free','empty','vacant','canceled'].includes(s)||(Number.isFinite(rem)?rem>0:(f!==false&&!s));
      return {looksOpen:open,remaining:rem};
    }

    let dayTimes=[]; let timesLoaded=false;
    function timeInMins(h, m){ return (h*60)+m }
    function passesFilter(mins){
      if(currentTimeFilter==='all') return true;
      if(currentTimeFilter==='morning')   return mins>=timeInMins(6,0)  && mins<timeInMins(11,0);
      if(currentTimeFilter==='afternoon') return mins>=timeInMins(11,0) && mins<timeInMins(16,0);
      if(currentTimeFilter==='evening')   return mins>=timeInMins(16,0) && mins<timeInMins(21,0);
      if(currentTimeFilter==='night')     return mins>=timeInMins(21,0) && mins<timeInMins(24,0);
      return true;
    }

    function fetchTimesForSelectedDate(){
      const dateEl=document.getElementById('date');
      const timeContainer=document.getElementById('time-container');
      const loc=$('#area').val()||''; const srv=$('#service').val()||'';
      const selectedISO=(dateEl.value||DateTime.now().toFormat('yyyy-LL-dd')).trim();
      lastSelectedISO=selectedISO;

      if(!loc||!srv){
        timeContainer.innerHTML=`<div style="grid-column:1/-1;justify-self:center" class="text-muted">اختر المنطقة والخدمة لعرض المواعيد</div>`;
        window.selectedTime=null; selectedTime=null; updateNextAvailability(); return;
      }

      dateEl.disabled=true; setLoadingTimes(true);
      timeContainer.innerHTML=`<div class="spinner-border text-info" role="status" style="grid-column:1/-1;justify-self:center;"></div>`;

      const now=DateTime.now().setZone('Asia/Riyadh');
      const isToday=selectedISO===now.toISODate();

      const qs=`/appointments?startDate=${encodeURIComponent(selectedISO)}&location=${encodeURIComponent(loc)}&service=${encodeURIComponent(srv)}&onlyAvailable=1`;
      callContent2(qs,(res)=>{
        const rows=(res?.data?.appointments||[]);
        const filtered=rows.filter(r=>{
          const d=DateTime.fromISO(r.TS_appointment_date,{setZone:true}); if(!d.isValid||d.toISODate()!==selectedISO) return false;
          const t=parseTimeToLuxon(r.TS_appointment_time); if(!t) return false;
          const {looksOpen}=normalizeAvailability(r); if(!looksOpen) return false;
          if(isToday){ const slot=now.set({hour:t.hour,minute:t.minute,second:0}); if(slot<now.plus({minutes:5})) return false; }
          return true;
        });

        const list=filtered.map(r=>{
          const t=parseTimeToLuxon(r.TS_appointment_time);
          const mins = t.hour*60 + t.minute;
          return {label:t.toLocaleString(DateTime.TIME_SIMPLE), h:t.hour, m:t.minute, mins};
        });

        const seen=new Set();
        dayTimes=list.filter(x=>{ if(seen.has(x.mins)) return false; seen.add(x.mins); return true; });
        timesLoaded=true;

        renderSelectedDateTimes(selectedISO);
        dateEl.disabled=false; setLoadingTimes(false);
      }, true);
    }

    function renderSelectedDateTimes(selectedISO){
      const timeContainer=document.getElementById('time-container');
      timeContainer.innerHTML='';

      if(!timesLoaded){
        timeContainer.innerHTML=`<div class="spinner-border text-info" role="status" style="grid-column:1/-1;justify-self:center;"></div>`;
        return;
      }

      const viewList = dayTimes
        .filter(x=>passesFilter(x.mins))
        .sort((a,b)=> a.mins - b.mins);

      if(!viewList.length){
        timeContainer.innerHTML=`<div style="grid-column:1/-1;justify-self:center" class="text-muted">لا توجد مواعيد ضمن الفلتر المحدد</div>`;
        return;
      }

      viewList.forEach(t=>{
        const btn=document.createElement('button');
        btn.type='button'; btn.className='time-option'; btn.setAttribute('role','radio'); btn.setAttribute('aria-checked','false'); btn.setAttribute('dir','ltr'); btn.textContent=t.label;
        btn.addEventListener('click',()=>{
          [...timeContainer.children].forEach(el=>el.setAttribute('aria-checked','false'));
          btn.setAttribute('aria-checked','true');
          const parsed=DateTime.fromObject({hour:t.h,minute:t.m});
          nForm.date=selectedISO; nForm.time=parsed.toFormat('HH:mm');
          window.selectedTime={ui:t.label,iso:nForm.time}; selectedTime=window.selectedTime;
          renderSummary('page3'); updateNextAvailability();
          showPage(3);
        });
        timeContainer.appendChild(btn);
      });
    }

    function installResizeObservers(){
      const header=document.getElementById('siteHeader');
      const footer=document.getElementById('siteFooter');
      const ro=new ResizeObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.target.id==='siteHeader') document.documentElement.style.setProperty('--header-h', entry.contentRect.height+'px');
          if(entry.target.id==='siteFooter') document.documentElement.style.setProperty('--footer-h', entry.contentRect.height+'px');
        });
      });
      header && ro.observe(header); footer && ro.observe(footer);
    }

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

    function buildPayload(){
      const loc=$('#area').val(); const svcC=$('#serviceCat').val(); const svc=$('#service').val(); const cnt=$('#serviceCount').val()||'1';
      const phoneDigits=itiPhone?.getNumber?.()?.replace(/^\+/, '') || '';
      return {
        date:nForm.date, time:nForm.time,
        location:(loc!==null&&loc!=='')?String(loc):undefined,
        service:(svc!==null&&svc!=='')?String(svc):undefined,
        serviceCount:String(cnt),
        serviceCat:(svcC!==null&&svcC!=='')?String(svcC):undefined,
        customerM:phoneDigits, customerN:nForm.customerN,
        paymentMethod:(nForm.paymentMethod||'').toLowerCase(),
        urlLocation:nForm.urlLocation, locationDescription:nForm.locationDescription||'',
        locale:isEnglishLocale() ? 'en' : 'ar',
        additionalServices:(nForm.additionalServicesIds||[]).join(','),
        couponCode: couponCodeApplied || '',
        couponDiscountAmount: couponDiscountAmount || 0
      };
    }

    function renderAdditionalServicesOptions(){
      const wrap=document.getElementById('additionalServicesWrap');
      if(!wrap) return;

      wrap.innerHTML='';

      if(!additionalServicesList.length){
        wrap.innerHTML='<div class="text-muted small">لا توجد خدمات إضافية متاحة حاليًا</div>';
        return;
      }

      const container=document.createElement('div');
      container.className='row g-2';

      additionalServicesList.forEach(s=>{
        const col=document.createElement('div');
        col.className='col-12 col-md-6';

        const pricePart = (s.price !== null && s.price !== undefined && s.price !== '')
          ? `<div class="small text-primary">+ ${s.price} ر.س</div>`
          : '';

        col.innerHTML = `
          <label class="form-check d-flex align-items-start gap-2 p-2 bg-white rounded-3 shadow-sm">
            <input type="checkbox" class="form-check-input mt-1" value="${String(s.id)}">
            <div class="flex-grow-1">
              <div class="fw-bold">${s.name || ''}</div>
              ${s.description ? `<div class="small text-muted">${s.description}</div>` : ''}
              ${pricePart}
            </div>
          </label>
        `;
        container.appendChild(col);
      });

      wrap.appendChild(container);

      wrap.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
        chk.addEventListener('change', ()=>{
          const ids=[]; const labels=[];
          additionalServicesTotal = 0;

          wrap.querySelectorAll('input[type="checkbox"]:checked').forEach(selected=>{
            const chosenId = String(selected.value);
            ids.push(chosenId);
            const labelEl=selected.closest('label').querySelector('.fw-bold');
            labels.push(labelEl ? labelEl.textContent.trim() : chosenId);

            const svc = additionalServicesList.find(s => String(s.id) === chosenId);
            if (svc && svc.price !== undefined && svc.price !== null && svc.price !== '') {
              const num = Number(svc.price);
              if (!isNaN(num)) additionalServicesTotal += num;
            }
          });

          nForm.additionalServicesIds = ids;
          nForm.additionalServicesLabels = labels;
          renderSummary('page2');
          updateFooterTotal();
        });
      });
    }

    async function loadAdditionalServices(){
      const wrap=document.getElementById('additionalServicesWrap');
      if(!wrap) return;
      try{
        wrap.innerHTML='<div class="text-muted small">جاري تحميل الخدمات الإضافية…</div>';
        const url = `${ADDITIONAL_SERVICES_URL}?appId=${encodeURIComponent(APP_ID)}`;
        const res = await fetch(url, { method:'GET', cache:'no-store' });
        if(!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        additionalServicesList = Array.isArray(data.services) ? data.services : [];
        renderAdditionalServicesOptions();
      }catch(err){
        console.error('loadAdditionalServices error:', err);
        if(wrap){
          wrap.innerHTML='<div class="text-danger small">تعذر تحميل الخدمات الإضافية الآن</div>';
        }
      }
    }

    async function validateCouponOnServer(code, subtotal, customer){
      const params = new URLSearchParams({
        appId: APP_ID,
        code: code || '',
        subtotal: String(subtotal || 0),
        customer: customer || ''
      });
      const url = `${COUPONS_API_URL}?${params.toString()}`;
      const res = await fetch(url, { method:'GET', cache:'no-store' });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    }

    async function validateCouponAndApply(){
      const input = document.getElementById('couponCode');
      const msgEl = document.getElementById('couponMessage');
      const btn = document.getElementById('applyCouponBtn');

      if (!input || !msgEl || !btn) return;

      const code = (input.value || '').trim();
      if (!code){
        showToast('error','رجاءً أدخل كود الكوبون أولاً');
        msgEl.textContent = 'من فضلك أدخل كود خصم ثم اضغط "تطبيق الكوبون".';
        msgEl.className = 'small mt-2 text-danger';
        return;
      }

      const subtotal = getOrderSubtotal();
      if (subtotal <= 0){
        showToast('error','من فضلك اختر الخدمة قبل تطبيق الكوبون');
        msgEl.textContent = 'يجب اختيار الخدمة (والخدمات الإضافية إن وجدت) قبل تطبيق الكوبون.';
        msgEl.className = 'small mt-2 text-danger';
        return;
      }

      const customer = itiPhone && itiPhone.getNumber ? itiPhone.getNumber().replace(/^\+/, '') : '';

      msgEl.textContent = 'جاري التحقق من الكوبون…';
      msgEl.className = 'small mt-2 text-muted';

      btn.disabled = true;
      const originalText = btn.dataset.originalText || btn.textContent;
      btn.dataset.originalText = originalText;
      btn.textContent = 'جاري التحقق…';

      try {
        const result = await validateCouponOnServer(code, subtotal, customer);

        if (!result || result.ok === false){
          couponCodeApplied = '';
          couponDiscountAmount = 0;
          couponMeta = null;
          nForm.couponCode = '';

          updateFooterTotal();

          const msg = result && result.message
            ? result.message
            : 'الكوبون غير صالح أو منتهي الصلاحية.';
          msgEl.textContent = msg;
          msgEl.className = 'small mt-2 text-danger';
          showToast('error', msg);
          renderSummary('page5');
          return;
        }

        couponCodeApplied = code;
        couponDiscountAmount = Number(result.discountAmount || 0);
        couponMeta = result;
        nForm.couponCode = code;

        updateFooterTotal();
        renderSummary('page5');

        const successMsg = result.message || 'تم تطبيق الكوبون بنجاح على إجمالي الطلب.';
        msgEl.textContent = successMsg;
        msgEl.className = 'small mt-2 text-success';
        showToast('success', successMsg);

      } catch (err){
        console.error('validateCouponAndApply error:', err);
        msgEl.textContent = 'تعذر التحقق من الكوبون الآن. حاول مرة أخرى لاحقًا.';
        msgEl.className = 'small mt-2 text-danger';
        showToast('error','تعذر التحقق من الكوبون الآن.');
      } finally {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'تطبيق الكوبون';
      }
    }

    // 🔹 Dynamic Payment Methods Loader
    async function loadPaymentMethods() {
      const wrap = document.getElementById('payGroup');
      const errPay = document.getElementById('err-pay');
      if (!wrap) return;

      wrap.innerHTML = `
        <div style="grid-column:1/-1;justify-self:center" class="text-muted">
          جاري تحميل طرق الدفع…
        </div>
      `;

      try {
        const url = `${PAYMENT_METHODS_URL}?action=listPaymentMethods&appId=${encodeURIComponent(APP_ID)}`;
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();

        const methods =
          Array.isArray(data.methods) ? data.methods :
          Array.isArray(data.items)   ? data.items   :
          Array.isArray(data.paymentMethods) ? data.paymentMethods : [];

        if (!methods.length) {
          wrap.innerHTML = `
            <div style="grid-column:1/-1;justify-self:center" class="text-muted">
              لا توجد طرق دفع مفعلة حاليًا
            </div>
          `;
          if (errPay) errPay.style.display = 'block';
          console.warn('loadPaymentMethods: no methods from API');
          return;
        }

        // ✅ Render payment cards
        wrap.innerHTML = '';
        methods.forEach((m, idx) => {
          const methodId = m.methodId || m.id || '';
          const nameAr  = m.nameAr || m.NameAr || '';
          const nameEn  = m.nameEn || m.NameEn || '';
          const logo    = m.logoUrl || m.LogoUrl || '';
          const type    = (m.type || '').toLowerCase();

          const label = isEnglishLocale() ? (nameEn || nameAr || methodId) : (nameAr || nameEn || methodId);

          const card = document.createElement('label');
          card.className = 'pay-card';
          card.setAttribute('tabindex', idx === 0 ? '0' : '-1');
          card.setAttribute('role', 'radio');
          card.setAttribute('aria-checked', 'false');

          const input = document.createElement('input');
          input.type = 'radio';
          input.name = 'payingMethod';
          input.value = methodId;
          input.className = 'visually-hidden';

          const content = document.createElement('div');
          content.style.display = 'flex';
          content.style.alignItems = 'center';
          content.style.gap = '12px';

          if (logo) {
            const img = document.createElement('img');
            img.src = logo;
            img.alt = label;
            img.style.maxWidth = '120px';
            img.style.height = 'auto';
            content.appendChild(img);
          } else {
            const span = document.createElement('strong');
            span.textContent = label;
            content.appendChild(span);
          }

          card.appendChild(input);
          card.appendChild(content);
          wrap.appendChild(card);

          const choose = () => {
            wrap.querySelectorAll('.pay-card').forEach(c => {
              c.setAttribute('aria-checked', 'false');
              c.setAttribute('tabindex', '-1');
              const r = c.querySelector('input[type="radio"]');
              if (r) r.checked = false;
            });

            card.setAttribute('aria-checked', 'true');
            card.setAttribute('tabindex', '0');
            input.checked = true;

            nForm.paymentMethod = methodId;
            renderSummary('page5');
            updateNextAvailability();
            showPage(4);
          };

          card.addEventListener('click', choose);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose();
            }
          });
        });

        if (errPay) errPay.style.display = 'none';
      } catch (err) {
        console.error('loadPaymentMethods error:', err);
        wrap.innerHTML = `
          <div style="grid-column:1/-1;justify-self:center" class="text-danger">
            تعذر تحميل طرق الدفع الآن، حاول لاحقًا.
          </div>
        `;
        if (errPay) errPay.style.display = 'block';
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

    /* 🎁 Offers / Ads popup (from Apps Script /api/offers) */
    let offersLoaded = false;
    let offersCache  = [];
    let offersFilterAll = true;
    let offersFilterTypes = { image: true, text: true, coupon: true };

    function normalizeOfferType(raw) {
      const t = String(raw || '').toLowerCase().trim();
      if (['image', 'img', 'banner', 'photo', 'picture'].includes(t)) return 'image';
      if (['coupon', 'code', 'promo', 'voucher'].includes(t)) return 'coupon';
      if (!t) return 'text';
      return t === 'text' ? 'text' : 'text';
    }

    function formatOfferDateRange(startRaw, endRaw) {
      const isEn = isEnglishLocale();
      if (!startRaw && !endRaw) return '';
      const fmt = (iso) => {
        const d = DateTime.fromISO(String(iso).slice(0, 10));
        if (!d.isValid) return String(iso);
        return d.toFormat(isEn ? 'dd LLL yyyy' : 'd LLL yyyy');
      };
      const fromTxt = startRaw ? fmt(startRaw) : '';
      const toTxt   = endRaw   ? fmt(endRaw)   : '';
      if (fromTxt && toTxt) {
        return isEn
          ? `Valid ${fromTxt} → ${toTxt}`
          : `ساري من ${fromTxt} إلى ${toTxt}`;
      }
      if (fromTxt) {
        return isEn ? `From ${fromTxt}` : `ساري من ${fromTxt}`;
      }
      return isEn ? `Until ${toTxt}` : `ساري حتى ${toTxt}`;
    }

    // 🔹 تحميل العروض من الـ backend
    async function fetchOffersFromServer() {
      const todayIso = DateTime.now().toISODate();
      const params = new URLSearchParams({
        appId: APP_ID,
        action: 'listOffers',
        today: todayIso
      });

      const url = `${OFFERS_API_URL}?${params.toString()}`;
      console.log('[offers] fetching from', url);

      const res = await fetch(url, { method: 'GET', cache: 'no-store' });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[offers] HTTP error', res.status, text);
        throw new Error('Offers HTTP ' + res.status);
      }

      const data = await res.json().catch((e) => {
        console.error('[offers] JSON parse error', e);
        return {};
      });

      console.log('[offers] raw data:', data);

      const items = data.items || data.offers || data.rows || [];
      offersCache = Array.isArray(items) ? items : [];
      offersLoaded = true;

      console.log('[offers] cached items:', offersCache);
    }

    // 🔹 تحويل بيانات العرض مع دعم rawKeys (Body AR/EN + Show On Pages)
    function getFilteredOffers() {
      if (!offersCache || !offersCache.length) return [];

      const today   = DateTime.now().toISODate();
      const todayDt = DateTime.fromISO(today);
      const isEn    = isEnglishLocale();

      return offersCache
        .map((o) => {
          const type = normalizeOfferType(
            o.type || o.kind || o.category || o.offerType
          );

          const startRaw = o.startDate || o.StartDate || o.start_date || o.validFrom || o.ValidFrom;
          const endRaw   = o.endDate   || o.EndDate   || o.end_date   || o.validTo   || o.ValidTo;
          const activeRaw = (o.active ?? o.Active ?? o.isActive ?? true);
          const active = !(String(activeRaw).toLowerCase() === 'false' || activeRaw === false);

          let fromOk = true, toOk = true;
          if (startRaw) {
            const d = DateTime.fromISO(String(startRaw).slice(0, 10));
            if (d.isValid) fromOk = todayDt >= d;
          }
          if (endRaw) {
            const d = DateTime.fromISO(String(endRaw).slice(0, 10));
            if (d.isValid) toOk = todayDt <= d;
          }

          // 🔹 قراءة Show On Pages من rawKeys
          const rk = o.rawKeys || o.RawKeys || {};
          const showOnPagesRaw =
            o.showOnPages ||
            o.ShowOnPages ||
            o.show_on_pages ||
            rk['Show On Pages'] ||
            rk['showOnPages'] ||
            '';

          const pages = String(showOnPagesRaw)
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

          // نعتبر أننا الآن في الصفحة 1 (الترحيب)
          const showOnWelcome =
            !pages.length || pages.includes('page1') || pages.includes('all');

          // 🔹 نصوص العنوان/الوصف من rawKeys إذا لم تكن موجودة مباشرة
          const title =
            o.title ||
            o.Title ||
            (isEn ? rk['Title EN'] || rk['Title AR'] : rk['Title AR'] || rk['Title EN']) ||
            '';

          const body =
            o.description ||
            o.Description ||
            o.body ||
            o.text ||
            (isEn ? rk['Body EN'] || rk['Body AR'] : rk['Body AR'] || rk['Body EN']) ||
            '';

          const imageUrl =
            o.imageUrl || o.ImageUrl || o.image || rk['Image URL'] || rk['Image'] || '';

          const couponCode =
            o.couponCode ||
            o.CouponCode ||
            o.coupon ||
            o.code ||
            rk['Coupon Code'] ||
            rk['Coupon'];

          return {
            raw: o,
            id: o.offerId || o.OfferId || o.id || o.ID,
            type,
            title,
            body,
            imageUrl,
            couponCode,
            startRaw,
            endRaw,
            active,
            fromOk,
            toOk,
            showOnWelcome,
            priority: Number(o.priority ?? o.Priority ?? 0) || 0
          };
        })
        .filter((o) => {
          if (!o.active || !o.fromOk || !o.toOk || !o.showOnWelcome) return false;
          if (!o.type) return false;
          if (!offersFilterAll && !offersFilterTypes[o.type]) return false;
          return true;
        })
        .sort((a, b) => b.priority - a.priority);
    }

    // 🔹 رسم العروض في البوب أب
    function renderOffersList() {
      const listEl = document.getElementById('offersList');
      if (!listEl) return;

      const filtered = getFilteredOffers();
      listEl.innerHTML = '';

      if (!offersLoaded) {
        const div = document.createElement('div');
        div.className = 'offers-empty text-muted small';
        div.textContent = isEnglishLocale()
          ? 'Loading offers…'
          : 'جاري تحميل العروض…';
        listEl.appendChild(div);
        return;
      }

      if (!filtered.length) {
        const div = document.createElement('div');
        div.className = 'offers-empty text-muted small';
        div.textContent = isEnglishLocale()
          ? 'No active offers at the moment.'
          : 'لا توجد عروض فعّالة حاليًا.';
        listEl.appendChild(div);
        return;
      }

      filtered.forEach((o) => {
        const card = document.createElement('div');
        card.className = 'offer-card';

        const title = document.createElement('h3');
        title.className = 'offer-title';
        title.textContent =
          o.title || (isEnglishLocale() ? 'Special offer' : 'عرض خاص');
        card.appendChild(title);

        if (o.body) {
          const body = document.createElement('p');
          body.className = 'offer-body';
          body.textContent = o.body;
          card.appendChild(body);
        }

        if (o.imageUrl) {
          const img = document.createElement('img');
          img.className = 'offer-image';
          img.src = o.imageUrl;
          img.alt = o.title || 'Offer';
          card.appendChild(img);
        }

        const metaRow = document.createElement('div');
        metaRow.className = 'offer-tag-row';

        const tag = document.createElement('span');
        tag.className = 'offer-tag';
        if (o.type === 'image') {
          tag.textContent = isEnglishLocale() ? 'Image Ad' : 'إعلان بالصورة';
        } else if (o.type === 'coupon') {
          tag.textContent = isEnglishLocale() ? 'Coupon' : 'كوبون خصم';
        } else {
          tag.textContent = isEnglishLocale() ? 'Text Offer' : 'عرض نصي';
        }
        metaRow.appendChild(tag);

        const datesTxt = formatOfferDateRange(o.startRaw, o.endRaw);
        if (datesTxt) {
          const datesSpan = document.createElement('span');
          datesSpan.className = 'offer-dates';
          datesSpan.textContent = datesTxt;
          metaRow.appendChild(datesSpan);
        }

        card.appendChild(metaRow);

        if (o.couponCode) {
          const couponRow = document.createElement('div');
          couponRow.style.display = 'flex';
          couponRow.style.alignItems = 'center';
          couponRow.style.justifyContent = 'space-between';
          couponRow.style.gap = '8px';
          couponRow.style.marginTop = '6px';

          const chip = document.createElement('span');
          chip.className = 'offer-coupon-chip';
          chip.innerHTML = `<i class="fa-solid fa-ticket"></i><span>${o.couponCode}</span>`;
          couponRow.appendChild(chip);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'offer-apply-btn';
          btn.innerHTML = `<i class="fa-solid fa-check"></i>${
            isEnglishLocale() ? 'Apply coupon' : 'تطبيق الكوبون'
          }`;
          btn.addEventListener('click', () => applyOfferCouponFromOffer(o));
          couponRow.appendChild(btn);

          card.appendChild(couponRow);
        }

        listEl.appendChild(card);
      });
    }

    // 🔹 تأكد من تحميل العروض مرة واحدة فقط
    async function ensureOffersLoaded() {
      try {
        if (!offersLoaded) {
          await fetchOffersFromServer();
        }
      } catch (err) {
        console.error('fetchOffersFromServer error:', err);
        if (typeof showToast === 'function') {
          showToast(
            'error',
            isEnglishLocale()
              ? 'Could not load offers.'
              : 'تعذر تحميل العروض الآن.'
          );
        }
      } finally {
        renderOffersList();
      }
    }

    function openOffersModal(){
      const modal = document.getElementById('offersModal');
      if (!modal) return;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('offers-open');
      ensureOffersLoaded();
    }

    function closeOffersModal(){
      const modal = document.getElementById('offersModal');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
      document.body.classList.remove('offers-open');
    }

    function applyOfferCouponFromOffer(o){
      const code = o.couponCode;
      if (!code){
        return;
      }
      const input = document.getElementById('couponCode');
      if (input){
        input.value = code;
      }
      closeOffersModal();
      if (typeof validateCouponAndApply === 'function'){
        validateCouponAndApply();
      }else if (typeof showToast === 'function'){
        showToast('success', isEnglishLocale()
          ? `Coupon ${code} copied, you can apply it from payment step.`
          : `تم نسخ الكوبون ${code}، يمكنك تطبيقه من خطوة الدفع.`);
      }
    }

    function initOffersFilters(){
      const wrap = document.getElementById('offersFilters');
      if (!wrap) return;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-type]');
        if (!btn) return;
        const t = btn.dataset.type;
        if (t === 'all'){
          offersFilterAll = true;
          offersFilterTypes = { image:true, text:true, coupon:true };
          wrap.querySelectorAll('[data-type]').forEach(el => {
            const type = el.dataset.type;
            el.classList.toggle('active', type === 'all' || type === 'image' || type === 'text' || type === 'coupon');
          });
        } else {
          offersFilterAll = false;
          offersFilterTypes[t] = !offersFilterTypes[t];
          const allChip = wrap.querySelector('[data-type="all"]');
          if (allChip) allChip.classList.remove('active');
          btn.classList.toggle('active', !!offersFilterTypes[t]);
        }
        renderOffersList();
      });
    }

    function wireOffersUI(){
      const btn = document.getElementById('btnShowOffers');
      const modal = document.getElementById('offersModal');
      const closeBtn = modal ? modal.querySelector('.offers-close') : null;
      const backdrop = modal ? modal.querySelector('.offers-backdrop') : null;

      if (btn){
        btn.addEventListener('click', () => {
          openOffersModal();
        });
      }
      if (closeBtn){
        closeBtn.addEventListener('click', () => closeOffersModal());
      }
      if (backdrop){
        backdrop.addEventListener('click', () => closeOffersModal());
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape'){
          if (modal && modal.classList.contains('show')){
            closeOffersModal();
          }
        }
      });
      initOffersFilters();
    }

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

    /* Map globals */
    let map, marker, autocomplete, areaPolygon, pendingAreaForBounds=null, currentAreaBounds;
    let lastValidLatLng = null;
    const SA_BOUNDS = { north: 32.154, south: 16.370, west: 34.495, east: 55.666 };

    async function loadAreaBounds(areaId){
      if(!areaId) return;

      if(!window.google || !window.google.maps || !map){
        pendingAreaForBounds = areaId;
        return;
      }

      try{
        const params = new URLSearchParams({
          appId: APP_ID,
          areaId: String(areaId)
        });
        const res = await fetch(`${AREA_BOUNDS_URL}?${params.toString()}`, {
          method:'GET',
          cache:'no-store'
        });
        if(!res.ok){
          console.warn('loadAreaBounds HTTP error', res.status);
          return;
        }
        const json = await res.json();
        const payload = json && json.data ? json.data : json;

        if(!payload){
          console.warn('loadAreaBounds: no payload');
          return;
        }

        const boundsObj = payload.bounds || {};
        currentAreaBounds = boundsObj;

        const centerObj = payload.center || {};
        const centerLat = Number(centerObj.lat);
        const centerLng = Number(centerObj.lng);

        const north = Number(boundsObj.north);
        const south = Number(boundsObj.south);
        const east  = Number(boundsObj.east);
        const west  = Number(boundsObj.west);

        let center;
        if(Number.isFinite(centerLat) && Number.isFinite(centerLng)){
          center = new google.maps.LatLng(centerLat, centerLng);
        }else{
          center = map.getCenter();
        }

        if(center){
          map.setCenter(center);
          if(marker){
            marker.setPosition(center);
          }
          lastValidLatLng = center;
        }

        if(Number.isFinite(north) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(west)){
          const areaLatLngBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(south, west),
            new google.maps.LatLng(north, east)
          );
          map.setOptions({
            restriction:{
              latLngBounds: areaLatLngBounds,
              strictBounds:true
            }
          });
          map.fitBounds(areaLatLngBounds);
        }

        const poly = payload.polygon;
        if(poly && Array.isArray(poly) && poly.length){
          const path = poly.map(pt=>{
            const lat = Number(pt.lat ?? pt[0]);
            const lng = Number(pt.lng ?? pt[1]);
            return {lat, lng};
          }).filter(p=>Number.isFinite(p.lat) && Number.isFinite(p.lng));
          if(path.length){
            if(areaPolygon){
              areaPolygon.setMap(null);
            }
            areaPolygon = new google.maps.Polygon({
              paths: path,
              strokeColor: '#027A93',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#027A93',
              fillOpacity: 0.08
            });
            areaPolygon.setMap(map);
          }
        }
      }catch(err){
        console.error('loadAreaBounds error:', err);
      }
    }

    function requestAreaBoundsForCurrentArea(){
      const areaId = $('#area').val() || '';
      if(!areaId) return;
      loadAreaBounds(areaId);
    }

    $(function(){
      installResizeObservers();

      Object.values(PAGE_BACKGROUNDS).forEach(src=>{ const i=new Image(); i.src=src; });

      $('#area').select2({width:'100%',placeholder:'اختر المنطقة لخدمة العناية الفاخرة', dir:'rtl'});
      $('#serviceCat').select2({width:'100%',placeholder:'فئة الخدمة', dir:'rtl'});
      $('#service').select2({width:'100%',placeholder:'باقتك المختارة', dir:'rtl'});
      $('#carBrand').select2({width:'100%',placeholder:'اختر ماركة المركبة (الأسماء الفاخرة أولاً)', dir:'rtl'});
      $('#area, #serviceCat, #service, #carBrand').on('select2:open', ()=>{$('.select2-search__field').attr('dir','rtl');});

      itiPhone=window.intlTelInput(document.querySelector('#mobile'),{
        initialCountry:'sa', onlyCountries:['sa','ae','bh','kw','om','qa'],
        separateDialCode:true, placeholderNumberType:'MOBILE',
        utilsScript:'https://cdn.jsdelivr.net/npm/intl-tel-input@24.4.0/build/js/utils.js'
      });
      $('#mobile').attr({placeholder:'رقم التواصل الخاص — مثال 5XXXXXXXX', inputmode:'tel', autocomplete:'tel'})
                  .on('blur', ()=> {
                    const ok = itiPhone && itiPhone.isValidNumber();
                    document.getElementById('err-mobile').style.display = ok ? 'none':'block';
                  });

      $('#name').attr('placeholder','الاسم كما سيظهر في الفاتورة');
      $('#carName').attr('placeholder','الموديل/الفئة — مثال: S-Class، LX 570');
      $('#plateNumber').attr('placeholder','أرقام اللوحة — اختياري');

      const today=DateTime.now().toFormat('yyyy-LL-dd');
      $('#date').val(today).attr('min',today);

      setLoadingServices(true);
      callContent2(`/locations`, res=>{
        const list=res?.data||[]; const ds=list.map(l=>({id:l.id,text:l.TS_location_arabic_name}));
        $('#area').empty().select2({data:ds,width:'100%',placeholder:'اختر المنطقة لخدمة العناية الفاخرة', dir:'rtl'});
        if(ds.length){
          $('#area').val(ds[0].id).trigger('change');
        } else {
          setLoadingServices(false); showToast('error','لا توجد مناطق متاحة حالياً');
        }
        renderSummary('page2');
      });

      $('#area').on('change', function(){
        nForm.location=this.value;
        requestAreaBoundsForCurrentArea();

        setLoadingServices(true);
        callContent2(`/services?location=${encodeURIComponent(this.value)}`, res=>{
          servicesCache=res?.data?.services||[]; categoriesCache=res?.data?.servicesCat||[];
          const cats=categoriesCache.map(c=>({id:c.TS_category_id,text:c.TS_category_arabic_name}));
          $('#serviceCat').empty().select2({data:cats,width:'100%',placeholder:'فئة الخدمة', dir:'rtl'});
          if(cats.length) $('#serviceCat').val(cats[0].id).trigger('change');
          setLoadingServices(false); renderSummary('page2'); updateNextAvailability();
        }, true);
      });

      $('#serviceCat').on('change', function(){
        nForm.serviceCat=this.value; const cid=Number(this.value);
        const items=servicesCache?.filter(s=>Number(s.TS_category_id)===cid)?.sort((a,b)=>a.TS_service_id-b.TS_service_id)?.map(s=>({id:s.TS_service_id,text:s.TS_service_arabic_name}))||[];
        $('#service').empty().select2({data:items,width:'100%',placeholder:'باقتك المختارة', dir:'rtl'});
        if(items.length) $('#service').val(items[0].id).trigger('change');
        renderSummary('page2'); updateNextAvailability();
      });

      $('#service').on('change', function () {
        nForm.service = this.value || '';

        const selectedId = this.value ? String(this.value) : '';
        let selectedService = null;
        if (servicesCache && Array.isArray(servicesCache)) {
          selectedService = servicesCache.find(
            s => String(s.TS_service_id) === selectedId
          );
        }

        const descBox = document.getElementById('serviceDetails');
        if (descBox) {
          const desc = selectedService ? getServiceDescription(selectedService) : '';
          if (desc) {
            descBox.textContent = desc;
          } else {
            const isEnglish = isEnglishLocale();
            descBox.textContent = isEnglish
              ? 'No details are available for this service yet.'
              : 'لا توجد تفاصيل متاحة لهذه الخدمة حاليًا.';
          }
        }

        const priceBox = document.getElementById('servicePrice');
        if (priceBox) {
          const priceRaw = selectedService ? selectedService.TS_service_final_price : '';
          baseServicePrice = (!isNaN(Number(priceRaw))) ? Number(priceRaw) : 0;
          const priceText = formatServicePrice(priceRaw);
          priceBox.textContent = priceText || '—';
        } else {
          baseServicePrice = 0;
        }

        renderSummary('page2');
        updateNextAvailability();
        updateFooterTotal();
      });

      const luxuryFirstBrands = [
        'Rolls-Royce','Bentley','Mercedes-Benz (Maybach)','Aston Martin','Ferrari','Lamborghini','McLaren','Maserati',
        'Porsche','Land Rover (Range Rover)','Mercedes-Benz','BMW','Audi','Lexus','Genesis','Jaguar','Cadillac','Infiniti',
        'GMC','Toyota','Nissan','Hyundai','Kia','Honda','Chevrolet','Ford','Mazda','Mitsubishi','Other'
      ].map(b=>({id:b,text:b}));
      $('#carBrand').empty().select2({data:luxuryFirstBrands,width:'100%',placeholder:'اختر ماركة المركبة (الأسماء الفاخرة أولاً)', dir:'rtl'});

      $('#name').on('input', function(){ nForm.customerN=this.value.trim(); renderSummary('page4'); updateNextAvailability(); });
      $('#mobile').on('input', function(){
        renderSummary('page4');
        if(OTP_ENABLED){
          resetOtpState(false);
        }
        updateNextAvailability();
      });
      $('#carName').on('input', function(){ updateNextAvailability(); });

      $('#serviceCount').on('change', function(){
        nForm.serviceCount=this.value||'1';
        renderSummary('page2');
        updateNextAvailability();
        updateFooterTotal();
      });

      $('#plateNumber').on('input', function(){ updatePlateHint(); renderSummary('page4'); updateNextAvailability(); });

      $('#date').on('change', ()=>{ fetchTimesForSelectedDate(); renderSummary('page3'); });
      $('#timeFilter').on('change', function(){ currentTimeFilter=this.value; renderSelectedDateTimes(lastSelectedISO); });

      const $prev=document.getElementById('footer-prev');
      const $next=document.getElementById('footer-next');
      const $wait=document.getElementById('footer-wait');

      async function gotoNext(){
        const i=getActiveIndex(); const id=orderedPages[i];
        if(id==='page1'){ stopWelcomeDeck(); showPage(1); return; }

        if(id==='page2'){
          const areaOk=!!$('#area').val(), catOk=!!$('#serviceCat').val(), svcOk=!!$('#service').val();
          document.getElementById('err-area').style.display=areaOk?'none':'block';
          document.getElementById('err-serviceCat').style.display=catOk?'none':'block';
          document.getElementById('err-service').style.display=svcOk?'none':'block';
          if(!areaOk||!catOk||!svcOk){ showToast('error','يرجى إكمال اختيار المنطقة/التصنيف/الخدمة'); return; }
          showPage(2); document.getElementById('date').dispatchEvent(new Event('change')); return;
        }

        if(id==='page3'){ if(!selectedTime){ showToast('error','الرجاء اختيار وقت'); return; } showPage(3); return; }

        if(id==='page4'){
          const nameOk=($('#name').val()||'').trim().length>0;
          const phoneOk=itiPhone && itiPhone.isValidNumber();
          document.getElementById('err-name').style.display=nameOk?'none':'block';
          document.getElementById('err-mobile').style.display=phoneOk?'none':'block';

          if(!nameOk||!phoneOk){
            showToast('error','يرجى التحقق من الاسم ورقم الجوال');
            return;
          }

          if(OTP_ENABLED && !otpVerified){
            const errOtp = document.getElementById('err-otp');
            if(errOtp){
              errOtp.textContent = 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
              errOtp.style.display = 'block';
            }
            showToast('error','يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة');
            return;
          }

          const errOtp = document.getElementById('err-otp');
          if(errOtp) errOtp.style.display = 'none';

          nForm.customerN=$('#name').val().trim(); 
          nForm.customerM=itiPhone.getNumber().replace(/^\+/,'');

          nForm.locationDescription=[$('#carBrand').val()||'', $('#carName').val()||'', $('#plateNumber').val()||''].filter(Boolean).join(', ');

          showPage(4); return;
        }

        if(id==='page5'){
          if(!nForm.paymentMethod){ document.getElementById('err-pay').style.display='block'; showToast('error','اختر طريقة الدفع'); return; }
          document.getElementById('err-pay').style.display='none'; showPage(5); return;
        }

        if(id==='page6'){

          // ✅ Terms & Conditions check before final submit
          if (!termsAccepted){
            openTermsModal();
            if (typeof showToast === 'function'){
              showToast('info', 'من فضلك اقرأ ووافق على الشروط والأحكام قبل إكمال الحجز');
            }
            return;
          }

          if(!positionUrl){
            document.getElementById('err-map').style.display='block';
            showToast('error','الرجاء تحديد الموقع');
            return;
          }
          document.getElementById('err-map').style.display='none'; 
          nForm.urlLocation=positionUrl;

          if(isSubmitting) return;
          isSubmitting=true;
          $next.style.display='none';
          $prev.style.display='none';
          $wait.classList.add('show');

          const payload = buildPayload();
          console.log('[booking] Sending reservation payload', payload);

          const r=await postReservation(payload);
          console.log('[booking] Reservation response:', r);

          if(r.ok && r.data?.success){
            showToast('success','تم إنشاء الحجز');

            const bookingId =
              (r.data.bookingId ??
               r.data.bookingID ??
               r.data.id ??
               r.data.BookingId ??
               r.data.BookingID) || null;

            console.log('[booking] Derived bookingId for review:', bookingId);

            // ⭐ REVIEW: schedule sending review form after N minutes via backend
            scheduleReviewForBooking(bookingId);

            document.getElementById('ts-area').textContent = $('#area').find(':selected').text()||'—';
            document.getElementById('ts-service').textContent = $('#service').find(':selected').text()||'—';
            document.getElementById('ts-dt').textContent = (nForm.date?DateTime.fromISO(nForm.date).toFormat('d LLL yyyy'):'') + (nForm.time?(' • '+nForm.time):'');
            document.getElementById('ts-pay').textContent = (nForm.paymentMethod||'').toUpperCase()||'—';
            const waMsg = encodeURIComponent(`تم إرسال طلب حجز: \nالخدمة: ${$('#service').find(':selected').text()}\nالتاريخ: ${nForm.date} ${nForm.time}\nالرابط: ${location.href}`);
            document.getElementById('ts-whatsapp').href = `https://wa.me/?text=${waMsg}`;

            $wait.classList.remove('show');
            isSubmitting=false;
            showPage(6);
          } else {
            const msg=r?.data?.msgAR || (r.status===404?'المسار غير موجود':'تعذر إنشاء الحجز');
            showToast('error',msg);
            isSubmitting=false;
            $wait.classList.remove('show');
            $next.style.display='';
            $prev.style.display='';
            return;
          }
          return;
        }
        showPage(Math.min(i+1, orderedPages.length-1));
      }
      document.getElementById('footer-next').addEventListener('click', gotoNext);
      document.getElementById('footer-prev').addEventListener('click', ()=>{ const i=getActiveIndex(); showPage(Math.max(i-1,0)); });

      // ✅ إصلاح حجز جديد: يرجع دائماً لنفس index.html بدل الروت /
      $('#rebook').on('click', ()=>{
        window.location.href = 'index.html';
      });

      const applyBtn = document.getElementById('applyCouponBtn');
      if (applyBtn){
        applyBtn.addEventListener('click', validateCouponAndApply);
      }

      // 🔐 Wire OTP controls (if enabled)
      if(OTP_ENABLED){
        const otpControls = document.getElementById('otpControls');
        const verifyRow  = document.getElementById('otpVerifyRow');
        if(otpControls) otpControls.style.display = 'flex';
        if(verifyRow)   verifyRow.style.display   = 'none';

        const btnSendOtp   = document.getElementById('btnSendOtp');
        const btnVerifyOtp = document.getElementById('btnVerifyOtp');
        if(btnSendOtp){   btnSendOtp.addEventListener('click', requestOtpForMobile); }
        if(btnVerifyOtp){ btnVerifyOtp.addEventListener('click', verifyOtpCode); }

        resetOtpState(true);
      } else {
        const otpControls = document.getElementById('otpControls');
        const verifyRow   = document.getElementById('otpVerifyRow');
        const errOtp      = document.getElementById('err-otp');
        if(otpControls) otpControls.style.display = 'none';
        if(verifyRow)   verifyRow.style.display   = 'none';
        if(errOtp)      errOtp.style.display      = 'none';
      }

      // Load dynamic extras + payment methods + wire offers + terms popup
      loadAdditionalServices();
      loadPaymentMethods();
      wireOffersUI();
      wireTermsModal();

      setPageBackground('page1'); renderSummary('page1'); syncProgress(0); startWelcomeDeck();

      const isEnglish = isEnglishLocale();
      if (isEnglish) {
        const lblDetails = document.getElementById('serviceDetailsLabel');
        if (lblDetails) lblDetails.textContent = 'Service details';
        const lblPrice = document.getElementById('servicePriceLabel');
        if (lblPrice) lblPrice.textContent = 'Service price (incl. VAT)';
        const footerTotalLabel = document.getElementById('footer-total-label');
        if (footerTotalLabel) footerTotalLabel.textContent = 'Order total:';

        const offersTitle = document.getElementById('offersTitle');
        if (offersTitle) offersTitle.textContent = "Today's offers";
        const offersBtn = document.getElementById('btnShowOffers');
        if (offersBtn) offersBtn.innerHTML = '<i class="fa-solid fa-gift"></i><span>Today\'s offers</span>';
        const filterWrap = document.getElementById('offersFilters');
        if (filterWrap){
          filterWrap.querySelectorAll('[data-type]').forEach(chip => {
            const t = chip.dataset.type;
            if (t === 'all') chip.textContent = 'All';
            else if (t === 'image') chip.textContent = 'Images';
            else if (t === 'text') chip.textContent = 'Text';
            else if (t === 'coupon') chip.textContent = 'Coupons';
          });
        }
      }

      updateFooterTotal();
    });

    function updateNextAvailability(){
      const i=getActiveIndex(); const nextBtn=document.getElementById('footer-next'); let enable=true;
      if(i===0){ 
        enable=true; 
      }
      else if(i===1){ 
        enable=!!($('#area').val()&&$('#service').val()); 
      }
      else if(i===2){ 
        enable=!!selectedTime; 
      }
      else if(i===3){ 
        const nameOk=($('#name').val()||'').trim().length>0; 
        const phoneOk = (window.itiPhone ? itiPhone.isValidNumber() : true);
        const otpOk   = (!OTP_ENABLED) || otpVerified;
        enable = nameOk && phoneOk && otpOk;
      }
      else if(i===4){ 
        enable=!!(document.querySelector('#payGroup input:checked')); 
      }
      else if(i===5){ 
        enable=!!positionUrl; 
      }
      nextBtn.disabled=!enable; nextBtn.classList.toggle('disabled',!enable);
    }

    function initMap(){
      const def={lat:24.7136,lng:46.6753};
      map=new google.maps.Map(document.getElementById('googleMap'),{
        center:def, zoom:12, disableDoubleClickZoom:true, mapTypeControl:false, fullscreenControl:true,
        restriction:{latLngBounds: SA_BOUNDS, strictBounds:false}
      });
      marker=new google.maps.Marker({
        position:def,
        map,
        draggable:true,
        title:'اسحب أو اضغط لتحديد الموقع'
      });
      lastValidLatLng = def;

      const setPos = (latLng, pan = false) => {
        if (!latLng) return;

        if (areaPolygon && google.maps && google.maps.geometry && google.maps.geometry.poly && typeof google.maps.geometry.poly.containsLocation === 'function') {
          const inside = google.maps.geometry.poly.containsLocation(latLng, areaPolygon);
          if (!inside) {
            if (lastValidLatLng) {
              const last = (lastValidLatLng.lat && lastValidLatLng.lng)
                ? new google.maps.LatLng(lastValidLatLng.lat, lastValidLatLng.lng)
                : lastValidLatLng;
              marker.setPosition(last);
              map.panTo(last);
            }
            showToast('error','الخدمة متاحة فقط داخل المنطقة المحددة على الخريطة');
            return;
          }
        }

        marker.setPosition(latLng);
        if (pan){ map.panTo(latLng); }
        map.setZoom(17);

        positionUrl=`https://www.google.com/maps/search/?api=1&query=${latLng.lat()},${latLng.lng()}`;
        lastValidLatLng = latLng;

        const hint=document.getElementById('mapHint');
        if(hint) hint.innerHTML=`تم اختيار الموقع: <strong>${latLng.lat().toFixed(5)}, ${latLng.lng().toFixed(5)}</strong>`;
        renderSummary('page6'); updateNextAvailability();
      };

      marker.addListener('dragend',({latLng})=>setPos(latLng));
      map.addListener('click',({latLng})=>setPos(latLng,true));

      const input=document.getElementById('mapSearch');
      const opts={ fields:['geometry','name'], componentRestrictions:{country:'sa'}, strictBounds:false };
      autocomplete=new google.maps.places.Autocomplete(input, opts);
      autocomplete.bindTo('bounds', map);
      autocomplete.addListener('place_changed', ()=>{
        const place=autocomplete.getPlace(); if(!place?.geometry) return;
        const loc=place.geometry.location;
        map.panTo(loc); map.setZoom(16); setPos(loc,true);
      });

      const btn=document.getElementById('show-my-location');
      btn?.addEventListener('click',()=>{
        if(!navigator.geolocation){ showToast('error','المتصفح لا يدعم تحديد الموقع'); return; }
        navigator.geolocation.getCurrentPosition(
          pos=>setPos(new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude),true),
          err=>{ showToast('error','تعذر تحديد موقعك'); },
          { enableHighAccuracy:true, timeout:10000, maximumAge:30000 }
        );
      });

      if(pendingAreaForBounds){
        loadAreaBounds(pendingAreaForBounds);
        pendingAreaForBounds = null;
      } else {
        requestAreaBoundsForCurrentArea();
      }
    }
    window.initMap=initMap;
  </script>

  <!-- Google Maps (with geometry library) -->
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBBHLoO038vsCovHN-SLUgAXqexlA2v0_4&callback=initMap&v=weekly&loading=async&libraries=places,geometry&language=ar&region=SA" async defer></script>

  <!-- Analytics or extra script -->
  <script
    src="https://rybbit.nahls.app/api/script.js"
    data-site-id="6371ee910e9c"
    defer
  ></script>

  <!-- PWA Service Worker + Install logic -->
  <script>
    // ✅ Register Service Worker (relative path for subfolder)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker
          .register('service-worker.js')
          .then(function (reg) {
            console.log('Service worker registered 👍', reg.scope);
          })
          .catch(function (err) {
            console.error('Service worker registration failed:', err);
          });
      });
    }

    // ====== PWA Install Logic (Android + iOS) ======
    let deferredInstallPrompt = null;

    const floatingInstallBtn = document.getElementById('installPwaBtn');
    const footerInstallBtn   = document.getElementById('footer-install-btn');

    function isIos() {
      return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
    }

    function isInStandaloneMode() {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
      );
    }

    function showIosInstallInstructions() {
      alert(
        'لتثبيت NahlTime على جهازك:\n' +
        '1️⃣ اضغط زر "المشاركة" في أسفل سفاري.\n' +
        '2️⃣ اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).\n' +
        '3️⃣ بعد التثبيت افتح التطبيق من الأيقونة الجديدة ✅'
      );
    }

    async function handlePwaInstallClick() {
      if (isInStandaloneMode()) {
        console.log('App already running in standalone mode.');
        return;
      }

      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        console.log('User choice:', choice.outcome);
        deferredInstallPrompt = null;

        if (floatingInstallBtn) floatingInstallBtn.style.display = 'none';
        if (footerInstallBtn)   footerInstallBtn.style.display   = 'none';
        return;
      }

      if (isIos()) {
        showIosInstallInstructions();
        return;
      }

      alert('يمكنك تثبيت التطبيق من إعدادات المتصفح أو "إضافة إلى الشاشة الرئيسية".');
    }

    window.addEventListener('load', () => {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        if (floatingInstallBtn) {
          floatingInstallBtn.style.display = 'block';
          floatingInstallBtn.textContent = '📲 تثبيت تطبيق NahlTime';
        }
        if (footerInstallBtn) {
          footerInstallBtn.style.display = 'block';
          footerInstallBtn.textContent = '📲 تحميل التطبيق';
        }
      });

      if (floatingInstallBtn) {
        floatingInstallBtn.addEventListener('click', handlePwaInstallClick);
      }
      if (footerInstallBtn) {
        footerInstallBtn.addEventListener('click', handlePwaInstallClick);
      }

      // iOS: إظهار زر التثبيت + توست بسيط لو التطبيق غير مثبت
      if (isIos() && !isInStandaloneMode()) {
        if (footerInstallBtn) {
          footerInstallBtn.style.display   = 'block';
          footerInstallBtn.textContent     = '📲 تحميل التطبيق';
        }
        if (floatingInstallBtn) {
          floatingInstallBtn.style.display = 'block';
          floatingInstallBtn.textContent   = '📲 تثبيت تطبيق NahlTime';
        }

        // 🔔 إشعار بسيط عند الفتح يشرح طريقة التثبيت
        if (typeof showToast === 'function') {
          setTimeout(() => {
            showToast('info', '📲 تقدر تثبت NahlTime من زر "تحميل التطبيق" في الأسفل أو من مشاركة سفاري → إضافة إلى الشاشة الرئيسية');
          }, 2500);
        }
      } else if (!isInStandaloneMode()) {
        // لأغلب المتصفحات على أندرويد/ديسكتوب: توست توعوي بسيط
        if (typeof showToast === 'function') {
          setTimeout(() => {
            showToast('info', '📲 عند ظهور زر "تحميل التطبيق" في الأسفل تقدر تثبت NahlTime كتطبيق على جهازك');
          }, 2500);
        }
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('NahlTime installed ✅');
      if (floatingInstallBtn) floatingInstallBtn.style.display = 'none';
      if (footerInstallBtn)   footerInstallBtn.style.display   = 'none';
      if (typeof showToast === 'function') {
        showToast('success', 'تم تثبيت تطبيق NahlTime على جهازك ✅');
      }
    });

    // 👀 لو صار تحديث في الـ Service Worker → نعيد تحميل الصفحة مرة واحدة
    let hasRefreshedForNewSW = false;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshedForNewSW) return;
        hasRefreshedForNewSW = true;

        if (typeof showToast === 'function') {
          showToast('info', '🤍 تم تحديث التطبيق، سيتم إعادة تحميل الصفحة...');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          window.location.reload();
        }
      });
    }
  </script>

    <!-- ✅ Define handleLogoError early so onerror never fails -->
  <script>
    function handleLogoError(img){
      const fallbacks = [
        "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/Sponge%20%26%20%20Soap/spong&Soap%20-%20logo.png",
        "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/Sponge%20%26%20%20Soap/spong%26Soap%20-%20logo.png",
        "https://pdnmghkpepvsfaiqlafk.supabase.co/storage/v1/object/public/nahl%20assets/Sponge%20%26%20%20Soap/logo.png",
        "https://dummyimage.com/180x54/027A93/ffffff.png&text=Sponge+%26+Soap"
      ];
      const i = Number(img.dataset.fidx || 0);
      if (i < fallbacks.length){
        img.dataset.fidx = String(i + 1);
        img.src = fallbacks[i];
      } else {
        img.style.display = 'none';
      }
    }
  </script>

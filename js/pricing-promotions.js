// /js/pricing-promotions.js
// Additional services, coupons, payment methods, and offers

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

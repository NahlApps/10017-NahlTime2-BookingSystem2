const ADDITIONAL_SERVICES_API_URL =
  'https://demo.nahl.app/api/additional-services';

async function loadAdditionalServices() {
  const wrap = document.getElementById('additionalServicesWrap');
  if (!wrap) return;

  try {
    wrap.innerHTML = '<div class="text-muted small">جاري تحميل الخدمات الإضافية…</div>';

    const url = `${ADDITIONAL_SERVICES_API_URL}?appId=${encodeURIComponent(APP_ID)}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();
    additionalServicesList = Array.isArray(data.services) ? data.services : [];
    renderAdditionalServicesOptions();
  } catch (err) {
    console.error('loadAdditionalServices error:', err);
    if (wrap) {
      wrap.innerHTML =
        '<div class="text-danger small">تعذر تحميل الخدمات الإضافية الآن</div>';
    }
  }
}

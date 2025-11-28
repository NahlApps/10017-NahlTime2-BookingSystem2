// app-init.js
// High-level bootstrapping & DOM wiring for NahlTime booking form.
// Depends on globals defined in other modules (config-core, booking-core, etc).

(function () {
  'use strict';

  $(function () {
    // ============================
    //  Layout & basic setup
    // ============================
    if (typeof installResizeObservers === 'function') {
      installResizeObservers();
    }

    // Preload background images for smoother transitions
    if (typeof PAGE_BACKGROUNDS === 'object') {
      Object.values(PAGE_BACKGROUNDS).forEach(src => {
        const i = new Image();
        i.src = src;
      });
    }

    // ============================
    //  Select2 & phone input
    // ============================
    $('#area').select2({
      width: '100%',
      placeholder: 'اختر المنطقة لخدمة العناية الفاخرة',
      dir: 'rtl'
    });
    $('#serviceCat').select2({
      width: '100%',
      placeholder: 'فئة الخدمة',
      dir: 'rtl'
    });
    $('#service').select2({
      width: '100%',
      placeholder: 'باقتك المختارة',
      dir: 'rtl'
    });
    $('#carBrand').select2({
      width: '100%',
      placeholder: 'اختر ماركة المركبة (الأسماء الفاخرة أولاً)',
      dir: 'rtl'
    });

    $('#area, #serviceCat, #service, #carBrand').on('select2:open', () => {
      $('.select2-search__field').attr('dir', 'rtl');
    });

    // Intl Tel Input for mobile
    window.itiPhone = window.intlTelInput(document.querySelector('#mobile'), {
      initialCountry: 'sa',
      onlyCountries: ['sa', 'ae', 'bh', 'kw', 'om', 'qa'],
      separateDialCode: true,
      placeholderNumberType: 'MOBILE',
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@24.4.0/build/js/utils.js'
    });

    $('#mobile')
      .attr({
        placeholder: 'رقم التواصل الخاص — مثال 5XXXXXXXX',
        inputmode: 'tel',
        autocomplete: 'tel'
      })
      .on('blur', () => {
        const ok = window.itiPhone && window.itiPhone.isValidNumber();
        const err = document.getElementById('err-mobile');
        if (err) err.style.display = ok ? 'none' : 'block';
      });

    // Placeholders
    $('#name').attr('placeholder', 'الاسم كما سيظهر في الفاتورة');
    $('#carName').attr('placeholder', 'الموديل/الفئة — مثال: S-Class، LX 570');
    $('#plateNumber').attr('placeholder', 'أرقام اللوحة — اختياري');

    // ============================
    //  Date defaults
    // ============================
    if (window.DateTime) {
      const today = DateTime.now().toFormat('yyyy-LL-dd');
      $('#date').val(today).attr('min', today);
    }

    // ============================
    //  Load locations & services
    // ============================
    if (typeof setLoadingServices === 'function') {
      setLoadingServices(true);
    }

    if (typeof callContent2 === 'function') {
      callContent2(`/locat

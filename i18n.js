// i18n.js
// ===============================
// بسيط لإدارة الترجمة (AR/EN) خارج app.js
// ===============================
(function () {
  // 🧾 قاموس النصوص
  // عدّل النصوص كما تحب، وأضف مفاتيح حسب ما تضعه في data-i18n
  const translations = {
    ar: {
      // Header
      'header.brandLine1': 'Sponge & Soap',
      'header.brandLine2': 'خدمة غسيل سيارات فاخرة حتى باب بيتك',
      'header.stepLabel': 'الخطوة',

      // Footer
      'footer.totalLabel': 'إجمالي الطلب:',
      'footer.prev': 'السابق',
      'footer.next': 'التالي',
      'footer.wait': 'جاري إنشاء الحجز...',
      'footer.rebook': 'بدء حجز جديد',

      // Page 1
      'page1.title': 'اهلاً بك في Sponge & Soap',
      'page1.subtitle': 'نغسل سيارتك بلمسة فاخرة أينما كنت',
      'page1.offersButton': 'عروض اليوم',

      // Page 2 (الخدمة)
      'page2.title': 'اختيار المنطقة والخدمة',
      'label.area': 'المنطقة',
      'label.serviceCat': 'فئة الخدمة',
      'label.service': 'الباقة',
      'label.serviceCount': 'عدد السيارات',
      'label.additionalServices': 'خدمات إضافية',

      // Gift
      'gift.title': 'هذه الحجز كـ هدية؟',
      'gift.toggleLabel': 'تحويل الحجز إلى هدية',
      'gift.receiverName': 'اسم المستلم',
      'gift.receiverMobile': 'رقم جوال المستلم',
      'gift.receiverCountry': 'مفتاح الدولة',
      'gift.message': 'رسالة مرفقة (اختياري)',

      // Page 3 (الوقت)
      'page3.title': 'اختر اليوم والوقت',
      'label.date': 'اليوم',
      'label.timeFilter': 'فترة اليوم',

      // Page 4 (البيانات)
      'page4.title': 'بياناتك الأساسية',
      'label.name': 'الاسم',
      'label.mobile': 'رقم الجوال',
      'label.carBrand': 'ماركة المركبة',
      'label.carName': 'الموديل / الفئة',
      'label.plateNumber': 'أرقام اللوحة (اختياري)',

      // Page 5 (الدفع)
      'page5.title': 'اختر طريقة الدفع',
      'label.coupon': 'كود الخصم',
      'btn.applyCoupon': 'تطبيق الكوبون',

      // Page 6 (الموقع)
      'page6.title': 'حدد موقعك على الخريطة',
      'label.mapSearch': 'ابحث عن عنوانك',

      // Page 7 (تم)
      'page7.title': 'تم إنشاء الحجز بنجاح 🎉',
      'page7.subtitle': 'ستصلك رسالة تأكيد بتفاصيل حجزك',
    },

    en: {
      // Header
      'header.brandLine1': 'Sponge & Soap',
      'header.brandLine2': 'Premium car wash at your doorstep',
      'header.stepLabel': 'Step',

      // Footer
      'footer.totalLabel': 'Order total:',
      'footer.prev': 'Previous',
      'footer.next': 'Next',
      'footer.wait': 'Creating your booking...',
      'footer.rebook': 'Start a new booking',

      // Page 1
      'page1.title': 'Welcome to Sponge & Soap',
      'page1.subtitle': 'Luxury car wash wherever you are',
      'page1.offersButton': 'Today’s offers',

      // Page 2 (Service)
      'page2.title': 'Choose Area & Service',
      'label.area': 'Area',
      'label.serviceCat': 'Service category',
      'label.service': 'Package',
      'label.serviceCount': 'Number of cars',
      'label.additionalServices': 'Additional services',

      // Gift
      'gift.title': 'Is this booking a gift?',
      'gift.toggleLabel': 'Turn booking into a gift',
      'gift.receiverName': 'Recipient name',
      'gift.receiverMobile': 'Recipient mobile',
      'gift.receiverCountry': 'Country code',
      'gift.message': 'Gift message (optional)',

      // Page 3 (Time)
      'page3.title': 'Choose date & time',
      'label.date': 'Date',
      'label.timeFilter': 'Time of day',

      // Page 4 (Details)
      'page4.title': 'Your details',
      'label.name': 'Full name',
      'label.mobile': 'Mobile number',
      'label.carBrand': 'Car brand',
      'label.carName': 'Model / trim',
      'label.plateNumber': 'Plate number (optional)',

      // Page 5 (Payment)
      'page5.title': 'Payment method',
      'label.coupon': 'Coupon code',
      'btn.applyCoupon': 'Apply coupon',

      // Page 6 (Location)
      'page6.title': 'Set your location on the map',
      'label.mapSearch': 'Search your address',

      // Page 7 (Done)
      'page7.title': 'Booking created successfully 🎉',
      'page7.subtitle': 'You will receive a confirmation message shortly',
    }
  };

  let currentLang = 'ar';

  function detectInitialLang() {
    try {
      // ?lang=ar|en
      const params = new URLSearchParams(window.location.search || '');
      const fromQuery = (params.get('lang') || '').toLowerCase();
      if (fromQuery === 'en' || fromQuery === 'ar') return fromQuery;

      // <html lang="...">
      const htmlLang = (document.documentElement.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('ar')) return 'ar';

      // افتراضي عربي
      return 'ar';
    } catch (e) {
      return 'ar';
    }
  }

  function applyLanguage(lang) {
    if (lang !== 'en' && lang !== 'ar') lang = 'ar';
    currentLang = lang;
    const isEn = lang === 'en';
    const dict = translations[lang] || {};

    // تحديث lang/dir في html
    document.documentElement.lang = isEn ? 'en' : 'ar';
    document.documentElement.dir  = isEn ? 'ltr' : 'rtl';

    // ربط مع nForm الموجودة في app.js عشان isEnglishLocale() يشتغل صح
    if (window.nForm) {
      window.nForm.locale = lang;
    }

    // تغيير العناصر اللي فيها data-i18n
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const txt = dict[key];
      if (typeof txt === 'string') {
        el.textContent = txt;
      }
    });

    // تغيير placeholder للعناصر اللي فيها data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const txt = dict[key];
      if (typeof txt === 'string') {
        el.setAttribute('placeholder', txt);
      }
    });

    // تحديث لسان الزر
    const labelEl = document.getElementById('langToggleLabel');
    if (labelEl) {
      labelEl.textContent = isEn ? 'EN' : 'AR';
    }

    // إعادة رسم بعض العناصر اللي تعتمد على اللغة
    if (typeof window.renderSummary === 'function') {
      window.renderSummary();
    }
    if (typeof window.updateNextAvailability === 'function') {
      window.updateNextAvailability();
    }
    if (typeof window.syncProgress === 'function' && typeof window.getActiveIndex === 'function') {
      window.syncProgress(window.getActiveIndex());
    }
  }

  function toggleLanguage() {
    applyLanguage(currentLang === 'ar' ? 'en' : 'ar');
  }

  // نعرّض API بسيطة عالمستوى العام
  window.i18n = {
    applyLanguage,
    toggleLanguage,
    getCurrentLanguage: () => currentLang,
    translations
  };

  // تشغيل تلقائي بعد تحميل DOM
  document.addEventListener('DOMContentLoaded', function () {
    const initial = detectInitialLang();
    applyLanguage(initial);

    const btn = document.getElementById('langToggleBtn');
    if (btn) {
      btn.addEventListener('click', toggleLanguage);
    }
  });
})();

// i18n.js
(function () {
  const I18N_STORAGE_KEY = 'nahl_lang';

  // 🔤 Translations dictionary
  const translations = {
    ar: {
      // Meta
      'meta.title': 'حجوزات المواعيد',

      // Header
      'header.logoAlt': 'Nahl Time - حجوزات المواعيد',
      'header.stepWelcome': 'الترحيب',
      'header.langToggleTitle': 'تغيير اللغة',
      'header.langToggleAria': 'تغيير اللغة',

      // Page 1 - Welcome
      'page1.title': '✨ غسيل بدون طوابير',
      'page1.slide1.title': 'نجيك لين باب بيتك',
      'page1.slide1.body': 'حجز سريع • خدمة متنقلة • احترافية في كل تفصيل',
      'page1.slide2.title': 'مواد فاخرة',
      'page1.slide2.body': 'منتجات آمنة على الطلاء والداخلية مع عناية دقيقة',
      'page1.slide3.title': 'موعدك على راحتك',
      'page1.slide3.body': 'حدد المنطقة والخدمة والوقت المناسب — والباقي علينا',
      'page1.offersButton': 'عروض اليوم',
      'page1.nextHint': 'انطلق — الخطوة التالية لاختيار المنطقة والخدمة',

      // Page 2 - Service & Area
      'page2.ariaLabel': 'اختيار المنطقة والخدمة',
      'page2.title': 'وين تحب نجيك؟',
      'page2.areaLabel': 'اختيار المنطقة',
      'page2.categoryLabel': 'التصنيف',
      'page2.serviceLabel': 'الخدمة',
      'page2.serviceDetailsLabel': 'تفاصيل الخدمة',
      'page2.serviceDetailsPlaceholder': 'سيتم عرض تفاصيل الخدمة المختارة هنا.',
      'page2.servicePriceLabel': 'سعر الخدمة (شامل الضريبة)',
      'page2.countLabel': 'عدد السيارات',
      'page2.additionalLabel': 'خدمات إضافية (اختياري)',
      'page2.additionalLoading': 'جاري تحميل الخدمات الإضافية…',
      'page2.giftLabel': 'هل ترغب بإرسال الخدمة كـ هدية؟',
      'page2.giftToggleText': 'نعم، أريد إرسالها كهدية لصديق',
      'page2.giftHint':
        'عند اختيار الهدية، نستلم بياناتك وبيانات المستلم، وتصل له رسالة خاصة مع رابط الحجز وكوبون الهدية.',

      // Page 3 - Time
      'page3.ariaLabel': 'اختيار الموعد',
      'page3.title': 'متى تحب نجيك؟',
      'page3.dateLabel': 'التاريخ',
      'page3.timeFilterLabel': 'فلترة الوقت',
      'page3.timeFilter.all': 'كل الأوقات المتاحة',
      'page3.timeFilter.morning': 'الصباح (06:00–11:00)',
      'page3.timeFilter.afternoon': 'الظهيرة (11:00–16:00)',
      'page3.timeFilter.evening': 'المساء (16:00–21:00)',
      'page3.timeFilter.night': 'ليلًا (21:00–23:59)',
      'page3.timeGroupAria': 'اختيار الوقت',

      // Page 4 - Contact
      'page4.ariaLabel': 'معلومات الاتصال',
      'page4.title': 'معلومات الاتصال',
      'page4.nameLabel': 'الاسم',
      'page4.namePlaceholder': 'الاسم كما سيظهر في الفاتورة',
      'page4.mobileLabel': 'رقم الجوال',
      'page4.mobilePlaceholder': 'رقم التواصل الخاص — مثال 5XXXXXXXX',
      'page4.otpSendBtn': 'إرسال كود على واتساب',
      'page4.otpStatus':
        'سيتم إرسال كود من 4 أرقام للتحقق من رقمك عبر واتساب.',
      'page4.otpPlaceholder': 'أدخل كود التحقق (4 أرقام)',
      'page4.otpVerifyBtn': 'تأكيد',

      // Gift block
      'gift.title': 'بيانات المستلم (الهدية)',
      'gift.nameLabel': 'اسم المستلم',
      'gift.namePlaceholder': 'اسم الشخص الذي ستصل له الهدية',
      'gift.mobileLabel': 'جوال المستلم',
      'gift.mobilePlaceholder': '5XXXXXXXX',
      'gift.mobileHint': 'سيتم إرسال الهدية لهذا الرقم عبر واتساب.',
      'gift.messageLabel': 'رسالة مرافقة للهدية (اختياري)',
      'gift.messagePlaceholder':
        'أكتب رسالة لطيفة تظهر للمستلم مع رابط الحجز وكوبون الهدية',

      // Car info
      'page4.carAria': 'معلومات المركبة',
      'car.title': 'معلومات المركبة',
      'car.brandLabel': 'ماركة السيارة 🚘',
      'car.nameLabel': 'اسم السيارة',
      'car.namePlaceholder': 'الموديل/الفئة — مثال: S-Class، LX 570',
      'car.plateLabel': 'رقم اللوحة (اختياري)',
      'car.platePlaceholder': 'أرقام اللوحة — اختياري',
      'car.plateHint':
        'اختياري — يساعد فريقنا على التعرف على مركبتك بسرعة',

      // Page 5 - Payment
      'page5.ariaLabel': 'طريقة الدفع',
      'page5.title': 'طريقة الدفع',
      'page5.payGroupAria': 'طريقة الدفع',

      // Coupon
      'coupon.label': 'كود الخصم (اختياري)',
      'coupon.placeholder': 'مثال: WELCOME10',
      'coupon.applyBtn': 'تطبيق الكوبون',
      'coupon.message':
        'يمكنك إدخال كوبون خصم إن وجد، وسيتم تطبيقه على إجمالي الطلب.',

      // Page 6 - Map
      'page6.ariaLabel': 'اختيار الموقع',
      'page6.title': 'الموقع على خريطة قوقل',
      'page6.mapPlaceholder': 'ابحث عن برج، حي، أو عنوان داخل السعودية',
      'page6.showMyLocation': 'إظهار موقعي',
      'page6.hint':
        'اضغط على الخريطة لوضع الدبوس، اسحب الدبوس لتعديل المكان، أو استخدم زر 📍 داخل الخريطة لتحديد موقعك الحالي.',

      // Page 7 - Done
      'page7.ariaLabel': 'تم الحجز',
      'page7.title': 'شكراً لكم 🌟',
      'page7.subtitle':
        'تم استلام طلبكم، وسنؤكد الموعد على واتساب قريبًا.',
      'page7.shareWhatsapp': 'مشاركة عبر واتساب',
      'page7.rebookBtn': '🔁 حجز جديد',

      // Summary
      'summary.area': 'المنطقة',
      'summary.service': 'الخدمة',
      'summary.datetime': 'الموعد',
      'summary.payMethod': 'طريقة الدفع',

      // Offers
      'offers.title': 'عروض اليوم',
      'offers.closeAria': 'إغلاق العروض',
      'offers.filterAll': 'الكل',
      'offers.filterImage': 'صور',
      'offers.filterText': 'نصوص',
      'offers.filterCoupon': 'كوبونات',
      'offers.loading': 'جاري تحميل العروض…',

      // Terms
      'terms.title': 'الشروط والأحكام',
      'terms.closeAria': 'إغلاق الشروط',
      'terms.loading': 'جاري تحميل الشروط والأحكام…',
      'terms.cancel': 'إلغاء',
      'terms.accept': 'أوافق على الشروط',

      // Footer
      'footer.ariaLabel': 'التنقل بين الخطوات',
      'footer.brand': 'نحل • <a href="https://nahl.app" target="_blank" rel="noopener">Nahl.app</a>',
      'footer.totalLabel': 'إجمالي الطلب:',
      'footer.prev': 'السابق',
      'footer.next': 'تخطي العرض',
      'footer.installAria': 'تثبيت تطبيق NahlTime',
      'footer.installTitle': 'تثبيت تطبيق NahlTime',
      'footer.wait': 'يتم إرسال الطلب…',
      'footer.installFloating': '📲 تثبيت تطبيق NahlTime',

      // Errors
      'errors.area': 'يرجى اختيار المنطقة',
      'errors.serviceCat': 'يرجى اختيار التصنيف',
      'errors.service': 'يرجى اختيار الخدمة',
      'errors.date': 'يرجى اختيار تاريخ صحيح',
      'errors.name': 'يرجى إدخال الاسم',
      'errors.mobile': 'الرجاء إدخال رقم جوال صحيح',
      'errors.otp': 'يرجى إدخال كود التحقق الصحيح',
      'errors.giftName': 'يرجى إدخال اسم المستلم',
      'errors.giftMobile': 'يرجى إدخال جوال المستلم',
      'errors.pay': 'يرجى اختيار طريقة الدفع',
      'errors.map': 'الرجاء تحديد الموقع على الخريطة'
    },

    en: {
      // Meta
      'meta.title': 'Appointment Booking',

      // Header
      'header.logoAlt': 'Nahl Time - Appointment Booking',
      'header.stepWelcome': 'Welcome',
      'header.langToggleTitle': 'Change language',
      'header.langToggleAria': 'Change language',

      // Page 1 - Welcome
      'page1.title': '✨ Car wash without queues',
      'page1.slide1.title': 'We come right to your door',
      'page1.slide1.body': 'Fast booking • Mobile service • Professional in every detail',
      'page1.slide2.title': 'Premium materials',
      'page1.slide2.body':
        'Safe products for paint and interior with careful attention',
      'page1.slide3.title': 'Your time, your choice',
      'page1.slide3.body':
        'Choose your area, service, and preferred time — we handle the rest',
      'page1.offersButton': "Today's offers",
      'page1.nextHint':
        'Let’s start — next step is to choose area and service',

      // Page 2 - Service & Area
      'page2.ariaLabel': 'Select area and service',
      'page2.title': 'Where should we come?',
      'page2.areaLabel': 'Select area',
      'page2.categoryLabel': 'Category',
      'page2.serviceLabel': 'Service',
      'page2.serviceDetailsLabel': 'Service details',
      'page2.serviceDetailsPlaceholder':
        'Details of the selected service will appear here.',
      'page2.servicePriceLabel': 'Service price (VAT included)',
      'page2.countLabel': 'Number of cars',
      'page2.additionalLabel': 'Additional services (optional)',
      'page2.additionalLoading': 'Loading additional services…',
      'page2.giftLabel': 'Send this as a gift?',
      'page2.giftToggleText': 'Yes, I want to send it as a gift',
      'page2.giftHint':
        'When gift mode is on, we take your details and the recipient details. They receive a special WhatsApp message with booking link and gift coupon.',

      // Page 3 - Time
      'page3.ariaLabel': 'Select appointment time',
      'page3.title': 'When would you like us to come?',
      'page3.dateLabel': 'Date',
      'page3.timeFilterLabel': 'Time filter',
      'page3.timeFilter.all': 'All available times',
      'page3.timeFilter.morning': 'Morning (06:00–11:00)',
      'page3.timeFilter.afternoon': 'Afternoon (11:00–16:00)',
      'page3.timeFilter.evening': 'Evening (16:00–21:00)',
      'page3.timeFilter.night': 'Night (21:00–23:59)',
      'page3.timeGroupAria': 'Choose time slot',

      // Page 4 - Contact
      'page4.ariaLabel': 'Contact information',
      'page4.title': 'Contact information',
      'page4.nameLabel': 'Name',
      'page4.namePlaceholder': 'Name as it will appear on invoice',
      'page4.mobileLabel': 'Mobile number',
      'page4.mobilePlaceholder': 'Your contact number – e.g. 5XXXXXXXX',
      'page4.otpSendBtn': 'Send code via WhatsApp',
      'page4.otpStatus':
        'A 4-digit code will be sent via WhatsApp to verify your number.',
      'page4.otpPlaceholder': 'Enter 4-digit verification code',
      'page4.otpVerifyBtn': 'Verify',

      // Gift block
      'gift.title': 'Recipient details (gift)',
      'gift.nameLabel': 'Recipient name',
      'gift.namePlaceholder': 'The person who will receive the gift',
      'gift.mobileLabel': 'Recipient mobile',
      'gift.mobilePlaceholder': '5XXXXXXXX',
      'gift.mobileHint':
        'The gift link will be sent to this number via WhatsApp.',
      'gift.messageLabel': 'Gift message (optional)',
      'gift.messagePlaceholder':
        'Write a nice message to show with the booking link and gift coupon',

      // Car info
      'page4.carAria': 'Vehicle information',
      'car.title': 'Vehicle information',
      'car.brandLabel': 'Car brand 🚘',
      'car.nameLabel': 'Car model/name',
      'car.namePlaceholder': 'Model / trim — e.g. S-Class, LX 570',
      'car.plateLabel': 'Plate number (optional)',
      'car.platePlaceholder': 'Plate digits — optional',
      'car.plateHint':
        'Optional — helps our team identify your vehicle quickly',

      // Page 5 - Payment
      'page5.ariaLabel': 'Payment method',
      'page5.title': 'Payment method',
      'page5.payGroupAria': 'Choose payment method',

      // Coupon
      'coupon.label': 'Discount code (optional)',
      'coupon.placeholder': 'Example: WELCOME10',
      'coupon.applyBtn': 'Apply code',
      'coupon.message':
        'If you have a coupon code, enter it here and it will be applied to the total.',

      // Page 6 - Map
      'page6.ariaLabel': 'Choose location',
      'page6.title': 'Location on Google Maps',
      'page6.mapPlaceholder': 'Search for tower, district, or address in Saudi Arabia',
      'page6.showMyLocation': 'Show my location',
      'page6.hint':
        'Tap on the map to place the pin, drag to adjust, or use the 📍 button inside the map to detect your current location.',

      // Page 7 - Done
      'page7.ariaLabel': 'Booking completed',
      'page7.title': 'Thank you 🌟',
      'page7.subtitle':
        'Your request has been received. We will confirm your appointment via WhatsApp shortly.',
      'page7.shareWhatsapp': 'Share on WhatsApp',
      'page7.rebookBtn': '🔁 New booking',

      // Summary
      'summary.area': 'Area',
      'summary.service': 'Service',
      'summary.datetime': 'Date & time',
      'summary.payMethod': 'Payment method',

      // Offers
      'offers.title': "Today's offers",
      'offers.closeAria': 'Close offers',
      'offers.filterAll': 'All',
      'offers.filterImage': 'Images',
      'offers.filterText': 'Text',
      'offers.filterCoupon': 'Coupons',
      'offers.loading': 'Loading offers…',

      // Terms
      'terms.title': 'Terms & Conditions',
      'terms.closeAria': 'Close terms',
      'terms.loading': 'Loading terms and conditions…',
      'terms.cancel': 'Cancel',
      'terms.accept': 'I agree to the terms',

      // Footer
      'footer.ariaLabel': 'Step navigation',
      'footer.brand': 'Nahl • <a href="https://nahl.app" target="_blank" rel="noopener">Nahl.app</a>',
      'footer.totalLabel': 'Order total:',
      'footer.prev': 'Previous',
      'footer.next': 'Next',
      'footer.installAria': 'Install NahlTime app',
      'footer.installTitle': 'Install NahlTime app',
      'footer.wait': 'Sending your request…',
      'footer.installFloating': '📲 Install NahlTime app',

      // Errors
      'errors.area': 'Please select an area',
      'errors.serviceCat': 'Please select a category',
      'errors.service': 'Please select a service',
      'errors.date': 'Please choose a valid date',
      'errors.name': 'Please enter your name',
      'errors.mobile': 'Please enter a valid mobile number',
      'errors.otp': 'Please enter a valid verification code',
      'errors.giftName': 'Please enter the recipient name',
      'errors.giftMobile': 'Please enter the recipient mobile number',
      'errors.pay': 'Please choose a payment method',
      'errors.map': 'Please select a location on the map'
    }
  };

  // 🧠 Helpers
  function getInitialLang() {
    const params = new URLSearchParams(window.location.search || '');
    const urlLang = params.get('lang');
    if (urlLang && (urlLang.toLowerCase() === 'en' || urlLang.toLowerCase() === 'ar')) {
      return urlLang.toLowerCase();
    }

    const stored = localStorage.getItem(I18N_STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;

    return (document.documentElement.getAttribute('data-lang-default') || 'ar').toLowerCase();
  }

  function setDirAndLang(lang) {
    const isAr = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-lang', lang);
  }

  function applyText(lang) {
    const dict = translations[lang] || translations.ar;

    // Elements with data-i18n (innerText)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = dict[key];
      if (val !== undefined) {
        // Some footer brand content contains HTML
        if (key === 'footer.brand') {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = dict[key];
      if (val !== undefined) {
        el.setAttribute('placeholder', val);
      }
    });

    // aria-label
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      const val = dict[key];
      if (val !== undefined) {
        el.setAttribute('aria-label', val);
      }
    });

    // title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = dict[key];
      if (val !== undefined) {
        el.setAttribute('title', val);
      }
    });

    // alt
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      const val = dict[key];
      if (val !== undefined) {
        el.setAttribute('alt', val);
      }
    });

    // 🔄 Page <title>
    const metaTitle = dict['meta.title'];
    if (metaTitle) {
      document.title = metaTitle;
    }

    // 🌐 Update lang toggle pill text
    const labelSpan = document.getElementById('langToggleLabel');
    if (labelSpan) {
      labelSpan.textContent = lang === 'ar' ? 'ع' : 'EN';
    }
  }

  function applyLanguage(lang) {
    setDirAndLang(lang);
    applyText(lang);
  }

  // 🚀 Init on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    const lang = getInitialLang();
    applyLanguage(lang);

    // Store for next visit
    localStorage.setItem(I18N_STORAGE_KEY, lang);

    // Attach toggle handler
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        const current = document.documentElement.lang === 'en' ? 'en' : 'ar';
        const next = current === 'en' ? 'ar' : 'en';
        localStorage.setItem(I18N_STORAGE_KEY, next);

        // Optional: update ?lang= in URL without reload
        const params = new URLSearchParams(window.location.search || '');
        params.set('lang', next);
        const newUrl =
          window.location.origin +
          window.location.pathname +
          '?' +
          params.toString();
        window.history.replaceState({}, '', newUrl);

        applyLanguage(next);
      });
    }
  });
})();

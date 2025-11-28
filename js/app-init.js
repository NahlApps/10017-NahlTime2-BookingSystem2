// app-init.js
// High-level bootstrapping & DOM wiring for NahlTime booking form.
// Depends on globals defined in other modules (config-core, booking-core, pricing-promotions, etc).

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
      callContent2(`/locations`, res => {
        const list = res?.data || [];
        const ds = list.map(l => ({
          id: l.id,
          text: l.TS_location_arabic_name
        }));

        $('#area')
          .empty()
          .select2({
            data: ds,
            width: '100%',
            placeholder: 'اختر المنطقة لخدمة العناية الفاخرة',
            dir: 'rtl'
          });

        if (ds.length) {
          $('#area').val(ds[0].id).trigger('change');
        } else {
          if (typeof setLoadingServices === 'function') {
            setLoadingServices(false);
          }
          if (typeof showToast === 'function') {
            showToast('error', 'لا توجد مناطق متاحة حالياً');
          }
        }

        if (typeof renderSummary === 'function') {
          renderSummary('page2');
        }
      });
    }

    // ============================
    //  Area → services dependencies
    // ============================
    $('#area').on('change', function () {
      if (window.nForm) {
        window.nForm.location = this.value;
      }

      if (typeof requestAreaBoundsForCurrentArea === 'function') {
        requestAreaBoundsForCurrentArea();
      }

      if (typeof setLoadingServices === 'function') {
        setLoadingServices(true);
      }

      if (typeof callContent2 === 'function') {
        callContent2(
          `/services?location=${encodeURIComponent(this.value)}`,
          res => {
            window.servicesCache = res?.data?.services || [];
            window.categoriesCache = res?.data?.servicesCat || [];

            const cats = (window.categoriesCache || []).map(c => ({
              id: c.TS_category_id,
              text: c.TS_category_arabic_name
            }));

            $('#serviceCat')
              .empty()
              .select2({
                data: cats,
                width: '100%',
                placeholder: 'فئة الخدمة',
                dir: 'rtl'
              });

            if (cats.length) {
              $('#serviceCat').val(cats[0].id).trigger('change');
            }

            if (typeof setLoadingServices === 'function') {
              setLoadingServices(false);
            }
            if (typeof renderSummary === 'function') {
              renderSummary('page2');
            }
            if (typeof updateNextAvailability === 'function') {
              updateNextAvailability();
            }
          },
          true
        );
      }
    });

    $('#serviceCat').on('change', function () {
      if (window.nForm) {
        window.nForm.serviceCat = this.value;
      }

      const cid = Number(this.value);
      const items =
        (window.servicesCache || [])
          .filter(s => Number(s.TS_category_id) === cid)
          .sort((a, b) => a.TS_service_id - b.TS_service_id)
          .map(s => ({
            id: s.TS_service_id,
            text: s.TS_service_arabic_name
          })) || [];

      $('#service')
        .empty()
        .select2({
          data: items,
          width: '100%',
          placeholder: 'باقتك المختارة',
          dir: 'rtl'
        });

      if (items.length) {
        $('#service').val(items[0].id).trigger('change');
      }

      if (typeof renderSummary === 'function') {
        renderSummary('page2');
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });

    // ============================
    //  Service change → desc + price
    // ============================
    $('#service').on('change', function () {
      if (window.nForm) {
        window.nForm.service = this.value || '';
      }

      const selectedId = this.value ? String(this.value) : '';
      let selectedService = null;

      if (Array.isArray(window.servicesCache)) {
        selectedService = window.servicesCache.find(
          s => String(s.TS_service_id) === selectedId
        );
      }

      const descBox = document.getElementById('serviceDetails');
      if (descBox) {
        const desc = selectedService && typeof getServiceDescription === 'function'
          ? getServiceDescription(selectedService)
          : '';

        if (desc) {
          descBox.textContent = desc;
        } else {
          const isEnglish =
            typeof isEnglishLocale === 'function' && isEnglishLocale();
          descBox.textContent = isEnglish
            ? 'No details are available for this service yet.'
            : 'لا توجد تفاصيل متاحة لهذه الخدمة حاليًا.';
        }
      }

      const priceBox = document.getElementById('servicePrice');
      if (priceBox) {
        const priceRaw = selectedService ? selectedService.TS_service_final_price : '';

        // 🔧 IMPORTANT: update the SAME global used in getOrderSubtotal()
        // (declared in pricing-promotions.js as `let baseServicePrice = 0;`)
        baseServicePrice = !isNaN(Number(priceRaw))
          ? Number(priceRaw)
          : 0;

        const priceText =
          typeof formatServicePrice === 'function'
            ? formatServicePrice(priceRaw)
            : priceRaw;
        priceBox.textContent = priceText || '—';
      } else {
        // fallback if price container missing
        baseServicePrice = 0;
      }

      if (typeof renderSummary === 'function') {
        renderSummary('page2');
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
      if (typeof updateFooterTotal === 'function') {
        updateFooterTotal();
      }
    });

    // ============================
    //  Car brands list
    // ============================
    const luxuryFirstBrands = [
      'Rolls-Royce',
      'Bentley',
      'Mercedes-Benz (Maybach)',
      'Aston Martin',
      'Ferrari',
      'Lamborghini',
      'McLaren',
      'Maserati',
      'Porsche',
      'Land Rover (Range Rover)',
      'Mercedes-Benz',
      'BMW',
      'Audi',
      'Lexus',
      'Genesis',
      'Jaguar',
      'Cadillac',
      'Infiniti',
      'GMC',
      'Toyota',
      'Nissan',
      'Hyundai',
      'Kia',
      'Honda',
      'Chevrolet',
      'Ford',
      'Mazda',
      'Mitsubishi',
      'Other'
    ].map(b => ({ id: b, text: b }));

    $('#carBrand')
      .empty()
      .select2({
        data: luxuryFirstBrands,
        width: '100%',
        placeholder: 'اختر ماركة المركبة (الأسماء الفاخرة أولاً)',
        dir: 'rtl'
      });

    // ============================
    //  Basic input bindings
    // ============================
    $('#name').on('input', function () {
      if (window.nForm) {
        window.nForm.customerN = this.value.trim();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });

    $('#mobile').on('input', function () {
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      if (window.OTP_ENABLED && typeof resetOtpState === 'function') {
        resetOtpState(false);
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });

    $('#carName').on('input', function () {
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });

    $('#serviceCount').on('change', function () {
      if (window.nForm) {
        window.nForm.serviceCount = this.value || '1';
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page2');
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
      if (typeof updateFooterTotal === 'function') {
        updateFooterTotal();
      }
    });

    $('#plateNumber').on('input', function () {
      if (typeof updatePlateHint === 'function') {
        updatePlateHint();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page4');
      }
      if (typeof updateNextAvailability === 'function') {
        updateNextAvailability();
      }
    });

    $('#date').on('change', () => {
      if (typeof fetchTimesForSelectedDate === 'function') {
        fetchTimesForSelectedDate();
      }
      if (typeof renderSummary === 'function') {
        renderSummary('page3');
      }
    });

    $('#timeFilter').on('change', function () {
      window.currentTimeFilter = this.value;
      if (typeof renderSelectedDateTimes === 'function') {
        renderSelectedDateTimes(window.lastSelectedISO);
      }
    });

    // ============================
    //  Footer navigation (Next/Prev)
    // ============================
    const $prev = document.getElementById('footer-prev');
    const $next = document.getElementById('footer-next');

    async function gotoNext() {
      if (typeof handleNextStep === 'function') {
        await handleNextStep();
        return;
      }
      console.warn(
        '[app-init] handleNextStep() not found. Next button will not progress steps.'
      );
    }

    if ($next) {
      $next.addEventListener('click', gotoNext);
    }
    if ($prev) {
      $prev.addEventListener('click', () => {
        if (typeof getActiveIndex === 'function' && typeof showPage === 'function') {
          const i = getActiveIndex();
          showPage(Math.max(i - 1, 0));
        }
      });
    }

    // ============================
    //  Re-book action
    // ============================
    $('#rebook').on('click', () => {
      window.location.href = 'index.html';
    });

    // ============================
    //  Coupons
    // ============================
    const applyBtn = document.getElementById('applyCouponBtn');
    if (applyBtn && typeof validateCouponAndApply === 'function') {
      applyBtn.addEventListener('click', validateCouponAndApply);
    }

    // ============================
    //  OTP wiring
    // ============================
    if (window.OTP_ENABLED) {
      const otpControls = document.getElementById('otpControls');
      const verifyRow = document.getElementById('otpVerifyRow');

      if (otpControls) otpControls.style.display = 'flex';
      if (verifyRow) verifyRow.style.display = 'none';

      const btnSendOtp = document.getElementById('btnSendOtp');
      const btnVerifyOtp = document.getElementById('btnVerifyOtp');

      if (btnSendOtp && typeof requestOtpForMobile === 'function') {
        btnSendOtp.addEventListener('click', requestOtpForMobile);
      }
      if (btnVerifyOtp && typeof verifyOtpCode === 'function') {
        btnVerifyOtp.addEventListener('click', verifyOtpCode);
      }

      if (typeof resetOtpState === 'function') {
        resetOtpState(true);
      }
    } else {
      const otpControls = document.getElementById('otpControls');
      const verifyRow = document.getElementById('otpVerifyRow');
      const errOtp = document.getElementById('err-otp');
      if (otpControls) otpControls.style.display = 'none';
      if (verifyRow) verifyRow.style.display = 'none';
      if (errOtp) errOtp.style.display = 'none';
    }

    // ============================
    //  Dynamic data: extras, pay, offers, terms
    // ============================
    if (typeof loadAdditionalServices === 'function') {
      loadAdditionalServices();
    }
    if (typeof loadPaymentMethods === 'function') {
      loadPaymentMethods();
    }
    if (typeof wireOffersUI === 'function') {
      wireOffersUI();
    }
    if (typeof wireTermsModal === 'function') {
      wireTermsModal();
    }

    // ============================
    //  Initial page state & intro
    // ============================
    if (typeof setPageBackground === 'function') {
      setPageBackground('page1');
    }
    if (typeof renderSummary === 'function') {
      renderSummary('page1');
    }
    if (typeof syncProgress === 'function') {
      syncProgress(0);
    }
    if (typeof startWelcomeDeck === 'function') {
      startWelcomeDeck();
    }

    // ============================
    //  English locale tweaks
    // ============================
    const isEnglish =
      typeof isEnglishLocale === 'function' && isEnglishLocale();

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
      if (offersBtn) {
        offersBtn.innerHTML =
          '<i class="fa-solid fa-gift"></i><span>Today\'s offers</span>';
      }

      const filterWrap = document.getElementById('offersFilters');
      if (filterWrap) {
        filterWrap.querySelectorAll('[data-type]').forEach(chip => {
          const t = chip.dataset.type;
          if (t === 'all') chip.textContent = 'All';
          else if (t === 'image') chip.textContent = 'Images';
          else if (t === 'text') chip.textContent = 'Text';
          else if (t === 'coupon') chip.textContent = 'Coupons';
        });
      }
    }

    // ============================
    //  Initial totals
    // ============================
    if (typeof updateFooterTotal === 'function') {
      updateFooterTotal();
    }
    if (typeof updateNextAvailability === 'function') {
      updateNextAvailability();
    }
  });
})();

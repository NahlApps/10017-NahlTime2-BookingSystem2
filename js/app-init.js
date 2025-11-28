// app-init.js
// High-level bootstrapping & DOM wiring for NahlTime booking form.
// Depends on globals defined in other modules (config-core, booking-core, pricing-promotions, trust-verification, review-postbooking, map-location, ux-intro).

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
        const desc =
          selectedService && typeof getServiceDescription === 'function'
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
    const $wait = document.getElementById('footer-wait');

    // 🔁 Core step handler (from original gotoNext logic)
    async function handleNextStep() {
      if (typeof getActiveIndex !== 'function' || typeof showPage !== 'function') {
        console.warn('[app-init] Missing getActiveIndex/showPage.');
        return;
      }

      const i = getActiveIndex();
      const id = (window.orderedPages || [])[i];

      if (!id) {
        console.warn('[app-init] No current step id');
        return;
      }

      // 1️⃣ Welcome → خدمة
      if (id === 'page1') {
        if (typeof stopWelcomeDeck === 'function') {
          stopWelcomeDeck();
        }
        showPage(1); // page2 index
        return;
      }

      // 2️⃣ Service & Location
      if (id === 'page2') {
        const areaOk = !!$('#area').val();
        const catOk = !!$('#serviceCat').val();
        const svcOk = !!$('#service').val();

        document.getElementById('err-area').style.display = areaOk ? 'none' : 'block';
        document.getElementById('err-serviceCat').style.display = catOk ? 'none' : 'block';
        document.getElementById('err-service').style.display = svcOk ? 'none' : 'block';

        if (!areaOk || !catOk || !svcOk) {
          if (typeof showToast === 'function') {
            showToast('error', 'يرجى إكمال اختيار المنطقة/التصنيف/الخدمة');
          }
          return;
        }

        showPage(2); // → page3
        const dateEl = document.getElementById('date');
        if (dateEl) {
          dateEl.dispatchEvent(new Event('change'));
        }
        return;
      }

      // 3️⃣ Time
      if (id === 'page3') {
        if (!window.selectedTime) {
          if (typeof showToast === 'function') {
            showToast('error', 'الرجاء اختيار وقت');
          }
          return;
        }
        showPage(3); // → page4
        return;
      }

      // 4️⃣ Contact
      if (id === 'page4') {
        const nameOk = ($('#name').val() || '').trim().length > 0;
        const phoneOk = window.itiPhone && window.itiPhone.isValidNumber();

        document.getElementById('err-name').style.display = nameOk ? 'none' : 'block';
        document.getElementById('err-mobile').style.display = phoneOk ? 'none' : 'block';

        if (!nameOk || !phoneOk) {
          if (typeof showToast === 'function') {
            showToast('error', 'يرجى التحقق من الاسم ورقم الجوال');
          }
          return;
        }

        // OTP check (if enabled)
        if (window.OTP_ENABLED && !window.otpVerified) {
          const errOtp = document.getElementById('err-otp');
          if (errOtp) {
            errOtp.textContent = 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة.';
            errOtp.style.display = 'block';
          }
          if (typeof showToast === 'function') {
            showToast('error', 'يرجى التحقق من رقم الجوال عبر كود التحقق قبل المتابعة');
          }
          return;
        }

        const errOtp = document.getElementById('err-otp');
        if (errOtp) errOtp.style.display = 'none';

        if (window.nForm && window.itiPhone) {
          nForm.customerN = $('#name').val().trim();
          nForm.customerM = window.itiPhone.getNumber().replace(/^\+/, '');
          nForm.locationDescription = [
            $('#carBrand').val() || '',
            $('#carName').val() || '',
            $('#plateNumber').val() || ''
          ]
            .filter(Boolean)
            .join(', ');
        }

        showPage(4); // → page5
        return;
      }

      // 5️⃣ Payment
      if (id === 'page5') {
        if (!window.nForm || !nForm.paymentMethod) {
          document.getElementById('err-pay').style.display = 'block';
          if (typeof showToast === 'function') {
            showToast('error', 'اختر طريقة الدفع');
          }
          return;
        }
        document.getElementById('err-pay').style.display = 'none';
        showPage(5); // → page6
        return;
      }

      // 6️⃣ Map + Terms + Submit
      if (id === 'page6') {
        // Terms check
        if (!window.termsAccepted) {
          if (typeof openTermsModal === 'function') {
            openTermsModal();
          }
          if (typeof showToast === 'function') {
            showToast('info', 'من فضلك اقرأ ووافق على الشروط والأحكام قبل إكمال الحجز');
          }
          return;
        }

        if (!window.positionUrl) {
          document.getElementById('err-map').style.display = 'block';
          if (typeof showToast === 'function') {
            showToast('error', 'الرجاء تحديد الموقع');
          }
          return;
        }

        document.getElementById('err-map').style.display = 'none';
        if (window.nForm) {
          nForm.urlLocation = window.positionUrl;
        }

        if (window.isSubmitting) return;
        window.isSubmitting = true;

        if ($next) $next.style.display = 'none';
        if ($prev) $prev.style.display = 'none';
        if ($wait) $wait.classList.add('show');

        try {
          const payload =
            typeof buildPayload === 'function' ? buildPayload() : null;
          console.log('[booking] Sending reservation payload', payload);

          if (typeof postReservation !== 'function') {
            console.error('[booking] postReservation() is not defined');
            throw new Error('postReservation missing');
          }

          const r = await postReservation(payload);
          console.log('[booking] Reservation response:', r);

          if (r.ok && r.data?.success) {
            if (typeof showToast === 'function') {
              showToast('success', 'تم إنشاء الحجز');
            }

            const bookingId =
              (r.data.bookingId ??
                r.data.bookingID ??
                r.data.id ??
                r.data.BookingId ??
                r.data.BookingID) || null;

            console.log('[booking] Derived bookingId for review:', bookingId);

            // ⭐ Schedule post-booking review
            if (typeof scheduleReviewForBooking === 'function') {
              scheduleReviewForBooking(bookingId);
            }

            // Fill thank-you summary
            document.getElementById('ts-area').textContent =
              $('#area').find(':selected').text() || '—';
            document.getElementById('ts-service').textContent =
              $('#service').find(':selected').text() || '—';
            document.getElementById('ts-dt').textContent =
              (nForm.date
                ? DateTime.fromISO(nForm.date).toFormat('d LLL yyyy')
                : '') + (nForm.time ? ' • ' + nForm.time : '');
            document.getElementById('ts-pay').textContent =
              (nForm.paymentMethod || '').toUpperCase() || '—';

            const waMsg = encodeURIComponent(
              `تم إرسال طلب حجز: \nالخدمة: ${$('#service')
                .find(':selected')
                .text()}\nالتاريخ: ${nForm.date} ${nForm.time}\nالرابط: ${location.href}`
            );
            document.getElementById(
              'ts-whatsapp'
            ).href = `https://wa.me/?text=${waMsg}`;

            if ($wait) $wait.classList.remove('show');
            window.isSubmitting = false;
            showPage(6); // → page7 (thanks)
          } else {
            const msg =
              r?.data?.msgAR ||
              (r.status === 404 ? 'المسار غير موجود' : 'تعذر إنشاء الحجز');
            if (typeof showToast === 'function') {
              showToast('error', msg);
            }
            window.isSubmitting = false;
            if ($wait) $wait.classList.remove('show');
            if ($next) $next.style.display = '';
            if ($prev) $prev.style.display = '';
            return;
          }
        } catch (err) {
          console.error('[booking] unexpected error:', err);
          if (typeof showToast === 'function') {
            showToast('error', 'حدث خطأ أثناء إنشاء الحجز');
          }
          window.isSubmitting = false;
          if ($wait) $wait.classList.remove('show');
          if ($next) $next.style.display = '';
          if ($prev) $prev.style.display = '';
        }

        return;
      }

      // Default: advance one step
      const list = window.orderedPages || [];
      showPage(Math.min(i + 1, list.length - 1));
    }

    async function gotoNext() {
      await handleNextStep();
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
    //  Initial totals & buttons state
    // ============================
    if (typeof updateFooterTotal === 'function') {
      updateFooterTotal();
    }
    if (typeof updateNextAvailability === 'function') {
      updateNextAvailability();
    }
  });
})();

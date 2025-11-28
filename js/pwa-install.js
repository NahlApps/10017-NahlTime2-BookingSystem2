// /js/pwa-install.js
// Service worker registration + PWA install UX

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

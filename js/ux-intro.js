// /js/ux-intro.js
// 🎬 Welcome deck (intro slides on page1)
// Depends on globals from booking-core.js:
//   deckTimers, deckIndex, deckRunning, SLIDE_MS, GAP_MS, showPage

/**
 * Start the welcome slideshow deck on page1.
 * Slides should have class `.ppt-slide` inside `#pptDeck`,
 * dots container has id `pptDots`.
 */
function startWelcomeDeck() {
  const deck = document.getElementById('pptDeck');
  if (!deck) {
    console.warn('[deck] #pptDeck not found, skipping welcome deck.');
    return;
  }

  const slides = [...deck.querySelectorAll('.ppt-slide')];
  if (!slides.length) {
    console.warn('[deck] No .ppt-slide elements found.');
    return;
  }

  const dotsWrap = document.getElementById('pptDots');
  if (!dotsWrap) {
    console.warn('[deck] #pptDots not found, dots will not render.');
  }

  // If already running, reset first
  deckTimers.forEach(clearTimeout);
  deckTimers = [];
  deckRunning = true;
  deckIndex   = 0;

  if (dotsWrap) {
    dotsWrap.innerHTML = slides
      .map((_, i) => `<span class="ppt-dot${i === 0 ? ' active' : ''}"></span>`)
      .join('');
  }

  const dots = dotsWrap ? [...dotsWrap.children] : [];

  const setActive = (i, exitingIndex = -1) => {
    slides.forEach((s, idx) => {
      s.classList.remove('is-active', 'is-exiting');
      if (idx === i) {
        s.classList.add('is-active');
        s.style.zIndex = 2;
      } else if (idx === exitingIndex) {
        s.classList.add('is-exiting');
        s.style.zIndex = 1;
      } else {
        s.style.zIndex = 0;
      }
    });

    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  };

  setActive(0, -1);

  const advance = () => {
    if (!deckRunning) return;

    const prev = deckIndex;
    deckIndex++;

    if (deckIndex >= slides.length) {
      // End of deck → stop & move to next page (page2 index = 1)
      stopWelcomeDeck();
      if (typeof showPage === 'function') {
        showPage(1);
      }
      return;
    }

    setActive(deckIndex, prev);
    schedule();
  };

  const schedule = () => {
    deckTimers.push(setTimeout(advance, SLIDE_MS + GAP_MS));
  };

  schedule();
}

/**
 * Stop the welcome deck and clear timeouts.
 */
function stopWelcomeDeck() {
  deckRunning = false;
  deckTimers.forEach(clearTimeout);
  deckTimers = [];
}

// Optional: auto-start deck when DOM is ready and page1 is active
document.addEventListener('DOMContentLoaded', () => {
  const page1 = document.getElementById('page1');
  const isActive = page1 && page1.classList.contains('active');
  if (isActive) {
    startWelcomeDeck();
  }
});

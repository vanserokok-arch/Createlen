document.addEventListener('DOMContentLoaded', () => {
  initHeaderInteractions();
  initScenariosSliderUniversal();
  initFaqAccordion();
  initFaqParallax();
});

/* ==========================================================
   Header interactions: burger + mobile submenu + desktop dropdown
   Works with current investment.html markup.
   ========================================================== */
function initHeaderInteractions() {
  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileMenuOverlay');
  const closeBtn = document.getElementById('mobileMenuClose');

  const lockBody = (lock) => {
    document.body.classList.toggle('is-locked', !!lock);
    document.body.classList.toggle('menu-open', !!lock);
    document.body.classList.toggle('menu-open-no-scroll', !!lock);
  };

  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('is-open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.setAttribute('aria-hidden', 'false');
    if (burger) {
      burger.setAttribute('aria-expanded', 'true');
      burger.classList.add('is-open');
    }
    lockBody(true);
  }

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.classList.remove('is-open');
    }
    lockBody(false);

    // reset mobile submenus
    document.querySelectorAll('#mobileMenu li.has-sub.is-open, #mobileMenu .mobile-has-submenu.submenu-open').forEach((li) => {
      li.classList.remove('is-open', 'submenu-open');
      const b = li.querySelector('button.mobile-submenu-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
      const ul = li.querySelector('.mobile-submenu, .sub-menu');
      if (ul) {
        ul.setAttribute('aria-hidden', 'true');
        ul.hidden = true;
      }
    });
  }

  if (burger && mobileMenu) {
    burger.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobileMenu.classList.contains('is-open')) closeMobileMenu();
      else openMobileMenu();
    });
  }
  if (overlay) overlay.addEventListener('click', closeMobileMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      closeAllDesktopSubmenus();
    }
  });

  // Close menu after navigating (mobile)
  document.querySelectorAll('#mobileMenu a[href^="#"]').forEach((a) => {
    a.addEventListener('click', () => closeMobileMenu());
  });

  // Mobile submenu ("Направления") — supports both legacy & current CSS
  document.querySelectorAll('#mobileMenu li.has-sub > button.mobile-submenu-toggle, #mobileMenu .mobile-has-submenu > button.mobile-submenu-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const li = btn.closest('li.has-sub') || btn.closest('.mobile-has-submenu');
      if (!li) return;

      const submenu = li.querySelector('.mobile-submenu, .sub-menu');
      const willOpen = !(li.classList.contains('is-open') || li.classList.contains('submenu-open'));

      // close others
      document.querySelectorAll('#mobileMenu li.has-sub.is-open, #mobileMenu .mobile-has-submenu.submenu-open').forEach((other) => {
        if (other === li) return;
        other.classList.remove('is-open', 'submenu-open');
        const b = other.querySelector('button.mobile-submenu-toggle');
        if (b) b.setAttribute('aria-expanded', 'false');
        const ul = other.querySelector('.mobile-submenu, .sub-menu');
        if (ul) {
          ul.setAttribute('aria-hidden', 'true');
          ul.hidden = true;
        }
      });

      li.classList.toggle('is-open', willOpen);
      li.classList.toggle('submenu-open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));

      if (submenu) {
        submenu.setAttribute('aria-hidden', String(!willOpen));
        submenu.hidden = !willOpen;
      }
    });
  });

  // Desktop dropdown ("Направления")
  const desktopTrigger = document.querySelector('.keis-header-nav [data-submenu-trigger="directions"]');

  function closeAllDesktopSubmenus() {
    document.querySelectorAll('.keis-header-nav li.has-children.is-open').forEach((li) => {
      li.classList.remove('is-open');
      const a = li.querySelector('[data-submenu-trigger="directions"], a[aria-haspopup="true"]');
      if (a) a.setAttribute('aria-expanded', 'false');
    });
  }

  if (desktopTrigger) {
    desktopTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      const li = desktopTrigger.closest('li.has-children');
      if (!li) return;

      const willOpen = !li.classList.contains('is-open');
      closeAllDesktopSubmenus();
      if (willOpen) {
        li.classList.add('is-open');
        desktopTrigger.setAttribute('aria-expanded', 'true');
      }
    });

    document.addEventListener('click', (e) => {
      const li = desktopTrigger.closest('li.has-children');
      if (!li) return;
      if (!li.contains(e.target)) closeAllDesktopSubmenus();
    });
  }
}

/* ==========================================================
   Scenarios slider — supports BOTH markups:
   A) New: .scenarios-band-window / .scenarios-band-track / .scenario-slide
   B) Old: .scenarios-rail-window / .scenarios-rail-track / .scenario-card
   ========================================================== */
function initScenariosSliderUniversal() {
  // A) new markup
  const bandRoot = document.querySelector('.investment-scenarios .scenarios-band-window');
  if (bandRoot) return initScenariosSliderBand();

  // B) legacy markup
  const railRoot = document.querySelector('.investment-scenarios .scenarios-rail');
  if (railRoot) return initScenariosSliderRail();
}

function initScenariosSliderBand() {
  const root = document.querySelector('.investment-scenarios');
  if (!root) return;

  const windowEl = root.querySelector('.scenarios-band-window');
  const track = root.querySelector('.scenarios-band-track');
  const slides = track ? Array.from(track.querySelectorAll('.scenario-slide')) : [];
  const prevBtn = root.querySelector('.scenarios-band-arrow.prev');
  const nextBtn = root.querySelector('.scenarios-band-arrow.next');

  if (!windowEl || !track || slides.length < 2) return;

  let index = 0;
  let step = 0;
  let maxIndex = 0;
  let isAnimating = false;

  function getGapPx() {
    const cs = window.getComputedStyle(track);
    const g = cs.columnGap || cs.gap || '0px';
    return parseFloat(g) || 0;
  }

  function measure() {
    const s0 = slides[0].getBoundingClientRect();
    const gap = getGapPx();
    step = s0.width + gap;

    const winW = windowEl.getBoundingClientRect().width;
    const visible = Math.max(1, Math.floor((winW + gap) / step));
    maxIndex = Math.max(0, slides.length - visible);

    index = Math.min(index, maxIndex);
    update();
    updateButtons();
  }

  function update() {
    const x = -index * step;
    track.style.setProperty('--scenarios-offset', `${x}px`);
  }

  function updateButtons() {
    if (prevBtn) prevBtn.classList.toggle('is-disabled', index <= 0);
    if (nextBtn) nextBtn.classList.toggle('is-disabled', index >= maxIndex);
  }

  function slide(dir) {
    if (isAnimating) return;

    const next = Math.min(Math.max(index + dir, 0), maxIndex);
    if (next === index) return;

    isAnimating = true;
    index = next;
    update();

    const onEnd = (e) => {
      if (e && e.target !== track) return;
      isAnimating = false;
      track.removeEventListener('transitionend', onEnd);
      updateButtons();
    };
    track.addEventListener('transitionend', onEnd);

    window.setTimeout(() => {
      if (!isAnimating) return;
      isAnimating = false;
      track.removeEventListener('transitionend', onEnd);
      updateButtons();
    }, 650);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => slide(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => slide(+1));

  windowEl.addEventListener('wheel', (e) => {
    const dx = Math.abs(e.deltaX);
    const dy = Math.abs(e.deltaY);
    const isHorizontalIntent = dx > dy || e.shiftKey;
    if (!isHorizontalIntent) return;
    e.preventDefault();
    slide(e.deltaX > 0 || e.deltaY > 0 ? +1 : -1);
  }, { passive: false });

  window.addEventListener('resize', () => measure(), { passive: true });
  measure();
}

function initScenariosSliderRail() {
  const rail = document.querySelector('.investment-scenarios .scenarios-rail');
  if (!rail) return;

  const windowEl = rail.querySelector('.scenarios-rail-window');
  const track = rail.querySelector('.scenarios-rail-track');
  const cards = track ? Array.from(track.querySelectorAll('.scenario-card')) : [];
  const prevBtn = rail.querySelector('.scenarios-rail-arrow.prev');
  const nextBtn = rail.querySelector('.scenarios-rail-arrow.next');

  if (!windowEl || !track || cards.length <= 3) return;

  const VISIBLE = 3;
  let currentIndex = 0;
  let isAnimating = false;
  let step = 0;

  function measure() {
    if (cards.length < 2) return;
    const r1 = cards[0].getBoundingClientRect();
    const r2 = cards[1].getBoundingClientRect();
    step = r2.left - r1.left;

    const cardWidth = r1.width;
    const gap = step - cardWidth;
    const windowWidth = VISIBLE * cardWidth + (VISIBLE - 1) * gap;
    windowEl.style.width = `${windowWidth}px`;
  }

  function updateOffset() {
    const offset = -currentIndex * step;
    track.style.setProperty('--scenarios-offset', `${offset}px`);
  }

  function setButtonsState() {
    const maxIndex = cards.length - VISIBLE;
    if (prevBtn) prevBtn.classList.toggle('is-disabled', currentIndex <= 0);
    if (nextBtn) nextBtn.classList.toggle('is-disabled', currentIndex >= maxIndex);
  }

  function slide(dir) {
    if (isAnimating) return;
    const maxIndex = cards.length - VISIBLE;
    const nextIndex = Math.min(Math.max(currentIndex + dir, 0), maxIndex);
    if (nextIndex === currentIndex) return;

    isAnimating = true;
    currentIndex = nextIndex;
    updateOffset();

    const onDone = () => {
      isAnimating = false;
      track.removeEventListener('transitionend', onDone);
      setButtonsState();
    };
    track.addEventListener('transitionend', onDone);
  }

  if (nextBtn) nextBtn.addEventListener('click', () => slide(+1));
  if (prevBtn) prevBtn.addEventListener('click', () => slide(-1));

  window.addEventListener('resize', () => {
    measure();
    updateOffset();
  }, { passive: true });

  // ensure a transition exists (if CSS missing)
  if (!track.style.transition) track.style.transition = 'transform 0.55s ease-out';

  measure();
  updateOffset();
  setButtonsState();
}

/* ==========================================================
   FAQ accordion (safe no-op if markup differs)
   Expects: .faq-item button.faq-question + .faq-answer
   ========================================================== */
function initFaqAccordion() {
  document.querySelectorAll('.investment-faq .faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    const panel = item.querySelector('.faq-answer');
    if (!btn || !panel) return;

    // initial state
    if (panel.hidden === undefined) {
      // no hidden support - ignore
    } else {
      panel.hidden = true;
    }
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      if (panel.hidden !== undefined) panel.hidden = !open;
    });
  });
}

/* ==========================================================
   FAQ parallax — updates CSS variables, CSS can choose to use them.
   ========================================================== */
function initFaqParallax() {
  const section = document.querySelector('.investment-faq');
  if (!section) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 800;

    // progress -1..1 around center
    const mid = rect.top + rect.height / 2;
    const p = (mid - vh / 2) / (vh / 2);
    const clamped = Math.max(-1, Math.min(1, p));

    const y = clamped * -18; // px
    section.style.setProperty('--faq-parallax-y', `${y}px`);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

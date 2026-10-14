/* Better Servants — homepage interactions (vanilla JS, no dependencies besides Bootstrap's offcanvas) */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- Preloader ---------- */
  const preloader = $('#preloader');
  const hidePreloader = () => preloader && preloader.classList.add('is-done');
  window.addEventListener('load', () => setTimeout(hidePreloader, 300));
  setTimeout(hidePreloader, 2500); // safety net if a remote image stalls

  /* ---------- Prototype: placeholder links do nothing ---------- */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="#"]');
    if (link) e.preventDefault();
  });

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Split headings into words ---------- */
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const splitNode = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            const inner = document.createElement('span');
            outer.className = 'split-word';
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          splitNode(child);
        }
      });
    };
    el.setAttribute('aria-label', el.textContent.trim());
    splitNode(el);
  });

  /* ---------- Counters ---------- */
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const duration = 1800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in');
      $$('[data-count]', el).forEach((c) => { if (!c.dataset.done) { c.dataset.done = '1'; animateCount(c); } });
      if (el.hasAttribute('data-count') && !el.dataset.done) { el.dataset.done = '1'; animateCount(el); }
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  $$('[data-anim], [data-reveal], [data-split], [data-count]').forEach((el) => io.observe(el));

  /* ---------- Sticky header, parallax, back-to-top progress ---------- */
  const header = $('#header');
  const hero = $('.hero');
  const toTop = $('#toTop');
  const ring = $('#toTop circle');
  const ringLen = 2 * Math.PI * 24;
  const parallaxEls = $$('[data-parallax]');
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const heroH = hero ? hero.offsetHeight * 0.6 : 400;
    header.classList.toggle('is-sticky', y > heroH);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? y / max : 0;
    toTop.classList.toggle('show', y > 600);
    ring.style.strokeDashoffset = ringLen * (1 - progress);

    if (!reduceMotion) {
      parallaxEls.forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const speed = parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${(-rect.top * speed).toFixed(1)}px, 0)`;
      });
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Custom cursor (fine pointers only) ---------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    const dot = $('.cursor-dot');
    const ringEl = $('.cursor-ring');
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      document.body.classList.add('cursor-ready');
    });
    document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-ready'));
    const follow = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ringEl.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    };
    follow();
    document.addEventListener('mouseover', (e) => {
      ringEl.classList.toggle('is-hover', !!e.target.closest('a, button, input, .service-card, .pest-card'));
    });
  }

  /* ---------- Testimonial slider ---------- */
  const slider = $('#tSlider');
  if (slider) {
    const track = $('.t-track', slider);
    const slides = $$('.t-slide', slider);
    const dotsWrap = $('.t-dots', slider);
    let index = 0;
    let timer;

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Testimonial ${i + 1}`);
      b.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.appendChild(b);
      return b;
    });

    const go = (i) => {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle('active', n === index));
      slides.forEach((s, n) => s.setAttribute('aria-hidden', n !== index));
    };
    const restart = () => {
      clearInterval(timer);
      if (!reduceMotion) timer = setInterval(() => go(index + 1), 6000);
    };

    $$('.t-btn', slider).forEach((b) => b.addEventListener('click', () => { go(index + parseInt(b.dataset.dir, 10)); restart(); }));

    // swipe support
    let startX = null;
    track.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    track.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 50) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      startX = null;
    });
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', restart);

    go(0);
    restart();
  }

  /* ---------- Pricing toggle ---------- */
  const billingBtns = $$('[data-billing]');
  billingBtns.forEach((btn) => btn.addEventListener('click', () => {
    const mode = btn.dataset.billing;
    billingBtns.forEach((b) => b.classList.toggle('active', b === btn));
    $$('.price .amount').forEach((amt) => {
      amt.classList.add('swap');
      setTimeout(() => {
        amt.textContent = amt.dataset[mode];
        amt.classList.remove('swap');
      }, 220);
    });
    $$('[data-per]').forEach((p) => { p.textContent = mode === 'yearly' ? '/ year' : '/ month'; });
  }));

  /* ---------- Newsletter (prototype only, nothing is sent) ---------- */
  const form = $('#newsletter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#nlEmail');
    const msg = $('#nlMsg');
    if (!input.checkValidity()) {
      msg.textContent = 'Please enter a valid email address.';
      return;
    }
    msg.textContent = 'Thanks! This is a prototype, so nothing was sent.';
    form.reset();
  });
})();

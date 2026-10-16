/* Lasse Meerburg — portfolio concept. Vanilla JS, no build step.
   Injects the shared chrome (header, menu, background, footer) and wires up
   the interactive bits: calendar, Dark Hour, menu, page wipes, typewriter
   dialogue, testimonial carousel, social-link preview, lightbox, card tilt. */
(() => {
  'use strict';
  window.__p3 = true;

  const doc = document.documentElement;
  const ROOT = doc.dataset.root || '.';
  const PAGE = doc.dataset.page || '';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const url = (path) => `${ROOT}/${path}`;
  const pad = (n) => String(n).padStart(2, '0');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
  };

  const LINKEDIN = 'https://www.linkedin.com/in/lasse-meerburg-8530b225b/';

  const PAGES = [
    { id: 'home', href: 'index.html', label: 'Home', tag: 'Title screen' },
    { id: 'projects', href: 'projects.html', label: 'Projects', tag: 'Social links' },
    { id: 'about', href: 'about.html', label: 'About', tag: 'Status' },
    { id: 'cv', href: 'cv.html', label: 'CV', tag: 'Calendar' },
    { id: 'contact', href: 'contact.html', label: 'Contact', tag: 'Phone' },
  ];

  const PROJECTS = [
    { slug: 'soaked-in-sin', title: 'Soaked in Sin', num: 'XIII', arcana: 'Death' },
    { slug: 'project-heist', title: 'Project Heist', num: 'I', arcana: 'The Magician' },
    { slug: 'sunbeat-city', title: 'Sunbeat City', num: 'XIX', arcana: 'The Sun' },
    { slug: 'production-toolbox', title: 'Production Toolbox', num: 'V', arcana: 'The Hierophant' },
    { slug: 'ortus', title: 'ORTUS', num: 'VII', arcana: 'The Chariot' },
  ];

  const activeId = PAGE === 'project' ? 'projects' : PAGE;

  const ICON = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5V12l3.5 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  /* ---------- Calendar & moon ------------------------------------------ */
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

  function moonPhase(date) {
    const synodic = 29.530588853;
    const knownNew = Date.UTC(2000, 0, 6, 18, 14);
    const days = (date.getTime() - knownNew) / 86400000;
    return (((days % synodic) + synodic) % synodic) / synodic; // 0 = new, .5 = full
  }

  function moonSVG(p) {
    const r = 10, cx = 12, cy = 12;
    const rx = Math.abs(Math.cos(p * 2 * Math.PI)) * r;
    const waxing = p < 0.5;
    const outerSweep = waxing ? 1 : 0;
    const innerSweep = waxing ? (p < 0.25 ? 0 : 1) : (p < 0.75 ? 0 : 1);
    const d = `M${cx} ${cy - r}A${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r}A${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r}Z`;
    const name = PHASES[Math.round(p * 8) % 8];
    return `<svg class="moon" viewBox="0 0 24 24" role="img" aria-label="${name}"><title>${name}</title><circle class="moon__dark" cx="12" cy="12" r="10"/><path class="moon__lit" d="${d}"/></svg>`;
  }

  function timeOfDay(h) {
    if (doc.dataset.theme === 'dark-hour' || h === 0) return 'Dark Hour';
    if (h < 5) return 'Late Night';
    if (h < 8) return 'Early Morning';
    if (h < 12) return 'Morning';
    if (h < 13) return 'Lunchtime';
    if (h < 15) return 'Afternoon';
    if (h < 18) return 'After School';
    return 'Evening';
  }

  function calHTML(now = new Date()) {
    const day = now.getDay();
    return `<div class="cal__date"><span class="cal__md">${now.getMonth() + 1}/${now.getDate()}</span><span class="cal__dow" data-day="${day}">${DAYS[day]}</span></div>
      <div class="cal__row">${moonSVG(moonPhase(now))}<span class="cal__tod">${timeOfDay(now.getHours())}</span></div>`;
  }

  function renderCals() {
    $$('[data-cal]').forEach((el) => { el.innerHTML = calHTML(); });
  }

  /* ---------- Shared chrome -------------------------------------------- */
  function wavesSVG() {
    const lines = [60, 110, 150, 185, 215, 240].map((y, i) => {
      const amp = 14 + i * 4;
      let d = `M0 ${y}`;
      for (let x = 0; x < 2400; x += 300) d += ` Q${x + 75} ${y - amp} ${x + 150} ${y} T${x + 300} ${y}`;
      return `<path d="${d}" stroke-opacity="${(0.12 + i * 0.05).toFixed(2)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 2400 300" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5">${lines}</g></svg>`;
  }

  function bubblesHTML(count) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const s = 4 + Math.random() * 16;
      out += `<i class="bubble" style="--x:${(Math.random() * 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--d:${(12 + Math.random() * 16).toFixed(1)}s;--delay:${(-Math.random() * 24).toFixed(1)}s;--drift:${(Math.random() * 60 - 30).toFixed(0)}px"></i>`;
    }
    return out;
  }

  function buildChrome() {
    const navLinks = PAGES.map((p) =>
      `<a href="${url(p.href)}"${p.id === activeId ? ' aria-current="page"' : ''}>${p.label}</a>`).join('');

    const menuItems = PAGES.map((p, i) =>
      `<a class="menu__item" href="${url(p.href)}" style="--i:${i}"${p.id === activeId ? ' aria-current="page"' : ''}>
        <span class="menu__num">${pad(i + 1)}</span><span class="menu__label">${p.label}</span><span class="menu__tag">${p.tag}</span></a>`).join('');

    document.body.insertAdjacentHTML('afterbegin', `
      <div class="bg" aria-hidden="true">
        <div class="bg__shard bg__shard--1"></div><div class="bg__shard bg__shard--2"></div>
        <div class="bg__rays"></div><div class="bg__moon"></div>
        <div class="bg__waves">${wavesSVG()}</div>
        <div class="bg__bubbles">${reduceMotion ? '' : bubblesHTML(18)}</div>
        <div class="bg__grain"></div>
      </div>
      <a class="skip" href="#main">Skip to content</a>
      <header class="hdr" id="hdr">
        <a class="brand" href="${url('index.html')}" aria-label="Lasse Meerburg — home">
          <span class="brand__mark" aria-hidden="true"><span>LM</span></span>
          <span class="brand__name">Lasse Meerburg<small>Game Producer</small></span>
        </a>
        <nav class="nav" aria-label="Main">${navLinks}</nav>
        <div class="cal" data-cal aria-label="Today"></div>
        <button class="dh-btn" id="dh-btn" type="button" aria-pressed="false" title="Toggle the Dark Hour">${ICON.clock}<span>Dark Hour</span></button>
        <button class="menu-btn" id="menu-btn" type="button" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false">
          <span class="menu-btn__bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span><kbd>Esc</kbd>
        </button>
      </header>`);

    document.body.insertAdjacentHTML('beforeend', `
      <footer class="ftr">
        <div class="wrap ftr__grid">
          <div>
            <p class="ftr__big">Follow</p>
            <a class="btn btn--solid" href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn ▶</a>
          </div>
          <nav class="ftr__nav" aria-label="Footer">${PAGES.map((p) => `<a href="${url(p.href)}">${p.label}</a>`).join('')}</nav>
          <p class="ftr__note">
            <span>© <span data-year></span> Lasse Meerburg · Game Producer · Breda, NL</span>
            <span>Design concept inspired by Persona 3 Reload. Fan-made, not affiliated with ATLUS or SEGA.</span>
          </p>
        </div>
      </footer>
      <div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Main menu" hidden>
        <div class="menu__bg" data-menu-close></div>
        <div class="menu__deco" aria-hidden="true">Menu</div>
        <div class="menu__cal"><div class="cal" data-cal></div></div>
        <nav class="menu__list" aria-label="Menu">${menuItems}</nav>
        <p class="menu__hint"><kbd>↑↓</kbd> Select · <kbd>Enter</kbd> Confirm · <kbd>Esc</kbd> Back</p>
        <button class="btn menu__close" type="button" data-menu-close>Close ✕</button>
      </div>
      <div class="dh-flash" aria-hidden="true"><div class="dh-flash__time"></div><div class="dh-flash__sub"></div></div>
      <div class="wipe" aria-hidden="true"><i></i><i></i><i></i></div>`);

    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Header scroll state -------------------------------------- */
  function initHeader() {
    const hdr = $('#hdr');
    const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Dark Hour ------------------------------------------------- */
  function initDarkHour() {
    const btn = $('#dh-btn');
    const flash = $('.dh-flash');

    const apply = (dark) => {
      if (dark) doc.dataset.theme = 'dark-hour';
      else delete doc.dataset.theme;
      btn.setAttribute('aria-pressed', String(dark));
      $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#06170b' : '#051538');
      renderCals();
    };

    apply(doc.dataset.theme === 'dark-hour');

    btn.addEventListener('click', () => {
      const dark = doc.dataset.theme !== 'dark-hour';
      store.set('p3-theme', dark ? 'dark-hour' : 'day');
      if (reduceMotion) { apply(dark); return; }
      const now = new Date();
      $('.dh-flash__time', flash).textContent = dark ? '12:00' : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      $('.dh-flash__sub', flash).textContent = dark ? 'The Dark Hour' : 'Back to normal time';
      flash.classList.toggle('dh-flash--day', !dark);
      flash.classList.remove('is-on');
      void flash.offsetWidth; // restart animation
      flash.classList.add('is-on');
      setTimeout(() => apply(dark), 260);
    });
  }

  /* ---------- Menu ------------------------------------------------------ */
  let menuApi = null;
  function initMenu() {
    const menu = $('#menu');
    const openBtn = $('#menu-btn');
    const items = $$('.menu__item', menu);
    const closeBtn = $('.menu__close', menu);
    let idx = Math.max(0, PAGES.findIndex((p) => p.id === activeId));
    let lastFocus = null;

    const setActive = (i, focus = true) => {
      idx = (i + items.length) % items.length;
      items.forEach((el, j) => el.classList.toggle('is-active', j === idx));
      if (focus) items[idx].focus({ preventScroll: true });
    };

    const open = () => {
      lastFocus = document.activeElement;
      menu.hidden = false;
      doc.classList.add('menu-open');
      openBtn.setAttribute('aria-expanded', 'true');
      renderCals();
      setActive(idx);
    };
    const close = () => {
      menu.hidden = true;
      doc.classList.remove('menu-open');
      openBtn.setAttribute('aria-expanded', 'false');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    openBtn.addEventListener('click', open);
    $$('[data-menu-close]', menu).forEach((el) => el.addEventListener('click', close));
    items.forEach((el, i) => {
      el.addEventListener('mouseenter', () => setActive(i));
      el.addEventListener('focus', () => setActive(i, false));
    });

    menu.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setActive(idx + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setActive(idx - 1); }
      else if (e.key === 'Tab') {
        const focusables = [...items, closeBtn];
        const pos = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = (pos + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
        focusables[next].focus();
      }
    });

    menuApi = { open, close, isOpen: () => !menu.hidden };
  }

  /* ---------- Global keys ------------------------------------------------ */
  function initKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (lightboxApi && lightboxApi.isOpen()) { lightboxApi.close(); return; }
      if (!menuApi) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (menuApi.isOpen()) menuApi.close();
      else if (!typing) menuApi.open();
    });
  }

  /* ---------- Page wipe -------------------------------------------------- */
  function initWipe() {
    const wipe = $('.wipe');

    if (doc.classList.contains('wipe-pending')) {
      wipe.classList.add('is-out');
      doc.classList.remove('wipe-pending');
      session.del('p3-wipe');
      setTimeout(() => wipe.classList.remove('is-out'), 900);
    }

    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        wipe.classList.remove('is-in', 'is-out');
        doc.classList.remove('wipe-pending');
        session.del('p3-wipe');
      }
    });

    if (reduceMotion) return;

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const dest = new URL(a.href, location.href);
      if (!/^https?:$/.test(dest.protocol) || dest.origin !== location.origin) return;
      if (dest.pathname === location.pathname && dest.search === location.search) return; // same page / hash link
      e.preventDefault();
      session.set('p3-wipe', '1');
      wipe.classList.remove('is-out');
      wipe.classList.add('is-in');
      setTimeout(() => { location.href = dest.href; }, 540);
    });
  }

  /* ---------- Scroll reveal --------------------------------------------- */
  function onVisible(el, cb, opts = { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { io.disconnect(); cb(); }
    }, opts);
    io.observe(el);
  }

  function initReveal() {
    $$('[data-reveal]').forEach((el) => onVisible(el, () => el.classList.add('is-in')));
  }

  /* ---------- Typewriter ------------------------------------------------- */
  function typewriter(el, text, speed = 20) {
    el.textContent = '';
    const ghost = document.createElement('span');
    ghost.className = 'tw-ghost';
    ghost.textContent = text;
    const live = document.createElement('span');
    live.className = 'tw-live';
    live.setAttribute('aria-hidden', 'true');
    el.append(ghost, live);

    const ctrl = { done: false, finish() {} };
    if (reduceMotion) { live.textContent = text; ctrl.done = true; return ctrl; }

    let i = 0;
    let timer = 0;
    ctrl.finish = () => { clearTimeout(timer); live.textContent = text; ctrl.done = true; };
    const tick = () => {
      i += 1;
      live.textContent = text.slice(0, i);
      if (i >= text.length) { ctrl.done = true; return; }
      const ch = text[i - 1];
      timer = setTimeout(tick, /[.!?]/.test(ch) ? speed * 9 : ch === ',' ? speed * 5 : speed);
    };
    tick();
    return ctrl;
  }

  function initTypewriters() {
    $$('[data-typewriter]').forEach((box) => {
      const textEl = $('.dialog__text', box);
      const text = textEl.textContent.trim().replace(/\s+/g, ' ');
      let tw = null;
      onVisible(box, () => { tw = typewriter(textEl, text); }, { threshold: 0.5 });
      box.addEventListener('click', () => tw && tw.finish());
    });
  }

  /* ---------- Testimonial carousel -------------------------------------- */
  function initTalk() {
    $$('[data-talk]').forEach((talk) => {
      const quotes = $$('.quotes > li', talk).map((li) => ({
        name: $('.q__name', li).textContent.trim(),
        role: ($('.q__role', li) || { textContent: '' }).textContent.trim(),
        text: $('.q__text', li).textContent.trim().replace(/\s+/g, ' '),
      }));
      if (!quotes.length) return;

      talk.insertAdjacentHTML('afterbegin', `
        <div class="dialog" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Testimonials — click or press Enter for the next one">
          <span class="dialog__name"></span>
          <p class="dialog__text" aria-live="polite"></p>
          <p class="dialog__role"></p>
          <span class="dialog__next" aria-hidden="true">▼</span>
        </div>
        <div class="talk__ctrl">
          <button class="btn" type="button" data-prev>◀ Prev</button>
          <span class="talk__count" aria-hidden="true"></span>
          <button class="btn" type="button" data-next>Next ▶</button>
          ${talk.dataset.log ? `<a class="btn talk__log" href="${talk.dataset.log}">Full backlog</a>` : ''}
        </div>`);

      const box = $('.dialog', talk);
      const nameEl = $('.dialog__name', box);
      const textEl = $('.dialog__text', box);
      const roleEl = $('.dialog__role', box);
      const countEl = $('.talk__count', talk);
      let i = 0;
      let tw = null;

      const show = (n) => {
        i = (n + quotes.length) % quotes.length;
        const q = quotes[i];
        if (tw) tw.finish();
        nameEl.textContent = q.name;
        roleEl.textContent = q.role;
        countEl.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(quotes.length)}`;
        tw = typewriter(textEl, `“${q.text}”`, 16);
      };
      const advance = () => { if (tw && !tw.done) tw.finish(); else show(i + 1); };

      box.addEventListener('click', advance);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      });
      $('[data-prev]', talk).addEventListener('click', () => show(i - 1));
      $('[data-next]', talk).addEventListener('click', () => show(i + 1));

      nameEl.textContent = quotes[0].name;
      onVisible(talk, () => show(0), { threshold: 0.4 });
    });
  }

  /* ---------- Social link preview (projects index) ---------------------- */
  function initSocialLinks() {
    const root = $('[data-slink]');
    if (!root) return;
    const links = $$('.slink__item a', root);
    const panels = $$('.slink__panel', root);
    // On narrow screens the list is hidden and every panel is shown, so only
    // hide inactive panels from assistive tech when the list is visible.
    const wide = window.matchMedia('(min-width: 901px)');
    let current = 0;
    const activate = (i) => {
      current = i;
      links.forEach((a, j) => a.classList.toggle('is-active', j === i));
      panels.forEach((p, j) => {
        p.classList.toggle('is-active', j === i);
        if (wide.matches && j !== i) p.setAttribute('aria-hidden', 'true');
        else p.removeAttribute('aria-hidden');
      });
    };
    wide.addEventListener('change', () => activate(current));
    links.forEach((a, i) => {
      a.addEventListener('mouseenter', () => activate(i));
      a.addEventListener('focus', () => activate(i));
      a.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
      });
    });
    activate(0);
  }

  /* ---------- Contact chat ---------------------------------------------- */
  function initChat() {
    const phone = $('[data-chat]');
    if (!phone) return;
    const msgs = $$('.msg', phone);
    if (reduceMotion) { phone.classList.add('is-done'); return; }
    msgs.forEach((m) => m.classList.add('is-hidden'));
    const typing = document.createElement('p');
    typing.className = 'msg msg--typing';
    typing.setAttribute('aria-hidden', 'true');
    typing.innerHTML = '<i></i><i></i><i></i>';
    let k = 0;
    const step = () => {
      if (k >= msgs.length) { typing.remove(); phone.classList.add('is-done'); return; }
      msgs[k].before(typing);
      setTimeout(() => { msgs[k].classList.remove('is-hidden'); k += 1; step(); }, k === 0 ? 700 : 1100);
    };
    onVisible(phone, step, { threshold: 0.3 });
  }

  /* ---------- Project prev / next --------------------------------------- */
  function initProjectNav() {
    const nav = $('#project-nav');
    const slug = document.body.dataset.project;
    if (!nav || !slug) return;
    const i = PROJECTS.findIndex((p) => p.slug === slug);
    if (i < 0) return;
    const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
    const next = PROJECTS[(i + 1) % PROJECTS.length];
    const link = (p, dir) => `<a class="pnav__link" href="${p.slug}.html">
        <span class="pnav__dir">${dir}</span><span class="pnav__title">${p.title}</span><span class="pnav__arc">${p.num} · ${p.arcana}</span></a>`;
    nav.innerHTML = link(prev, '◀ Previous link') + link(next, 'Next link ▶');
  }

  /* ---------- Lightbox --------------------------------------------------- */
  let lightboxApi = null;
  function initLightbox() {
    const shots = $$('.shot');
    if (!shots.length) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="lb" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
        <img class="lb__img" alt="">
        <p class="lb__cap"></p>
        <button class="btn lb__close" type="button">Close ✕</button>
        <button class="btn lb__nav lb__prev" type="button" aria-label="Previous image">◀</button>
        <button class="btn lb__nav lb__next" type="button" aria-label="Next image">▶</button>
      </div>`);
    const lb = $('.lb');
    const img = $('.lb__img', lb);
    const cap = $('.lb__cap', lb);
    let cur = 0;
    let opener = null;

    const hiRes = (src) => src.replace(/format=\d+w/, 'format=2500w');
    const show = (i) => {
      cur = (i + shots.length) % shots.length;
      const s = $('img', shots[cur]);
      img.src = hiRes(s.currentSrc || s.src);
      img.alt = s.alt;
      cap.textContent = ($('figcaption', shots[cur]) || {}).textContent || s.alt;
      img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    };
    const open = (i) => { opener = document.activeElement; show(i); lb.hidden = false; doc.classList.add('menu-open'); $('.lb__close', lb).focus(); };
    const close = () => { lb.hidden = true; doc.classList.remove('menu-open'); if (opener) opener.focus(); };

    shots.forEach((fig, i) => {
      fig.tabIndex = 0;
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-label', `Enlarge image: ${$('img', fig).alt}`);
      fig.addEventListener('click', () => open(i));
      fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    $('.lb__close', lb).addEventListener('click', close);
    $('.lb__prev', lb).addEventListener('click', () => show(cur - 1));
    $('.lb__next', lb).addEventListener('click', () => show(cur + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'Tab') {
        const f = $$('button', lb);
        const pos = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(pos + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    lightboxApi = { close, isOpen: () => !lb.hidden };
  }

  /* ---------- Card tilt -------------------------------------------------- */
  function initTilt() {
    if (reduceMotion || !finePointer) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
      });
    });
  }

  /* ---------- Boot ------------------------------------------------------- */
  buildChrome();
  renderCals();
  setInterval(renderCals, 60000);
  initHeader();
  initDarkHour();
  initMenu();
  initLightbox();
  initKeys();
  initWipe();
  initReveal();
  initTypewriters();
  initTalk();
  initSocialLinks();
  initChat();
  initProjectNav();
  initTilt();
})();

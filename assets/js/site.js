/* Lasse Meerburg — portfolio concept. Vanilla JS, no build step.
   Injects the shared chrome (header, menu, background, footer) and wires up
   the interactions: pause menu with Extras (Dark Hour theme, sound), page
   wipes, typewriter dialogue, testimonial carousel, project filters,
   lightbox, card tilt, CV calendar, a subtle water shader, controller
   support and a hidden room. Every feature boots on its own. */
(() => {
  'use strict';
  window.__p3 = true;

  const doc = document.documentElement;
  const ROOT = doc.dataset.root || '.';
  const PAGE = doc.dataset.page || '';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const INTERACTIVE = 'a[href], button, [role="button"], [data-tilt], .dialog[tabindex]';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const url = (path) => `${ROOT}/${path}`;
  const pad = (n) => String(n).padStart(2, '0');
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

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
  const GOATCOUNTER = 'lmeerburg';

  const PAGES = [
    { id: 'home', href: 'index.html', label: 'Home', tag: 'Start' },
    { id: 'projects', href: 'projects.html', label: 'Projects', tag: 'My work' },
    { id: 'about', href: 'about.html', label: 'About', tag: 'Who I am' },
    { id: 'cv', href: 'cv.html', label: 'CV', tag: 'Experience' },
    { id: 'contact', href: 'contact.html', label: 'Contact', tag: 'Get in touch' },
  ];

  // Newest first: this order drives the "newer / older" links on project pages.
  const PROJECTS = [
    { slug: 'project-heist', title: 'Project Heist', when: '2025 – 2026' },
    { slug: 'sunbeat-city', title: 'Sunbeat City', when: 'Feb – Jul 2025' },
    { slug: 'soaked-in-sin', title: 'Soaked in Sin', when: 'Jan 2025' },
    { slug: 'production-toolbox', title: 'Production Toolbox', when: 'Nov 2024 – Jan 2025' },
    { slug: 'ortus', title: 'ORTUS', when: 'Apr – Jun 2024' },
  ];

  const activeId = PAGE === 'project' ? 'projects' : PAGE;

  const ICON = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5V12l3.5 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path class="sfx-wave" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="sfx-off" d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  let menuApi = null;
  let lightboxApi = null;
  let finisherApi = null;
  let slinkApi = null;
  let konamiFeed = null;
  let goTo = (href) => { location.href = href; };

  /* ---------- Visibility (one shared observer) -------------------------- */
  // While the arrival wipe still covers the page, reveals wait for it so the
  // entrance animations play where the visitor can actually see them.
  let revealGate = 0;
  const visibleCbs = new Map();
  const fire = (cbs) => cbs.forEach((cb) => { try { cb(); } catch (err) { console.error('[p3] reveal callback failed:', err); } });
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const cbs = visibleCbs.get(en.target) || [];
        visibleCbs.delete(en.target);
        io.unobserve(en.target);
        const wait = revealGate - performance.now();
        if (wait > 0) setTimeout(() => fire(cbs), wait);
        else fire(cbs);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 })
    : null;

  function onVisible(el, cb) {
    if (!io) { cb(); return; }
    const list = visibleCbs.get(el);
    if (list) list.push(cb);
    else { visibleCbs.set(el, [cb]); io.observe(el); }
  }

  /* ---------- SFX: tiny Web Audio synth, off by default ----------------- */
  const sfx = (() => {
    let ctx = null;
    let on = store.get('p3-sfx') === 'on';
    let lastHover = 0;
    let lastBlip = 0;

    const ensure = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };

    const tone = ({ freq = 880, to = 0, dur = 0.06, type = 'sine', vol = 0.05, delay = 0 }) => {
      const c = ensure();
      if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    };

    const noise = ({ dur = 0.45, vol = 0.05 }) => {
      const c = ensure();
      if (!c) return;
      const t = c.currentTime;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.9;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.6);
      f.frequency.exponentialRampToValueAtTime(700, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
      src.stop(t + dur);
    };

    const gate = (fn) => (...args) => { if (on) fn(...args); };

    return {
      get on() { return on; },
      set(v) { on = v; store.set('p3-sfx', v ? 'on' : 'off'); },
      hover: gate(() => {
        const n = performance.now();
        if (n - lastHover < 45) return;
        lastHover = n;
        tone({ freq: 1500, dur: 0.035, type: 'triangle', vol: 0.03 });
      }),
      select: gate(() => {
        tone({ freq: 740, dur: 0.07, type: 'square', vol: 0.025 });
        tone({ freq: 1110, dur: 0.12, type: 'square', vol: 0.022, delay: 0.055 });
      }),
      back: gate(() => tone({ freq: 620, to: 300, dur: 0.15, type: 'triangle', vol: 0.05 })),
      open: gate(() => { tone({ freq: 260, to: 1400, dur: 0.22, type: 'sawtooth', vol: 0.018 }); noise({ dur: 0.28, vol: 0.03 }); }),
      whoosh: gate(() => noise({ dur: 0.55, vol: 0.06 })),
      blip: gate(() => {
        const n = performance.now();
        if (n - lastBlip < 40) return;
        lastBlip = n;
        tone({ freq: 480 + Math.random() * 120, dur: 0.03, type: 'square', vol: 0.012 });
      }),
      pop: gate(() => tone({ freq: 900, to: 1800, dur: 0.09, vol: 0.05 })),
      bell: gate(() => {
        tone({ freq: 196, dur: 1.8, vol: 0.12 });
        tone({ freq: 392, dur: 1.3, vol: 0.05 });
        tone({ freq: 588, dur: 0.9, vol: 0.025 });
        [0, 0.45, 0.9].forEach((d) => tone({ freq: 2200, dur: 0.025, type: 'square', vol: 0.018, delay: d }));
      }),
      chime: gate(() => [1046, 1318, 1568, 2093].forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.035, delay: i * 0.07 }))),
      hit: gate(() => {
        noise({ dur: 0.35, vol: 0.09 });
        tone({ freq: 150, to: 45, dur: 0.45, type: 'sawtooth', vol: 0.08 });
        [880, 1320, 1760].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'square', vol: 0.025, delay: 0.3 + i * 0.07 }));
      }),
    };
  })();

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

  function clockSVG() {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const r1 = i % 3 ? 38 : 33;
      const r2 = 43;
      return `<line x1="${(50 + Math.sin(a) * r1).toFixed(1)}" y1="${(50 - Math.cos(a) * r1).toFixed(1)}" x2="${(50 + Math.sin(a) * r2).toFixed(1)}" y2="${(50 - Math.cos(a) * r2).toFixed(1)}" stroke-width="${i % 3 ? 2 : 4}"/>`;
    }).join('');
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="3"/>${ticks}<line class="hand-h" x1="50" y1="50" x2="50" y2="27" stroke-width="6"/><line class="hand-m" x1="50" y1="50" x2="50" y2="13" stroke-width="3.5"/><circle cx="50" cy="50" r="4.5" fill="currentColor"/></svg>`;
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
        <div class="bg__grain"></div>
      </div>
      <div class="progress" aria-hidden="true"></div>
      <a class="skip" href="#main">Skip to content</a>
      <header class="hdr" id="hdr">
        <a class="brand" href="${url('index.html')}" aria-label="Lasse Meerburg — home">
          <span class="brand__mark" aria-hidden="true"><span>LM</span></span>
          <span class="brand__name">Lasse Meerburg<small>Game Producer</small></span>
        </a>
        <nav class="nav" aria-label="Main">${navLinks}</nav>
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
      <button class="to-top" type="button" aria-label="Back to top">${ICON.up}</button>
      <div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Main menu" hidden>
        <div class="menu__bg" data-menu-close></div>
        <div class="menu__deco" aria-hidden="true">Menu</div>
        <nav class="menu__list" aria-label="Menu">${menuItems}</nav>
        <p class="menu__hint"><kbd>↑↓</kbd> Select · <kbd>Enter</kbd> Confirm · <kbd>Esc</kbd> Back</p>
        <div class="menu__extras" role="group" aria-labelledby="extras-title">
          <p class="menu__extras-title" id="extras-title">Extras</p>
          <button class="dh-btn" id="dh-btn" type="button" aria-pressed="false">${ICON.clock}<span>Dark Hour theme</span><b class="menu__state">Off</b></button>
          <button class="sfx-btn" id="sfx-btn" type="button" aria-pressed="false">${ICON.speaker}<span>Sound effects</span><b class="menu__state">Off</b></button>
        </div>
        <button class="btn menu__close" type="button" data-menu-close>Close ✕</button>
      </div>
      <div class="dh-flash" aria-hidden="true"><div class="dh-flash__time"></div><div class="dh-flash__sub"></div></div>
      <div class="dh-stamp" aria-hidden="true">${clockSVG()}<b class="dh-stamp__time"></b><span class="dh-stamp__sub"></span></div>
      <div class="finisher" aria-hidden="true">
        <div class="finisher__bg"></div><div class="finisher__lines"></div>
        <svg class="finisher__ink" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"></svg>
        <div class="finisher__slash finisher__slash--1"></div><div class="finisher__slash finisher__slash--2"></div><div class="finisher__slash finisher__slash--3"></div>
        <p class="finisher__text"><b>Let's</b><b>team up!</b></p>
      </div>
      <div class="pad-bar" aria-hidden="true" hidden></div>
      <div class="wipe" aria-hidden="true"><i></i><i></i><i></i><div class="wipe__label"><b></b><span>Now loading</span></div></div>`);

    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Sound toggle + global hover / press feedback --------------- */
  function initSfx() {
    const btn = $('#sfx-btn');
    const sync = () => {
      btn.setAttribute('aria-pressed', String(sfx.on));
      $('.menu__state', btn).textContent = sfx.on ? 'On' : 'Off';
    };
    sync();
    btn.addEventListener('click', () => {
      sfx.set(!sfx.on);
      sync();
      sfx.chime();
    });

    let hoverEl = null;
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest(INTERACTIVE);
      if (el === hoverEl) return;
      hoverEl = el;
      if (el && e.pointerType === 'mouse') sfx.hover();
    });
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(INTERACTIVE);
      if (!el) return;
      if (el !== btn) sfx.select();
      if (e.pointerType !== 'mouse' && navigator.vibrate) navigator.vibrate(8);
    });
  }

  /* ---------- Scroll: header, progress, back-to-top, parallax ----------- */
  function initScroll() {
    const hdr = $('#hdr');
    const bar = $('.progress');
    const toTop = $('.to-top');
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      hdr.classList.toggle('is-scrolled', y > 12);
      if (y > lastY + 6 && y > 260 && !doc.classList.contains('menu-open')) hdr.classList.add('is-hidden');
      else if (y < lastY - 6 || y <= 260) hdr.classList.remove('is-hidden');
      if (Math.abs(y - lastY) > 6) lastY = y;
      bar.style.transform = `scaleX(${(y / max).toFixed(4)})`;
      toTop.classList.toggle('is-shown', y > window.innerHeight * 0.8);
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    // Bring the hidden header back when the pointer heads for the top edge.
    document.addEventListener('pointermove', (e) => {
      if (e.clientY < 80) hdr.classList.remove('is-hidden');
    }, { passive: true });
    hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
    toTop.addEventListener('click', () => {
      sfx.whoosh();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    update();
  }

  /* ---------- Dark Hour theme -------------------------------------------- */
  function initDarkHour() {
    const btn = $('#dh-btn');
    const flash = $('.dh-flash');
    const stamp = $('.dh-stamp');

    const apply = (dark) => {
      if (dark) doc.dataset.theme = 'dark-hour';
      else delete doc.dataset.theme;
      btn.setAttribute('aria-pressed', String(dark));
      $('.menu__state', btn).textContent = dark ? 'On' : 'Off';
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#06170b' : '#051538');
    };

    const showStamp = (dark) => {
      const now = new Date();
      const h = dark ? 0 : (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
      const m = dark ? 0 : now.getMinutes() * 6;
      stamp.style.setProperty('--h', `${h}deg`);
      stamp.style.setProperty('--m', `${m}deg`);
      $('.dh-stamp__time', stamp).textContent = dark ? '12:00' : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      $('.dh-stamp__sub', stamp).textContent = dark ? 'The Dark Hour' : 'Back to normal time';
      stamp.classList.toggle('dh-stamp--day', !dark);
      restart(stamp, 'is-on');
    };

    apply(doc.dataset.theme === 'dark-hour');

    btn.addEventListener('click', () => {
      const dark = doc.dataset.theme !== 'dark-hour';
      store.set('p3-theme', dark ? 'dark-hour' : 'day');
      if (reduceMotion) { apply(dark); return; }
      if (dark) sfx.bell(); else sfx.chime();

      const r = btn.getBoundingClientRect();
      doc.style.setProperty('--vx', `${(r.left + r.width / 2).toFixed(0)}px`);
      doc.style.setProperty('--vy', `${(r.top + r.height / 2).toFixed(0)}px`);

      if (document.startViewTransition) {
        showStamp(dark);
        document.startViewTransition(() => apply(dark));
        return;
      }

      // Fallback: full-screen flash, then swap the theme underneath it.
      $('.dh-flash__time', flash).textContent = dark ? '12:00' : new Date().toTimeString().slice(0, 5);
      $('.dh-flash__sub', flash).textContent = dark ? 'The Dark Hour' : 'Back to normal time';
      flash.classList.toggle('dh-flash--day', !dark);
      restart(flash, 'is-on');
      setTimeout(() => apply(dark), 260);
    });
  }

  /* ---------- Menu ------------------------------------------------------ */
  function initMenu() {
    const menu = $('#menu');
    const openBtn = $('#menu-btn');
    const items = $$('.menu__item', menu);
    const extras = $$('.menu__extras button', menu);
    const closeBtn = $('.menu__close', menu);
    let idx = Math.max(0, PAGES.findIndex((p) => p.id === activeId));
    let lastFocus = null;
    let closeTimer = 0;

    const setActive = (i, focus = true, sound = false) => {
      const prev = idx;
      idx = (i + items.length) % items.length;
      items.forEach((el, j) => el.classList.toggle('is-active', j === idx));
      if (focus) items[idx].focus({ preventScroll: true });
      if (sound && prev !== idx) sfx.hover();
    };

    const isOpen = () => !menu.hidden && !menu.classList.contains('is-closing');

    const open = () => {
      clearTimeout(closeTimer);
      lastFocus = document.activeElement;
      menu.classList.remove('is-closing');
      menu.hidden = false;
      doc.classList.add('menu-open');
      $('#hdr').classList.remove('is-hidden');
      openBtn.setAttribute('aria-expanded', 'true');
      items.forEach((el) => el.classList.remove('is-confirm'));
      setActive(idx);
      sfx.open();
    };

    const close = () => {
      if (!isOpen()) return;
      sfx.back();
      openBtn.setAttribute('aria-expanded', 'false');
      doc.classList.remove('menu-open');
      menu.classList.add('is-closing');
      closeTimer = setTimeout(() => {
        menu.hidden = true;
        menu.classList.remove('is-closing');
      }, reduceMotion ? 0 : 260);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };

    openBtn.addEventListener('click', open);
    $$('[data-menu-close]', menu).forEach((el) => el.addEventListener('click', close));
    items.forEach((el, i) => {
      el.addEventListener('mouseenter', () => setActive(i));
      el.addEventListener('focus', () => setActive(i, false));
    });

    menu.addEventListener('keydown', (e) => {
      const onItem = items.includes(document.activeElement);
      if (onItem && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) { e.preventDefault(); setActive(idx + 1, true, true); }
      else if (onItem && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) { e.preventDefault(); setActive(idx - 1, true, true); }
      else if (e.key === 'Tab') {
        const focusables = [...items, ...extras, closeBtn];
        const pos = focusables.indexOf(document.activeElement);
        e.preventDefault();
        focusables[(pos + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
      }
    });

    menuApi = { open, close, isOpen };
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
  function labelFor(dest) {
    const file = dest.pathname.split('/').pop() || 'index.html';
    if (/\/projects\/[^/]+$/.test(dest.pathname)) {
      const p = PROJECTS.find((x) => `${x.slug}.html` === file);
      if (p) return p.title;
    }
    if (file === 'velvet.html') return 'Velvet Room';
    const pg = PAGES.find((x) => x.href === file);
    return pg ? pg.label : 'Loading';
  }

  function initWipe() {
    const wipe = $('.wipe');
    const label = $('.wipe__label b', wipe);

    if (doc.classList.contains('wipe-pending')) {
      const arriving = session.get('p3-wipe');
      label.textContent = session.get('p3-wipe-label') || 'Lasse Meerburg';
      if (!arriving) wipe.classList.add('is-intro');
      wipe.classList.add('is-out');
      doc.classList.remove('wipe-pending');
      ['p3-wipe', 'p3-wipe-label'].forEach((k) => session.del(k));
      setTimeout(() => wipe.classList.remove('is-out', 'is-intro'), arriving ? 1100 : 1700);
      if (!reduceMotion) {
        const hold = arriving ? 420 : 1050;
        revealGate = performance.now() + hold;
        doc.classList.add('is-arriving');
        setTimeout(() => doc.classList.remove('is-arriving'), hold);
      }
    }
    session.set('p3-seen', '1');

    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        wipe.classList.remove('is-in', 'is-out', 'is-intro');
        doc.classList.remove('wipe-pending');
        $$('.menu__item.is-confirm').forEach((el) => el.classList.remove('is-confirm'));
        session.del('p3-wipe');
      }
    });

    if (reduceMotion) return;

    goTo = (href, text) => {
      const dest = new URL(href, location.href);
      label.textContent = text || labelFor(dest);
      session.set('p3-wipe', '1');
      session.set('p3-wipe-label', label.textContent);
      sfx.whoosh();
      wipe.classList.remove('is-out', 'is-intro');
      wipe.classList.add('is-in');
      setTimeout(() => { location.href = dest.href; }, 680);
    };

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const dest = new URL(a.href, location.href);
      if (!/^https?:$/.test(dest.protocol) || dest.origin !== location.origin) return;
      if (dest.pathname === location.pathname && dest.search === location.search) return; // same page / hash link
      e.preventDefault();
      if (a.classList.contains('menu__item')) a.classList.add('is-confirm');
      if (a.hasAttribute('data-finisher') && finisherApi) {
        finisherApi.play(() => goTo(dest.href));
        return;
      }
      goTo(dest.href);
    });
  }

  /* ---------- "Let's team up!" finish screen ----------------------------- */
  function initFinisher() {
    const el = $('.finisher');
    if (!el || reduceMotion) return;
    let blobs = '';
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 26 + Math.random() * 30;
      const r = 0.8 + Math.random() * (i < 8 ? 7 : 2.5);
      blobs += `<circle cx="${(50 + Math.cos(a) * d).toFixed(1)}" cy="${(50 + Math.sin(a) * d * 0.62).toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }
    $('.finisher__ink', el).innerHTML = blobs;
    finisherApi = {
      play(done) {
        sfx.hit();
        restart(el, 'is-on');
        setTimeout(done, 1250);
      },
    };
    window.addEventListener('pageshow', (e) => { if (e.persisted) el.classList.remove('is-on'); });
  }

  /* ---------- Reveal & stagger ------------------------------------------- */
  const STAGGER = '.checklist, .facts, .params, .skills, .equip, .legend, .hero__stats, .chips, .choices, .meta, .teams, .slink__list, .btn-row, .ftr__nav, .hmenu, .quest__rows, .compendium__group';

  function initReveal() {
    $$('[data-reveal]').forEach((el) => onVisible(el, () => el.classList.add('is-in')));
    $$('.title, .timeline, .ftr').forEach((el) => onVisible(el, () => el.classList.add('is-in')));
    if (reduceMotion) return;
    $$(STAGGER).forEach((c) => {
      c.dataset.stagger = '';
      [...c.children].forEach((child, i) => child.style.setProperty('--i', i));
      onVisible(c, () => c.classList.add('is-in'));
    });
    $$('.shot').forEach((el) => onVisible(el, () => el.classList.add('is-in')));
  }

  /* ---------- Cards: fade in when they scroll into view ---------------- */
  function initCards() {
    $$('.arcana').forEach((card) => onVisible(card, () => card.classList.add('is-dealt')));
  }

  /* ---------- Counters --------------------------------------------------- */
  function initCounters() {
    if (reduceMotion) return;
    $$('.hero__stats b, .teams b, .slink__team').forEach((el) => {
      const node = el.firstChild;
      if (!node || node.nodeType !== 3) return;
      const m = node.textContent.match(/^(\d+)(.*)$/);
      if (!m) return;
      const target = Number(m[1]);
      const suffix = m[2];
      node.textContent = `0${suffix}`;
      onVisible(el, () => {
        const dur = 900 + target * 25;
        let t0 = 0;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          node.textContent = `${target}${suffix}`;
          restart(el, 'is-counted');
        };
        const step = (now) => {
          if (finished) return;
          if (!t0) t0 = now;
          const p = Math.min(1, (now - t0) / dur);
          node.textContent = `${Math.round(target * (1 - Math.pow(1 - p, 4)))}${suffix}`;
          if (p < 1) requestAnimationFrame(step);
          else finish();
        };
        setTimeout(() => requestAnimationFrame(step), 250);
        // rAF pauses in background tabs; never leave a counter stuck short.
        setTimeout(finish, 250 + dur + 600);
      });
    });
  }

  /* ---------- Typewriter ------------------------------------------------- */
  function typewriter(el, text, speed = 20, box = null) {
    el.textContent = '';
    const ghost = document.createElement('span');
    ghost.className = 'tw-ghost';
    ghost.textContent = text;
    const live = document.createElement('span');
    live.className = 'tw-live';
    live.setAttribute('aria-hidden', 'true');
    el.append(ghost, live);

    const ctrl = { done: false, finish() {} };
    const done = () => {
      ctrl.done = true;
      if (box) { box.classList.remove('is-typing'); box.classList.add('is-typed'); }
    };
    if (box) { box.classList.add('is-typing'); box.classList.remove('is-typed'); }
    if (reduceMotion) { live.textContent = text; done(); return ctrl; }

    let i = 0;
    let timer = 0;
    ctrl.finish = () => {
      if (ctrl.done) return;
      clearTimeout(timer);
      live.textContent = text;
      done();
    };
    const tick = () => {
      i += 1;
      live.textContent = text.slice(0, i);
      if (i >= text.length) { done(); return; }
      const ch = text[i - 1];
      if (i % 2 === 0 && /\S/.test(ch)) sfx.blip();
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
      onVisible(box, () => setTimeout(() => { tw = typewriter(textEl, text, 20, box); }, 350));
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
        </div>
        <div class="talk__ctrl">
          <button class="btn" type="button" data-prev>◀ Prev</button>
          <span class="talk__count" aria-hidden="true"></span>
          <button class="btn" type="button" data-next>Next ▶</button>
          ${talk.dataset.log ? `<a class="btn talk__log" href="${talk.dataset.log}">All testimonials</a>` : ''}
        </div>`);

      const box = $('.dialog', talk);
      const nameEl = $('.dialog__name', box);
      const textEl = $('.dialog__text', box);
      const roleEl = $('.dialog__role', box);
      const countEl = $('.talk__count', talk);
      let i = 0;
      let tw = null;

      const show = (n, animate = true) => {
        i = (n + quotes.length) % quotes.length;
        const q = quotes[i];
        if (tw) tw.finish();
        nameEl.textContent = q.name;
        roleEl.textContent = q.role;
        countEl.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(quotes.length)}`;
        if (animate && !reduceMotion) { restart(box, 'is-swap'); restart(countEl, 'is-bump'); }
        tw = typewriter(textEl, `“${q.text}”`, 16, box);
      };
      const advance = () => { if (tw && !tw.done) tw.finish(); else show(i + 1); };

      box.addEventListener('click', advance);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sfx.select(); advance(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); sfx.hover(); show(i + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); sfx.hover(); show(i - 1); }
      });
      $('[data-prev]', talk).addEventListener('click', () => show(i - 1));
      $('[data-next]', talk).addEventListener('click', () => show(i + 1));

      nameEl.textContent = quotes[0].name;
      onVisible(talk, () => setTimeout(() => show(0, false), 300));
    });
  }

  /* ---------- Projects index: list + live preview ----------------------- */
  function initSocialLinks() {
    const root = $('[data-slink]');
    if (!root) return;
    const links = $$('.slink__item a', root);
    const panels = $$('.slink__panel', root);
    // On narrow screens the list is hidden and every panel is shown, so only
    // hide inactive panels from assistive tech when the list is visible.
    const wide = window.matchMedia('(min-width: 901px)');
    let current = -1;

    const replay = (panel) => {
      if (reduceMotion || !wide.matches) return;
      const card = $('.arcana', panel);
      if (card) restart(card, 'is-dealt');
      $$('[data-stagger]', panel).forEach((el) => restart(el, 'is-in'));
    };

    const activate = (i, force = false) => {
      if (i === current && !force) return;
      current = i;
      links.forEach((a, j) => a.classList.toggle('is-active', j === i));
      panels.forEach((p, j) => {
        p.classList.toggle('is-active', j === i);
        if (wide.matches && j !== i) p.setAttribute('aria-hidden', 'true');
        else p.removeAttribute('aria-hidden');
      });
      replay(panels[i]);
    };

    links.forEach((a, i) => {
      a.addEventListener('mouseenter', () => activate(i));
      a.addEventListener('focus', () => activate(i));
      a.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        sfx.hover();
        const vis = $$('.slink__item:not(.is-filtered) a', root);
        const k = vis.indexOf(a);
        vis[(k + (e.key === 'ArrowDown' ? 1 : -1) + vis.length) % vis.length].focus();
      });
    });
    wide.addEventListener('change', () => activate(current, true));
    slinkApi = {
      refresh() {
        const vis = $$('.slink__item:not(.is-filtered) a', root);
        if (vis.length && !vis.includes(links[current])) activate(links.indexOf(vis[0]), true);
      },
    };
    current = 0;
    links[0].classList.add('is-active');
    panels.forEach((p, j) => {
      p.classList.toggle('is-active', j === 0);
      if (wide.matches && j !== 0) p.setAttribute('aria-hidden', 'true');
    });
  }

  function initCompendium() {
    const root = $('[data-slink]');
    const bar = $('.compendium');
    if (!root || !bar) return;
    const list = $('.slink__list', root);
    const stage = $('.slink__stage', root);
    const items = $$('.slink__item', list);
    const panels = $$('.slink__panel', stage);
    const countEl = $('.compendium__count', bar);
    let filter = 'all';
    let sort = 'newest';
    const key = (el) => ({ date: el.dataset.date, team: +el.dataset.team });
    const sorters = {
      newest: (a, b) => b.date.localeCompare(a.date),
      oldest: (a, b) => a.date.localeCompare(b.date),
      team: (a, b) => b.team - a.team,
    };
    const match = (el) => filter === 'all' || el.dataset.tags.split(' ').includes(filter);

    const apply = (animate) => {
      const first = new Map(items.map((el) => [el, el.getBoundingClientRect()]));
      const by = (a, b) => sorters[sort](key(a), key(b));
      [...items].sort(by).forEach((el) => list.append(el));
      [...panels].sort(by).forEach((el) => stage.append(el));
      items.forEach((el) => el.classList.toggle('is-filtered', !match(el)));
      panels.forEach((el) => el.classList.toggle('is-filtered', !match(el)));
      if (animate && !reduceMotion && Element.prototype.animate) {
        items.forEach((el) => {
          if (el.classList.contains('is-filtered')) return;
          const a = first.get(el);
          const b = el.getBoundingClientRect();
          if (!a.height) {
            el.animate([{ opacity: 0, transform: 'translateX(-30px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          } else if (Math.abs(a.top - b.top) > 1) {
            el.animate([{ transform: `translateY(${a.top - b.top}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.2,1)' });
          }
        });
      }
      const n = items.filter((el) => !el.classList.contains('is-filtered')).length;
      countEl.innerHTML = `<b>${n}</b> / ${items.length} projects`;
      if (slinkApi) slinkApi.refresh();
    };

    bar.addEventListener('click', (e) => {
      const b = e.target.closest('.ctag');
      if (!b) return;
      if (b.dataset.filter) {
        filter = b.dataset.filter;
        $$('[data-filter]', bar).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }
      if (b.dataset.sort) {
        sort = b.dataset.sort;
        $$('[data-sort]', bar).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }
      apply(true);
    });
    apply(false);
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
      setTimeout(() => {
        msgs[k].classList.remove('is-hidden');
        sfx.pop();
        k += 1;
        step();
      }, k === 0 ? 700 : 1100);
    };
    onVisible(phone, step);
  }

  /* ---------- Project pages: newer / older links ------------------------ */
  function initProjectNav() {
    const nav = $('#project-nav');
    const slug = document.body.dataset.project;
    if (!nav || !slug) return;
    const i = PROJECTS.findIndex((p) => p.slug === slug);
    if (i < 0) return;
    const newer = PROJECTS[i - 1];
    const older = PROJECTS[i + 1];
    const link = (p, dir) => `<a class="pnav__link" href="${p.slug}.html">
        <span class="pnav__dir">${dir}</span><span class="pnav__title">${p.title}</span><span class="pnav__arc">${p.when}</span></a>`;
    const all = (dir) => `<a class="pnav__link" href="../projects.html">
        <span class="pnav__dir">${dir}</span><span class="pnav__title">All projects</span><span class="pnav__arc">Newest to oldest</span></a>`;
    nav.innerHTML = (newer ? link(newer, '◀ Newer project') : all('◀ Back to'))
      + (older ? link(older, 'Older project ▶') : all('Back to ▶'));
  }

  /* ---------- Project pages: chapter list -------------------------------- */
  function initChapters() {
    if (PAGE !== 'project') return;
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const targets = [];
    const add = (el, num, text) => {
      if (!el) return;
      if (!el.id) el.id = slug(text);
      targets.push({ el, num, text });
    };
    add($('#quest'), '◆', 'At a glance');
    add($('#summary-title') && $('#summary-title').closest('section'), '≡', 'Summary');
    $$('.h3').forEach((h) => {
      const num = $('.h3__num', h);
      const n = num ? num.textContent.trim() : '•';
      add(h, n, h.textContent.trim().replace(n, '').trim());
    });
    add($('#takeaways-title') && $('#takeaways-title').closest('section'), '★', 'Takeaways');
    if (targets.length < 3) return;

    const nav = document.createElement('nav');
    nav.className = 'chapters is-away';
    nav.setAttribute('aria-label', 'Sections on this page');
    nav.innerHTML = `<ol>${targets.map((t) => `<li><a href="#${t.el.id}"><span class="chapters__num">${t.num}</span><span class="chapters__label">${t.text}</span></a></li>`).join('')}</ol>`;
    document.body.append(nav);
    const links = $$('a', nav);

    let ticking = false;
    const update = () => {
      ticking = false;
      const line = window.innerHeight * 0.4;
      let active = 0;
      targets.forEach((t, i) => { if (t.el.getBoundingClientRect().top < line) active = i; });
      links.forEach((a, i) => a.classList.toggle('is-active', i === active));
      nav.classList.toggle('is-away', window.scrollY < window.innerHeight * 0.5);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Home: main-menu hero --------------------------------------- */
  function initHeroMenu() {
    const nav = $('.hmenu');
    if (!nav) return;
    const items = $$('.hmenu__item', nav);
    let idx = 0;
    const set = (i, focus) => {
      idx = (i + items.length) % items.length;
      items.forEach((el, j) => el.classList.toggle('is-active', j === idx));
      if (focus) items[idx].focus({ preventScroll: true });
    };
    items.forEach((el, i) => {
      el.addEventListener('mouseenter', () => set(i));
      el.addEventListener('focus', () => set(i));
    });
    nav.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); sfx.hover(); set(idx + 1, true); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); sfx.hover(); set(idx - 1, true); }
    });
    set(0);
  }

  /* ---------- CV: calendar that follows the timeline -------------------- */
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function initDayCal() {
    const cal = $('.daycal');
    if (!cal || !('IntersectionObserver' in window)) return;
    const layout = cal.closest('.cv-layout');
    const mEl = $('.daycal__md', cal);
    const yEl = $('.daycal__year', cal);
    const evEl = $('.daycal__event', cal);
    const fx = $('.daycal__fx', cal);
    const entries = $$('.tl[data-date]', layout);

    // Connector from the calendar to the entry it is showing.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'daycal__link');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path class="daycal__path"/><circle class="daycal__dot" r="4"/>';
    layout.append(svg);
    const path = $('.daycal__path', svg);
    const dot = $('.daycal__dot', svg);

    let current = null;
    const draw = () => {
      if (!current || getComputedStyle(cal).display === 'none') { path.setAttribute('d', ''); dot.setAttribute('r', '0'); return; }
      dot.setAttribute('r', '4');
      const L = layout.getBoundingClientRect();
      const a = cal.getBoundingClientRect();
      const b = $('.tl__date', current).getBoundingClientRect();
      const x1 = a.right - L.left - 4;
      const y1 = a.top + a.height * 0.7 - L.top;
      const x2 = b.left - L.left - 8;
      const y2 = b.top + b.height / 2 - L.top;
      const xm = x1 + Math.max(14, (x2 - x1) * 0.4);
      path.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}H${xm.toFixed(1)}V${y2.toFixed(1)}H${x2.toFixed(1)}`);
      dot.setAttribute('cx', x2.toFixed(1));
      dot.setAttribute('cy', y2.toFixed(1));
    };
    let ticking = false;
    const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; draw(); }); } };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const show = (d, flip) => {
      mEl.textContent = MONTHS[d.getMonth()];
      yEl.textContent = d.getFullYear();
      if (flip) restart(mEl, 'is-flip');
    };
    const today = new Date();
    let cur = new Date(today.getFullYear(), today.getMonth(), 1);
    show(cur, false);
    evEl.textContent = 'Today';
    let timer = 0;

    const go = (tl) => {
      clearInterval(timer);
      cal.classList.remove('is-running');
      current = tl;
      entries.forEach((el) => el.classList.toggle('is-current', el === tl));
      evEl.textContent = tl.dataset.title;
      restart(evEl, 'is-swap');
      schedule();
      const parts = tl.dataset.date.split('-').map(Number);
      if (parts.length < 2) {
        // Year-only entries: no exact start month to show.
        mEl.textContent = String(parts[0]);
        yEl.textContent = tl.dataset.span || '';
        restart(mEl, 'is-flip');
        return;
      }
      const target = new Date(parts[0], parts[1] - 1, 1);
      const months = (target.getFullYear() - cur.getFullYear()) * 12 + (target.getMonth() - cur.getMonth());
      if (!months || reduceMotion) { cur = target; show(cur, true); return; }
      fx.textContent = months > 0 ? 'Forward in time' : 'Rewinding';
      cal.classList.add('is-running');
      const start = cur;
      const steps = Math.min(Math.abs(months), 6);
      let k = 0;
      timer = setInterval(() => {
        k += 1;
        show(new Date(start.getFullYear(), start.getMonth() + Math.round((months * k) / steps), 1), true);
        sfx.blip();
        if (k >= steps) {
          clearInterval(timer);
          cur = target;
          show(cur, true);
          cal.classList.remove('is-running');
        }
      }, 90);
    };

    const watch = new IntersectionObserver((list) => {
      list.forEach((en) => { if (en.isIntersecting) go(en.target); });
    }, { rootMargin: '-38% 0px -52% 0px' });
    entries.forEach((el) => watch.observe(el));
  }

  /* ---------- Lightbox (zooms out of the thumbnail) ---------------------- */
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
    const EASE = 'cubic-bezier(.2,.9,.2,1)';
    let cur = 0;
    let opener = null;
    let busy = false;

    const hiRes = (src) => src.replace(/format=\d+w/, 'format=2500w');
    const thumbOf = (i) => $('img', shots[i]);

    const setContent = (i) => {
      cur = (i + shots.length) % shots.length;
      const t = thumbOf(cur);
      img.style.setProperty('--ar', (t.naturalWidth && t.naturalHeight) ? (t.naturalWidth / t.naturalHeight).toFixed(4) : '1.6');
      img.src = t.currentSrc || t.src;
      img.alt = t.alt;
      cap.textContent = ($('figcaption', shots[cur]) || {}).textContent || t.alt;
      const hi = hiRes(t.currentSrc || t.src);
      const pre = new Image();
      const want = cur;
      pre.onload = () => { if (cur === want && !lb.hidden) img.src = hi; };
      pre.src = hi;
    };

    // FLIP between a thumbnail rect and the lightbox image's own rect.
    const flip = (fromRect, reverse) => new Promise((resolve) => {
      if (reduceMotion || !fromRect || !fromRect.width) { resolve(); return; }
      img.style.transition = 'none';
      img.style.transform = 'none';
      const to = img.getBoundingClientRect();
      if (!to.width) { resolve(); return; }
      const s = fromRect.width / to.width;
      const dx = fromRect.left + fromRect.width / 2 - (to.left + to.width / 2);
      const dy = fromRect.top + fromRect.height / 2 - (to.top + to.height / 2);
      const t = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`;
      if (!reverse) { img.style.transform = t; void img.offsetWidth; }
      img.style.transition = `transform .55s ${EASE}, opacity .3s`;
      img.style.transform = reverse ? t : 'none';
      setTimeout(resolve, 560);
    });

    const open = (i) => {
      if (busy) return;
      opener = document.activeElement;
      const rect = thumbOf(i).getBoundingClientRect();
      img.style.opacity = '1';
      setContent(i);
      lb.classList.remove('is-closing');
      lb.hidden = false;
      doc.classList.add('menu-open');
      sfx.open();
      $('.lb__close', lb).focus({ preventScroll: true });
      const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      ready.then(() => flip(rect, false));
    };

    const close = () => {
      if (lb.hidden || busy) return;
      busy = true;
      sfx.back();
      lb.classList.add('is-closing');
      const r = thumbOf(cur).getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < window.innerHeight;
      const anim = inView ? flip(r, true) : new Promise((res) => {
        img.style.transition = 'opacity .25s';
        img.style.opacity = '0';
        setTimeout(res, 260);
      });
      anim.then(() => {
        lb.hidden = true;
        lb.classList.remove('is-closing');
        img.style.transition = '';
        img.style.transform = '';
        doc.classList.remove('menu-open');
        busy = false;
        if (opener) opener.focus({ preventScroll: true });
      });
    };

    const step = (dir) => {
      if (busy) return;
      sfx.hover();
      if (reduceMotion) { setContent(cur + dir); return; }
      busy = true;
      img.style.transition = 'transform .18s ease-in, opacity .18s';
      img.style.transform = `translateX(${-dir * 70}px) rotate(${-dir * 2}deg)`;
      img.style.opacity = '0';
      setTimeout(() => {
        setContent(cur + dir);
        img.style.transition = 'none';
        img.style.transform = `translateX(${dir * 70}px) rotate(${dir * 2}deg)`;
        void img.offsetWidth;
        img.style.transition = `transform .4s ${EASE}, opacity .3s`;
        img.style.transform = 'none';
        img.style.opacity = '1';
        setTimeout(() => { busy = false; }, 200);
      }, 180);
    };

    shots.forEach((fig, i) => {
      fig.tabIndex = 0;
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-label', `Enlarge image: ${$('img', fig).alt}`);
      fig.addEventListener('click', () => open(i));
      fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    $('.lb__close', lb).addEventListener('click', close);
    $('.lb__prev', lb).addEventListener('click', () => step(-1));
    $('.lb__next', lb).addEventListener('click', () => step(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'Tab') {
        const f = $$('button', lb);
        const pos = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(pos + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    lightboxApi = { close, isOpen: () => !lb.hidden };
  }

  /* ---------- Card tilt + glare ----------------------------------------- */
  function initTilt() {
    if (reduceMotion || !finePointer) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointerenter', () => el.classList.add('is-tilting'));
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-(y - 0.5) * 7).toFixed(2)}deg`);
        el.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        ['--rx', '--ry', '--px', '--py'].forEach((p) => el.style.removeProperty(p));
      });
    });
  }

  /* ---------- Click splash ----------------------------------------------- */
  function initSplash() {
    if (reduceMotion) return;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const big = !!e.target.closest(INTERACTIVE);
      const el = document.createElement('div');
      el.className = 'splash';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.innerHTML = `<i class="ring${big ? '' : ' ring--small'}"></i>`;
      document.body.append(el);
      setTimeout(() => el.remove(), 700);
    });
  }

  /* ---------- Background: subtle water caustics (WebGL) ----------------- */
  function initCaustics() {
    if (reduceMotion) return;
    if (navigator.connection && navigator.connection.saveData) return;
    const bg = $('.bg');
    const canvas = document.createElement('canvas');
    canvas.className = 'bg__caustics';
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
    const fs = `precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uColor;
vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float cell(vec2 x, float t){
  vec2 n = floor(x), f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.5 + 0.45 * sin(t + 6.2831 * h2(n + g));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.y;
  float t = uTime * 0.16;
  vec2 p = uv * vec2(3.0, 4.0);
  p += 0.22 * vec2(sin(p.y * 1.7 + t * 1.3), cos(p.x * 1.4 - t * 1.1));
  float c1 = 1.0 - smoothstep(0.0, 0.09, cell(p, t));
  float c2 = 1.0 - smoothstep(0.0, 0.06, cell(p * 1.7 + 4.0, t * 1.4));
  float c = pow(c1 * 0.75 + c2 * 0.4, 1.8);
  float depth = gl_FragCoord.y / uRes.y;
  float a = c * (0.1 + 0.9 * smoothstep(0.2, 1.0, depth));
  gl_FragColor = vec4(uColor * a, a);
}`;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uColor = gl.getUniformLocation(prog, 'uColor');

    const hexToRgb = (hex) => {
      const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
      if (!m) return [0.25, 0.86, 1];
      const n = parseInt(m[1], 16);
      return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    const setColor = () => gl.uniform3fv(uColor, hexToRgb(getComputedStyle(doc).getPropertyValue('--cyan')));
    new MutationObserver(setColor).observe(doc, { attributes: true, attributeFilter: ['data-theme'] });

    const scale = 0.5;
    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();
    setColor();
    bg.insertBefore(canvas, $('.bg__rays', bg));
    doc.classList.add('has-caustics');

    let last = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (now - last < 40) return; // ~25 fps is plenty for a slow background
      last = now;
      gl.uniform1f(uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Controller support (Gamepad API) --------------------------- */
  function initGamepad() {
    if (!('getGamepads' in navigator)) return;
    const bar = $('.pad-bar');
    let raf = 0;
    const prev = {};
    const repeat = {};

    const glyphs = (ps) => {
      const g = ps
        ? { A: ['✕', 'ps-x'], B: ['○', 'ps-o'], LR: 'L1 R1', M: 'Options' }
        : { A: ['A', 'xb-a'], B: ['B', 'xb-b'], LR: 'LB RB', M: '☰' };
      const btn = ([t, c]) => `<i class="pad-btn ${c}">${t}</i>`;
      bar.innerHTML = `<span>${btn(g.A)}Select</span><span>${btn(g.B)}Back</span><span><i class="pad-btn pad-btn--wide">${g.M}</i>Menu</span>`
        + `<span><i class="pad-btn pad-btn--wide">${g.LR}</i>Newer / Older</span><span><i class="pad-btn pad-btn--wide">R</i>Scroll</span>`;
    };

    const scope = () => {
      if (lightboxApi && lightboxApi.isOpen()) return $('.lb');
      if (menuApi && menuApi.isOpen()) return $('#menu');
      return document.body;
    };
    const candidates = () => {
      const root = scope();
      return $$('a[href], button:not([disabled]), [tabindex="0"]', root).filter((el) => {
        if (root === document.body && el.closest('#menu, .lb, .pad-bar')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
    };
    const focusEl = (el) => {
      if (!el) return;
      el.focus({ preventScroll: true });
      // Menus, lists and cards select on hover; mirror that for the pad.
      el.dispatchEvent(new Event('mouseenter'));
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      sfx.hover();
    };
    const move = (dx, dy) => {
      const items = candidates();
      const cur = items.includes(document.activeElement) ? document.activeElement : null;
      // Inside a vertical list (menus, link lists, choices) follow DOM order.
      const group = cur && dy && cur.closest('.menu__list, .menu__extras, .hmenu, .slink__list, .choices, .chapters ol, .talk__ctrl');
      if (group) {
        const list = items.filter((el) => group.contains(el));
        const next = list[list.indexOf(cur) + dy];
        if (next) { focusEl(next); return; }
      }
      if (!cur) {
        focusEl(items.find((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }) || items[0]);
        return;
      }
      const a = cur.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      let best = null;
      let bestScore = Infinity;
      items.forEach((el) => {
        if (el === cur) return;
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2 - ax;
        const y = r.top + r.height / 2 - ay;
        const along = x * dx + y * dy;
        if (along <= 4) return;
        const score = along + Math.abs(x * dy - y * dx) * 2.5;
        if (score < bestScore) { bestScore = score; best = el; }
      });
      if (best) focusEl(best);
      else if (dy) window.scrollBy({ top: dy * window.innerHeight * 0.6, behavior: 'smooth' });
    };
    const rumble = (gp) => {
      const act = gp && gp.vibrationActuator;
      if (act && act.playEffect) act.playEffect('dual-rumble', { duration: 60, strongMagnitude: 0.25, weakMagnitude: 0.6 }).catch(() => {});
    };
    const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    const onDir = (d) => {
      doc.classList.add('gamepad-mode');
      if (konamiFeed) konamiFeed(KEY[d]);
      move(...DIR[d]);
    };
    const onButton = (i, gp) => {
      doc.classList.add('gamepad-mode');
      const active = document.activeElement;
      if (i === 0) {
        if (konamiFeed) konamiFeed('a');
        if (active && active !== document.body) { active.click(); rumble(gp); }
        else move(0, 1);
      } else if (i === 1) {
        if (konamiFeed) konamiFeed('b');
        if (lightboxApi && lightboxApi.isOpen()) lightboxApi.close();
        else if (menuApi && menuApi.isOpen()) menuApi.close();
        else if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
      } else if (i === 9) {
        if (menuApi) (menuApi.isOpen() ? menuApi.close() : menuApi.open());
      } else if (i === 4 || i === 5) {
        const dir = i === 4 ? 0 : 1;
        if (lightboxApi && lightboxApi.isOpen()) $(dir ? '.lb__next' : '.lb__prev').click();
        else {
          const link = $$('#project-nav a')[dir];
          if (link) link.click();
        }
      }
    };

    const pressed = (gp, i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const loop = (t) => {
      const pads = [...navigator.getGamepads()].filter(Boolean);
      if (!pads.length) { raf = 0; return; }
      const gp = pads[0];
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      const dirs = {
        up: pressed(gp, 12) || ay < -0.6,
        down: pressed(gp, 13) || ay > 0.6,
        left: pressed(gp, 14) || ax < -0.6,
        right: pressed(gp, 15) || ax > 0.6,
      };
      Object.keys(dirs).forEach((d) => {
        if (!dirs[d]) { delete repeat[d]; return; }
        if (!repeat[d]) { repeat[d] = t + 380; onDir(d); } else if (t >= repeat[d]) { repeat[d] = t + 130; onDir(d); }
      });
      [0, 1, 4, 5, 9].forEach((i) => {
        const on = pressed(gp, i);
        if (on && !prev[i]) onButton(i, gp);
        prev[i] = on;
      });
      const ry = gp.axes[3] || 0;
      if (Math.abs(ry) > 0.2) window.scrollBy(0, ry * 22);
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('gamepadconnected', (e) => {
      const id = e.gamepad.id || '';
      glyphs(/054c|playstation|dualsense|dualshock/i.test(id) || (/wireless controller/i.test(id) && !/xbox|045e/i.test(id)));
      bar.hidden = false;
      doc.classList.add('gamepad-mode');
      if (!raf) raf = requestAnimationFrame(loop);
    });
    window.addEventListener('gamepaddisconnected', () => {
      if (![...navigator.getGamepads()].some(Boolean)) { bar.hidden = true; doc.classList.remove('gamepad-mode'); }
    });
    document.addEventListener('pointerdown', () => doc.classList.remove('gamepad-mode'));
  }

  /* ---------- Konami code → Velvet Room ---------------------------------- */
  function initKonami() {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    konamiFeed = (key) => {
      if (key === code[pos]) pos += 1;
      else pos = key === code[0] ? 1 : 0;
      if (pos === code.length) {
        pos = 0;
        sfx.chime();
        if (PAGE !== 'velvet') goTo(url('velvet.html'), 'Velvet Room');
      }
    };
    document.addEventListener('keydown', (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      konamiFeed(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
  }

  /* ---------- Velvet Room page ------------------------------------------- */
  function initVelvet() {
    if (PAGE !== 'velvet') return;
    const floor = $('.floor b');
    if (!floor || reduceMotion) return;
    let n = 1;
    setInterval(() => {
      n = n >= 99 ? 1 : n + 1;
      floor.textContent = `${pad(n)}F`;
      restart(floor, 'is-tick');
    }, 1400);
  }

  /* ---------- Analytics (GoatCounter, cookie-free) ----------------------- */
  function initAnalytics() {
    if (!GOATCOUNTER || /^(localhost|127\.)/.test(location.hostname) || location.protocol === 'file:') return;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
    document.head.append(s);
  }

  /* ---------- Boot ------------------------------------------------------- */
  // Each feature boots on its own so one failure can't take the page down.
  const run = (fn) => {
    try { fn(); } catch (err) {
      console.error(`[p3] ${fn.name} failed:`, err);
      doc.dataset.p3Error = `${doc.dataset.p3Error || ''}${fn.name}: ${err.message}; `;
    }
  };
  buildChrome();
  [
    initSfx, initScroll, initDarkHour, initMenu, initLightbox, initKeys, initWipe,
    initFinisher, initChapters, initHeroMenu, initCards, initReveal, initCounters,
    initTypewriters, initTalk, initSocialLinks, initCompendium, initChat,
    initProjectNav, initDayCal, initTilt, initSplash, initCaustics, initGamepad,
    initKonami, initVelvet, initAnalytics,
  ].forEach(run);
})();

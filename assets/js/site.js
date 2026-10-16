/* Lasse Meerburg — portfolio concept. Vanilla JS, no build step.
   Injects the shared chrome (header, menu, background, footer) and wires up
   the interactions, plus a "juice" layer: split-text reveals, card deals,
   counters, a trailing cursor, click splashes, magnetic buttons, parallax,
   a FLIP lightbox, the Dark Hour circle reveal and optional synth SFX. */
(() => {
  'use strict';
  window.__p3 = true;

  const doc = document.documentElement;
  const ROOT = doc.dataset.root || '.';
  const PAGE = doc.dataset.page || '';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const INTERACTIVE = 'a[href], button, [role="button"], [data-tilt], .dialog[tabindex]';
  const MAGNETIC = '.btn, .choice, .dh-btn, .menu-btn, .sfx-btn, .to-top';

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
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path class="sfx-wave" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="sfx-off" d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

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
      rank: gate(() => [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.04, delay: i * 0.09 }))),
    };
  })();

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
        <div class="bg__bubbles">${reduceMotion ? '' : bubblesHTML(18)}</div>
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
        <div class="cal" data-cal aria-label="Today"></div>
        <button class="dh-btn" id="dh-btn" type="button" aria-pressed="false" title="Toggle the Dark Hour">${ICON.clock}<span>Dark Hour</span></button>
        <button class="sfx-btn" id="sfx-btn" type="button" aria-pressed="false" title="Toggle sound effects">${ICON.speaker}<span>SFX</span></button>
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
        <div class="menu__cal"><div class="cal" data-cal></div></div>
        <nav class="menu__list" aria-label="Menu">${menuItems}</nav>
        <p class="menu__hint"><kbd>↑↓</kbd> Select · <kbd>Enter</kbd> Confirm · <kbd>Esc</kbd> Back</p>
        <button class="btn menu__close" type="button" data-menu-close>Close ✕</button>
      </div>
      <div class="dh-flash" aria-hidden="true"><div class="dh-flash__time"></div><div class="dh-flash__sub"></div></div>
      <div class="dh-stamp" aria-hidden="true">${clockSVG()}<b class="dh-stamp__time"></b><span class="dh-stamp__sub"></span></div>
      <div class="wipe" aria-hidden="true"><i></i><i></i><i></i><div class="wipe__label"><b></b><span>Now loading</span></div></div>`);

    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Sound toggle + global hover / press feedback --------------- */
  function initSfx() {
    const btn = $('#sfx-btn');
    const sync = () => btn.setAttribute('aria-pressed', String(sfx.on));
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
  let menuApi = null;
  let lightboxApi = null;

  function initScroll() {
    const hdr = $('#hdr');
    const bar = $('.progress');
    const toTop = $('.to-top');
    const bg = $('.bg');
    const hero = $('.hero');
    const phero = $('.phero');
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
      if (!reduceMotion) {
        bg.style.setProperty('--sy', y.toFixed(0));
        if (hero && y < window.innerHeight * 1.5) hero.style.setProperty('--par', `${(y * 0.12).toFixed(1)}px`);
        if (phero && y < window.innerHeight * 1.5) phero.style.setProperty('--par', `${(y * 0.3).toFixed(1)}px`);
      }
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
    toTop.addEventListener('click', () => {
      sfx.whoosh();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    update();
  }

  /* ---------- Screen shake ---------------------------------------------- */
  function shake() {
    if (reduceMotion) return;
    const main = $('#main');
    if (!main) return;
    restart(main, 'is-shaking');
    setTimeout(() => main.classList.remove('is-shaking'), 520);
  }

  /* ---------- Dark Hour ------------------------------------------------- */
  function initDarkHour() {
    const btn = $('#dh-btn');
    const flash = $('.dh-flash');
    const stamp = $('.dh-stamp');

    const apply = (dark) => {
      if (dark) doc.dataset.theme = 'dark-hour';
      else delete doc.dataset.theme;
      btn.setAttribute('aria-pressed', String(dark));
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#06170b' : '#051538');
      renderCals();
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
        setTimeout(shake, 250);
        return;
      }

      // Fallback: full-screen flash, then swap the theme underneath it.
      $('.dh-flash__time', flash).textContent = $('.dh-stamp__time', stamp).textContent = dark ? '12:00' : new Date().toTimeString().slice(0, 5);
      $('.dh-flash__sub', flash).textContent = dark ? 'The Dark Hour' : 'Back to normal time';
      flash.classList.toggle('dh-flash--day', !dark);
      restart(flash, 'is-on');
      setTimeout(() => { apply(dark); shake(); }, 260);
    });
  }

  /* ---------- Menu ------------------------------------------------------ */
  function initMenu() {
    const menu = $('#menu');
    const openBtn = $('#menu-btn');
    const items = $$('.menu__item', menu);
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
      renderCals();
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
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setActive(idx + 1, true, true); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setActive(idx - 1, true, true); }
      else if (e.key === 'Tab') {
        const focusables = [...items, closeBtn];
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
      session.del('p3-wipe');
      session.del('p3-wipe-label');
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

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const dest = new URL(a.href, location.href);
      if (!/^https?:$/.test(dest.protocol) || dest.origin !== location.origin) return;
      if (dest.pathname === location.pathname && dest.search === location.search) return; // same page / hash link
      e.preventDefault();
      label.textContent = labelFor(dest);
      session.set('p3-wipe', '1');
      session.set('p3-wipe-label', label.textContent);
      if (a.classList.contains('menu__item')) a.classList.add('is-confirm');
      sfx.whoosh();
      wipe.classList.remove('is-out', 'is-intro');
      wipe.classList.add('is-in');
      setTimeout(() => { location.href = dest.href; }, 680);
    });
  }

  /* ---------- Split-text headings --------------------------------------- */
  const SPLIT = '.hero__title > span, .title__main, .phero__title, .proj__title a, .slink__info h2, .status__name, .rankup__title, .cta-band h2, .h3';

  function splitText(el) {
    if (el.classList.contains('is-split')) return;
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 1) { walk(child); return; }
        if (child.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'split-w';
          w.setAttribute('aria-hidden', 'true');
          for (const ch of part) {
            const c = document.createElement('span');
            c.className = 'split-c';
            c.style.setProperty('--c', i++);
            c.textContent = ch;
            w.append(c);
          }
          frag.append(w);
        });
        child.replaceWith(frag);
      });
    };
    walk(el);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    el.prepend(sr);
    el.classList.add('is-split');
  }

  function initSplit() {
    if (reduceMotion) return;
    $$(SPLIT).forEach((el) => {
      splitText(el);
      onVisible(el, () => el.classList.add('is-in'));
    });
  }

  /* ---------- Reveal, stagger, misc observers --------------------------- */
  const STAGGER = '.checklist, .facts, .params, .skills, .equip, .legend, .hero__stats, .chips, .choices, .meta, .bars, .slink__list, .btn-row, .ftr__nav';

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

  /* ---------- Arcana cards: back face + deal-in -------------------------- */
  function initCards() {
    $$('.arcana').forEach((card) => {
      const back = document.createElement('span');
      back.className = 'arcana__back';
      back.setAttribute('aria-hidden', 'true');
      card.append(back);
      onVisible(card, () => card.classList.add('is-dealt'));
    });
  }

  /* ---------- Counters --------------------------------------------------- */
  function initCounters() {
    if (reduceMotion) return;
    $$('.hero__stats b, .bar__val, .slink__team').forEach((el) => {
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

  /* ---------- Social link preview (projects index) ---------------------- */
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
      $$('.is-split, [data-stagger]', panel).forEach((el) => restart(el, 'is-in'));
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
        if (e.key === 'ArrowDown') { e.preventDefault(); sfx.hover(); links[(i + 1) % links.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); sfx.hover(); links[(i - 1 + links.length) % links.length].focus(); }
      });
    });
    wide.addEventListener('change', () => activate(current, true));
    current = 0;
    links[0].classList.add('is-active');
    panels.forEach((p, j) => {
      p.classList.toggle('is-active', j === 0);
      if (wide.matches && j !== 0) p.setAttribute('aria-hidden', 'true');
    });
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
        restart(phone, 'is-buzz');
        sfx.pop();
        k += 1;
        step();
      }, k === 0 ? 700 : 1100);
    };
    onVisible(phone, step);
  }

  /* ---------- Rank up sparkle burst ------------------------------------- */
  function initRankUp() {
    if (reduceMotion) return;
    $$('.rankup').forEach((box) => onVisible(box, () => {
      setTimeout(() => {
        const flag = $('.rankup__flag', box);
        if (!flag) return;
        for (let i = 0; i < 14; i++) {
          const s = document.createElement('span');
          s.className = 'spark';
          s.style.setProperty('--a', `${(i * 360) / 14 + Math.random() * 12}deg`);
          s.style.setProperty('--r', `${50 + Math.random() * 80}px`);
          flag.append(s);
          setTimeout(() => s.remove(), 1000);
        }
        sfx.rank();
      }, 600);
    }));
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

  /* ---------- Card tilt + holo glare ------------------------------------- */
  function initTilt() {
    if (reduceMotion || !finePointer) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointerenter', () => el.classList.add('is-tilting'));
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-(y - 0.5) * 18).toFixed(2)}deg`);
        el.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        ['--rx', '--ry', '--px', '--py'].forEach((p) => el.style.removeProperty(p));
      });
    });
  }

  /* ---------- Cursor ring, click splash, magnetic buttons, parallax ------ */
  function initCursor() {
    if (reduceMotion || !finePointer) return;
    const ring = document.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);

    let x = -100, y = -100, rx = -100, ry = -100, s = 1, target = 1, raf = 0, shown = false;
    const loop = () => {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      s += (target - s) * 0.25;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) rotate(45deg) scale(${s.toFixed(3)})`;
      raf = (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1 || Math.abs(target - s) > 0.005) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) { shown = true; rx = x; ry = y; ring.classList.add('is-visible'); }
      ring.classList.toggle('is-hover', !!e.target.closest(INTERACTIVE));
      kick();
    }, { passive: true });
    document.addEventListener('pointerdown', () => { target = 0.6; ring.classList.add('is-down'); kick(); });
    document.addEventListener('pointerup', () => { target = 1; ring.classList.remove('is-down'); kick(); });
    doc.addEventListener('mouseleave', () => { shown = false; ring.classList.remove('is-visible'); });
  }

  function initSplash() {
    if (reduceMotion) return;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const big = !!e.target.closest(INTERACTIVE);
      const el = document.createElement('div');
      el.className = 'splash';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      let html = '<i class="ring"></i><i class="ring ring--2"></i>';
      const n = big ? 10 : 6;
      for (let i = 0; i < n; i++) {
        html += `<i class="drop" style="--a:${((360 / n) * i + Math.random() * 25).toFixed(0)}deg;--r:${(28 + Math.random() * 44).toFixed(0)}px"></i>`;
      }
      for (let i = 0; i < (big ? 3 : 2); i++) {
        html += `<i class="bub" style="--dx:${(Math.random() * 50 - 25).toFixed(0)}px;--d:${(0.9 + Math.random() * 0.7).toFixed(2)}s;--s:${(5 + Math.random() * 8).toFixed(1)}px"></i>`;
      }
      el.innerHTML = html;
      document.body.append(el);
      setTimeout(() => el.remove(), 1700);
    });
  }

  function initMagnet() {
    if (reduceMotion || !finePointer) return;
    let cur = null;
    const reset = (el) => { if (el) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); } };
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest(MAGNETIC);
      if (cur && cur !== el) reset(cur);
      cur = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(1)}px`);
      el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height - 0.5) * 10).toFixed(1)}px`);
    }, { passive: true });
    doc.addEventListener('mouseleave', () => { reset(cur); cur = null; });
  }

  function initPointerParallax() {
    if (reduceMotion || !finePointer) return;
    const bg = $('.bg');
    const hero = $('.hero');
    let px = 0, py = 0, raf = 0;
    window.addEventListener('pointermove', (e) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        bg.style.setProperty('--mxp', px.toFixed(3));
        if (hero) {
          hero.style.setProperty('--hx', px.toFixed(3));
          hero.style.setProperty('--hy', py.toFixed(3));
        }
      });
    }, { passive: true });
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
  renderCals();
  setInterval(renderCals, 60000);
  [
    initSfx, initScroll, initDarkHour, initMenu, initLightbox, initKeys, initWipe,
    initSplit, initCards, initReveal, initCounters, initTypewriters, initTalk,
    initSocialLinks, initChat, initRankUp, initProjectNav, initTilt,
    initCursor, initSplash, initMagnet, initPointerParallax,
  ].forEach(run);
})();

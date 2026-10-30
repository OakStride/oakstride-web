/* site.js - delat beteende for de sex huvudsidorna. Ersatter det inline-skript for
   mobilmenyn som tidigare lag kopierat i varje fil. Inga externa bibliotek.
   1. Headerns lage (genomskinlig over heron, solid annars) - hojden mats, inte gissas
   2. Mobilmenyn (hamburgaren)
   3. Tjanster-panelen. I HTML ar triggern en vanlig lank till sidans tjansteavsnitt,
      sa menyn fungerar utan JS. Har forstarks den till en knapp med aria-expanded
      (klick, Enter/Space, Esc, klick utanfor, hover pa breda skarmar).
   4. Roterande ord i heron: tva byten med 2 s mellanrum, sedan stannar det pa sista
      ordet. Hela rorelsen ar klar inom 5 s (WCAG 2.2.2 utan pausknapp).
   Rotationen startar aldrig vid prefers-reduced-motion. */
(function () {
  var root = document.documentElement;
  root.classList.add('js'); // satts redan i <head>; har som reserv
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var desktop = window.matchMedia('(min-width: 901px)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.hero');
  var nav = header ? header.querySelector('.nav') : null;

  // ---- 1. Headerns lage ----
  // Hojden mats nar menyn ar stangd och skrivs till --header-h, som heron och
  // scroll-padding laser. Samma varde styr observatorns rootMargin.
  var hio = null;
  var measure = function () {
    if (!header || (nav && nav.classList.contains('open'))) return;
    var h = header.offsetHeight;
    if (!h) return;
    root.style.setProperty('--header-h', h + 'px');
    if (hero && hasIO) {
      if (hio) hio.disconnect();
      hio = new IntersectionObserver(function (entries) {
        header.classList.toggle('over-hero', entries[0].isIntersecting);
      }, { rootMargin: '-' + h + 'px 0px 0px 0px', threshold: 0 });
      hio.observe(hero);
    }
  };
  if (header) {
    measure();
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  if (header) {
    var toggle = header.querySelector('.nav-toggle');
    var trigger = header.querySelector('.nav-trigger');
    var panel = trigger ? document.getElementById(trigger.getAttribute('data-panel')) : null;
    var item = trigger ? trigger.parentNode : null;
    var scrim = document.querySelector('.nav-scrim');
    var openedByHover = 0;
    var hoverTimer = null;

    // ---- 3. Tjanster-panelen ----
    var isOpen = function () { return panel && panel.classList.contains('is-open'); };
    var setPanel = function (open, returnFocus) {
      if (!panel) return;
      panel.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      header.classList.toggle('panel-open', open && desktop.matches);
      if (scrim) scrim.hidden = !(open && desktop.matches);
      if (!open && returnFocus) trigger.focus();
    };

    // ---- 2. Mobilmenyn ----
    var setMenu = function (open, returnFocus) {
      if (!nav || !toggle) return;
      nav.classList.toggle('open', open);
      header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) setPanel(false);
      if (!open && returnFocus) toggle.focus();
    };

    if (toggle) {
      toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    }

    if (trigger && panel) {
      // Lanken blir en knapp: rollen, tillstandet och Space (Enter ger en lank sjalv).
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', panel.id);
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (isOpen() && Date.now() - openedByHover < 450) return; // hover hann forst
        setPanel(!isOpen());
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setPanel(!isOpen()); }
      });
      item.addEventListener('mouseenter', function () {
        if (!desktop.matches || !canHover.matches) return;
        clearTimeout(hoverTimer);
        if (!isOpen()) { openedByHover = Date.now(); setPanel(true); }
      });
      item.addEventListener('mouseleave', function () {
        if (!desktop.matches || !canHover.matches) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { setPanel(false); }, 220);
      });
      // Tabbar man ut ur panelen pa desktop stangs den.
      item.addEventListener('focusout', function (e) {
        if (!desktop.matches) return;
        if (e.relatedTarget && !item.contains(e.relatedTarget)) setPanel(false);
      });
      if (scrim) scrim.addEventListener('click', function () { setPanel(false); });
      document.addEventListener('click', function (e) {
        if (isOpen() && desktop.matches && !item.contains(e.target)) setPanel(false);
      });
      if (desktop.addEventListener) desktop.addEventListener('change', function () { setPanel(false); setMenu(false); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (isOpen()) { setPanel(false, true); return; }
      if (nav && nav.classList.contains('open')) setMenu(false, true);
    });

    // En vald lank stanger menyn (ankarlankar pa samma sida) - men inte triggern.
    Array.prototype.forEach.call(header.querySelectorAll('nav.links a'), function (a) {
      if (a === trigger) return;
      a.addEventListener('click', function () { setPanel(false); setMenu(false); });
    });
  }

  // ---- 4. Roterande ord ----
  Array.prototype.forEach.call(document.querySelectorAll('[data-rotator]'), function (rot) {
    var words = rot.querySelectorAll('.rot-word');
    if (words.length < 2 || reduce) return;
    var i = 0;
    var show = function (n) { words[i].classList.remove('on'); i = n; words[i].classList.add('on'); };
    var step = function () {
      if (i >= words.length - 1) return; // stannar pa sista ordet
      show(i + 1);
      if (i < words.length - 1) setTimeout(step, 2000);
    };
    setTimeout(step, 2000);
  });
})();

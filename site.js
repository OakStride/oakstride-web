/* site.js - delat beteende for de sex huvudsidorna. Ersatter det inline-skript for
   mobilmenyn som tidigare lag kopierat i varje fil. Inga externa bibliotek.
   1. Headerns lage (genomskinlig over heron, solid annars)
   2. Mobilmenyn (hamburgaren)
   3. Tjanster-panelen (klick, Enter/Space, Esc, klick utanfor, hover pa breda skarmar)
   4. Roterande ord i heron (stannar efter ett varv, pausknapp, pausar nar dold)
   5. Tal som raknas upp nar de syns
   Allt rorligt (4 och 5) startar aldrig vid prefers-reduced-motion. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var desktop = window.matchMedia('(min-width: 901px)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.hero');

  // ---- 1. Headerns lage ----
  if (header && hero && hasIO) {
    var hio = new IntersectionObserver(function (entries) {
      header.classList.toggle('over-hero', entries[0].isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 });
    hio.observe(hero);
  }

  if (header) {
    var nav = header.querySelector('.nav');
    var toggle = header.querySelector('.nav-toggle');
    var trigger = header.querySelector('.nav-trigger');
    var panel = trigger ? document.getElementById(trigger.getAttribute('aria-controls')) : null;
    var item = trigger ? trigger.parentNode : null;
    var scrim = document.querySelector('.nav-scrim');
    var openedByHover = 0;
    var hoverTimer = null;

    // ---- 3. Tjanster-panelen ----
    var setPanel = function (open, returnFocus) {
      if (!panel) return;
      panel.hidden = !open;
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
      // <button> ger Enter och Space av sig sjalv - inget eget tangentbordsfang behovs.
      trigger.addEventListener('click', function () {
        if (!panel.hidden && Date.now() - openedByHover < 450) return; // hover hann forst
        setPanel(panel.hidden);
      });
      item.addEventListener('mouseenter', function () {
        if (!desktop.matches || !canHover.matches) return;
        clearTimeout(hoverTimer);
        if (panel.hidden) { openedByHover = Date.now(); setPanel(true); }
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
        if (!panel.hidden && desktop.matches && !item.contains(e.target)) setPanel(false);
      });
      desktop.addEventListener && desktop.addEventListener('change', function () { setPanel(false); setMenu(false); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (panel && !panel.hidden) { setPanel(false, true); return; }
      if (nav && nav.classList.contains('open')) setMenu(false, true);
    });

    // En vald lank stanger menyn (ankarlankar pa samma sida).
    Array.prototype.forEach.call(header.querySelectorAll('nav.links a'), function (a) {
      a.addEventListener('click', function () { setPanel(false); setMenu(false); });
    });
  }

  // ---- 4. Roterande ord ----
  Array.prototype.forEach.call(document.querySelectorAll('[data-rotator]'), function (rot) {
    var words = rot.querySelectorAll('.rot-word');
    var btn = document.getElementById(rot.getAttribute('data-pause'));
    if (words.length < 2 || reduce) return;
    var i = 0, steps = 0, timer = null, paused = false, done = false, inView = true;
    var show = function (n) { words[i].classList.remove('on'); i = n; words[i].classList.add('on'); };
    var stop = function () { clearInterval(timer); timer = null; };
    var finish = function () { stop(); done = true; if (btn) btn.hidden = true; };
    var tick = function () {
      show((i + 1) % words.length);
      steps += 1;
      if (steps >= words.length) finish(); // ett varv, tillbaka pa forsta ordet
    };
    var start = function () {
      if (timer || done || paused || !inView || document.hidden) return;
      timer = setInterval(tick, 2800);
    };
    if (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        paused = !paused;
        btn.querySelector('[data-label]').textContent = btn.getAttribute(paused ? 'data-play' : 'data-pause-label');
        if (paused) stop(); else start();
      });
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if (hasIO) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        if (inView) start(); else stop();
      }).observe(rot);
    } else {
      start();
    }
  });

  // ---- 5. Tal som raknas upp ----
  // Talet star fardigt i HTML (det ar det skarmlasare och sokmotorer far). Skriptet
  // nollstaller bara den synliga, aria-dolda siffran och raknar fram till samma varde.
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && !reduce && hasIO && window.requestAnimationFrame) {
    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var t0 = null, dur = 1200;
      var step = function (t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { cio.unobserve(en.target); run(en.target); }
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(counters, function (el) {
      el.textContent = '0';
      cio.observe(el);
    });
  }
})();

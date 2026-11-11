/* Samuele Silvestri Architetto – script condiviso da tutte le pagine */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Altezza reale del viewport su mobile ---------- */
  function setFullHeight() {
    root.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  setFullHeight();
  window.addEventListener('resize', setFullHeight);
  window.addEventListener('orientationchange', function () { setTimeout(setFullHeight, 100); });

  /* ---------- Intro: solo in home e solo alla prima visita della sessione ---------- */
  var intro = document.getElementById('intro');
  var introPlaying = false;

  if (intro) {
    if (reduceMotion || root.classList.contains('intro-seen')) {
      intro.style.display = 'none';
    } else {
      introPlaying = true;
      try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
      var introText = document.getElementById('intro-text');
      setTimeout(function () { introText.style.opacity = '1'; }, 100);
      setTimeout(function () {
        introText.style.opacity = '0';
        intro.style.opacity = '0';
      }, 2000);
      setTimeout(function () { intro.style.display = 'none'; }, 3500);
    }
  }

  /* ---------- Slideshow ---------- */
  var slideshow = document.getElementById('slideshow');
  if (slideshow) initSlideshow(slideshow);

  function initSlideshow(slideshow) {
    var DURATION = 4000;                          // tempo per ogni foto
    var FIRST_DURATION = introPlaying ? 8000 : DURATION;  // con l'intro la prima resta di più
    var LOAD_TIMEOUT = 15000;                     // un'immagine che non arriva in 15 s si salta

    var slides = Array.prototype.slice.call(slideshow.querySelectorAll('.slide'));
    var total = slides.length;
    var counters = Array.prototype.slice.call(document.querySelectorAll('[data-counter]'));
    var captionEls = Array.prototype.slice.call(document.querySelectorAll('[data-caption-target]'));

    var loaders = [];
    var current = 0;
    var timer = null;
    var navToken = 0;

    function load(i) {
      if (loaders[i]) return loaders[i];
      var img = slides[i];

      var loading = new Promise(function (resolve) {
        img.addEventListener('load', function () { resolve(true); }, { once: true });
        img.addEventListener('error', function () { resolve(false); }, { once: true });
        if (img.dataset.src && !img.getAttribute('src')) {
          img.src = img.dataset.src;
        } else if (img.complete) {
          resolve(img.naturalWidth > 0);
        }
      });

      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(false); }, LOAD_TIMEOUT);
      });

      loaders[i] = Promise.race([loading, timeout]).then(function (ok) {
        if (!ok) loaders[i] = null;   // al giro successivo si riprova
        return ok;
      });
      return loaders[i];
    }

    // Didascalia come testo (righe separate da "|"), senza innerHTML
    function setCaption(el, text) {
      while (el.firstChild) el.removeChild(el.firstChild);
      text.split('|').forEach(function (line, k) {
        if (k > 0) el.appendChild(document.createElement('br'));
        el.appendChild(document.createTextNode(line));
      });
    }

    function render(i) {
      slides.forEach(function (s, k) {
        s.classList.toggle('active', k === i);
        s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });

      var label = (i + 1) + ' / ' + total;
      counters.forEach(function (el) { el.textContent = label; });

      // In home ogni foto porta didascalia e link al suo progetto
      var cap = slides[i].dataset.caption;
      var href = slides[i].dataset.href;
      captionEls.forEach(function (el) {
        if (cap) setCaption(el, cap);
        if (href && el.tagName === 'A') el.setAttribute('href', href);
      });

      current = i;
      if (total > 1) load((i + 1) % total);   // precarica solo la prossima
    }

    if (total < 2) {   // progetto con una sola immagine: niente scorrimento
      if (total === 1) render(0);
      return;
    }

    slideshow.classList.add('navigable');

    function schedule(delay) {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(function () { goTo(current + 1, 1); }, delay || DURATION);
    }

    function goTo(i, dir) {
      var token = ++navToken;
      clearTimeout(timer);
      dir = dir || 1;
      i = ((i % total) + total) % total;

      var tries = 0;
      function attempt() {
        load(i).then(function (ok) {
          if (token !== navToken) return;   // nel frattempo l'utente ha già cambiato foto
          if (ok) {
            render(i);
            schedule();
          } else if (++tries < total) {
            i = (i + dir + total) % total;
            attempt();
          }
        });
      }
      attempt();
    }

    function next() { goTo(current + 1, 1); }
    function prev() { goTo(current - 1, -1); }

    // Click: metà destra avanti, metà sinistra indietro
    var touchMoved = false;
    slideshow.addEventListener('click', function (e) {
      if (touchMoved) { touchMoved = false; return; }
      var rect = slideshow.getBoundingClientRect();
      if (e.clientX - rect.left < rect.width / 2) prev(); else next();
    });

    // Frecce da tastiera
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    });

    // Swipe su mobile
    var touchX = null;
    slideshow.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
      touchMoved = false;
    }, { passive: true });
    slideshow.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) {
        touchMoved = true;
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });

    // Pausa quando la scheda non è visibile
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else schedule();
    });

    render(0);
    load(0).then(function () { schedule(FIRST_DURATION); });
  }

  /* ---------- Consenso cookie e Google Analytics ---------- */
  var GA_ID = 'G-FW1ER2Y7QD';
  var STORAGE_KEY = 'cookie-consent';
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;
  var gaLoaded = false;

  function readConsent() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  document.getElementById('cookie-accept').addEventListener('click', function () {
    saveConsent('granted');
    window['ga-disable-' + GA_ID] = false;
    banner.hidden = true;
    loadGA();
  });

  document.getElementById('cookie-deny').addEventListener('click', function () {
    saveConsent('denied');
    banner.hidden = true;
    window['ga-disable-' + GA_ID] = true;   // blocca l'invio di altri dati se revocato a metà visita
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-cookie-settings]'), function (btn) {
    btn.addEventListener('click', function () { banner.hidden = false; });
  });

  var consent = readConsent();
  if (consent === 'granted') loadGA();
  else if (consent !== 'denied') banner.hidden = false;
})();

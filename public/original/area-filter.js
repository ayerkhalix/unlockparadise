/* Unlock Paradise area feed filter/sort. Vanilla ES, no deps. */
(function () {
  'use strict';

  var KEYS = ['distance', 'name', 'date', 'rating'];
  var DIRS = ['asc', 'desc'];

  // Parse a card element into a plain record. Missing travel => null.
  function cardData(el) {
    var t = el.getAttribute('data-travel');
    return {
      el: el,
      travel: t === '' || t === null ? null : parseInt(t, 10),
      access: (el.getAttribute('data-access') || '').split('|').filter(Boolean),
      assets: (el.getAttribute('data-assets') || '').split('|').filter(Boolean),
      vip: el.getAttribute('data-vip') === '1',
      title: el.getAttribute('data-title') || '',
      date: parseInt(el.getAttribute('data-date') || '0', 10),
      rating: parseFloat(el.getAttribute('data-rating')) || 0,
      reviews: parseInt(el.getAttribute('data-reviews') || '0', 10),
      search: el.getAttribute('data-search') || el.getAttribute('data-title') || ''
    };
  }

  // state: { key, dir, min, max, rangeActive, access:[], vip:bool }
  function applyFilters(cards, st) {
    return cards.filter(function (c) {
      if (st.search && c.search.indexOf(st.search) === -1) return false; // name/access substring
      if (st.vip && !c.vip) return false;
      if (st.rangeActive) {
        if (c.travel == null) return false;          // unknown travel hidden when range narrowed
        if (c.travel < st.min || c.travel > st.max) return false;
      }
      if (st.access && st.access.length) {
        var hit = c.access.some(function (a) { return st.access.indexOf(a) !== -1; });
        if (!hit) return false;                       // OR within facet
      }
      if (st.assets && st.assets.length) {
        var hitAsset = c.assets.some(function (a) { return st.assets.indexOf(a) !== -1; });
        if (!hitAsset) return false;                  // OR within facet
      }
      return true;
    });
  }

  // travel ascending, nulls always last (stable tie-break by title)
  function byTravelAsc(a, b) {
    if (a.travel == null && b.travel == null) return a.title.localeCompare(b.title);
    if (a.travel == null) return 1;
    if (b.travel == null) return -1;
    if (a.travel !== b.travel) return a.travel - b.travel;
    return a.title.localeCompare(b.title);
  }
  // travel descending, nulls STILL last (not a plain negation)
  function byTravelDesc(a, b) {
    if (a.travel == null && b.travel == null) return a.title.localeCompare(b.title);
    if (a.travel == null) return 1;
    if (b.travel == null) return -1;
    if (a.travel !== b.travel) return b.travel - a.travel;
    return a.title.localeCompare(b.title);
  }

  // rating: higher first (desc) / lower first (asc); zero-review places ALWAYS last
  function byRatingDesc(a, b) {
    var az = a.reviews > 0, bz = b.reviews > 0;
    if (!az && !bz) return a.title.localeCompare(b.title);
    if (!az) return 1;
    if (!bz) return -1;
    if (a.rating !== b.rating) return b.rating - a.rating;
    if (a.reviews !== b.reviews) return b.reviews - a.reviews;
    return a.title.localeCompare(b.title);
  }
  function byRatingAsc(a, b) {
    var az = a.reviews > 0, bz = b.reviews > 0;
    if (!az && !bz) return a.title.localeCompare(b.title);
    if (!az) return 1;   // zero-review STILL last, not a plain negation
    if (!bz) return -1;
    if (a.rating !== b.rating) return a.rating - b.rating;
    if (a.reviews !== b.reviews) return b.reviews - a.reviews;
    return a.title.localeCompare(b.title);
  }

  function sortCards(cards, key, dir) {
    var c = cards.slice();
    if (key === 'distance') {
      c.sort(dir === 'desc' ? byTravelDesc : byTravelAsc);
    } else if (key === 'name') {
      c.sort(function (a, b) { return a.title.localeCompare(b.title); });
      if (dir === 'desc') c.reverse();
    } else if (key === 'date') {
      c.sort(function (a, b) { return a.date - b.date; }); // asc = oldest first
      if (dir === 'desc') c.reverse();                     // desc = newest first
    } else if (key === 'rating') {
      c.sort(dir === 'asc' ? byRatingAsc : byRatingDesc);
    }
    return c;
  }

  function parseState(search) {
    var p = new URLSearchParams(search || '');
    var key = p.get('sort');
    var dir = p.get('dir');
    return {
      key: KEYS.indexOf(key) !== -1 ? key : 'distance',
      dir: DIRS.indexOf(dir) !== -1 ? dir : 'asc',
      min: p.get('mintime') != null ? parseInt(p.get('mintime'), 10) : 0,
      max: p.get('maxtime') != null ? parseInt(p.get('maxtime'), 10) : null, // null = upper bound
      access: (p.get('access') || '').split(',').filter(Boolean),
      assets: (p.get('assets') || '').split(',').filter(Boolean),
      vip: p.get('vip') === '1',
      search: (p.get('q') || '').trim().toLowerCase()
    };
  }

  function serializeState(state, maxBound) {
    var p = new URLSearchParams();
    if (state.key && state.key !== 'distance') p.set('sort', state.key);
    if (state.dir && state.dir !== 'asc') p.set('dir', state.dir);
    if (state.min > 0) p.set('mintime', String(state.min));
    if (state.max != null && state.max < maxBound) p.set('maxtime', String(state.max));
    if (state.access && state.access.length) p.set('access', state.access.join(','));
    if (state.assets && state.assets.length) p.set('assets', state.assets.join(','));
    if (state.vip) p.set('vip', '1');
    if (state.search) p.set('q', state.search);
    var s = p.toString();
    return s ? '?' + s : location.pathname;
  }

  function init() {
    var grid = document.querySelector('.upd-grid');
    var toolbar = document.querySelector('.upd-toolbar');
    if (!grid || !toolbar || grid.dataset.updArchiveReady === 'true') return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.upd-card')).map(cardData);
    var total = cards.length;

    var sortSel  = toolbar.querySelector('[data-ctl="sort"]');
    var dirBtn   = toolbar.querySelector('[data-ctl="dir"]');
    var rangeOut = toolbar.querySelector('[data-ctl="range-out"]');
    var accBoxes = Array.prototype.slice.call(toolbar.querySelectorAll('[data-ctl="access"]'));
    var assetBoxes = Array.prototype.slice.call(toolbar.querySelectorAll('[data-ctl="assets"]'));
    var vipIn   = toolbar.querySelector('[data-ctl="vip"]');
    var searchIn = toolbar.querySelector('[data-ctl="search"]');
    var countEl  = document.querySelector('[data-ctl="count"]'); // lives outside the form (between box & feed)
    var resetBtns = Array.prototype.slice.call(document.querySelectorAll('[data-ctl="reset"]')); // mobile + desktop copies
    var advToggle = toolbar.querySelector('[data-ctl="advanced"]');
    var advPanel  = document.getElementById('upd-advanced');
    var emptyEl  = document.querySelector('.upd-feed__empty');

    var dir = 'asc';

    function setDir(d) {
      dir = d;
      if (dirBtn) {
        dirBtn.setAttribute('data-dir', d);
        dirBtn.setAttribute('data-tip', d === 'asc' ? 'Ascending' : 'Descending');
        dirBtn.setAttribute('aria-label', d === 'asc' ? 'Ascending — tap to sort descending' : 'Descending — tap to sort ascending');
      }
    }

    // ---- Custom dual-handle range slider (no native inputs) ----
    function setupRange() {
      var wrap = toolbar.querySelector('.upd-range');
      if (!wrap) return null;
      var bar  = wrap.querySelector('.upd-range__bar');
      var fill = wrap.querySelector('[data-ctl="range-fill"]');
      var hMin = wrap.querySelector('[data-ctl="handle-min"]');
      var hMax = wrap.querySelector('[data-ctl="handle-max"]');
      var lo   = parseInt(wrap.getAttribute('data-min'), 10) || 0;
      var hi   = parseInt(wrap.getAttribute('data-max'), 10) || 0;
      var step = parseInt(wrap.getAttribute('data-step'), 10) || 10;
      var vMin = lo, vMax = hi;

      function pct(v) { return hi > lo ? (v - lo) / (hi - lo) * 100 : 0; }
      function paint() {
        hMin.style.left = pct(vMin) + '%';
        hMax.style.left = pct(vMax) + '%';
        fill.style.left = pct(vMin) + '%';
        fill.style.right = (100 - pct(vMax)) + '%';
        hMin.setAttribute('aria-valuenow', vMin);
        hMax.setAttribute('aria-valuenow', vMax);
        if (rangeOut) {
          rangeOut.textContent = (vMin === lo && vMax === hi) ? 'Any'
            : (vMax === hi ? vMin + '+ min'                 // top handle = no upper cap
            : vMin + '–' + vMax + ' min');
        }
      }
      function snap(x) { return Math.round(x / step) * step; }
      function valFromX(clientX) {
        var r = bar.getBoundingClientRect();
        var p = r.width ? (clientX - r.left) / r.width : 0;
        p = Math.max(0, Math.min(1, p));
        return Math.max(lo, Math.min(hi, snap(lo + p * (hi - lo))));
      }
      function startDrag(which, ev) {
        ev.preventDefault();
        (which === 'min' ? hMin : hMax).focus();
        function move(e) {
          var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
          var v = valFromX(cx);
          // keep a one-step gap so the handles can never share a spot
          if (which === 'min') { vMin = Math.max(lo, Math.min(v, vMax - step)); }
          else { vMax = Math.min(hi, Math.max(v, vMin + step)); }
          paint(); render();
        }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('touchend', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', up);
      }
      function key(which, e) {
        // each handle is bounded so the two stay at least one step apart
        var loB = which === 'min' ? lo : vMin + step;
        var hiB = which === 'min' ? vMax - step : hi;
        var nv = which === 'min' ? vMin : vMax;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nv -= step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nv += step;
        else if (e.key === 'Home') nv = loB;
        else if (e.key === 'End') nv = hiB;
        else return;
        e.preventDefault();
        nv = Math.max(loB, Math.min(nv, hiB));
        if (which === 'min') vMin = nv; else vMax = nv;
        paint(); render();
      }
      hMin.addEventListener('pointerdown', function (e) { startDrag('min', e); });
      hMax.addEventListener('pointerdown', function (e) { startDrag('max', e); });
      hMin.addEventListener('keydown', function (e) { key('min', e); });
      hMax.addEventListener('keydown', function (e) { key('max', e); });

      return {
        bound: hi, floor: lo,
        getMin: function () { return vMin; },
        getMax: function () { return vMax; },
        set: function (mn, mx) {
          vMin = Math.max(lo, Math.min(mn, hi - step));   // leave room for the gap
          vMax = Math.min(hi, Math.max(mx, vMin + step));
          paint();
        },
        reset: function () { vMin = lo; vMax = hi; paint(); }
      };
    }
    var range = setupRange();
    var maxBound = range ? range.bound : 0;
    var floor = range ? range.floor : 0;

    function currentState() {
      var mn = range ? range.getMin() : 0;
      var mx = range ? range.getMax() : maxBound;
      return {
        key: sortSel.value,
        dir: dir,
        min: mn,
        max: mx,
        rangeActive: (mn > floor) || (mx < maxBound),
        access: accBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }),
        assets: assetBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }),
        vip: vipIn ? vipIn.checked : false,
        search: searchIn ? searchIn.value.trim().toLowerCase() : ''
      };
    }

    function render() {
      var state = currentState();
      var shown = sortCards(applyFilters(cards, state), state.key, state.dir);
      var shownSet = shown.reduce(function (s, c) { s.set(c.el, true); return s; }, new Map());
      cards.forEach(function (c) { c.el.classList.toggle('is-hidden', !shownSet.has(c.el)); });
      shown.forEach(function (c) { grid.appendChild(c.el); }); // reorder in place
      if (countEl) countEl.textContent = 'Showing ' + shown.length + ' of ' + total + ' places';
      if (emptyEl) emptyEl.hidden = shown.length !== 0;
      history.replaceState(null, '', serializeState(state, maxBound));
    }

    // Restore from URL
    var initial = parseState(location.search);
    if (KEYS.indexOf(initial.key) !== -1) sortSel.value = initial.key;
    setDir(initial.dir);
    // Picking "Top rated" should show best-first without a second tap.
    sortSel.addEventListener('change', function () {
      if (sortSel.value === 'rating') setDir('desc');
    });
    if (vipIn) vipIn.checked = initial.vip;
    if (searchIn) searchIn.value = initial.search;
    accBoxes.forEach(function (b) { b.checked = initial.access.indexOf(b.value) !== -1; });
    assetBoxes.forEach(function (b) { b.checked = initial.assets.indexOf(b.value) !== -1; });
    if (range) range.set(initial.min > 0 ? initial.min : floor, initial.max != null ? initial.max : maxBound);

    toolbar.addEventListener('change', render);
    if (searchIn) searchIn.addEventListener('input', render); // live filter per keystroke ('change' only fires on blur)
    if (dirBtn) dirBtn.addEventListener('click', function () { setDir(dir === 'asc' ? 'desc' : 'asc'); render(); });
    function doReset() {
      sortSel.value = 'distance';
      setDir('asc');
      if (vipIn) vipIn.checked = false; // vip reset
      if (searchIn) searchIn.value = '';
      accBoxes.forEach(function (b) { b.checked = false; });
      assetBoxes.forEach(function (b) { b.checked = false; });
      if (range) range.reset();
      render();
    }
    // One-shot press animation: flash teal + spin, then settle back. Class-driven
    // (not :active) so it plays for taps too; blur() drops the lingering focus that
    // otherwise kept the button looking "pressed" after a mobile tap.
    function playReset(btn) {
      btn.classList.remove('upd-reset--anim');
      void btn.offsetWidth;                 // reflow so a rapid re-press restarts the anim
      btn.classList.add('upd-reset--anim');
      btn.blur();
    }
    resetBtns.forEach(function (b) {
      b.addEventListener('click', function (e) { doReset(); playReset(e.currentTarget); });
      b.addEventListener('animationend', function () { b.classList.remove('upd-reset--anim'); });
    });
    if (advToggle && advPanel) {
      var advTimer;
      // Reveal = drop the clip AND fade the content in. The height expands first
      // with the content still hidden + clipped (so no clipped frame is ever shown);
      // only once the height transition finishes do we reveal.
      var advReveal = function () {
        clearTimeout(advTimer);
        if (advPanel.classList.contains('is-open')) advPanel.classList.add('upd-adv-open');
      };
      // Key the reveal to the actual end of the grid-rows transition (about .3s) rather
      // than a fixed timer: fires the instant expansion completes, no extra slack.
      advPanel.addEventListener('transitionend', function (e) {
        if (e.target === advPanel && e.propertyName === 'grid-template-rows') advReveal();
      });
      advToggle.addEventListener('click', function () {
        var open = advPanel.classList.toggle('is-open');
        advToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        clearTimeout(advTimer);
        if (open) {
          // Reduced-motion: no transition (so transitionend won't fire), so reveal now.
          // Otherwise let transitionend trigger the reveal; the timeout is only a
          // fallback in case transitionend never fires.
          var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduce) {
            advPanel.classList.add('upd-adv-open');
          } else {
            advTimer = setTimeout(advReveal, 360);
          }
        } else {
          advPanel.classList.remove('upd-adv-open'); // re-clip + fade out while collapsing
        }
      });
    }

    render();
    grid.dataset.updArchiveReady = 'true';

    // Exact browse restoration is shared with itinerary browsing in BrowsingTrail.

  }

  // Exported for the Node sanity check; harmless in browser.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cardData: cardData, applyFilters: applyFilters, sortCards: sortCards, parseState: parseState, serializeState: serializeState };
  }

  if (typeof window !== 'undefined') {
    window.UPDAreaFilter = { init: init, cardData: cardData, applyFilters: applyFilters, sortCards: sortCards, parseState: parseState, serializeState: serializeState };
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
  }
})();

/* Category hero band parallax fallback: the photo layer scrolls at 30% speed,
   same as the home hero. area-archive.css does this with a scroll timeline
   wherever the browser has one. This script covers desktop browsers that do
   not, driving the ::before layer through a CSS custom property. It stays off
   touch devices: a scroll listener runs a frame behind the scroll there and the
   photo shudders, so they keep a still photo. Skipped for reduced motion. */
(function () {
  'use strict';
  var band = document.querySelector('.upd-feed__header--hero');
  var mm = window.matchMedia;
  if (!band || !mm || mm('(prefers-reduced-motion: reduce)').matches) return;
  if (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) return;
  if (!mm('(hover: hover) and (pointer: fine)').matches) return;
  var ticking = false;
  function upd() { band.style.setProperty('--upd-feed-parallax', ((window.pageYOffset || 0) * 0.3) + 'px'); ticking = false; }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
})();

/* Card photo strips: keep the dots in sync with the snapped slide, and
   make sure a horizontal swipe inside the card <a> never registers as a tap.
   Scrolling itself is native CSS scroll-snap; this is decoration + guard. */
(function () {
  'use strict';
  var tracks = document.querySelectorAll('[data-upd-strip]');
  if (!tracks.length) return;
  Array.prototype.forEach.call(tracks, function (track) {
    var dots = track.parentNode.querySelectorAll('.upd-card__dot');
    var link = track.closest('.upd-card__link');
    var startLeft = 0;
    if ('IntersectionObserver' in window && dots.length) {
      var slides = track.querySelectorAll('img');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.intersectionRatio < .6) return;
          var i = Array.prototype.indexOf.call(slides, en.target);
          Array.prototype.forEach.call(dots, function (d, j) { d.classList.toggle('is-active', j === i); });
        });
      }, { root: track, threshold: .6 });
      Array.prototype.forEach.call(slides, function (img) { io.observe(img); });
    }
    track.addEventListener('pointerdown', function () { startLeft = track.scrollLeft; }, { passive: true });
    if (link) {
      link.addEventListener('click', function (e) {
        if (Math.abs(track.scrollLeft - startLeft) > 8) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    }
  });
})();

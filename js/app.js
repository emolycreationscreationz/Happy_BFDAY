(function () {
  'use strict';

  var C = window.GIFT || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEART = '<svg viewBox="0 0 32 32"><use href="#i-heart"/></svg>';
  var heroVideo = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* ---------- Supabase (REST, no library needed) ---------- */
  var SB = (C.supabaseUrl && C.supabaseAnonKey) ? C.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' : '';
  function sb(path, body) {
    if (!SB) return Promise.reject(new Error('demo'));
    var h = { apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' };
    // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys don't
    if (/^eyJ/.test(C.supabaseAnonKey)) h.Authorization = 'Bearer ' + C.supabaseAnonKey;
    if (path.indexOf('rpc/') !== 0) h.Prefer = 'return=minimal';
    return fetch(SB + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.status === 204 ? null : r.json().catch(function () { return null; });
    });
  }

  /* ---------- Fill text from config ---------- */
  function fill() {
    $$('[data-f]').forEach(function (e) {
      var v = C[e.getAttribute('data-f')];
      if (v != null) e.textContent = v;
    });
    if (C.pageTitle) document.title = C.pageTitle + (C.hisName ? ' · ' + C.hisName : '');
    $('#replyName').placeholder = C.replyNamePlaceholder || 'Your name';
    $('#replyMsg').placeholder = C.replyPlaceholder || '';
    if (C.hisName) $('#replyName').value = C.hisName;
  }

  /* ---------- Heart burst ---------- */
  var COLORS = ['#ff5c8d', '#ff8fb1', '#ffd1de', '#f3c77a', '#e91e63', '#fff3d6'];
  function burst(x, y, n, spread) {
    if (reducedMotion) return;
    var b = el('div', 'burst');
    b.style.left = x + 'px'; b.style.top = y + 'px';
    spread = spread || 160;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.8);
      var p = el('i');
      p.innerHTML = HEART;
      p.style.setProperty('--x', Math.cos(a) * d + 'px');
      p.style.setProperty('--y', Math.sin(a) * d - 40 + 'px');
      p.style.setProperty('--r', (Math.random() * 120 - 60) + 'deg');
      p.style.setProperty('--s', (10 + Math.random() * 18) + 'px');
      p.style.setProperty('--c', COLORS[i % COLORS.length]);
      p.style.setProperty('--dur', (0.9 + Math.random() * 0.8) + 's');
      b.appendChild(p);
    }
    document.body.appendChild(b);
    setTimeout(function () { b.remove(); }, 1900);
  }

  /* ---------- Opening: envelope ---------- */
  function stars() {
    var s = $('.stars');
    for (var i = 0; i < 60; i++) {
      var st = el('i');
      st.style.left = Math.random() * 100 + '%';
      st.style.top = Math.random() * 100 + '%';
      st.style.setProperty('--t', (2 + Math.random() * 3) + 's');
      st.style.setProperty('--d', (Math.random() * 3) + 's');
      s.appendChild(st);
    }
  }

  function typeLines(box, lines, done) {
    var li = 0;
    var caret = el('span', 'caret');
    function nextLine() {
      if (li >= lines.length) { caret.remove(); done(); return; }
      var p = el('p'), text = lines[li++], ci = 0;
      box.appendChild(p);
      p.appendChild(caret);
      (function tick() {
        if (ci <= text.length) {
          p.textContent = text.slice(0, ci++);
          p.appendChild(caret);
          setTimeout(tick, reducedMotion ? 0 : 36);
        } else {
          setTimeout(nextLine, reducedMotion ? 0 : 380);
        }
      })();
    }
    nextLine();
  }

  function opener() {
    var env = $('#envelope'), op = $('#opener'), opened = false;
    var speed = reducedMotion ? 0.05 : 1;
    function open() {
      if (opened) return;
      opened = true;
      var r = $('#seal').getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 28, 180);
      op.classList.add('opened');
      env.classList.add('open');
      sb('visits', { user_agent: navigator.userAgent.slice(0, 300) }).catch(function () {});
      setTimeout(function () { env.classList.add('rise'); }, 800 * speed);
      setTimeout(function () {
        env.classList.add('read');
        setTimeout(function () {
          typeLines($('#typed'), C.openingLines || [], function () { $('#openGifts').classList.add('show'); });
        }, 900 * speed);
      }, 2000 * speed);
    }
    $('#seal').addEventListener('click', open);
    env.addEventListener('click', function (e) { if (!e.target.closest('#openGifts')) open(); });

    $('#openGifts').addEventListener('click', function (e) {
      burst(e.clientX, e.clientY, 36, 220);
      window.scrollTo(0, 0);
      op.classList.add('gone');
      document.body.classList.remove('locked');
      if (heroVideo) heroVideo.play().catch(function () {});
      setTimeout(function () { op.remove(); }, 1400);
    });
  }

  /* ---------- Hero: AI video + wishes ---------- */
  function hero() {
    var frame = $('#videoFrame'), box = $('#videoBox');
    var ar = String(C.videoAspect || '9/16').split('/').map(Number);
    if (ar.length === 2 && ar[0] > 0 && ar[1] > 0) {
      frame.style.setProperty('--ar', ar[0] + ' / ' + ar[1]);
      if (ar[0] > ar[1]) frame.classList.add('landscape');
    }

    function placeholder() {
      box.innerHTML = '';
      var ph = el('div', 'video-placeholder');
      ph.innerHTML = HEART;
      ph.appendChild(el('span', null, 'A little video for you is on its way…'));
      ph.appendChild(el('small', null, 'coming soon'));
      box.appendChild(ph);
      $('#videoSound').hidden = true;
      heroVideo = null;
    }

    if (!C.video) { placeholder(); }
    else {
      var v = el('video');
      v.muted = true; v.loop = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      if (C.videoPoster) v.poster = C.videoPoster;
      v.src = C.video;
      v.addEventListener('error', placeholder);
      box.appendChild(v);
      heroVideo = v;

      var btn = $('#videoSound');
      btn.hidden = false;
      btn.addEventListener('click', function () {
        v.muted = !v.muted;
        if (!v.muted) v.play().catch(function () {});
        btn.classList.toggle('on', !v.muted);
        btn.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Turn sound off');
        btn.innerHTML = '<svg><use href="#i-' + (v.muted ? 'mute' : 'sound') + '"/></svg>';
      });
      // Pause when scrolled away, resume when back in view
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          if (!heroVideo || document.body.classList.contains('locked')) return;
          if (en[0].isIntersecting) v.play().catch(function () {}); else v.pause();
        }, { threshold: 0.25 }).observe(frame);
      }
    }

    var list = $('#wishes');
    (C.wishes || []).forEach(function (w) {
      var li = el('li', 'wish');
      var ic = el('span', 'wish__icon');
      ic.innerHTML = HEART;
      li.appendChild(ic);
      li.appendChild(el('span', null, w));
      list.appendChild(li);
    });
  }

  /* ---------- Gift 1: memories in a heart ---------- */
  // Slot centres on the heart outline (x%, y%, rotation)
  var SLOTS = [
    [50, 88, 0], [30, 74, -8], [70, 74, 8], [13, 55, -10], [87, 55, 10],
    [9, 31, -6], [91, 31, 6], [27, 11, -10], [73, 11, 10]
  ];
  var PH = [['#ffc2d4', '#ff8fb1'], ['#ffd9c2', '#f3a37a'], ['#f7c6e8', '#d98ad0'], ['#ffe3b3', '#f3c77a'], ['#ffc2cf', '#e91e63']];

  function photo(src, focus, i, alt) {
    if (src) {
      var img = el('img');
      img.src = src; img.alt = alt || ''; img.loading = 'lazy'; img.decoding = 'async';
      if (focus) img.style.objectPosition = focus;
      img.addEventListener('error', function () { img.replaceWith(placeholder(i)); });
      return img;
    }
    return placeholder(i);
  }
  function placeholder(i) {
    var d = el('span', 'ph');
    var c = PH[i % PH.length];
    d.style.setProperty('--c1', c[0]); d.style.setProperty('--c2', c[1]);
    d.innerHTML = HEART;
    return d;
  }

  function memories() {
    var box = $('#collage'), mem = C.memories || [];
    SLOTS.forEach(function (s, i) {
      var m = mem[i], node;
      if (m) {
        node = el('button', 'polaroid');
        node.type = 'button';
        node.setAttribute('aria-label', m.caption || 'Open memory ' + (i + 1));
        var card = el('span', 'polaroid__card');
        var im = el('span', 'polaroid__img');
        im.appendChild(photo(m.src, m.focus, i, m.caption));
        card.appendChild(im);
        node.appendChild(card);
        var pin = el('span', 'polaroid__pin'); pin.innerHTML = HEART;
        node.appendChild(pin);
        node.style.setProperty('--bd', (i * 0.37) + 's');
        node.addEventListener('click', function () { lightbox(m.src, m.focus, m.caption, i); });
      } else {
        node = el('span', 'slot-heart');
        node.innerHTML = HEART;
      }
      node.style.setProperty('--x', s[0] + '%');
      node.style.setProperty('--y', s[1] + '%');
      node.style.setProperty('--r', s[2] + 'deg');
      node.style.setProperty('--d', (0.3 + i * 0.13) + 's');
      box.appendChild(node);
    });

    var hp = C.heartPhoto || {};
    var btn = $('#heartPhoto');
    var mask = el('span', 'heart-photo__mask');
    if (hp.src) mask.appendChild(photo(hp.src, hp.focus, 0, hp.caption));
    btn.appendChild(mask);
    btn.setAttribute('aria-label', hp.caption || 'Open our photo');
    btn.addEventListener('click', function (e) {
      burst(e.clientX, e.clientY, 14, 110);
      lightbox(hp.src, hp.focus, hp.caption, 0);
    });

    var lb = $('#lightbox');
    function close() { lb.hidden = true; }
    $('#lightboxClose').addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function lightbox(src, focus, caption, i) {
    var box = $('#lightboxImg');
    box.innerHTML = '';
    box.appendChild(photo(src, focus, i, caption));
    $('#lightboxCap').textContent = caption || '';
    $('#lightbox').hidden = false;
  }

  /* ---------- Gift 2: letter ---------- */
  function letter() {
    var body = $('#letterBody');
    (C.letter || []).forEach(function (t) { body.appendChild(el('p', null, t)); });
  }

  /* ---------- Gift 3: cinema ---------- */
  function youtubeId(u) {
    if (!u) return '';
    u = String(u).trim();
    var m = u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(u) ? u : '';
  }
  function youtubeStart(u) {
    var m = String(u || '').match(/[?&](?:t|start)=(\d+)/);
    return m ? +m[1] : (+C.youtubeStart || 0);
  }

  function cinema() {
    // marquee bulbs around the border
    var bulbs = $('#bulbs'), k = 0, x, y;
    function bulb(l, t) {
      var b = el('i');
      b.style.left = l + '%'; b.style.top = t + '%';
      b.style.setProperty('--d', (k++ % 2) * 0.6 + 's');
      bulbs.appendChild(b);
    }
    for (x = 0; x <= 100; x += 100 / 14) bulb(x, 0);
    for (y = 25; y <= 75; y += 25) bulb(100, y);
    for (x = 100; x >= 0; x -= 100 / 14) bulb(x, 100);
    for (y = 75; y >= 25; y -= 25) bulb(0, y);

    // seats: two glowing ones for us
    var back = $('#seatsBack'), front = $('#seatsFront'), i;
    for (i = 0; i < 9; i++) back.appendChild(el('span', 'seat'));
    for (i = 0; i < 7; i++) {
      var s = el('span', 'seat');
      if (i === 3 || i === 4) { s.className = 'seat us'; s.appendChild(el('span', null, i === 3 ? 'you' : 'me')); }
      front.appendChild(s);
    }

    var id = youtubeId(C.youtubeUrl);
    if (!id) $('#screenIdleText').textContent = 'Our song is coming soon…';

    var th = $('#theater');
    $('#playSong').addEventListener('click', function (e) {
      burst(e.clientX, e.clientY, 20, 150);
      th.classList.add('open');
      if (heroVideo) { heroVideo.muted = true; heroVideo.pause(); }
      if (!id) return;
      // Insert straight away (still inside the tap) so the browser allows sound
      var f = el('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&playsinline=1&rel=0&modestbranding=1&start=' + youtubeStart(C.youtubeUrl);
      f.title = C.songTitle || 'Our song';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      $('#screen').appendChild(f);
      setTimeout(function () { th.classList.add('playing'); $('#screenIdle').remove(); }, 1600);
    });
  }

  /* ---------- Finale: reasons, kisses, reply ---------- */
  function finale() {
    var box = $('#reasons');
    (C.reasons || []).forEach(function (r, i) {
      var b = el('button', 'reason');
      b.type = 'button';
      b.style.setProperty('--rd', (i % 3) * 0.12 + 's');
      var inner = el('span', 'reason__inner');
      var f = el('span', 'reason__face reason__front');
      f.innerHTML = HEART;
      f.appendChild(el('span', null, r.front));
      f.appendChild(el('small', null, 'tap me'));
      var bk = el('span', 'reason__face reason__back', r.back);
      inner.appendChild(f); inner.appendChild(bk);
      b.appendChild(inner);
      b.addEventListener('click', function (e) {
        var flipped = b.classList.toggle('flipped');
        if (flipped) burst(e.clientX, e.clientY, 10, 90);
      });
      box.appendChild(b);
    });

    // Kisses counter
    var count = $('#loveCount'), total = load('bf-kisses', 0), pending = 0, timer;
    function show(n) {
      count.textContent = Number(n).toLocaleString();
      count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
    }
    show(total);
    if (SB) {
      sb('rpc/get_kisses').then(function (n) { if (n != null) { total = +n; show(total); } }).catch(function () {});
    }
    function flush() {
      var n = pending; pending = 0;
      if (!n) return;
      sb('rpc/add_kisses', { amount: n })
        .then(function (t) { if (t != null) { total = +t; show(total); } })
        .catch(function (err) { if (err.message !== 'demo') pending += n; });
    }
    var btn = $('#loveBtn');
    btn.addEventListener('click', function (e) {
      total++; pending++;
      save('bf-kisses', total);
      show(total);
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      var r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 12, 130);
      clearTimeout(timer);
      timer = setTimeout(flush, 900);
    });
    window.addEventListener('pagehide', flush);

    // Reply
    var form = $('#replyForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#replyName').value.trim(), msg = $('#replyMsg').value.trim();
      if (!name || !msg) return;
      var send = $('#replySend');
      send.disabled = true;
      function ok() {
        $('#replyMsg').value = '';
        $('#replyThanks').hidden = false;
        var r = send.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 30, 200);
        send.disabled = false;
      }
      if (!SB) {
        var saved = load('bf-replies', []);
        saved.push({ name: name, message: msg, at: new Date().toISOString() });
        save('bf-replies', saved);
        ok();
        return;
      }
      sb('replies', { name: name, message: msg }).then(ok).catch(function () {
        send.disabled = false;
        toast("Couldn't send it, please try again");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  function reveal() {
    var items = $$('.reveal, .wish, .reason, .paper__body p, #collage');
    if (!('IntersectionObserver' in window) || reducedMotion) {
      items.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    items.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Scroll progress heart ---------- */
  function progress() {
    var rect = $('#progressRect'), ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      rect.setAttribute('y', (32 - 26 * p - 3).toFixed(2));
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Little hearts wherever he taps ---------- */
  function tapHearts() {
    if (reducedMotion) return;
    var last = 0;
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest('input, textarea, .lightbox, #opener')) return;
      var now = Date.now();
      if (now - last < 120) return;
      last = now;
      for (var i = 0; i < 3; i++) {
        var h = el('span', 'tap-heart');
        h.innerHTML = HEART;
        h.style.left = e.clientX + 'px'; h.style.top = e.clientY + 'px';
        h.style.setProperty('--x', (Math.random() * 60 - 30) + 'px');
        h.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
        h.style.color = COLORS[(Math.random() * COLORS.length) | 0];
        h.style.animationDelay = i * 0.08 + 's';
        document.body.appendChild(h);
        setTimeout(h.remove.bind(h), 1300);
      }
    });
  }

  /* ---------- Ambient floating hearts + sparkles ---------- */
  function ambient() {
    var cv = $('#ambient'), cx = cv.getContext('2d');
    if (!cx) return;
    var W, H, dpr, parts = [];
    var cols = ['255,92,141', '255,143,177', '255,209,222', '243,199,122'];
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function make(initial) {
      var heart = Math.random() < 0.6;
      return {
        heart: heart,
        x: Math.random() * W,
        y: initial ? Math.random() * H : H + 20,
        s: heart ? 6 + Math.random() * 14 : 1 + Math.random() * 2,
        v: 0.15 + Math.random() * 0.45,
        a: 0.12 + Math.random() * 0.4,
        w: Math.random() * Math.PI * 2,
        ws: 0.005 + Math.random() * 0.015,
        c: cols[(Math.random() * cols.length) | 0]
      };
    }
    function heart(x, y, s) {
      cx.beginPath();
      cx.moveTo(x, y - s * 0.15);
      cx.bezierCurveTo(x, y - s * 0.5, x - s * 0.5, y - s * 0.5, x - s * 0.5, y - s * 0.15);
      cx.bezierCurveTo(x - s * 0.5, y + s * 0.15, x, y + s * 0.3, x, y + s * 0.5);
      cx.bezierCurveTo(x, y + s * 0.3, x + s * 0.5, y + s * 0.15, x + s * 0.5, y - s * 0.15);
      cx.bezierCurveTo(x + s * 0.5, y - s * 0.5, x, y - s * 0.5, x, y - s * 0.15);
      cx.fill();
    }
    function draw() {
      cx.clearRect(0, 0, W, H);
      parts.forEach(function (p, i) {
        p.y -= p.v; p.w += p.ws;
        var x = p.x + Math.sin(p.w) * 18;
        if (p.y < -30) parts[i] = make(false);
        if (p.heart) {
          cx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
          heart(x, p.y, p.s);
        } else {
          cx.fillStyle = 'rgba(' + p.c + ',' + (p.a * (0.6 + 0.4 * Math.sin(p.w * 4))) + ')';
          cx.beginPath(); cx.arc(x, p.y, p.s, 0, Math.PI * 2); cx.fill();
        }
      });
    }
    size();
    var n = W < 600 ? 26 : 42;
    for (var i = 0; i < n; i++) parts.push(make(true));
    addEventListener('resize', size);
    if (reducedMotion) { draw(); return; }
    (function loop() {
      if (!document.hidden) draw();
      requestAnimationFrame(loop);
    })();
  }

  fill();
  stars();
  hero();
  memories();
  letter();
  cinema();
  finale();
  reveal();
  progress();
  tapHearts();
  ambient();
  opener();
})();

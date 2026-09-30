(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var D = window.GIFT_DEFAULTS || {};
  var SBC = window.SUPABASE_CONFIG || {};
  var BUCKET = 'card-media';
  var MAX_PHOTOS = 9;
  var MAX_VIDEO_MB = 50;

  if (!SBC.url || !SBC.key) { $('#setupWarn').hidden = false; $('#viewEdit').hidden = true; return; }
  var BASE = SBC.url.replace(/\/+$/, '');

  var data = null;             // the card being made
  var dirty = false;
  var busy = 0;                // uploads in progress

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cardUrl(slug) { return new URL('./?card=' + encodeURIComponent(slug), location.href).href; }
  function markDirty() { dirty = true; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Supabase (plain REST, no library) ---------- */
  function headers(extra) {
    var h = { apikey: SBC.key };
    // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys don't
    if (/^eyJ/.test(SBC.key)) h.Authorization = 'Bearer ' + SBC.key;
    for (var k in extra) h[k] = extra[k];
    return h;
  }
  function rpc(name, args) {
    return fetch(BASE + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.message || ('Error ' + r.status));
        return j;
      });
    });
  }
  function uploadBlob(blob, ext, type) {
    var path = 'uploads/' + new Date().toISOString().slice(0, 10) + '/' +
      Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
    return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST', body: blob,
      headers: headers({ 'Content-Type': type, 'x-upsert': 'false', 'cache-control': 'max-age=31536000' })
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || j.error || ('Error ' + r.status)); });
      return BASE + '/storage/v1/object/public/' + BUCKET + '/' + path;
    });
  }

  /* ---------- form definition ---------- */
  // type: text | lines (one per line) | paras (blank line between) | reasons | number | theme | photo | photos | video
  var SECTIONS = [
    { title: 'Names & colours', open: true, fields: [
      { k: 'hisName', type: 'text', label: 'Their name (shown big)', required: true, placeholder: 'e.g. Raj', clear: true },
      { k: 'herName', type: 'text', label: 'Your name', placeholder: 'e.g. Priya', clear: true },
      { k: 'date', type: 'text', label: 'Date', help: 'Any format, e.g. 03 · 10 · 2026' },
      { k: 'theme', type: 'theme', label: 'Colour theme' },
      { k: 'titleLine1', type: 'text', label: 'Title, big word', help: 'e.g. Happy' },
      { k: 'titleLine2', type: 'text', label: 'Title, second line', help: 'e.g. Boyfriend\'s Day, Birthday, Anniversary' }
    ] },
    { title: 'Photos', open: true, fields: [
      { k: 'heartPhoto', type: 'photo', label: 'Big heart photo (middle)' },
      { k: 'memories', type: 'photos', label: 'Photos around the heart (up to ' + MAX_PHOTOS + ')', help: 'Use different photos from the big heart and the last photo.' },
      { k: 'finalPhoto', type: 'photo', label: 'Photo at the end' }
    ] },
    { title: 'Song', open: true, fields: [
      { k: 'youtubeUrl', type: 'text', label: 'YouTube link', placeholder: 'https://youtu.be/…', help: 'Plays in the little cinema. Leave empty to skip it.' },
      { k: 'songTitle', type: 'text', label: 'Song name (optional)' },
      { k: 'youtubeStart', type: 'number', label: 'Start the song at (seconds)' }
    ] },
    { title: 'Messages', fields: [
      { k: 'openingLines', type: 'lines', label: 'Message typed when the envelope opens', help: 'One line per row.' },
      { k: 'wishes', type: 'lines', label: 'Wishes', help: 'One wish per row.' },
      { k: 'letterGreeting', type: 'text', label: 'Letter greeting' },
      { k: 'letter', type: 'paras', label: 'Letter', help: 'Leave an empty line between paragraphs.' },
      { k: 'letterClosing', type: 'text', label: 'Letter closing' },
      { k: 'reasons', type: 'reasons', label: 'Reasons I appreciate you (flip cards)', help: 'One reason per row.' }
    ] },
    { title: 'Video (optional)', fields: [
      { k: 'video', type: 'video', label: 'A short video (plays silently on a loop)', help: 'MP4 or MOV, up to ' + MAX_VIDEO_MB + ' MB. Under 15 MB loads best on phones.' }
    ] }
  ];

  /* ---------- editor ---------- */
  var getters = {};    // key → function returning the field's current value

  function start() {
    data = clone(D);
    // names start empty so nobody sends "My Love & Me" by mistake
    data.hisName = ''; data.herName = '';
    dirty = false;
    var form = $('#editForm');
    form.textContent = '';
    getters = {};
    SECTIONS.forEach(function (sec) {
      var det = el('details', 'panel section');
      det.open = !!sec.open;
      det.appendChild(el('summary', null, sec.title));
      var body = el('div', 'section__body');
      sec.fields.forEach(function (f) { body.appendChild(field(f, data[f.k])); });
      det.appendChild(body);
      form.appendChild(det);
    });
    form.oninput = markDirty;
    $('#viewEdit').hidden = false; $('#viewDone').hidden = true;
    window.scrollTo(0, 0);
  }

  function wrap(f, control) {
    var w = el('div', 'field');
    var lab = el('label', 'field__label', f.label + (f.required ? ' *' : ''));
    if (control.id) lab.htmlFor = control.id;
    w.appendChild(lab);
    w.appendChild(control);
    if (f.help) w.appendChild(el('p', 'field__help', f.help));
    return w;
  }

  var uid = 0;
  function field(f, value) {
    var id = 'f' + (++uid), input;
    switch (f.type) {
      case 'text':
      case 'number':
        input = el('input'); input.id = id; input.type = f.type === 'number' ? 'number' : 'text';
        if (f.type === 'number') input.min = 0;
        if (f.placeholder) input.placeholder = f.placeholder;
        input.value = value == null ? '' : value;
        getters[f.k] = function () { return f.type === 'number' ? (+input.value || 0) : input.value.trim(); };
        return wrap(f, input);

      case 'lines':
      case 'paras':
      case 'reasons':
        input = el('textarea'); input.id = id;
        var arr = value || [];
        if (f.type === 'reasons') arr = arr.map(function (r) { return r.back; });
        input.value = arr.join(f.type === 'paras' ? '\n\n' : '\n');
        input.rows = f.type === 'paras' ? 12 : Math.max(4, arr.length + 1);
        getters[f.k] = function () {
          var parts = f.type === 'paras' ? input.value.split(/\n\s*\n/) : input.value.split('\n');
          parts = parts.map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
          if (f.type === 'reasons') parts = parts.map(function (b, i) { return { front: 'Reason #' + (i + 1), back: b }; });
          return parts;
        };
        return wrap(f, input);

      case 'theme':
        var box = el('div', 'themes'); box.id = id;
        var chosen = value || 'blue';
        Object.keys(Theme.THEMES).forEach(function (name) {
          var b = el('button', 'theme-pick'); b.type = 'button';
          b.appendChild(swatch(name));
          b.appendChild(el('span', null, Theme.THEMES[name].label));
          b.setAttribute('aria-pressed', String(name === chosen));
          b.addEventListener('click', function () {
            chosen = name;
            box.querySelectorAll('.theme-pick').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            markDirty();
          });
          box.appendChild(b);
        });
        getters[f.k] = function () { return chosen; };
        return wrap(f, box);

      case 'photo':
        var p = photoEditor(value || { src: '', caption: '', focus: '50% 40%' }, null);
        getters[f.k] = p.get;
        return wrap(f, p.node);

      case 'photos':
        return photosField(f, value || []);

      case 'video':
        return videoField(f);
    }
  }

  function swatch(theme) {
    var t = (Theme.THEMES[theme] || Theme.THEMES.blue), s = el('span', 'swatch');
    t.swatch.forEach(function (c) { var i = el('i'); i.style.background = c; s.appendChild(i); });
    return s;
  }

  /* ---------- photos ---------- */
  function photoEditor(ph, onRemove) {
    var node = el('div', 'photo');
    var frame = el('div', 'photo__frame');
    var img = el('img'); img.alt = '';
    var dot = el('span', 'photo__dot');
    var empty = el('span', 'photo__empty', 'Tap to add a photo');
    frame.appendChild(img); frame.appendChild(dot); frame.appendChild(empty);
    var side = el('div', 'photo__side');
    var cap = el('input'); cap.type = 'text'; cap.placeholder = 'Caption (optional)'; cap.value = ph.caption || '';
    var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    var pick = el('button', 'btn btn--ghost btn--sm'); pick.type = 'button';
    var rm = el('button', 'btn btn--ghost btn--sm', 'Remove'); rm.type = 'button';
    var hint = el('p', 'field__help', 'Tap the faces in the photo to keep them in view when it\'s cropped.');
    var row = el('div', 'photo__buttons'); row.appendChild(pick); row.appendChild(rm);
    side.appendChild(cap); side.appendChild(row); side.appendChild(hint); side.appendChild(file);
    node.appendChild(frame); node.appendChild(side);

    var state = { src: ph.src || '', focus: ph.focus || '50% 40%' };
    function render() {
      img.hidden = !state.src; empty.hidden = !!state.src; dot.hidden = !state.src; hint.hidden = !state.src;
      rm.hidden = !state.src && !onRemove;
      if (state.src) img.src = state.src;
      var fx = state.focus.split(' ');
      dot.style.left = fx[0]; dot.style.top = fx[1];
      pick.textContent = state.src ? 'Replace' : 'Upload photo';
    }
    frame.addEventListener('click', function (e) {
      if (!state.src) { file.click(); return; }
      var r = img.getBoundingClientRect();
      var x = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100);
      var y = Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100);
      state.focus = x + '% ' + y + '%';
      render(); markDirty();
    });
    pick.addEventListener('click', function () { file.click(); });
    rm.addEventListener('click', function () {
      if (onRemove) { onRemove(); return; }
      state.src = ''; render(); markDirty();
    });
    function setFile(f) {
      node.classList.add('uploading');
      return uploadImage(f).then(function (url) {
        state.src = url; state.focus = '50% 40%'; render(); markDirty();
      }).catch(function (err) { toast('Photo upload failed: ' + err.message, 5000); })
        .then(function () { node.classList.remove('uploading'); });
    }
    file.addEventListener('change', function () {
      var f = file.files[0]; file.value = '';
      if (f) setFile(f);
    });
    render();
    return {
      node: node,
      get: function () { return { src: state.src, caption: cap.value.trim(), focus: state.focus }; },
      setFile: setFile
    };
  }

  function photosField(f, list) {
    var box = el('div', 'photos');
    var items = [];
    var add = el('button', 'btn btn--ghost', '+ Add photos'); add.type = 'button';
    var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true; file.hidden = true;
    function addItem(ph) {
      var item = photoEditor(ph, function () {
        items.splice(items.indexOf(item), 1);
        item.node.remove(); markDirty(); sync();
      });
      items.push(item);
      box.appendChild(item.node);
      sync();
      return item;
    }
    function sync() { add.hidden = items.length >= MAX_PHOTOS; }
    (list || []).forEach(addItem);
    sync();
    add.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var files = Array.prototype.slice.call(file.files, 0, MAX_PHOTOS - items.length);
      file.value = '';
      files.forEach(function (fl) { addItem({ src: '', caption: '', focus: '50% 40%' }).setFile(fl); });
    });
    getters[f.k] = function () { return items.map(function (i) { return i.get(); }).filter(function (p) { return p.src; }); };
    var w = wrap(f, box);
    w.appendChild(add); w.appendChild(file);
    return w;
  }

  /* ---------- video ---------- */
  function videoField(f) {
    var state = { video: '', poster: '', aspect: '9/16' };
    var box = el('div', 'video');
    var vid = el('video'); vid.muted = true; vid.playsInline = true; vid.loop = true; vid.controls = true;
    var status = el('p', 'field__help');
    var file = el('input'); file.type = 'file'; file.accept = 'video/mp4,video/webm,video/quicktime'; file.hidden = true;
    var pick = el('button', 'btn btn--ghost btn--sm'); pick.type = 'button';
    var rm = el('button', 'btn btn--ghost btn--sm', 'Remove'); rm.type = 'button';
    var row = el('div', 'photo__buttons'); row.appendChild(pick); row.appendChild(rm);
    box.appendChild(vid); box.appendChild(row); box.appendChild(status); box.appendChild(file);
    function render() {
      vid.hidden = !state.video; rm.hidden = !state.video;
      pick.textContent = state.video ? 'Replace video' : 'Upload video';
      if (state.video && vid.getAttribute('src') !== state.video) { vid.src = state.video; if (state.poster) vid.poster = state.poster; }
    }
    pick.addEventListener('click', function () { file.click(); });
    rm.addEventListener('click', function () {
      state = { video: '', poster: '', aspect: state.aspect };
      vid.removeAttribute('src'); vid.load(); status.textContent = ''; render(); markDirty();
    });
    file.addEventListener('change', function () {
      var fl = file.files[0]; file.value = '';
      if (!fl) return;
      if (fl.size > MAX_VIDEO_MB * 1048576) { toast('That video is ' + Math.round(fl.size / 1048576) + ' MB. The limit is ' + MAX_VIDEO_MB + ' MB.', 5000); return; }
      box.classList.add('uploading');
      status.textContent = 'Uploading ' + Math.max(1, Math.round(fl.size / 1048576)) + ' MB… keep this page open.';
      busy++;
      videoInfo(fl).then(function (info) {
        return Promise.all([
          uploadBlob(fl, (fl.name.split('.').pop() || 'mp4').toLowerCase(), fl.type || 'video/mp4'),
          info.poster ? uploadBlob(info.poster, 'jpg', 'image/jpeg') : Promise.resolve('')
        ]).then(function (urls) {
          state = { video: urls[0], poster: urls[1], aspect: info.aspect };
          render(); markDirty();
          status.textContent = 'Uploaded ✓';
        });
      }).catch(function (err) {
        status.textContent = '';
        toast('Video upload failed: ' + err.message, 5000);
      }).then(function () { busy--; box.classList.remove('uploading'); });
    });
    render();
    getters.video = function () { return state.video; };
    getters.videoPoster = function () { return state.poster; };
    getters.videoAspect = function () { return state.aspect; };
    getters.videoWebm = function () { return ''; };
    return wrap(f, box);
  }

  // Read the video's shape and grab a still frame to show while it loads
  function videoInfo(file) {
    return new Promise(function (resolve) {
      var v = document.createElement('video'), url = URL.createObjectURL(file), done = false;
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      function finish(info) { if (done) return; done = true; URL.revokeObjectURL(url); resolve(info); }
      setTimeout(function () { finish({ aspect: '9/16', poster: null }); }, 8000);
      v.addEventListener('error', function () { finish({ aspect: '9/16', poster: null }); });
      v.addEventListener('loadedmetadata', function () {
        var w = v.videoWidth, h = v.videoHeight;
        var aspect = w && h ? (Math.abs(w - h) < w * 0.05 ? '1/1' : w > h ? '16/9' : '9/16') : '9/16';
        v.currentTime = Math.min(1, (v.duration || 2) / 2);
        v.addEventListener('seeked', function () {
          try {
            var c = document.createElement('canvas'), s = Math.min(1, 1080 / Math.max(w, h));
            c.width = Math.round(w * s); c.height = Math.round(h * s);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            c.toBlob(function (b) { finish({ aspect: aspect, poster: b }); }, 'image/jpeg', 0.82);
          } catch (e) { finish({ aspect: aspect, poster: null }); }
        }, { once: true });
      });
    });
  }

  /* ---------- photo uploads ---------- */
  // Shrink to max 1600px and re-save as JPEG: small files, and strips hidden data like GPS location
  function uploadImage(file) {
    busy++;
    return loadImage(file).then(function (img) {
      var s = Math.min(1, 1600 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); });
    }).then(function (blob) {
      return uploadBlob(blob, 'jpg', 'image/jpeg');
    }).then(function (url) { busy--; return url; }, function (err) { busy--; throw err; });
  }
  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var i = new Image(), u = URL.createObjectURL(file);
      i.onload = function () { URL.revokeObjectURL(u); res(i); };
      i.onerror = function () { URL.revokeObjectURL(u); rej(new Error('That file isn\'t a photo this browser can read (try JPG or PNG)')); };
      i.src = u;
    });
  }

  /* ---------- create ---------- */
  function collect() {
    var out = clone(data);
    Object.keys(getters).forEach(function (k) { out[k] = getters[k](); });
    // keep the envelope and letter wording in step with the names
    if (out.herName) out.envelopeFrom = 'with all my love, from ' + out.herName;
    if (out.hisName) out.cardGreeting = 'My ' + out.hisName + ',';
    return out;
  }

  $('#saveBtn').addEventListener('click', function () {
    if (busy) { toast('Please wait for the uploads to finish'); return; }
    var card = collect();
    if (!card.hisName) {
      toast('Please add their name first', 3000);
      var first = $('#editForm input[type=text]');
      if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
      return;
    }
    var btn = $('#saveBtn');
    btn.disabled = true; $('#saveStatus').textContent = 'Creating…';
    rpc('create_card', { p_data: card }).then(function (res) {
      if (!res || !res.slug) throw new Error(res && res.error === 'too_big' ? 'The text is too long.' : 'Please try again.');
      dirty = false;
      var url = cardUrl(res.slug);
      $('#doneLink').value = url;
      $('#openLink').href = url;
      $('#waLink').href = 'https://wa.me/?text=' + encodeURIComponent('I made something for you ♥ ' + url);
      $('#toast').classList.remove('show');
      $('#viewEdit').hidden = true; $('#viewDone').hidden = false;
      window.scrollTo(0, 0);
    }).catch(function (err) {
      toast('Could not create the card: ' + err.message, 5000);
    }).then(function () { btn.disabled = false; $('#saveStatus').textContent = ''; });
  });

  $('#copyLink').addEventListener('click', function () {
    var link = $('#doneLink').value;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
      .then(function () { toast('Link copied'); })
      .catch(function () { $('#doneLink').select(); document.execCommand('copy'); toast('Link copied'); });
  });
  $('#another').addEventListener('click', start);

  start();
})();

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var D = window.GIFT_DEFAULTS || {};
  var SBC = window.SUPABASE_CONFIG || {};
  var BUCKET = 'card-media';
  var MAX_PHOTOS = 9;

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
  // type: text | number | list (one box per item) | theme | photo | photos
  var SECTIONS = [
    { title: 'Names & colours', open: true, fields: [
      { k: 'hisName', type: 'text', label: 'Their name (shown big)', required: true, placeholder: 'e.g. Raj', clear: true },
      { k: 'herName', type: 'text', label: 'Your name', placeholder: 'e.g. Priya', clear: true },
      { k: 'theme', type: 'theme', label: 'Colour theme' }
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
      { k: 'openingLines', type: 'list', label: 'Message typed when the envelope opens', item: 'Line', max: 8 },
      { k: 'wishes', type: 'list', label: 'Wishes', item: 'Wish', max: 10 },
      { k: 'letterGreeting', type: 'text', label: 'Letter greeting' },
      { k: 'letter', type: 'list', label: 'Letter', item: 'Paragraph', max: 10, long: true },
      { k: 'letterClosing', type: 'text', label: 'Letter closing' },
      { k: 'reasons', type: 'list', label: 'Reasons I appreciate you', item: 'Flip card', max: 12, reasons: true }
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
      det.addEventListener('toggle', function () { body.querySelectorAll('.list textarea').forEach(function (t) { t.dispatchEvent(new Event('input')); }); });
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

      case 'list':
        return listField(f, value || []);

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

  /* ---------- lists: one box per item (lines, wishes, letter paragraphs, flip cards) ---------- */
  function listField(f, values) {
    var box = el('div', 'list');
    var rows = [];
    var add = el('button', 'btn btn--ghost btn--sm', '+ Add ' + f.item.toLowerCase()); add.type = 'button';
    function renumber() {
      rows.forEach(function (r, i) { r.label.textContent = f.item + ' ' + (i + 1); });
      add.hidden = rows.length >= f.max;
    }
    function addRow(text) {
      var row = el('div', 'list__row');
      var label = el('label', 'list__label');
      var input = el('textarea');
      input.id = 'f' + (++uid);
      label.htmlFor = input.id;
      input.rows = f.long ? 4 : 2;
      input.value = text || '';
      // grow with the text so the whole message is always visible
      var grow = function () { input.style.height = 'auto'; input.style.height = input.scrollHeight + 2 + 'px'; };
      input.addEventListener('input', grow);
      requestAnimationFrame(grow);
      var rm = el('button', 'list__remove', '✕'); rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove');
      var r = { row: row, label: label, input: input };
      rm.addEventListener('click', function () {
        rows.splice(rows.indexOf(r), 1); row.remove(); renumber(); markDirty();
      });
      var head = el('div', 'list__head'); head.appendChild(label); head.appendChild(rm);
      row.appendChild(head); row.appendChild(input);
      box.appendChild(row);
      rows.push(r);
      renumber();
      return r;
    }
    (f.reasons ? values.map(function (x) { return x.back; }) : values).forEach(addRow);
    if (!rows.length) addRow('');
    add.addEventListener('click', function () { addRow('').input.focus(); markDirty(); });
    getters[f.k] = function () {
      var parts = rows.map(function (r) { return r.input.value.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      if (f.reasons) parts = parts.map(function (b, i) { return { front: 'Reason #' + (i + 1), back: b }; });
      return parts;
    };
    var w = wrap(f, box);
    w.appendChild(add);
    return w;
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

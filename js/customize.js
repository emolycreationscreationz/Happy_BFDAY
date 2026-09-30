(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var D = window.GIFT_DEFAULTS || {};
  var SBC = window.SUPABASE_CONFIG || {};
  var BUCKET = 'card-media';
  var MAX_PHOTOS = 9;
  var MAX_VIDEO_MB = 50;

  if (!SBC.url || !SBC.key || !window.supabase) { $('#setupWarn').hidden = false; return; }
  var db = window.supabase.createClient(SBC.url, SBC.key);

  var user = null;
  var current = null;          // { slug, data, isNew }
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
  function show(view) {
    ['viewLogin', 'viewList', 'viewEdit'].forEach(function (v) { $('#' + v).hidden = v !== view; });
    $('#signOut').hidden = view === 'viewLogin';
    window.scrollTo(0, 0);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cardUrl(slug) { return new URL('./?card=' + encodeURIComponent(slug), location.href).href; }
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  var SLUG_OK = /^[a-z0-9][a-z0-9-]{1,60}$/;
  function markDirty() { dirty = true; $('#saveStatus').textContent = 'Unsaved changes'; }

  /* ---------- auth ---------- */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'), err = $('#loginErr');
    btn.disabled = true; err.hidden = true;
    db.auth.signInWithPassword({ email: $('#loginEmail').value.trim(), password: $('#loginPass').value })
      .then(function (res) {
        btn.disabled = false;
        if (res.error) { err.textContent = res.error.message; err.hidden = false; }
      });
  });
  $('#signOut').addEventListener('click', function () {
    if (dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
    dirty = false;
    db.auth.signOut();
  });
  db.auth.onAuthStateChange(function (_event, session) {
    var u = session ? session.user : null;
    if ((u && u.id) === (user && user.id)) return;
    user = u;
    if (user) loadList(); else show('viewLogin');
  });
  db.auth.getSession().then(function (res) {
    if (!res.data.session) show('viewLogin');
  });

  /* ---------- card list ---------- */
  function loadList() {
    show('viewList');
    var box = $('#cardList');
    box.textContent = 'Loading…';
    Promise.all([
      db.from('cards').select('slug, data, updated_at').order('updated_at', { ascending: false }),
      db.from('visits').select('card_id, opened_at').order('opened_at', { ascending: false }).limit(5000)
    ]).then(function (r) {
      if (r[0].error) { box.textContent = 'Could not load cards: ' + r[0].error.message; return; }
      var stats = {};
      (r[1].data || []).forEach(function (v) {
        var s = stats[v.card_id] || (stats[v.card_id] = { n: 0, last: v.opened_at });
        s.n++;
      });
      box.textContent = '';
      var cards = r[0].data || [];
      $('#emptyList').hidden = cards.length > 0;
      cards.forEach(function (c) { box.appendChild(cardRow(c, stats[c.slug])); });
      box.appendChild(mainRow(stats.main));
    });
  }

  function opened(st) {
    if (!st) return 'Not opened yet';
    return 'Opened ' + st.n + '× · last ' + new Date(st.last).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function swatch(theme) {
    var t = (Theme.THEMES[theme] || Theme.THEMES.blue), s = el('span', 'swatch');
    t.swatch.forEach(function (c) { var i = el('i'); i.style.background = c; s.appendChild(i); });
    return s;
  }

  function cardRow(c, st) {
    var d = c.data || {}, row = el('article', 'card-row panel');
    var head = el('div', 'card-row__head');
    head.appendChild(swatch(d.theme));
    var names = el('div', 'card-row__names');
    names.appendChild(el('b', null, (d.hisName || '?') + ' & ' + (d.herName || '?')));
    names.appendChild(el('small', null, '?card=' + c.slug));
    head.appendChild(names);
    row.appendChild(head);
    row.appendChild(el('p', 'card-row__meta', opened(st)));
    var acts = el('div', 'card-row__actions');
    var open = el('a', 'btn btn--ghost btn--sm', 'Open');
    open.href = cardUrl(c.slug); open.target = '_blank'; open.rel = 'noopener';
    var copy = el('button', 'btn btn--ghost btn--sm', 'Copy link'); copy.type = 'button';
    copy.addEventListener('click', function () { copyText(cardUrl(c.slug)); });
    var edit = el('button', 'btn btn--sm', 'Edit'); edit.type = 'button';
    edit.addEventListener('click', function () { openEditor(c.slug, d, false); });
    var del = el('button', 'btn btn--danger btn--sm', 'Delete'); del.type = 'button';
    del.addEventListener('click', function () { deleteCard(c.slug); });
    [open, copy, edit, del].forEach(function (b) { acts.appendChild(b); });
    row.appendChild(acts);
    return row;
  }

  function mainRow(st) {
    var row = el('article', 'card-row panel card-row--main');
    var head = el('div', 'card-row__head');
    head.appendChild(swatch('blue'));
    var names = el('div', 'card-row__names');
    names.appendChild(el('b', null, 'Main link card'));
    names.appendChild(el('small', null, 'Set in js/config.js (no ?card=)'));
    head.appendChild(names);
    row.appendChild(head);
    row.appendChild(el('p', 'card-row__meta', opened(st)));
    var acts = el('div', 'card-row__actions');
    var open = el('a', 'btn btn--ghost btn--sm', 'Open');
    open.href = new URL('./', location.href).href; open.target = '_blank'; open.rel = 'noopener';
    acts.appendChild(open);
    row.appendChild(acts);
    return row;
  }

  function copyText(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { toast('Link copied'); })
      .catch(function () { prompt('Copy this link:', text); });
  }

  function deleteCard(slug) {
    if (!confirm('Delete the card "' + slug + '"? Its link will stop working. This cannot be undone.')) return;
    db.from('cards').delete().eq('slug', slug).then(function (res) {
      if (res.error) { toast('Could not delete: ' + res.error.message, 4000); return; }
      // Tidy up its uploaded files (best effort)
      var folder = user.id + '/' + slug;
      db.storage.from(BUCKET).list(folder, { limit: 1000 }).then(function (l) {
        var paths = (l.data || []).map(function (f) { return folder + '/' + f.name; });
        if (paths.length) db.storage.from(BUCKET).remove(paths);
      });
      toast('Card deleted');
      loadList();
    });
  }

  $('#newCard').addEventListener('click', function () {
    var d = clone(D);
    delete d.theme; d.theme = 'blue';
    openEditor('', d, true);
  });
  $('#backToList').addEventListener('click', function () {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    dirty = false;
    loadList();
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- form definition ---------- */
  // type: text | long | lines (one per line) | paras (blank line between) | reasons | number | select | theme | slug | photo | photos | video
  var SECTIONS = [
    { title: 'Link & colours', open: true, fields: [
      { k: 'slug', type: 'slug', label: 'Card link name', help: 'The end of the link, e.g. raj-priya → …/?card=raj-priya. Lowercase letters, numbers and dashes. It can\'t be changed after saving.' },
      { k: 'theme', type: 'theme', label: 'Colour theme' }
    ] },
    { title: 'Names & occasion', open: true, fields: [
      { k: 'hisName', type: 'text', label: 'Their name (shown big)', required: true },
      { k: 'herName', type: 'text', label: 'Your name (signs the letter)' },
      { k: 'titleLine1', type: 'text', label: 'Title, big word', help: 'e.g. Happy' },
      { k: 'titleLine2', type: 'text', label: 'Title, second line', help: 'e.g. Boyfriend\'s Day, Birthday, Anniversary' },
      { k: 'pageTitle', type: 'text', label: 'Title on the card inside the envelope' },
      { k: 'date', type: 'text', label: 'Date', help: 'Any format, e.g. 03 · 10 · 2026' }
    ] },
    { title: 'Envelope', fields: [
      { k: 'envelopeTo', type: 'text', label: 'Line above the name' },
      { k: 'envelopeFrom', type: 'text', label: 'Line under the name' },
      { k: 'envelopeHint', type: 'text', label: 'Tap hint' },
      { k: 'cardGreeting', type: 'text', label: 'First line on the card' },
      { k: 'openingLines', type: 'lines', label: 'Message typed on the card', help: 'One line per row.' },
      { k: 'openButton', type: 'text', label: 'Button text' }
    ] },
    { title: 'Video & wishes', fields: [
      { k: 'video', type: 'video', label: 'Video (plays silently on a loop)', help: 'MP4 or MOV, up to ' + MAX_VIDEO_MB + ' MB. Under 15 MB loads best on phones. Leave empty to hide the video.' },
      { k: 'heroKicker', type: 'text', label: 'Small line above the title' },
      { k: 'wishesTitle', type: 'text', label: 'Wishes heading' },
      { k: 'wishes', type: 'lines', label: 'Wishes', help: 'One wish per row.' }
    ] },
    { title: 'Photos', fields: [
      { k: 'heartPhoto', type: 'photo', label: 'Big heart photo (middle)' },
      { k: 'memories', type: 'photos', label: 'Photos around the heart (up to ' + MAX_PHOTOS + ')', help: 'Use different photos from the big heart and the final photo.' },
      { k: 'finalPhoto', type: 'photo', label: 'Framed photo near the end' },
      { k: 'memoriesTitle', type: 'text', label: 'Photos heading' },
      { k: 'memoriesSub', type: 'text', label: 'Line under the heading' }
    ] },
    { title: 'Letter', fields: [
      { k: 'letterTitle', type: 'text', label: 'Heading' },
      { k: 'letterGreeting', type: 'text', label: 'Greeting' },
      { k: 'letter', type: 'paras', label: 'Letter', help: 'Leave an empty line between paragraphs.' },
      { k: 'letterClosing', type: 'text', label: 'Closing (above the name)' }
    ] },
    { title: 'Song (cinema)', fields: [
      { k: 'youtubeUrl', type: 'text', label: 'YouTube link', help: 'Any YouTube link. Leave empty to hide the cinema.' },
      { k: 'youtubeStart', type: 'number', label: 'Start the song at (seconds)' },
      { k: 'songTitle', type: 'text', label: 'Song title on the marquee' },
      { k: 'cinemaTitle', type: 'text', label: 'Heading' },
      { k: 'cinemaSub', type: 'text', label: 'Line under the heading' },
      { k: 'ticket', type: 'text', label: 'Ticket text' },
      { k: 'playButton', type: 'text', label: 'Button text' }
    ] },
    { title: 'Ending', fields: [
      { k: 'appreciateKicker', type: 'text', label: 'Small line above' },
      { k: 'appreciateTitle', type: 'text', label: 'Big heading' },
      { k: 'appreciateSub', type: 'text', label: 'Line under the heading' },
      { k: 'reasons', type: 'reasons', label: 'Reasons (flip cards)', help: 'One reason per row.' },
      { k: 'closingLine', type: 'text', label: 'Last line' }
    ] },
    { title: 'Other small text', fields: [
      { k: 'scrollNudgeTitle', type: 'text', label: '"There\'s more" heading' },
      { k: 'scrollNudge', type: 'text', label: '"There\'s more" line' },
      { k: 'memoriesLabel', type: 'text', label: 'Photos label' },
      { k: 'letterLabel', type: 'text', label: 'Letter label' },
      { k: 'cinemaLabel', type: 'text', label: 'Cinema label' },
      { k: 'nowShowing', type: 'text', label: 'Marquee small text' },
      { k: 'footer', type: 'text', label: 'Footer' },
      { k: 'madeBy', type: 'text', label: 'Made by' }
    ] }
  ];

  /* ---------- editor ---------- */
  var getters = {};    // key → function returning the field's current value

  function openEditor(slug, data, isNew) {
    current = { slug: slug, data: Object.assign(clone(D), clone(data || {})), isNew: isNew };
    dirty = false;
    $('#saveStatus').textContent = isNew ? '' : 'Saved';
    $('#editTitle').textContent = isNew ? 'New card' : (current.data.hisName || slug);
    var form = $('#editForm');
    form.textContent = '';
    getters = {};
    SECTIONS.forEach(function (sec) {
      var det = el('details', 'panel section');
      det.open = !!sec.open;
      det.appendChild(el('summary', null, sec.title));
      var body = el('div', 'section__body');
      sec.fields.forEach(function (f) { body.appendChild(field(f, current.data[f.k])); });
      det.appendChild(body);
      form.appendChild(det);
    });
    form.oninput = markDirty;
    show('viewEdit');
  }

  function wrap(f, control) {
    var w = el('div', 'field');
    var lab = el('label', 'field__label', f.label);
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

      case 'slug':
        input = el('input'); input.id = id; input.type = 'text';
        input.value = value || current.slug || '';
        input.placeholder = 'e.g. raj-priya';
        input.autocapitalize = 'off'; input.spellcheck = false;
        if (!current.isNew) input.disabled = true;
        input.addEventListener('input', function () { input.value = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); });
        getters[f.k] = function () { return input.value.trim(); };
        var w = wrap(f, input);
        if (current.isNew) {
          // suggest a link name from the names as they're typed
          setTimeout(function () {
            var names = document.querySelectorAll('#editForm input[type=text]');
            names[1] && names[1].addEventListener('input', suggest);
            names[2] && names[2].addEventListener('input', suggest);
          });
          var suggest = function () {
            if (input.dataset.touched) return;
            input.value = slugify(getters.hisName() + '-' + getters.herName());
          };
          input.addEventListener('input', function () { input.dataset.touched = '1'; });
        }
        return w;

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

  /* ---------- photos ---------- */
  function photoEditor(ph, onRemove) {
    var node = el('div', 'photo');
    var frame = el('div', 'photo__frame');
    var img = el('img'); img.alt = '';
    var dot = el('span', 'photo__dot');
    var empty = el('span', 'photo__empty', 'No photo');
    frame.appendChild(img); frame.appendChild(dot); frame.appendChild(empty);
    var side = el('div', 'photo__side');
    var cap = el('input'); cap.type = 'text'; cap.placeholder = 'Caption'; cap.value = ph.caption || '';
    var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    var pick = el('button', 'btn btn--ghost btn--sm', ph.src ? 'Replace' : 'Upload photo'); pick.type = 'button';
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
    file.addEventListener('change', function () {
      var f = file.files[0]; file.value = '';
      if (!f) return;
      node.classList.add('uploading');
      uploadImage(f).then(function (url) {
        state.src = url; state.focus = '50% 40%'; render(); markDirty();
      }).catch(function (err) { toast('Upload failed: ' + err.message, 5000); })
        .then(function () { node.classList.remove('uploading'); });
    });
    render();
    return {
      node: node,
      get: function () { return { src: state.src, caption: cap.value.trim(), focus: state.focus }; },
      setFile: function (f) {
        node.classList.add('uploading');
        return uploadImage(f).then(function (url) { state.src = url; render(); markDirty(); })
          .catch(function (err) { toast('Upload failed: ' + err.message, 5000); })
          .then(function () { node.classList.remove('uploading'); });
      }
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
    var d = current.data;
    var state = { video: d.video || '', poster: d.videoPoster || '', aspect: d.videoAspect || '9/16', webm: d.videoWebm || '' };
    var box = el('div', 'video');
    var vid = el('video'); vid.muted = true; vid.playsInline = true; vid.loop = true; vid.controls = true;
    var none = el('p', 'muted', 'No video');
    var status = el('p', 'field__help');
    var file = el('input'); file.type = 'file'; file.accept = 'video/mp4,video/webm,video/quicktime'; file.hidden = true;
    var pick = el('button', 'btn btn--ghost btn--sm'); pick.type = 'button';
    var rm = el('button', 'btn btn--ghost btn--sm', 'Remove'); rm.type = 'button';
    var row = el('div', 'photo__buttons'); row.appendChild(pick); row.appendChild(rm);
    box.appendChild(vid); box.appendChild(none); box.appendChild(row); box.appendChild(status); box.appendChild(file);
    function render() {
      vid.hidden = !state.video; none.hidden = !!state.video; rm.hidden = !state.video;
      pick.textContent = state.video ? 'Replace video' : 'Upload video';
      if (state.video && vid.getAttribute('src') !== state.video) { vid.src = state.video; if (state.poster) vid.poster = state.poster; }
    }
    pick.addEventListener('click', function () { file.click(); });
    rm.addEventListener('click', function () {
      state = { video: '', poster: '', aspect: state.aspect, webm: '' };
      vid.removeAttribute('src'); vid.load(); render(); markDirty();
    });
    file.addEventListener('change', function () {
      var fl = file.files[0]; file.value = '';
      if (!fl) return;
      if (fl.size > MAX_VIDEO_MB * 1048576) { toast('That video is ' + Math.round(fl.size / 1048576) + ' MB. The limit is ' + MAX_VIDEO_MB + ' MB.', 5000); return; }
      box.classList.add('uploading');
      status.textContent = 'Uploading ' + Math.round(fl.size / 1048576) + ' MB… keep this page open.';
      busy++;
      videoInfo(fl).then(function (info) {
        return Promise.all([
          uploadBlob(fl, (fl.name.split('.').pop() || 'mp4').toLowerCase(), fl.type || 'video/mp4'),
          info.poster ? uploadBlob(info.poster, 'jpg', 'image/jpeg') : Promise.resolve('')
        ]).then(function (urls) {
          state = { video: urls[0], poster: urls[1], aspect: info.aspect, webm: '' };
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
    getters.videoWebm = function () { return state.webm; };
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

  /* ---------- uploads ---------- */
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
  function uploadBlob(blob, ext, type) {
    var folder = (getters.slug && getters.slug()) || current.slug || 'drafts';
    var path = user.id + '/' + folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    return db.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      });
  }

  /* ---------- save & preview ---------- */
  function collect() {
    var data = clone(current.data);
    Object.keys(getters).forEach(function (k) { if (k !== 'slug') data[k] = getters[k](); });
    return data;
  }

  function save() {
    if (busy) { toast('Wait for the uploads to finish first'); return Promise.reject(); }
    var slug = current.isNew ? getters.slug() : current.slug;
    if (!SLUG_OK.test(slug)) { toast('Card link name: 2–60 lowercase letters, numbers or dashes', 4000); openSection(0); return Promise.reject(); }
    var data = collect();
    if (!data.hisName) { toast('Add their name first', 3000); return Promise.reject(); }
    var btn = $('#saveBtn');
    btn.disabled = true; $('#saveStatus').textContent = 'Saving…';
    var q = current.isNew
      ? db.from('cards').insert({ slug: slug, data: data })
      : db.from('cards').update({ data: data, updated_at: new Date().toISOString() }).eq('slug', slug);
    return q.then(function (res) {
      btn.disabled = false;
      if (res.error) {
        $('#saveStatus').textContent = 'Not saved';
        var msg = /duplicate|unique/i.test(res.error.message) ? 'That link name is already taken. Try another.' : res.error.message;
        toast(msg, 5000);
        throw res.error;
      }
      current.slug = slug; current.data = data;
      if (current.isNew) {
        current.isNew = false;
        var s = document.querySelector('#editForm input[placeholder="e.g. raj-priya"]');
        if (s) s.disabled = true;
      }
      dirty = false;
      $('#saveStatus').textContent = 'Saved ✓';
      $('#editTitle').textContent = data.hisName;
      toast('Saved. Link: ' + cardUrl(slug), 3500);
    });
  }
  function openSection(i) { var d = document.querySelectorAll('#editForm details')[i]; if (d) d.open = true; }

  $('#saveBtn').addEventListener('click', function () { save().catch(function () {}); });
  $('#previewBtn').addEventListener('click', function () {
    // open the tab now (inside the tap) so pop-up blockers allow it, then point it at the saved card
    var w = window.open('about:blank', '_blank');
    var go = function () { if (w) w.location.href = cardUrl(current.slug); else location.href = cardUrl(current.slug); };
    if (!dirty && !current.isNew) { go(); return; }
    save().then(go, function () { if (w) w.close(); });
  });
})();

/*
 * Colour themes. The stylesheet is designed in blue; every other theme is made by
 * moving the blue hues to another hue at runtime. Gold, cream and neutrals never change.
 */
window.Theme = (function () {
  'use strict';

  var THEMES = {
    blue:   { label: 'Blue & Gold',   hue: 218, swatch: ['#1e68e9', '#e9c27a', '#050a18'] },
    rose:   { label: 'Rose & Gold',   hue: 340, swatch: ['#e0115f', '#e9c27a', '#1c030d'] },
    red:    { label: 'Red & Gold',    hue: 356, swatch: ['#d0102a', '#e9c27a', '#1a0306'] },
    purple: { label: 'Purple & Gold', hue: 272, swatch: ['#7b2ff0', '#e9c27a', '#0e0518'] },
    teal:   { label: 'Teal & Gold',   hue: 178, swatch: ['#0fa3a0', '#e9c27a', '#021312'] },
    black:  { label: 'Black & Gold',  hue: null, swatch: ['#3a3a3a', '#e9c27a', '#050505'] }
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    function f(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return [f(0), f(8), f(4)];
  }

  // Returns the new [r,g,b] for a blue colour, or null when it should stay as it is.
  function shift(r, g, b, name) {
    var t = THEMES[name];
    if (!t || name === 'blue') return null;
    var hsl = rgbToHsl(r, g, b);
    if (hsl[1] < 0.12 || hsl[0] < 195 || hsl[0] > 240) return null;
    if (t.hue == null) return hslToRgb(hsl[0], hsl[1] * 0.08, hsl[2] < 0.5 ? hsl[2] * 0.55 : hsl[2]);   // deep charcoal
    return hslToRgb(t.hue, hsl[1], hsl[2]);
  }
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }

  // Recolour every #hex / %23hex / rgb(a) / 'r,g,b' colour in a piece of text
  function text(src, name) {
    if (!name || name === 'blue' || !THEMES[name]) return src;
    return src
      .replace(/(#|%23)([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, function (m, pre, hx) {
        if (hx.length === 3) hx = hx.replace(/./g, '$&$&');
        var n = shift(parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16), name);
        return n ? pre + hex2(n[0]) + hex2(n[1]) + hex2(n[2]) : m;
      })
      .replace(/(rgba?\()\s*(\d+),\s*(\d+),\s*(\d+)(\s*[,)])/g, function (m, pre, r, g, b, post) {
        var n = shift(+r, +g, +b, name);
        return n ? pre + n.join(', ') + post : m;
      })
      .replace(/^(\d+),(\d+),(\d+)$/, function (m, r, g, b) {
        var n = shift(+r, +g, +b, name);
        return n ? n.join(',') : m;
      });
  }

  // Apply a theme to the live page: stylesheet, SVG sprite colours.
  function apply(name) {
    if (!name || name === 'blue' || !THEMES[name]) return Promise.resolve();
    document.querySelectorAll('svg [stop-color], svg [fill], svg [stroke]').forEach(function (n) {
      ['stop-color', 'fill', 'stroke'].forEach(function (a) {
        var v = n.getAttribute(a);
        if (v && v.charAt(0) === '#') n.setAttribute(a, text(v, name));
      });
    });
    var link = document.querySelector('link[href*="css/style.css"]');
    if (!link) return Promise.resolve();
    return fetch(link.href).then(function (r) { return r.text(); }).then(function (css) {
      var st = document.createElement('style');
      st.textContent = text(css, name);
      link.parentNode.insertBefore(st, link.nextSibling);
      link.disabled = true;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = THEMES[name].swatch[2];
    }).catch(function () {});
  }

  return { THEMES: THEMES, text: text, apply: apply };
})();

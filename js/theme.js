/* =========================================================
   theme.js — тема сайту (темна / світла / як у системі) і колір акценту.
   Підключається в <head> кожної сторінки ПЕРШИМ скриптом, без defer,
   щоб тема застосувалась ще до того, як сторінка намалюється
   (інакше на мить блимає темна тема).

   Вибір зберігається в цьому браузері (localStorage), а для тих, хто
   в акаунті, — ще й у профілі (налаштування переїжджають на інші пристрої).

   Колір акценту можна обрати будь-який, але щоб «було гарно» і читалось:
   світлість кольору підлаштовується, поки контраст з фоном не стане
   щонайменше 4.5:1 (вимога WCAG для тексту). Текст на кнопках кольору
   акценту — темний або білий, залежно від того, що контрастніше.
   ========================================================= */

(function () {
  "use strict";

  var KEY = "sv_theme";
  var DEFAULT = { mode: "dark", accent: "#5EE6C8" };

  var PRESETS = [
    { name: "М'ятний", value: "#5EE6C8" },
    { name: "Блакитний", value: "#5EB8FF" },
    { name: "Бузковий", value: "#A78BFA" },
    { name: "Рожевий", value: "#FF7EB6" },
    { name: "Кораловий", value: "#FF8A65" },
    { name: "Бурштиновий", value: "#FFC857" },
    { name: "Лаймовий", value: "#A3E635" },
    { name: "Малиновий", value: "#FF5A6E" },
  ];

  // Фон кожної теми — той самий, що в css/base.css
  var BG = { dark: "#15111F", light: "#F7F3EE" };
  var DARK_TEXT = "#15111F";
  var WHITE = "#FFFFFF";

  /* ---------- Кольорова математика ---------- */
  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join("").toUpperCase();
  }

  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(hsl) {
    var h = hsl[0], s = hsl[1], l = hsl[2];
    if (!s) return [l * 255, l * 255, l * 255];
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }

  /* Підлаштувати колір під тему: на темному фоні — світлішаємо,
     на світлому — темнішаємо, поки контраст не стане ≥ 4.5. */
  function fitAccent(hex, mode) {
    var bg = hexToRgb(BG[mode]);
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb);
    var step = mode === "light" ? -0.01 : 0.01;
    for (var i = 0; i < 100 && contrast(rgb, bg) < 4.5; i++) {
      hsl[2] = Math.min(1, Math.max(0, hsl[2] + step));
      rgb = hslToRgb(hsl);
    }
    var onAccent = contrast(hexToRgb(DARK_TEXT), rgb) >= contrast(hexToRgb(WHITE), rgb) ? DARK_TEXT : WHITE;
    return { hex: rgbToHex(rgb), rgb: rgb.map(Math.round), onAccent: onAccent, adjusted: rgbToHex(rgb) !== rgbToHex(hexToRgb(hex)) };
  }

  /* ---------- Збереження ---------- */
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v === "object") return normalize(v);
    } catch (e) { /* приватний режим тощо — беремо стандартну */ }
    return normalize({});
  }

  function normalize(v) {
    var mode = v.mode === "light" || v.mode === "system" ? v.mode : "dark";
    var accent = /^#[0-9a-f]{6}$/i.test(v.accent || "") ? v.accent.toUpperCase() : DEFAULT.accent;
    return { mode: mode, accent: accent };
  }

  function resolvedMode(mode) {
    if (mode !== "system") return mode;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  /* ---------- Застосувати ---------- */
  var current = read();

  function apply(settings) {
    current = normalize(settings || current);
    var mode = resolvedMode(current.mode);
    var fit = fitAccent(current.accent, mode);
    var root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.style.setProperty("--color-accent", fit.hex);
    root.style.setProperty("--accent-rgb", fit.rgb.join(", "));
    root.style.setProperty("--color-on-accent", fit.onAccent);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", BG[mode]);
    return fit;
  }

  function set(settings, opts) {
    current = normalize(Object.assign({}, current, settings));
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* не страшно */ }
    var fit = apply(current);
    if (!(opts && opts.silent)) document.dispatchEvent(new CustomEvent("sv:theme", { detail: current }));
    return fit;
  }

  apply(current);

  // «Як у системі»: стежимо, коли людина перемикає тему Windows/телефону
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onChange = function () { if (current.mode === "system") apply(current); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  window.SVTheme = {
    PRESETS: PRESETS,
    DEFAULT: DEFAULT,
    get: function () { return Object.assign({}, current); },
    set: set,
    fit: function (hex, mode) { return fitAccent(hex, resolvedMode(mode || current.mode)); },
  };
})();

/* ============================================================
   MOTOR DE ANIMAÇÃO — ELIANE REIS
   Reimplementação autocontida do sistema de timeline declarativa
   (data-tl-*), do preloader, da rolagem horizontal fixa, do
   contador de dígitos, das revelações de texto e da rolagem suave
   descritos no frontend de referência. Sem dependências externas.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    preloaderDelay: 0.2,
    lenisLerp: 0.1,
    resizeDebounce: 150
  };

  var STATE = {
    triggers: [],
    raf: 0,
    smooth: null,
    initialized: false
  };

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Assume o controle dos estados iniciais o quanto antes. */
  document.documentElement.classList.add("js-anim");

  /* ---------------------------------------------------------
     UTILITÁRIOS
     --------------------------------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isDesktop() { return window.innerWidth >= 768; }

  function parseJSONish(str, fallback) {
    if (!str) return fallback || {};
    try { return JSON.parse(String(str).replace(/'/g, '"')); }
    catch (e) { return fallback || {}; }
  }

  var NAMED_COLORS = {
    white: [255, 255, 255, 1],
    black: [0, 0, 0, 1],
    transparent: [0, 0, 0, 0]
  };

  function parseColor(v) {
    if (typeof v !== "string") return null;
    var s = v.trim().toLowerCase();
    if (NAMED_COLORS[s]) return NAMED_COLORS[s].slice();
    var m;
    if ((m = s.match(/^#([0-9a-f]{3})$/))) {
      return [
        parseInt(m[1][0] + m[1][0], 16),
        parseInt(m[1][1] + m[1][1], 16),
        parseInt(m[1][2] + m[1][2], 16),
        1
      ];
    }
    if ((m = s.match(/^#([0-9a-f]{6})$/))) {
      return [
        parseInt(m[1].slice(0, 2), 16),
        parseInt(m[1].slice(2, 4), 16),
        parseInt(m[1].slice(4, 6), 16),
        1
      ];
    }
    if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1];
    }
    return null;
  }

  function colorToString(c) {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (Math.round(c[3] * 1000) / 1000) + ")";
  }

  var NUM_RE = /-?\d*\.?\d+/g;

  /* Interpola dois valores preservando unidades, cores e funções CSS. */
  function lerpValue(from, to, t) {
    if (typeof from === "number" && typeof to === "number") return from + (to - from) * t;

    var cf = parseColor(from), ct = parseColor(to);
    if (cf && ct) {
      return colorToString([
        cf[0] + (ct[0] - cf[0]) * t,
        cf[1] + (ct[1] - cf[1]) * t,
        cf[2] + (ct[2] - cf[2]) * t,
        cf[3] + (ct[3] - cf[3]) * t
      ]);
    }

    var sf = String(from), st = String(to);
    var nf = sf.match(NUM_RE), nt = st.match(NUM_RE);
    if (nf && nt && nf.length === nt.length) {
      var i = 0;
      return st.replace(NUM_RE, function () {
        var a = parseFloat(nf[i]), b = parseFloat(nt[i]);
        i++;
        return String(Math.round((a + (b - a) * t) * 1000) / 1000);
      });
    }
    return t < 1 ? from : to;
  }

  /* ---------------------------------------------------------
     ACELERAÇÕES (mesmos nomes do código de referência)
     --------------------------------------------------------- */
  function powOut(n) { return function (p) { return 1 - Math.pow(1 - p, n); }; }
  function powIn(n) { return function (p) { return Math.pow(p, n); }; }
  function powInOut(n) {
    return function (p) {
      return p < 0.5 ? Math.pow(2, n - 1) * Math.pow(p, n) : 1 - Math.pow(-2 * p + 2, n) / 2;
    };
  }

  var EASES = {
    none: function (p) { return p; },
    linear: function (p) { return p; },
    "power1.in": powIn(2), "power1.out": powOut(2), "power1.inOut": powInOut(2),
    "power2.in": powIn(3), "power2.out": powOut(3), "power2.inOut": powInOut(3),
    "power3.in": powIn(4), "power3.out": powOut(4), "power3.inOut": powInOut(4),
    "power4.out": powOut(5),
    "expo.out": function (p) { return p === 1 ? 1 : 1 - Math.pow(2, -10 * p); },
    "expo.inOut": function (p) {
      return p === 0 ? 0 : p === 1 ? 1 : p < 0.5
        ? Math.pow(2, 20 * p - 10) / 2
        : (2 - Math.pow(2, -20 * p + 10)) / 2;
    }
  };
  function ease(name) { return EASES[name] || EASES["power1.inOut"]; }

  /* ---------------------------------------------------------
     ESTADO POR ELEMENTO + APLICAÇÃO DE PROPRIEDADES
     --------------------------------------------------------- */
  var STORE = new WeakMap();

  var DEFAULTS = {
    opacity: 1, autoAlpha: 1, scale: 1, rotate: 0,
    x: "0px", y: "0px", xPercent: 0, yPercent: 0,
    filter: "blur(0px)", color: null, backgroundColor: null,
    zIndex: null, height: null, clipPath: null
  };

  function stateOf(el) {
    var s = STORE.get(el);
    if (!s) { s = {}; STORE.set(el, s); }
    return s;
  }

  function baseline(el, key) {
    var s = stateOf(el);
    if (key in s) return s[key];
    if (key === "color" || key === "backgroundColor") {
      return window.getComputedStyle(el)[key];
    }
    if (key === "height") return el.offsetHeight + "px";
    if (key === "zIndex") {
      var z = window.getComputedStyle(el).zIndex;
      return z === "auto" ? 0 : parseFloat(z) || 0;
    }
    return key in DEFAULTS ? DEFAULTS[key] : 0;
  }

  function applyState(el) {
    var s = stateOf(el);
    var st = el.style;
    var tr = "";

    if (s.x !== undefined || s.y !== undefined) {
      tr += "translate(" + (s.x !== undefined ? s.x : "0px") + "," + (s.y !== undefined ? s.y : "0px") + ")";
    }
    if (s.xPercent !== undefined || s.yPercent !== undefined) {
      tr += " translate(" + (s.xPercent || 0) + "%," + (s.yPercent || 0) + "%)";
    }
    if (s.scale !== undefined) tr += " scale(" + s.scale + ")";
    if (s.rotate !== undefined) tr += " rotate(" + s.rotate + "deg)";
    if (tr) st.transform = tr;

    if (s.autoAlpha !== undefined) {
      st.opacity = s.autoAlpha;
      st.visibility = Number(s.autoAlpha) <= 0.001 ? "hidden" : "visible";
    }
    if (s.opacity !== undefined) st.opacity = s.opacity;
    if (s.visibility !== undefined) st.visibility = s.visibility;
    if (s.filter !== undefined) st.filter = s.filter;
    if (s.color !== undefined && s.color !== null) st.color = s.color;
    if (s.backgroundColor !== undefined && s.backgroundColor !== null) st.backgroundColor = s.backgroundColor;
    if (s.zIndex !== undefined && s.zIndex !== null) st.zIndex = Math.round(s.zIndex);
    if (s.height !== undefined && s.height !== null) st.height = s.height;
    if (s.clipPath !== undefined && s.clipPath !== null) { st.clipPath = s.clipPath; st.webkitClipPath = s.clipPath; }
    if (s.display !== undefined) st.display = s.display;
    if (s.pointerEvents !== undefined) st.pointerEvents = s.pointerEvents;
  }

  var META_KEYS = { duration: 1, ease: 1, stagger: 1, delay: 1, force3D: 1, transformOrigin: 1, overwrite: 1 };

  function setVars(el, vars) {
    var s = stateOf(el);
    for (var k in vars) {
      if (META_KEYS[k]) continue;
      s[k] = vars[k];
    }
    if (vars.transformOrigin) el.style.transformOrigin = vars.transformOrigin;
    applyState(el);
  }

  function tweenTo(el, from, to, p) {
    var s = stateOf(el);
    for (var k in to) {
      if (META_KEYS[k]) continue;
      s[k] = lerpValue(from[k], to[k], p);
    }
    applyState(el);
  }

  function captureFrom(el, to, explicitFrom) {
    var from = {};
    for (var k in to) {
      if (META_KEYS[k]) continue;
      from[k] = explicitFrom && k in explicitFrom ? explicitFrom[k] : baseline(el, k);
    }
    return from;
  }

  /* ---------------------------------------------------------
     TIMELINE (rAF)
     --------------------------------------------------------- */
  function Timeline(opts) {
    opts = opts || {};
    this.entries = [];
    this.labels = {};
    this.delay = opts.delay || 0;
    this.time = 0;
    this.duration = 0;
    this.playing = false;
  }

  Timeline.prototype._resolve = function (at) {
    if (typeof at === "number") return at;
    if (at === undefined || at === null) return this.duration;
    var s = String(at);
    var m = s.match(/^([a-zA-Z_][\w-]*)?(?:\s*\+=\s*([\d.]+))?$/);
    if (m) {
      var base = m[1] ? (this.labels[m[1]] || 0) : this.duration;
      return base + (m[2] ? parseFloat(m[2]) : 0);
    }
    return this.duration;
  };

  Timeline.prototype.addLabel = function (name, at) { this.labels[name] = this._resolve(at); return this; };

  Timeline.prototype.set = function (targets, vars, at) {
    var t = this._resolve(at);
    this.entries.push({ kind: "set", targets: toArray(targets), vars: vars, start: t, dur: 0 });
    this.duration = Math.max(this.duration, t);
    return this;
  };

  Timeline.prototype.to = function (targets, vars, at) {
    var t = this._resolve(at);
    var dur = vars.duration !== undefined ? vars.duration : 0.5;
    var stagger = vars.stagger || 0;
    var arr = toArray(targets);
    this.entries.push({ kind: "to", targets: arr, vars: vars, start: t, dur: dur, stagger: stagger, from: null });
    this.duration = Math.max(this.duration, t + dur + stagger * Math.max(0, arr.length - 1));
    return this;
  };

  Timeline.prototype.fromTo = function (targets, fromVars, vars, at) {
    var t = this._resolve(at);
    var dur = vars.duration !== undefined ? vars.duration : 0.5;
    var stagger = vars.stagger || 0;
    var arr = toArray(targets);
    this.entries.push({ kind: "to", targets: arr, vars: vars, explicitFrom: fromVars, start: t, dur: dur, stagger: stagger, from: null });
    this.duration = Math.max(this.duration, t + dur + stagger * Math.max(0, arr.length - 1));
    return this;
  };

  Timeline.prototype.call = function (fn, at) {
    var t = this._resolve(at);
    this.entries.push({ kind: "call", fn: fn, start: t, dur: 0, done: false });
    this.duration = Math.max(this.duration, t);
    return this;
  };

  Timeline.prototype.seek = function (time) {
    for (var i = 0; i < this.entries.length; i++) {
      var e = this.entries[i];
      if (e.kind === "set") {
        if (time >= e.start && !e.applied) {
          e.targets.forEach(function (el) { setVars(el, e.vars); });
          e.applied = true;
        }
        continue;
      }
      if (e.kind === "call") {
        if (time >= e.start && !e.done) { e.done = true; e.fn(); }
        continue;
      }
      var eFn = ease(e.vars.ease || "power1.inOut");
      for (var j = 0; j < e.targets.length; j++) {
        var el = e.targets[j];
        var s0 = e.start + (e.stagger || 0) * j;
        if (time < s0) continue;
        if (!e.from) e.from = [];
        if (!e.from[j]) e.from[j] = captureFrom(el, e.vars, e.explicitFrom);
        var p = e.dur > 0 ? clamp((time - s0) / e.dur, 0, 1) : 1;
        if (e.doneAt && e.doneAt[j]) continue;
        tweenTo(el, e.from[j], e.vars, eFn(p));
        if (p >= 1) { e.doneAt = e.doneAt || []; e.doneAt[j] = true; }
      }
    }
  };

  Timeline.prototype.play = function () {
    var self = this;
    var t0 = null;
    self.playing = true;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = (ts - t0) / 1000 - self.delay;
      if (t < 0) { requestAnimationFrame(step); return; }
      self.seek(t);
      if (t < self.duration + 0.05) requestAnimationFrame(step);
      else { self.seek(self.duration + 1); self.playing = false; }
    }
    requestAnimationFrame(step);
    return self;
  };

  function toArray(t) {
    if (!t) return [];
    if (t.nodeType) return [t];
    return Array.prototype.slice.call(t);
  }

  /* ---------------------------------------------------------
     SCROLL TRIGGER
     --------------------------------------------------------- */
  function tokenValue(token, size) {
    if (token === "top" || token === "left") return 0;
    if (token === "center") return size / 2;
    if (token === "bottom" || token === "right") return size;
    if (/%$/.test(token)) return (parseFloat(token) / 100) * size;
    if (/px$/.test(token)) return parseFloat(token);
    if (/vh$/.test(token)) return (parseFloat(token) / 100) * window.innerHeight;
    return parseFloat(token) || 0;
  }

  function resolveScrollPos(spec, triggerEl) {
    var parts = String(spec).trim().split(/\s+/);
    var a = parts[0], b = parts.length > 1 ? parts[1] : "top";
    var rect = triggerEl.getBoundingClientRect();
    var top = rect.top + window.pageYOffset;
    return top + tokenValue(a, rect.height) - tokenValue(b, window.innerHeight);
  }

  function addTrigger(cfg) { STATE.triggers.push(cfg); return cfg; }

  function refreshTriggers() {
    for (var i = 0; i < STATE.triggers.length; i++) {
      var t = STATE.triggers[i];
      if (!t.triggerEl || !t.triggerEl.isConnected) continue;
      t.startPx = resolveScrollPos(t.start, t.triggerEl);
      t.endPx = t.end != null ? resolveScrollPos(t.end, t.triggerEl) : t.startPx + 1;
      if (t.onRefresh) t.onRefresh(t);
    }
    updateTriggers(true);
  }

  function updateTriggers(immediate) {
    var y = window.pageYOffset;
    for (var i = 0; i < STATE.triggers.length; i++) {
      var t = STATE.triggers[i];
      if (t.scrub) {
        var span = t.endPx - t.startPx;
        var target = span > 0 ? clamp((y - t.startPx) / span, 0, 1) : y >= t.startPx ? 1 : 0;
        if (immediate || reduceMotion) t.p = target;
        else t.p = t.p + (target - t.p) * 0.16;
        if (Math.abs(target - t.p) < 0.0005) t.p = target;
        t.apply(t.p);
      } else {
        var active = y >= t.startPx;
        if (active !== t.active) {
          t.active = active;
          if (active) t.onEnter && t.onEnter();
          else if (!t.once) t.onLeaveBack && t.onLeaveBack();
        }
      }
    }
  }

  /* ---------------------------------------------------------
     DIVISÃO DE TEXTO (linhas / caracteres)
     --------------------------------------------------------- */
  function isSplit(el) { return el.hasAttribute("data-split-initialized"); }
  function markSplit(el) { el.setAttribute("data-split-initialized", "true"); }

  function splitIntoLines(el) {
    if (isSplit(el)) return $$(".line", el);

    var tokens = [];
    (function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var n = node.childNodes[i];
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          for (var j = 0; j < parts.length; j++) {
            if (!parts[j]) continue;
            if (/^\s+$/.test(parts[j])) tokens.push({ t: "space" });
            else tokens.push({ t: "word", v: parts[j] });
          }
        } else if (n.nodeType === 1) {
          if (n.tagName === "BR") tokens.push({ t: "br" });
          else walk(n);
        }
      }
    })(el);

    el.innerHTML = "";
    var spans = [];
    tokens.forEach(function (tk) {
      if (tk.t === "space") { el.appendChild(document.createTextNode(" ")); return; }
      if (tk.t === "br") { var br = document.createElement("br"); br.setAttribute("data-br", "1"); el.appendChild(br); spans.push({ br: br }); return; }
      var s = document.createElement("span");
      s.className = "word";
      s.textContent = tk.v;
      el.appendChild(s);
      spans.push({ el: s });
    });

    // Agrupa por linha visual
    var groups = [];
    var current = null;
    var lastTop = null;
    spans.forEach(function (item) {
      if (item.br) { current = null; lastTop = null; return; }
      var top = Math.round(item.el.offsetTop);
      if (current === null || (lastTop !== null && Math.abs(top - lastTop) > 2)) {
        current = [];
        groups.push(current);
      }
      lastTop = top;
      current.push(item.el);
    });

    if (!groups.length) { markSplit(el); return []; }

    var frag = document.createDocumentFragment();
    var lines = [];
    groups.forEach(function (g) {
      var mask = document.createElement("div");
      mask.className = "line-mask";
      var line = document.createElement("div");
      line.className = "line";
      g.forEach(function (w, i) {
        if (i > 0) line.appendChild(document.createTextNode(" "));
        line.appendChild(w);
      });
      mask.appendChild(line);
      frag.appendChild(mask);
      lines.push(line);
    });

    el.innerHTML = "";
    el.appendChild(frag);
    markSplit(el);

    // Títulos com background-clip:text pintam duas vezes após a divisão.
    var cs = window.getComputedStyle(el);
    if ((cs.webkitBackgroundClip || cs.backgroundClip) === "text") {
      el.style.background = "none";
      el.style.webkitTextFillColor = "transparent";
    }
    return lines;
  }

  /* Cada caractere ganha o seu próprio span, mas agrupado por palavra:
     spans inline-block soltos deixariam o navegador quebrar no meio da palavra. */
  function splitIntoChars(el) {
    if (isSplit(el)) return $$(".anim-char", el);
    var words = el.textContent.split(/(\s+)/);
    el.innerHTML = "";
    var frag = document.createDocumentFragment();
    words.forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); return; }
      var wordEl = document.createElement("span");
      wordEl.className = "anim-word";
      for (var i = 0; i < w.length; i++) {
        var s = document.createElement("span");
        s.className = "anim-char";
        s.textContent = w[i];
        wordEl.appendChild(s);
      }
      frag.appendChild(wordEl);
    });
    el.appendChild(frag);
    markSplit(el);
    return $$(".anim-char", el);
  }

  /* ---------------------------------------------------------
     CONTADOR DE DÍGITOS
     --------------------------------------------------------- */
  function setupMaskedNumber(el) {
    if ($(".number-wrap", el)) return;
    var value = el.getAttribute("data-number-count") || el.textContent.trim();
    el.textContent = "";
    var wrap = document.createElement("div");
    wrap.className = "number-wrap";
    el.appendChild(wrap);

    Array.prototype.forEach.call(value, function (ch) {
      var mask = document.createElement("div");
      mask.className = "digit-mask";
      if (!isNaN(parseInt(ch, 10))) {
        var track = document.createElement("div");
        track.className = "digit-track";
        for (var i = 0; i <= 9; i++) {
          var sp = document.createElement("span");
          sp.textContent = String(i);
          track.appendChild(sp);
        }
        mask.appendChild(track);
        mask.dataset.target = ch;
        mask.dataset.isDigit = "true";
      } else {
        mask.className += " is-static";
        mask.textContent = ch;
      }
      wrap.appendChild(mask);
    });
  }

  /* ---------------------------------------------------------
     MOTOR DE ATRIBUTOS data-tl-*
     --------------------------------------------------------- */
  var StyleEngine = {
    init: function () {
      $$("[data-tl-type], [data-number-count]").forEach(function (el) { StyleEngine.process(el); });
    },

    process: function (el) {
      if (el.hasAttribute("data-tl-desktop") && window.innerWidth < 768) return;

      var type = el.getAttribute("data-tl-type");
      var numberAttr = el.getAttribute("data-number-count");
      var triggerSel = el.getAttribute("data-tl-trigger") || ".hero";
      var triggerEl = $(triggerSel) || el;
      var start = el.getAttribute("data-tl-start") || "900px top";
      var end = el.getAttribute("data-tl-end") || "bottom top";
      var isOnce = el.hasAttribute("data-tl-once");

      var fromVars = parseJSONish(el.getAttribute("data-tl-from"), {});
      var toVars = parseJSONish(el.getAttribute("data-tl-to"), {});

      if (numberAttr !== null) {
        setupMaskedNumber(el);
        var masks = $$('.digit-mask[data-is-digit="true"]', el);
        addTrigger({
          triggerEl: triggerEl, start: start, end: null, scrub: false, once: isOnce, active: false,
          onEnter: function () {
            var tl = new Timeline();
            masks.forEach(function (mask, i) {
              var track = $(".digit-track", mask);
              var h = mask.offsetHeight;
              setVars(track, { y: h * 9 + "px" });
              tl.to(track, {
                y: -parseInt(mask.dataset.target, 10) * h + "px",
                duration: toVars.duration || 1.2,
                ease: toVars.ease || "power3.out"
              }, i * (toVars.stagger || 0.06));
            });
            tl.play();
          },
          onLeaveBack: function () {
            masks.forEach(function (mask) {
              var track = $(".digit-track", mask);
              setVars(track, { y: mask.offsetHeight * 9 + "px" });
            });
          }
        });
        return;
      }

      var splitType = el.getAttribute("data-tl-split");
      var targets;

      if (el.getAttribute("data-tl-target")) {
        targets = $$(el.getAttribute("data-tl-target"), el);
      } else if (splitType === "lines") {
        targets = splitIntoLines(el);
        if (!targets.length) targets = [el];
      } else if (splitType === "chars") {
        targets = splitIntoChars(el);
      } else {
        targets = [el];
      }

      if (type === "scroll") {
        var trg = addTrigger({
          triggerEl: triggerEl, start: start, end: end, scrub: true, p: 0,
          apply: function (p) {
            for (var i = 0; i < targets.length; i++) {
              var t = targets[i];
              if (!trg.from) trg.from = [];
              if (!trg.from[i]) trg.from[i] = captureFrom(t, toVars, fromVars);
              tweenTo(t, trg.from[i], toVars, p);
            }
          }
        });
        return;
      }

      // type === "trigger" — reproduz e reverte
      var dur = toVars.duration !== undefined ? toVars.duration : 0.5;
      var stg = toVars.stagger || 0;
      var dly = toVars.delay || 0;
      addTrigger({
        triggerEl: triggerEl, start: start, end: null, scrub: false, once: isOnce, active: false,
        onEnter: function () {
          var tl = new Timeline({ delay: dly });
          targets.forEach(function (t, i) {
            tl.fromTo(t, captureFrom(t, toVars, fromVars), Object.assign({}, toVars, { duration: dur, ease: toVars.ease || "power1.inOut" }), i * stg);
          });
          tl.play();
        },
        onLeaveBack: function () {
          if (isOnce) return;
          targets.forEach(function (t) { setVars(t, captureFrom(t, toVars, fromVars)); });
        }
      });
    }
  };

  /* ---------------------------------------------------------
     PRELOADER — entrada encenada do início
     --------------------------------------------------------- */
  var Preloader = {
    timeline: null,

    init: function () {
      var navContainer = $(".nav-container");
      var wordmark = $(".wordmark-hero");
      var wrap = $(".brand-logo-preload-svg");

      if (!isDesktop() || reduceMotion || !wordmark || !wrap) {
        document.documentElement.classList.remove("js-anim");
        if (navContainer) setVars(navContainer, { autoAlpha: 1 });
        Preloader.revealStatic();
        return;
      }

      var letters = $$(".wm-letter", wordmark);
      var profileImgItem = $(".profile-img-item");
      var navLinks = $$(".hero-navigation-link");
      var navSeps = $$(".hero-navigation-sep");
      var heroCard3 = $(".hero-card-3");
      var heroCardsLeft = $(".hero-cards-left");
      var heroLeftText = $(".hero-left-text");
      var heroRightText = $(".hero-right-text");
      var heroHeading = $(".hero-heading");
      var heroButtons = $(".hero-buttons-wrap");
      var navButton = $(".nav-button");
      var navButtonSecondary = $(".nav-button-secondary");
      var navLogoItem = $(".nav-logo-item");

      // Divide o título em linhas sem máscara (a revelação é por desfoque + escala)
      var headingLines = [];
      if (heroHeading) {
        headingLines = splitIntoLines(heroHeading);
        heroHeading.style.visibility = "visible";
      }

      if (heroLeftText) { splitIntoLines(heroLeftText); setVars(heroLeftText, { autoAlpha: 0 }); }
      if (heroRightText) { splitIntoLines(heroRightText); setVars(heroRightText, { autoAlpha: 0 }); }

      var rect = wrap.getBoundingClientRect();
      var xToCenter = 0;
      var yToCenter = (window.innerHeight / 2) - (rect.top + rect.height / 2);

      setVars(wrap, { autoAlpha: 1, y: yToCenter + "px", x: window.innerWidth + "px" });
      setVars(wordmark, { transformOrigin: "0 0" });
      letters.forEach(function (l) { setVars(l, { yPercent: 110 }); });
      navSeps.forEach(function (s) { setVars(s, { height: "0vw", autoAlpha: 1 }); });

      var tl = new Timeline({ delay: CONFIG.preloaderDelay });
      Preloader.timeline = tl;

      if (navLogoItem) tl.set(navLogoItem, { display: "none" }, 0);

      tl.to(wrap, { x: xToCenter + "px", duration: 1, ease: "power3.inOut" }, 0);
      tl.to(letters, { yPercent: 0, duration: 1, stagger: 0.09, ease: "power3.out" }, 0);
      tl.to(wrap, { x: "0px", y: "0px", duration: 1, ease: "power2.inOut" }, 1);

      if (navContainer) tl.set(navContainer, { autoAlpha: 1 }, 1.4);
      // Passagem de bastão: o logotipo gigante sai, o da barra lateral entra.
      tl.set(wrap, { display: "none" }, 2);
      if (navLogoItem) tl.set(navLogoItem, { display: "flex" }, 2);

      // Máscara em cada link do menu para a revelação vertical
      var navLinkInners = [];
      navLinks.forEach(function (link) {
        link.style.overflow = "hidden";
        link.style.display = "inline-block";
        var inner = document.createElement("div");
        inner.className = "nav-link-mask-inner";
        while (link.firstChild) inner.appendChild(link.firstChild);
        link.appendChild(inner);
        navLinkInners.push(inner);
        setVars(inner, { yPercent: 100 });
        setVars(link, { autoAlpha: 1, pointerEvents: "none" });
      });

      if (navButton) setVars(navButton, { autoAlpha: 0, scale: 0.94, filter: "blur(10px)" });
      if (navButtonSecondary) setVars(navButtonSecondary, { autoAlpha: 0, scale: 0.94, filter: "blur(10px)" });
      if (heroCard3) setVars(heroCard3, { autoAlpha: 0, filter: "blur(8px)" });
      if (heroCardsLeft) setVars(heroCardsLeft, { autoAlpha: 0, filter: "blur(8px)" });
      if (heroButtons) setVars(heroButtons, { autoAlpha: 0, scale: 0.94, filter: "blur(10px)" });
      if (profileImgItem) setVars(profileImgItem, { autoAlpha: 0, scale: 0.88, filter: "blur(20px)", transformOrigin: "center bottom" });
      headingLines.forEach(function (l) { setVars(l, { autoAlpha: 0, scale: 0.9, filter: "blur(10px)", transformOrigin: "center center" }); });

      var linkDur = 0.4, sepDur = 0.2;
      tl.addLabel("heroReveal", 1.4);

      if (profileImgItem) {
        tl.to(profileImgItem, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "power2.out" }, "heroReveal");
      }
      if (headingLines.length) {
        tl.to(headingLines, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1.0, stagger: 0.1, ease: "power2.out" }, "heroReveal+=0.3");
      }
      if (navLinkInners.length) {
        tl.to(navLinkInners, { yPercent: 0, duration: linkDur, ease: "power2.out" }, "heroReveal+=0.6");
        tl.call(function () { navLinks.forEach(function (l) { setVars(l, { pointerEvents: "auto" }); }); }, "heroReveal+=1.0");
      }
      if (navSeps.length) {
        tl.to(navSeps, { height: "0.8vw", duration: sepDur, ease: "power2.out" }, "heroReveal+=0.6");
      }

      var cardOrder = [heroCardsLeft, heroCard3];
      cardOrder.forEach(function (el, i) {
        if (!el) return;
        tl.to(el, { autoAlpha: 1, filter: "blur(0px)", duration: 0.9, ease: "power2.out" }, "heroReveal+=" + (0.6 + i * 0.14));
      });

      if (heroButtons) tl.to(heroButtons, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: "power2.out" }, "heroReveal+=1.1");
      if (navButton) tl.to(navButton, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: "power2.out" }, "heroReveal+=1.25");
      if (navButtonSecondary) tl.to(navButtonSecondary, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: "power2.out" }, "heroReveal+=1.33");

      [[heroLeftText, 1.65], [heroRightText, 1.75]].forEach(function (pair) {
        var target = pair[0];
        if (!target) return;
        tl.call(function () {
          setVars(target, { autoAlpha: 1 });
          var lines = $$(".line", target);
          if (!lines.length) return;
          lines.forEach(function (l) { setVars(l, { yPercent: 100, autoAlpha: 0, filter: "blur(6px)" }); });
          var sub = new Timeline();
          sub.to(lines, { yPercent: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.7, stagger: 0.075, ease: "power2.out" }, 0);
          sub.play();
        }, "heroReveal+=" + pair[1]);
      });

      tl.play();
    },

    revealStatic: function () {
      var heroHeading = $(".hero-heading");
      if (heroHeading) heroHeading.style.visibility = "visible";
    }
  };

  /* ---------------------------------------------------------
     ROLAGEM HORIZONTAL FIXA (resultados)
     --------------------------------------------------------- */
  var HorizontalScroll = {
    init: function () {
      if (!isDesktop()) return;
      var section = $(".work_section");
      var stickyEl = $(".work-sticky");
      var support = $(".work-sticky-support");
      var wrap = $(".work-track-wrap");
      var track = $(".work-track");
      if (!section || !stickyEl || !support || !wrap || !track) return;

      function measure(t) {
        support.style.height = Math.max(0, section.offsetHeight - stickyEl.offsetHeight) + "px";
        var wr = wrap.getBoundingClientRect();
        var tr = track.getBoundingClientRect();
        var currentX = stateOf(track).x ? parseFloat(stateOf(track).x) : 0;
        var overflowRight = Math.max(0, (tr.right - currentX) - wr.right);
        t.xMovement = -overflowRight;
        t.endPx = t.startPx + Math.max(1, section.offsetHeight - window.innerHeight);
      }

      var trg = addTrigger({
        triggerEl: section, start: "top top", end: "bottom top", scrub: true, p: 0,
        xMovement: 0,
        onRefresh: measure,
        apply: function (p) {
          setVars(track, { x: (trg.xMovement * p) + "px" });
        }
      });

      // Revelação dos cartões
      var cards = $$(".work-card", track);
      cards.forEach(function (c) { setVars(c, { yPercent: 10, autoAlpha: 0, scale: 0.72 }); });
      addTrigger({
        triggerEl: section, start: "top 80%", end: null, scrub: false, once: true, active: false,
        onEnter: function () {
          var tl = new Timeline();
          tl.to(cards, { yPercent: 0, autoAlpha: 1, scale: 1, duration: 1.1, ease: "expo.out", stagger: 0.09 }, 0);
          tl.play();
        }
      });
    }
  };

  /* ---------------------------------------------------------
     TROCA DE TEMA — cada bloco da barra lateral inverte quando
     passa por cima de uma seção marcada com data-theme="dark".
     --------------------------------------------------------- */
  var ThemeSwitcher = {
    init: function () {
      var darkSections = $$('[data-theme="dark"]');
      var blocks = $$(".nav-logo, .nav-top-layout, .nav-stats-wrap, .nav-menu, .nav-comapny-wrap, .nav-email-wrap, .nav-button-wrap");
      if (!darkSections.length || !blocks.length) return;

      STATE.theme = function () {
        var ranges = darkSections.map(function (s) {
          var r = s.getBoundingClientRect();
          return [r.top, r.bottom];
        });
        for (var i = 0; i < blocks.length; i++) {
          var r = blocks[i].getBoundingClientRect();
          var mid = r.top + r.height / 2;
          var dark = false;
          for (var j = 0; j < ranges.length; j++) {
            if (mid > ranges[j][0] && mid < ranges[j][1]) { dark = true; break; }
          }
          blocks[i].classList.toggle("is-dark", dark);
        }
      };
      STATE.theme();
    }
  };

  /* ---------------------------------------------------------
     REVELAÇÃO DE TEXTO CARACTERE A CARACTERE
     --------------------------------------------------------- */
  var TextReveal = {
    init: function () {
      var target = $("[data-text-reveal]");
      if (!target || isSplit(target)) return;
      var chars = splitIntoChars(target);
      if (!chars.length) return;

      var from = { color: "rgba(153,0,255,0.16)", opacity: 0.16, y: "5px" };
      var to = { color: "rgba(11,4,16,1)", opacity: 1, y: "0px" };
      var perChar = 0.35;
      var total = 1 + perChar;

      var trg = addTrigger({
        triggerEl: target, start: "top 92%", end: "top 25%", scrub: true, p: 0,
        apply: function (p) {
          var spread = perChar / Math.max(1, chars.length);
          for (var i = 0; i < chars.length; i++) {
            var local = clamp((p * total - i * spread) / 1, 0, 1);
            tweenTo(chars[i], from, to, EASES["power1.out"](local));
          }
        }
      });
      trg.apply(0);
    }
  };

  /* ---------------------------------------------------------
     HOVER DOS BOTÕES — rolagem de palavras
     --------------------------------------------------------- */
  var ButtonHover = {
    init: function () {
      if (!isDesktop() || reduceMotion) return;

      $$("[data-button-hover]").forEach(function (el) {
        var originalTarget, cloneTarget, mask;
        var p = el.querySelector("p");

        if (!p) {
          var inner = el.querySelector(".nav-link-mask-inner") || el;
          el.classList.add("is-text-link");
          var a = document.createElement("span");
          a.innerHTML = inner.innerHTML;
          var b = document.createElement("span");
          b.innerHTML = inner.innerHTML;
          b.classList.add("clone-text");
          inner.innerHTML = "";
          inner.appendChild(a);
          inner.appendChild(b);
          originalTarget = a; cloneTarget = b; mask = inner;
        } else {
          mask = document.createElement("div");
          mask.classList.add("nav-button-mask");
          p.parentNode.insertBefore(mask, p);
          mask.appendChild(p);
          var clone = p.cloneNode(true);
          clone.classList.add("clone-p");
          mask.appendChild(clone);
          originalTarget = p; cloneTarget = clone;
        }

        var wordsA = wrapWords(originalTarget);
        var wordsB = wrapWords(cloneTarget);
        if (!wordsA.length || !wordsB.length) return;

        var h = originalTarget.offsetHeight;
        wordsB.forEach(function (w) { setVars(w, { y: h + "px" }); });

        var showingA = true;
        el.addEventListener("mouseenter", function () {
          var out = showingA ? wordsA : wordsB;
          var inn = showingA ? wordsB : wordsA;
          var tl = new Timeline();
          tl.to(out, { y: -h + "px", duration: 0.5, stagger: 0.05, ease: "power2.out" }, 0);
          inn.forEach(function (w, i) {
            tl.fromTo(w, { y: h + "px" }, { y: "0px", duration: 0.5, ease: "power2.out" }, i * 0.05);
          });
          tl.play();
          showingA = !showingA;
        });
      });

      function wrapWords(el) {
        var text = el.textContent;
        var parts = text.split(/(\s+)/).filter(function (s) { return s.length; });
        el.innerHTML = "";
        var out = [];
        parts.forEach(function (part) {
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); return; }
          var s = document.createElement("span");
          s.className = "word";
          s.textContent = part;
          el.appendChild(s);
          out.push(s);
        });
        return out;
      }
    }
  };

  /* ---------------------------------------------------------
     COPIAR TELEFONE
     --------------------------------------------------------- */
  var Clipboard = {
    init: function () {
      $$("[data-clipboard]").forEach(function (el) {
        function copy() {
          var value = el.getAttribute("data-clipboard");
          var chip = $(".clipboard-item", el);
          var done = function () {
            if (!chip) return;
            chip.classList.add("is-visible");
            setTimeout(function () { chip.classList.remove("is-visible"); }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(done, done);
          } else {
            var ta = document.createElement("textarea");
            ta.value = value;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch (e) {}
            document.body.removeChild(ta);
            done();
          }
        }
        el.addEventListener("click", copy);
        el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); } });
      });
    }
  };

  /* ---------------------------------------------------------
     ROLAGEM SUAVE (equivalente ao Lenis do código de origem)
     --------------------------------------------------------- */
  var SmoothScroll = {
    init: function () {
      if (reduceMotion) return;
      if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

      var target = window.pageYOffset;
      var current = target;
      var active = true;
      document.documentElement.classList.add("lenis", "lenis-smooth");

      function maxScroll() {
        return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      }

      window.addEventListener("wheel", function (e) {
        if (e.ctrlKey) return;
        if (e.target && e.target.closest && e.target.closest("[data-lenis-prevent]")) return;
        e.preventDefault();
        target = clamp(target + e.deltaY, 0, maxScroll());
        active = true;
      }, { passive: false });

      window.addEventListener("keydown", function (e) {
        var k = e.key;
        if (k === "PageDown") target = clamp(target + window.innerHeight * 0.9, 0, maxScroll());
        else if (k === "PageUp") target = clamp(target - window.innerHeight * 0.9, 0, maxScroll());
        else if (k === "Home") target = 0;
        else if (k === "End") target = maxScroll();
        else return;
        active = true;
      });

      SmoothScroll.scrollTo = function (y) {
        target = clamp(y, 0, maxScroll());
        active = true;
      };

      SmoothScroll.sync = function () { target = current = window.pageYOffset; };

      SmoothScroll.tick = function () {
        var y = window.pageYOffset;
        /* Se algo fora daqui rolou a página (barra de rolagem, busca do
           navegador, âncora nativa), sincroniza em vez de puxar de volta. */
        if (!active) {
          if (Math.abs(y - current) > 1) { current = target = y; }
          return;
        }
        if (Math.abs(y - current) > 6) current = y;
        current += (target - current) * CONFIG.lenisLerp;
        if (Math.abs(target - current) < 0.4) { current = target; active = false; }
        window.scrollTo(0, current);
      };
    }
  };

  /* ---------------------------------------------------------
     ÂNCORAS + LINK ATIVO
     --------------------------------------------------------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (!id || id === "#") return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        var y = el.getBoundingClientRect().top + window.pageYOffset;
        if (SmoothScroll.scrollTo) SmoothScroll.scrollTo(y);
        else window.scrollTo({ top: y, behavior: "smooth" });
        closeMobileMenu();
      });
    });
  }

  function initScrollSpy() {
    var ids = ["inicio", "sobre", "resultados", "contato", "localizacao"];
    var links = {};
    $$("[data-link-id]").forEach(function (l) {
      var k = l.getAttribute("data-link-id");
      (links[k] = links[k] || []).push(l);
    });
    STATE.spy = function () {
      var y = window.pageYOffset + window.innerHeight * 0.35;
      var currentId = ids[0];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.pageYOffset <= y) currentId = id;
      });
      ids.forEach(function (id) {
        (links[id] || []).forEach(function (l) {
          l.classList.toggle("is-current", id === currentId);
        });
      });
    };
  }

  /* ---------------------------------------------------------
     MENU MÓVEL
     --------------------------------------------------------- */
  function closeMobileMenu() {
    var panel = $(".mobile-panel");
    var toggle = $(".mobile-menu-toggle");
    if (panel) panel.classList.remove("is-open");
    if (toggle) { toggle.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
  }

  function initMobileMenu() {
    var toggle = $(".mobile-menu-toggle");
    var panel = $(".mobile-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------------------------------------------------------
     ENTRADA DAS SEÇÕES SEM data-tl (fallback móvel)
     --------------------------------------------------------- */
  function initMobileReveals() {
    if (isDesktop() || reduceMotion || !("IntersectionObserver" in window)) return;
    var els = $$(".about-card-wrap, .contact-card, .map-info, .map-frame, .work-card, .about-portrait-wrap");
    els.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(18px)";
      el.style.transition = "opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1)";
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     LOOP PRINCIPAL
     --------------------------------------------------------- */
  function loop() {
    if (SmoothScroll.tick) SmoothScroll.tick();
    updateTriggers(false);
    if (STATE.theme) STATE.theme();
    if (STATE.spy) STATE.spy();
    STATE.raf = requestAnimationFrame(loop);
  }

  function initAll() {
    if (STATE.initialized) return;

    var y = document.querySelector("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());

    StyleEngine.init();
    Preloader.init();
    HorizontalScroll.init();
    ThemeSwitcher.init();
    TextReveal.init();
    ButtonHover.init();
    Clipboard.init();
    SmoothScroll.init();
    initAnchors();
    initScrollSpy();
    initMobileMenu();
    initMobileReveals();

    refreshTriggers();
    STATE.initialized = true;
    loop();

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (SmoothScroll.sync) SmoothScroll.sync();
        refreshTriggers();
      }, CONFIG.resizeDebounce);
    });

    // Recalcula depois que fontes e imagens assentam o layout
    window.addEventListener("load", function () { setTimeout(refreshTriggers, 120); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(refreshTriggers, 60); });
    }
    setTimeout(refreshTriggers, 600);
  }

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    window.scrollTo(0, 0);
    initAll();
  }

  /* Espera as fontes assentarem antes de dividir o texto em linhas —
     com rede de segurança para o caso de a promessa nunca resolver. */
  function scheduleBoot() {
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      window.scrollTo(0, 0);
      requestAnimationFrame(boot);
      setTimeout(boot, 40);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(arm, arm);
      setTimeout(arm, 1500);
    } else {
      arm();
    }
  }

  if (document.readyState === "complete") scheduleBoot();
  else window.addEventListener("load", scheduleBoot);
})();

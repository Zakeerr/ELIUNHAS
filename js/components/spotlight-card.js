/* ============================================================
   SpotlightCard — porte do componente React Bits para JS puro.
   Aprimora um elemento existente: injeta as camadas de luz,
   grão, borda e brilho da borda, e segue o cursor com a mesma
   suavização exponencial do original.
   Uso: SpotlightCard(elemento, { theme, spotlightColor, ... })
   ============================================================ */
(function (window) {
  "use strict";

  var THEMES = {
    dark: {
      surface: "#111111",
      border: "rgba(255, 255, 255, 0.08)",
      shadow: "0 24px 48px -24px rgba(0, 0, 0, 0.6)",
      light: "#ffffff",
      fill: 1,
      edge: 1
    },
    light: {
      surface: "#ffffff",
      border: "rgba(24, 24, 27, 0.1)",
      shadow: "0 1px 2px rgba(24, 24, 27, 0.04), 0 18px 40px -20px rgba(24, 24, 27, 0.16)",
      light: "#18181b",
      fill: 0.28,
      edge: 0.7
    }
  };

  var SHAPES = ["circle", "beam"];

  var NOISE =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  var falloff = function (color, softness) {
    var soft = clamp(softness, 0, 1);
    var core = Math.pow(1 - soft, 1.5) * 0.85;
    var stop = function (alpha, at) {
      return "color-mix(in srgb, " + color + " " + (alpha * 100).toFixed(2) + "%, transparent) " + (at * 100).toFixed(2) + "%";
    };
    var list = [stop(1, 0)];
    for (var i = 0; i <= 14; i++) {
      var t = core + ((1 - core) * i) / 14;
      var g = (t - core) / (1 - core);
      var smooth = 1 - g * g * (3 - 2 * g);
      var glow = Math.exp(-4.6 * g * g) * (1 - Math.pow(g, 6));
      list.push(stop(smooth + (glow - smooth) * soft, t));
    }
    return list.join(", ");
  };

  var DEFAULTS = {
    spotlightColor: undefined,
    intensity: 0.15,
    spotlightSize: 240,
    softness: 0.7,
    shape: "circle",
    borderGlow: 0.6,
    proximity: 80,
    smoothing: 0.3,
    ambient: false,
    flare: true,
    grain: 0,
    theme: "dark",
    surface: null
  };

  function SpotlightCard(root, options) {
    if (!root || root.__spotlight) return root && root.__spotlight;
    var p = Object.assign({}, DEFAULTS, options || {});
    var palette = THEMES[p.theme] || THEMES.dark;

    var buildSettings = function () {
      var color = p.spotlightColor || palette.light;
      return {
        shape: SHAPES.indexOf(p.shape) !== -1 ? p.shape : "circle",
        fill: falloff(color, p.softness),
        edge: falloff(color, 1),
        size: Math.max(20, p.spotlightSize),
        intensity: clamp(p.intensity, 0, 1) * palette.fill,
        borderGlow: clamp(p.borderGlow, 0, 1) * palette.edge,
        proximity: Math.max(0, p.proximity),
        smoothing: clamp(p.smoothing, 0, 1),
        ambient: p.ambient,
        flare: p.flare,
        grain: clamp(p.grain, 0, 1)
      };
    };
    var settingsRef = { current: buildSettings() };

    /* Marcação equivalente ao JSX do componente */
    root.classList.add("spotlight-card");
    root.style.setProperty("--spotlight-card-surface", p.surface || palette.surface);
    root.style.setProperty("--spotlight-card-border", palette.border);
    root.style.setProperty("--spotlight-card-shadow", palette.shadow);

    var make = function (cls) {
      var span = document.createElement("span");
      span.className = cls;
      span.setAttribute("aria-hidden", "true");
      return span;
    };
    var light = make("spotlight-card__light");
    var noise = make("spotlight-card__grain");
    noise.style.backgroundImage = NOISE;
    var border = make("spotlight-card__border");
    var edge = make("spotlight-card__edge");
    root.insertBefore(noise, root.firstChild);
    root.insertBefore(light, root.firstChild);
    root.appendChild(border);
    root.appendChild(edge);

    var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var state = { x: 0, y: 0, presence: 0, flare: 0, time: Math.random() * 60, pressed: false, visible: true };
    var pointer = { x: 0, y: 0, active: false };
    var drawn = { light: "", edge: "", noise: "" };
    var focus = null;
    var raf = 0;
    var last = 0;
    var alive = true;

    var gradient = function (s, size, x, y, stops) {
      if (s.shape === "beam") {
        var reach = Math.max(size * 0.6, y + size * 0.55);
        return "radial-gradient(" + (size * 0.55).toFixed(1) + "px " + reach.toFixed(1) + "px at " + x.toFixed(1) + "px 0px, " + stops + ")";
      }
      return "radial-gradient(circle " + size.toFixed(1) + "px at " + x.toFixed(1) + "px " + y.toFixed(1) + "px, " + stops + ")";
    };

    var paint = function (s) {
      var size = s.size * (1 + 0.2 * state.flare);
      var boost = 1 + 0.7 * state.flare;
      var fill = gradient(s, size, state.x, state.y, s.fill);
      var rim = gradient(s, size * 0.6, state.x, s.shape === "beam" ? 0 : state.y, s.edge);
      if (fill !== drawn.light) {
        drawn.light = fill;
        light.style.background = fill;
      }
      if (rim !== drawn.edge) {
        drawn.edge = rim;
        edge.style.background = rim;
      }
      light.style.opacity = String(Math.min(1, state.presence * s.intensity * boost));
      edge.style.opacity = String(Math.min(1, state.presence * s.borderGlow * boost));
      var grainy = s.grain > 0 ? gradient(s, size, state.x, state.y, "#000 0%, transparent 100%") : "none";
      if (grainy !== drawn.noise) {
        drawn.noise = grainy;
        noise.style.webkitMaskImage = grainy;
        noise.style.maskImage = grainy;
      }
      noise.style.opacity = String(state.presence * s.grain);
    };

    var tick = function (now) {
      raf = 0;
      if (!alive) return;
      var s = settingsRef.current;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      var rect = root.getBoundingClientRect();
      var tx = state.x;
      var ty = state.y;
      var target = 0;
      if (focus && root.contains(focus)) {
        var box = focus.getBoundingClientRect();
        tx = box.left + box.width / 2 - rect.left;
        ty = box.top + box.height / 2 - rect.top;
        target = 1;
      } else if (pointer.active) {
        tx = pointer.x - rect.left;
        ty = pointer.y - rect.top;
        var gap = Math.hypot(Math.max(0, -tx, tx - rect.width), Math.max(0, -ty, ty - rect.height));
        if (gap === 0) target = 1;
        else if (s.proximity > 0) target = Math.pow(Math.max(0, 1 - gap / s.proximity), 2);
      }
      if (target < 0.6 && s.ambient && state.visible) {
        if (!reduce) state.time += dt;
        var drift = 0.6 - target;
        tx += (rect.width * (0.5 + 0.34 * Math.sin(state.time * 0.43)) - tx) * (drift / 0.6);
        ty += (rect.height * (0.5 + 0.3 * Math.sin(state.time * 0.61 + 1.3)) - ty) * (drift / 0.6);
        target = 0.6;
      }
      if (state.presence < 0.02 && target > 0 && !s.ambient) {
        state.x = tx;
        state.y = ty;
      }
      var follow = reduce || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (0.015 + s.smoothing * 0.22));
      state.x += (tx - state.x) * follow;
      state.y += (ty - state.y) * follow;
      var fade = reduce ? 1 : 1 - Math.exp(-dt / (target > state.presence ? 0.1 : 0.32));
      state.presence += (target - state.presence) * fade;
      if (Math.abs(target - state.presence) < 0.002) state.presence = target;
      var press = state.pressed && s.flare && !reduce ? 1 : 0;
      state.flare += (press - state.flare) * (1 - Math.exp(-dt / (press ? 0.05 : 0.28)));
      if (Math.abs(press - state.flare) < 0.002) state.flare = press;
      paint(s);
      var moving = Math.abs(tx - state.x) > 0.1 || Math.abs(ty - state.y) > 0.1;
      var settled = !moving && state.presence === target && state.flare === press;
      if (!settled || (s.ambient && state.visible && !reduce)) raf = requestAnimationFrame(tick);
    };

    var wake = function () {
      if (raf || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    var onMove = function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      if (state.presence > 0 || settingsRef.current.proximity > 0 || root.contains(event.target)) wake();
    };
    var onOut = function (event) {
      if (event.relatedTarget) return;
      pointer.active = false;
      wake();
    };
    var onDown = function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      state.pressed = true;
      wake();
    };
    var onUp = function (event) {
      if (event.pointerType !== "mouse") pointer.active = false;
      if (!state.pressed && event.pointerType === "mouse") return;
      state.pressed = false;
      wake();
    };
    var onFocusIn = function (event) {
      if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
      focus = event.target;
      wake();
    };
    var onFocusOut = function (event) {
      if (root.contains(event.relatedTarget)) return;
      focus = null;
      wake();
    };
    var onScroll = function () {
      if (pointer.active || state.presence > 0) wake();
    };

    var observer = new IntersectionObserver(function (entries) {
      state.visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (state.visible) wake();
    });
    observer.observe(root);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("pointerout", onOut);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    wake();

    var api = {
      element: root,
      set: function (next) {
        p = Object.assign(p, next || {});
        settingsRef.current = buildSettings();
        wake();
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        observer.disconnect();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("scroll", onScroll, { capture: true });
        document.removeEventListener("pointerout", onOut);
        root.removeEventListener("pointerdown", onDown);
        root.removeEventListener("focusin", onFocusIn);
        root.removeEventListener("focusout", onFocusOut);
      }
    };
    root.__spotlight = api;
    return api;
  }

  window.SpotlightCard = SpotlightCard;
})(window);

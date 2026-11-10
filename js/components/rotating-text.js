/* ============================================================
   RotatingText — porte do componente React Bits para JS puro.
   O original anima com Motion (React); aqui as mesmas predefinições
   de efeito (slide, flip, blur, scale, drop), o stagger por letra,
   o modo "wait" e o bloco de destaque que se ajusta à largura de
   cada texto são feitos com GSAP.
   Uso: RotatingText(elemento, { texts: [...], effect, highlight, ... })
   ============================================================ */
(function (window) {
  "use strict";

  var segmenter =
    typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("pt-BR", { granularity: "grapheme" }) : null;

  var splitIntoCharacters = function (text) {
    return segmenter
      ? Array.from(segmenter.segment(text), function (segment) { return segment.segment; })
      : Array.from(text);
  };

  /* Molas do Motion traduzidas para curvas GSAP equivalentes. */
  var EFFECTS = {
    slide: function (up) {
      return {
        initial: { yPercent: up ? 100 : -100, opacity: 0 },
        animate: { yPercent: 0, opacity: 1 },
        exit: { yPercent: up ? -120 : 120, opacity: 0 },
        transition: { duration: 0.55, ease: "back.out(1.15)" },
        exitTransition: { duration: 0.36, ease: "power3.in" }
      };
    },
    flip: function (up) {
      return {
        initial: { rotationX: up ? -90 : 90, opacity: 0, transformPerspective: 480 },
        animate: { rotationX: 0, opacity: 1, transformPerspective: 480 },
        exit: { rotationX: up ? 90 : -90, opacity: 0, transformPerspective: 480 },
        transition: { duration: 0.6, ease: "back.out(1.6)" },
        exitTransition: { duration: 0.32, ease: "power2.in" },
        style: { transformOrigin: "50% 50% -0.45em", backfaceVisibility: "hidden" }
      };
    },
    blur: function (up) {
      return {
        initial: { yPercent: up ? 45 : -45, opacity: 0 },
        animate: { yPercent: 0, opacity: 1 },
        exit: { yPercent: up ? -45 : 45, opacity: 0 },
        transition: { duration: 0.55, ease: "expo.out" },
        exitTransition: { duration: 0.4, ease: "power2.in" }
      };
    },
    scale: function (up) {
      return {
        initial: { scale: up ? 0.35 : 1.7, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: up ? 1.7 : 0.35, opacity: 0 },
        transition: { duration: 0.6, ease: "back.out(1.7)" },
        exitTransition: { duration: 0.35, ease: "power2.in" }
      };
    },
    drop: function () {
      return {
        initial: { yPercent: -110, opacity: 0 },
        animate: { yPercent: 0, opacity: 1 },
        exit: { yPercent: 110, opacity: 0 },
        transition: { duration: 0.6, ease: "back.out(2)" },
        exitTransition: { duration: 0.3, ease: "power3.in" }
      };
    }
  };

  var readableText = function (color) {
    var value = String(color == null ? "" : color).trim();
    var rgb = null;
    var hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      var digits = hex[1].length < 6
        ? hex[1].slice(0, 3).split("").map(function (c) { return c + c; }).join("")
        : hex[1].slice(0, 6);
      rgb = [0, 2, 4].map(function (i) { return parseInt(digits.slice(i, i + 2), 16); });
    } else {
      var fn = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (fn) rgb = fn.slice(1, 4).map(Number);
    }
    if (!rgb) return undefined;
    var lin = rgb.map(function (channel) {
      var c = Math.min(Math.max(channel / 255, 0), 1);
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.3 ? "#0b0b0c" : "#ffffff";
  };

  var DEFAULTS = {
    texts: [],
    effect: "slide",
    direction: "up",
    highlight: false,
    highlightColor: "#a855f7",
    rotationInterval: 2000,
    blur: 0,
    staggerDuration: 0,
    staggerFrom: "first",
    splitBy: "characters",
    loop: true,
    auto: true,
    pauseOnHover: false,
    animatePresenceInitial: false,
    onNext: null,
    mainClassName: "",
    splitLevelClassName: "",
    elementLevelClassName: ""
  };

  function RotatingText(el, options) {
    if (!el || !window.gsap) return null;
    var gsap = window.gsap;
    var p = Object.assign({}, DEFAULTS, options || {});
    var texts = p.texts.length ? p.texts : [el.textContent.trim()];
    var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var preset = (EFFECTS[p.effect] || EFFECTS.slide)(p.direction !== "down");
    var blurAmount = p.blur > 0 ? p.blur : p.effect === "blur" ? 10 : 0;
    var withBlur = function (state, px) {
      return blurAmount > 0 ? Object.assign({}, state, { filter: "blur(" + px + "px)" }) : state;
    };
    var enterFrom = withBlur(preset.initial, blurAmount);
    var enterTo = withBlur(preset.animate, 0);
    var leaveTo = withBlur(preset.exit, blurAmount);

    /* Estrutura igual ao JSX: rótulo acessível + grupo animado */
    el.textContent = "";
    el.classList.add("text-rotate");
    if (p.highlight) el.classList.add("text-rotate-highlight");
    if (p.mainClassName) el.className += " " + p.mainClassName;
    if (p.highlight) {
      el.style.backgroundColor = p.highlightColor;
      var auto = readableText(p.highlightColor);
      if (auto) el.style.color = auto;
    }

    var sr = document.createElement("span");
    sr.className = "text-rotate-sr-only";
    el.appendChild(sr);

    var host = el;
    if (p.highlight) {
      host = document.createElement("span");
      host.className = "text-rotate-highlight-content";
      el.appendChild(host);
    }

    var index = 0;
    var group = null;
    var timer = null;
    var hovered = false;
    var busy = null;

    function buildGroup(text) {
      var g = document.createElement("span");
      g.className = p.splitBy === "lines" ? "text-rotate-lines" : "text-rotate";
      g.setAttribute("aria-hidden", "true");
      var parts;
      if (p.splitBy === "characters") {
        var words = text.split(" ");
        parts = words.map(function (word, i) {
          return { characters: splitIntoCharacters(word), needsSpace: i !== words.length - 1 };
        });
      } else {
        var sep = p.splitBy === "words" ? " " : p.splitBy === "lines" ? "\n" : p.splitBy;
        var chunks = text.split(sep);
        parts = chunks.map(function (part, i) {
          return { characters: [part], needsSpace: i !== chunks.length - 1 };
        });
      }
      var elements = [];
      parts.forEach(function (wordObj) {
        var w = document.createElement("span");
        w.className = "text-rotate-word" + (p.splitLevelClassName ? " " + p.splitLevelClassName : "");
        wordObj.characters.forEach(function (ch) {
          var c = document.createElement("span");
          c.className = "text-rotate-element" + (p.elementLevelClassName ? " " + p.elementLevelClassName : "");
          c.textContent = ch;
          if (preset.style) Object.assign(c.style, preset.style);
          w.appendChild(c);
          elements.push(c);
        });
        if (wordObj.needsSpace) {
          var space = document.createElement("span");
          space.className = "text-rotate-space";
          space.textContent = " ";
          w.appendChild(space);
        }
        g.appendChild(w);
      });
      g.__chars = elements;
      return g;
    }

    function staggerFn(total) {
      var shuffled = Array.from({ length: total }, function (_, i) { return i; })
        .sort(function () { return Math.random() - 0.5; });
      return function (i) {
        var d = p.staggerDuration;
        if (p.staggerFrom === "first") return i * d;
        if (p.staggerFrom === "last") return (total - 1 - i) * d;
        if (p.staggerFrom === "center") return Math.abs(Math.floor(total / 2) - i) * d;
        if (p.staggerFrom === "random") return shuffled[i] * d;
        return Math.abs(p.staggerFrom - i) * d;
      };
    }

    function fitWidth(instant) {
      if (!p.highlight || !group) return;
      var target = host.offsetWidth + 1;
      if (instant || reduce) gsap.set(el, { width: target });
      else gsap.to(el, { width: target, duration: 0.6, ease: "power3.out", overwrite: true });
    }

    function enter(text, animateIn) {
      group = buildGroup(text);
      host.appendChild(group);
      sr.textContent = text;
      var chars = group.__chars;
      if (!animateIn) {
        fitWidth(true);
        return null;
      }
      fitWidth(false);
      if (reduce) {
        return gsap.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      }
      return gsap.fromTo(
        chars,
        Object.assign({}, enterFrom),
        Object.assign({}, enterTo, preset.transition, { stagger: staggerFn(chars.length) })
      );
    }

    function leave(onDone) {
      if (!group) { onDone(); return; }
      var old = group;
      var chars = old.__chars;
      var done = function () { old.remove(); onDone(); };
      if (reduce) {
        gsap.to(chars, { opacity: 0, duration: 0.2, onComplete: done });
        return;
      }
      gsap.to(
        chars,
        Object.assign({}, leaveTo, preset.exitTransition || preset.transition, {
          stagger: staggerFn(chars.length),
          onComplete: done
        })
      );
    }

    function schedule() {
      clearTimeout(timer);
      if (!p.auto || (p.pauseOnHover && hovered)) return;
      timer = setTimeout(next, p.rotationInterval);
    }

    function goTo(i) {
      if (i === index) return;
      index = i;
      if (p.onNext) p.onNext(i);
      var text = texts[i];
      busy = true;
      leave(function () {
        enter(text, true);
        busy = false;
      });
      schedule();
    }

    var lastIndex = Math.max(texts.length - 1, 0);
    function next() { goTo(index < lastIndex ? index + 1 : p.loop ? 0 : index); }
    function previous() { goTo(index > 0 ? index - 1 : p.loop ? lastIndex : index); }
    function jumpTo(i) { goTo(Math.max(0, Math.min(i, lastIndex))); }
    function reset() { goTo(0); }

    el.addEventListener("mouseenter", function () {
      if (!p.pauseOnHover) return;
      hovered = true;
      clearTimeout(timer);
    });
    el.addEventListener("mouseleave", function () {
      if (!hovered) return;
      hovered = false;
      schedule();
    });

    /* A largura do destaque acompanha mudanças de fonte e de tela */
    var observer = null;
    if (p.highlight && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(function () {
        if (!busy && !gsap.isTweening(el)) fitWidth(true);
      });
      observer.observe(host);
    }

    enter(texts[0], p.animatePresenceInitial);
    schedule();

    return {
      element: el,
      next: next,
      previous: previous,
      jumpTo: jumpTo,
      reset: reset,
      pause: function () { clearTimeout(timer); },
      play: schedule,
      destroy: function () {
        clearTimeout(timer);
        if (observer) observer.disconnect();
      }
    };
  }

  window.RotatingText = RotatingText;
})(window);

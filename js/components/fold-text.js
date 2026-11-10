/* ============================================================
   FoldText — porte do componente React Bits para JS puro.
   Mesma lógica com GSAP: cada letra (ou palavra/linha) é um painel
   que desdobra a partir da dobradiça, com sombra no vinco, gatilhos
   mount / hover / scroll / loop e redobra perto do cursor.
   Diferença do original: além de { text }, aceita o conteúdo que já
   está no elemento e preserva <em> e <br> (para o itálico dos títulos).
   Uso: FoldText(elemento, { foldStyle, splitBy, hinge, trigger, ... })
   ============================================================ */
(function (window) {
  "use strict";

  var HINGES = {
    top: { origin: "50% 0%", axis: "rotateX", sign: -1 },
    bottom: { origin: "50% 100%", axis: "rotateX", sign: 1 },
    left: { origin: "0% 50%", axis: "rotateY", sign: 1 },
    right: { origin: "100% 50%", axis: "rotateY", sign: -1 }
  };

  var SLATS = {
    rotateX: {
      origins: ["50% 25%", "50% 75%"],
      clips: ["inset(-40% -20% 50% -20%)", "inset(50% -20% -40% -20%)"]
    },
    rotateY: {
      origins: ["25% 50%", "75% 50%"],
      clips: ["inset(-40% 50% -40% -20%)", "inset(-40% -20% -40% 50%)"]
    }
  };

  var FOLD_STYLES = ["paper", "blinds", "flip"];
  var SLAT_DELAY = 0.24;

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  var DEFAULTS = {
    text: null,
    splitBy: "char",
    hinge: "top",
    foldStyle: "paper",
    duration: 0.65,
    stagger: 0.045,
    staggerFrom: "start",
    foldAngle: 92,
    ease: "power3.out",
    perspective: 700,
    creaseShading: 0.55,
    trigger: "mount",
    loopDelay: 1.4,
    hoverRefold: false,
    refoldRadius: 140,
    refoldAngle: 45,
    fontSize: 80,
    fontWeight: 800,
    color: "currentColor",
    className: ""
  };

  function FoldText(root, options) {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    if (!root || !gsap) return null;
    var p = Object.assign({}, DEFAULTS, options || {});

    var safeHinge = HINGES[p.hinge] ? p.hinge : "top";
    var hingeConfig = HINGES[safeHinge];
    var safeStyle = FOLD_STYLES.indexOf(p.foldStyle) !== -1 ? p.foldStyle : "paper";
    var safeCrease = clamp(p.creaseShading, 0, 1);
    var safeAngle = clamp(p.foldAngle, 0, 180);
    var safeStagger = Math.max(0, p.stagger);
    var safeDelay = Math.max(0, p.loopDelay);
    var safeRadius = Math.max(1, p.refoldRadius);
    var safeRefold = clamp(p.refoldAngle, 0, 180);
    var startsFolded = p.trigger !== "hover";

    /* ---------- Marcação (equivalente ao useMemo de segments) ---------- */
    var renderPiece = function (content, isLine) {
      var segment = document.createElement("span");
      segment.className = "fold-text-segment";
      if (isLine) segment.setAttribute("data-fold-split", "line");
      var piece = document.createElement("span");
      piece.className = "fold-text-piece";
      piece.setAttribute("data-fold-hinge", safeHinge);
      piece.setAttribute("data-fold-style", safeStyle);
      if (startsFolded) piece.style.opacity = "0";
      if (safeStyle === "blinds") {
        var a = document.createElement("span");
        a.className = "fold-text-slat";
        a.setAttribute("data-fold-text", content);
        a.textContent = content;
        var b = document.createElement("span");
        b.className = "fold-text-slat";
        b.setAttribute("data-fold-slat", "b");
        b.setAttribute("data-fold-text", content);
        b.textContent = content;
        piece.appendChild(a);
        piece.appendChild(b);
      } else {
        piece.setAttribute("data-fold-text", content);
        piece.textContent = content;
      }
      segment.appendChild(piece);
      return segment;
    };

    var appendText = function (container, text) {
      if (p.splitBy === "line") {
        text.split("\n").forEach(function (line) { container.appendChild(renderPiece(line || " ", true)); });
        return;
      }
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          part.split("\n").forEach(function (spaces, lineIndex) {
            if (lineIndex > 0) container.appendChild(document.createElement("br"));
            if (spaces) container.appendChild(document.createTextNode(spaces));
          });
          return;
        }
        if (p.splitBy === "word") {
          container.appendChild(renderPiece(part, false));
          return;
        }
        var word = document.createElement("span");
        word.className = "fold-text-word";
        Array.from(part).forEach(function (ch) { word.appendChild(renderPiece(ch, false)); });
        container.appendChild(word);
      });
    };

    var visual = document.createElement("span");
    visual.className = "fold-text-visual";
    visual.setAttribute("aria-hidden", "true");
    var plain;

    if (typeof p.text === "string") {
      plain = p.text;
      appendText(visual, p.text);
    } else {
      /* Conteúdo do próprio elemento: espaços do HTML viram um só,
         <em>/<strong>/<span> são recriados em volta dos seus painéis. */
      var nodes = Array.from(root.childNodes);
      var squash = function (s) { return s.replace(/\s+/g, " "); };
      nodes.forEach(function (node, i) {
        if (node.nodeType === 3) {
          var t = squash(node.data);
          if (i === 0) t = t.replace(/^ /, "");
          if (i === nodes.length - 1) t = t.replace(/ $/, "");
          appendText(visual, t);
        } else if (node.nodeType === 1 && node.tagName === "BR") {
          visual.appendChild(document.createElement("br"));
        } else if (node.nodeType === 1) {
          var wrap = document.createElement(node.tagName.toLowerCase());
          if (node.className) wrap.className = node.className;
          appendText(wrap, squash(node.textContent).trim());
          visual.appendChild(wrap);
        }
      });
      plain = squash(root.textContent).trim();
    }

    var sr = document.createElement("span");
    sr.className = "fold-text-sr-only";
    sr.textContent = plain;

    root.textContent = "";
    root.classList.add("fold-text");
    if (p.className) root.className += " " + p.className;
    if (p.fontSize !== "inherit") root.style.setProperty("--fold-text-font-size", typeof p.fontSize === "number" ? p.fontSize + "px" : p.fontSize);
    if (p.fontWeight !== "inherit") root.style.setProperty("--fold-text-font-weight", p.fontWeight);
    root.style.setProperty("--fold-text-color", p.color);
    root.style.setProperty("--fold-perspective", Math.max(120, p.perspective) + "px");
    root.appendChild(sr);
    root.appendChild(visual);

    /* ---------- Animação (equivalente ao useLayoutEffect) ---------- */
    var elements = Array.from(root.querySelectorAll(".fold-text-piece"));
    if (!elements.length) return null;

    var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var axis = hingeConfig.axis;
    var sign = hingeConfig.sign;
    var origin = hingeConfig.origin;
    var slats = SLATS[axis];
    var unfoldEase = gsap.parseEase(reduceMotion ? "power1.out" : p.ease) || gsap.parseEase("power3.out");
    var foldEase = gsap.parseEase(reduceMotion ? "power1.in" : "power2.in");
    var angle = reduceMotion ? 0 : safeStyle === "flip" ? 180 : safeAngle;
    var crease = reduceMotion ? 0 : safeCrease;
    var refold = p.hoverRefold && !reduceMotion ? safeRefold : 0;
    var lift = safeStyle === "flip" && !reduceMotion ? 0.45 : 0;
    var unfoldDuration = reduceMotion ? Math.min(p.duration, 0.22) : p.duration;
    var staggerVars = { each: reduceMotion ? Math.min(safeStagger, 0.02) : safeStagger, from: p.staggerFrom };

    var pieces = elements.map(function (element) {
      var parts = safeStyle === "blinds" ? Array.from(element.children) : [element];
      if (safeStyle === "blinds") {
        element.style.opacity = "1";
        parts.forEach(function (part, index) {
          part.style.transformOrigin = slats.origins[index];
          if (index > 0) part.style.clipPath = slats.clips[index];
        });
      } else {
        element.style.transformOrigin = safeStyle === "flip" ? "50% 50%" : origin;
        element.style.backfaceVisibility = safeStyle === "flip" ? "visible" : "";
      }
      return { element: element, parts: parts, t: startsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
    });

    var shade = function (progress, tilt) { return String(crease * clamp(1 - progress + tilt / 90, 0, 1)); };

    var render = function () {
      pieces.forEach(function (piece) {
        var tilt = piece.r * refold;

        if (safeStyle === "blinds") {
          var resting = tilt < 0.05;
          piece.parts.forEach(function (part, index) {
            var offset = index * SLAT_DELAY;
            var open = unfoldEase(clamp((piece.t - offset) / (1 - SLAT_DELAY), 0, 1));
            var close = foldEase(clamp((piece.f - offset) / (1 - SLAT_DELAY), 0, 1));
            var progress = open * (1 - close);
            if (Math.abs(1 - progress) > 0.002) resting = false;
            part.style.transform = axis + "(" + sign * ((1 - progress) * angle + tilt) + "deg)";
            part.style.opacity = String(clamp(progress, 0, 1));
            part.style.setProperty("--fold-crease", shade(progress, tilt));
          });
          piece.parts[0].style.clipPath = resting ? "none" : slats.clips[0];
          piece.parts[1].style.visibility = resting ? "hidden" : "visible";
          return;
        }

        var progress = unfoldEase(piece.t) * (1 - foldEase(piece.f));
        var rise = lift * Math.sin(Math.PI * clamp(progress, 0, 1));
        var turn = axis + "(" + sign * ((1 - progress) * angle + tilt) + "deg)";
        piece.element.style.transform = rise > 0.001 ? "translateZ(" + rise + "em) " + turn : turn;
        piece.element.style.opacity = String(clamp(progress, 0, 1));
        piece.element.style.setProperty("--fold-crease", shade(progress, tilt));
      });
    };

    var timeline = null;
    var scrollTrigger = null;

    var play = function (loop) {
      if (timeline) timeline.kill();
      timeline = gsap.timeline(Object.assign({ onUpdate: render }, loop ? { repeat: -1, repeatDelay: 0.35 } : {}));
      timeline.fromTo(pieces, { t: 0, f: 0 }, { t: 1, duration: unfoldDuration, ease: "none", stagger: staggerVars });
      if (loop) {
        timeline.to(pieces, { f: 1, duration: unfoldDuration * 0.75, ease: "none", stagger: staggerVars }, "+=" + safeDelay);
      }
      render();
    };

    var handleEnter = function () { play(false); };

    if (p.trigger === "hover") {
      render();
      root.addEventListener("mouseenter", handleEnter);
    } else if (p.trigger === "scroll" && ScrollTrigger) {
      render();
      scrollTrigger = ScrollTrigger.create({ trigger: root, start: "top 82%", once: true, onEnter: handleEnter });
    } else {
      play(p.trigger === "loop");
    }

    var pointer = null;
    var centers = null;
    var measured = null;
    var relaxing = false;

    var measure = function (box) {
      centers = pieces.map(function (piece) {
        var rect = piece.element.parentElement.getBoundingClientRect();
        return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
      });
      measured = { width: box.width, height: box.height };
    };

    var relax = function (time, deltaTime) {
      var step = Math.min(deltaTime, 64) / 1000;
      var moving = false;
      pieces.forEach(function (piece) {
        var rate = piece.aim > piece.r ? 14 : 6;
        piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
        if (Math.abs(piece.aim - piece.r) > 0.001) moving = true;
        else piece.r = piece.aim;
      });
      render();
      if (!moving) {
        gsap.ticker.remove(relax);
        relaxing = false;
      }
    };

    var aim = function () {
      var box = root.getBoundingClientRect();
      var near =
        pointer &&
        pointer.x > box.left - safeRadius &&
        pointer.x < box.right + safeRadius &&
        pointer.y > box.top - safeRadius &&
        pointer.y < box.bottom + safeRadius;
      if (near && (!centers || Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)) {
        measure(box);
      }
      var changed = false;
      pieces.forEach(function (piece, index) {
        var value = 0;
        if (near) {
          var center = centers[index];
          var distance = Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) / safeRadius;
          if (distance < 1) value = 1 - distance * distance * (3 - 2 * distance);
        }
        if (value !== piece.aim) changed = true;
        piece.aim = value;
      });
      if (changed && !relaxing) {
        relaxing = true;
        gsap.ticker.add(relax);
      }
    };

    var handleMove = function (event) {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };
    var handleLeave = function () {
      pointer = null;
      aim();
    };
    var handleScroll = function () {
      if (pointer) aim();
    };

    if (refold) {
      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
      document.documentElement.addEventListener("pointerleave", handleLeave);
    }

    return {
      element: root,
      play: function () { play(false); },
      destroy: function () {
        root.removeEventListener("mouseenter", handleEnter);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("scroll", handleScroll, { capture: true });
        document.documentElement.removeEventListener("pointerleave", handleLeave);
        gsap.ticker.remove(relax);
        if (scrollTrigger) scrollTrigger.kill();
        if (timeline) timeline.kill();
        gsap.killTweensOf(pieces);
      }
    };
  }

  window.FoldText = FoldText;
})(window);

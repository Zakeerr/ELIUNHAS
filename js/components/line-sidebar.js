/* ============================================================
   LineSidebar — porte do componente React Bits para JS puro.
   Monta a lista dentro de um elemento e mantém o mesmo laço
   rAF que suaviza o --effect de cada item (cor, deslocamento e
   escala andam juntos). Cada item é um link de verdade para
   funcionar com teclado e leitores de tela.
   Uso: LineSidebar(elemento, { items: [{ label, href }], ... })
   ============================================================ */
(function (window) {
  "use strict";

  var FALLOFF_CURVES = {
    linear: function (p) { return p; },
    smooth: function (p) { return p * p * (3 - 2 * p); },
    sharp: function (p) { return p * p * p; }
  };

  var DEFAULTS = {
    items: [],
    accentColor: "#A855F7",
    textColor: "#c4c4c4",
    markerColor: "#6c6c6c",
    showIndex: true,
    showMarker: true,
    proximityRadius: 100,
    maxShift: 30,
    falloff: "smooth",
    markerLength: 60,
    markerGap: 0,
    tickScale: 0.5,
    scaleTick: true,
    itemGap: 20,
    fontSize: 1.1,
    smoothing: 100,
    defaultActive: null,
    onItemClick: null,
    className: "",
    ariaLabel: "Navegação"
  };

  function LineSidebar(mount, options) {
    if (!mount) return null;
    var p = Object.assign({}, DEFAULTS, options || {});

    var nav = document.createElement("nav");
    nav.className =
      "line-sidebar" +
      (p.showMarker ? " line-sidebar--markers" : "") +
      (p.scaleTick ? " line-sidebar--scale-tick" : "") +
      (p.className ? " " + p.className : "");
    nav.setAttribute("aria-label", p.ariaLabel);
    var vars = {
      "--accent-color": p.accentColor,
      "--text-color": p.textColor,
      "--marker-color": p.markerColor,
      "--marker-length": p.markerLength + "px",
      "--marker-gap": p.markerGap + "px",
      "--tick-scale": p.tickScale,
      "--max-shift": p.maxShift + "px",
      "--item-gap": p.itemGap + "px",
      "--font-size": p.fontSize + "rem",
      "--smoothing": p.smoothing + "ms"
    };
    Object.keys(vars).forEach(function (k) { nav.style.setProperty(k, vars[k]); });

    var list = document.createElement("ul");
    list.className = "line-sidebar__list";
    nav.appendChild(list);

    var itemRefs = [];
    p.items.forEach(function (item, index) {
      var label = typeof item === "string" ? item : item.label;
      var href = typeof item === "string" ? "#" : item.href;

      var li = document.createElement("li");
      li.className = "line-sidebar__item";

      var a = document.createElement("a");
      a.className = "line-sidebar__link";
      a.href = href;

      if (p.showMarker) {
        var marker = document.createElement("span");
        marker.className = "line-sidebar__marker";
        marker.setAttribute("aria-hidden", "true");
        a.appendChild(marker);
      }
      var labelEl = document.createElement("span");
      labelEl.className = "line-sidebar__label";
      if (p.showIndex) {
        var idx = document.createElement("span");
        idx.className = "line-sidebar__index";
        idx.setAttribute("aria-hidden", "true");
        idx.textContent = String(index + 1).padStart(2, "0");
        labelEl.appendChild(idx);
      }
      var text = document.createElement("span");
      text.className = "line-sidebar__text";
      text.textContent = label;
      labelEl.appendChild(text);
      a.appendChild(labelEl);

      a.addEventListener("click", function (event) { handleClick(event, index, label, href); });
      li.appendChild(a);
      list.appendChild(li);
      itemRefs.push(li);
    });

    mount.appendChild(nav);

    var targets = [];
    var current = [];
    var raf = null;
    var lastTime = 0;
    var activeIndex = p.defaultActive;

    /* Um único laço rAF suaviza o --effect de cada item com
       suavização exponencial independente da taxa de quadros. */
    var runFrame = function (now) {
      var dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      var tau = Math.max(p.smoothing, 1) / 1000;
      var k = 1 - Math.exp(-dt / tau);

      var moving = false;
      for (var i = 0; i < itemRefs.length; i++) {
        var el = itemRefs[i];
        var target = Math.max(targets[i] || 0, activeIndex === i ? 1 : 0);
        var cur = current[i] || 0;
        var next = cur + (target - cur) * k;
        var settled = Math.abs(target - next) < 0.0015;
        var value = settled ? target : next;
        current[i] = value;
        el.style.setProperty("--effect", value.toFixed(4));
        if (!settled) moving = true;
      }

      raf = moving ? requestAnimationFrame(runFrame) : null;
    };

    var startLoop = function () {
      if (raf != null) cancelAnimationFrame(raf);
      lastTime = performance.now();
      raf = requestAnimationFrame(runFrame);
    };

    var handlePointerMove = function (e) {
      var rect = list.getBoundingClientRect();
      var pointerY = e.clientY - rect.top;
      var ease = FALLOFF_CURVES[p.falloff] || FALLOFF_CURVES.linear;
      for (var i = 0; i < itemRefs.length; i++) {
        var el = itemRefs[i];
        var center = el.offsetTop + el.offsetHeight / 2;
        var distance = Math.abs(pointerY - center);
        targets[i] = ease(Math.max(0, 1 - distance / p.proximityRadius));
      }
      startLoop();
    };

    var handlePointerLeave = function () {
      targets = targets.map(function () { return 0; });
      startLoop();
    };

    function setActive(index) {
      if (index === activeIndex) return;
      activeIndex = index;
      itemRefs.forEach(function (li, i) {
        var link = li.firstChild;
        if (i === index) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
      startLoop();
    }

    function handleClick(event, index, label, href) {
      setActive(index);
      if (p.onItemClick) p.onItemClick(index, label, href, event);
    }

    list.addEventListener("pointermove", handlePointerMove);
    list.addEventListener("pointerleave", handlePointerLeave);
    if (activeIndex != null) {
      var initial = activeIndex;
      activeIndex = null;
      setActive(initial);
    } else {
      startLoop();
    }

    return {
      element: nav,
      setActive: setActive,
      destroy: function () {
        if (raf != null) cancelAnimationFrame(raf);
        list.removeEventListener("pointermove", handlePointerMove);
        list.removeEventListener("pointerleave", handlePointerLeave);
        nav.remove();
      }
    };
  }

  window.LineSidebar = LineSidebar;
})(window);

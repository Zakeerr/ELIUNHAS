/* ============================================================
   SpecularButton — porte do componente React Bits para JS puro.
   Aprimora um <a> ou <button> existente: injeta o canvas WebGL2
   da luz na borda e envolve o conteúdo no rótulo.
   Uso: SpecularButton(elemento, { size, radius, tint, ... })
   ============================================================ */
(function (window) {
  "use strict";

  var PAD = 24;
  var TAU = Math.PI * 2;

  var VERTEX = [
    "#version 300 es",
    "in vec2 aPosition;",
    "void main() {",
    "  gl_Position = vec4(aPosition, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 uCenter;",
    "uniform vec2 uHalf;",
    "uniform float uRadius;",
    "uniform float uPx;",
    "uniform float uSpot;",
    "uniform vec2 uEntry;",
    "uniform vec3 uLineColor;",
    "uniform vec3 uBaseColor;",
    "uniform float uIntensity;",
    "uniform vec2 uWindow;",
    "uniform float uThickness;",
    "uniform float uGlow;",
    "out vec4 outColor;",
    "",
    "float roundedBox(vec2 p, vec2 b, float r) {",
    "  vec2 q = abs(p) - b + r;",
    "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;",
    "}",
    "",
    "float loopPosition(vec2 p, vec2 b, float r) {",
    "  vec2 inner = b - r;",
    "  float arc = 1.5707963 * r;",
    "  float quarter = inner.x + inner.y + arc;",
    "  vec2 a = abs(p);",
    "  vec2 q = a - inner;",
    "  float s = q.x > 0.0 && q.y > 0.0",
    "    ? inner.y + atan(q.y, q.x) * r",
    "    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));",
    "  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;",
    "  else if (p.y < 0.0) s = 4.0 * quarter - s;",
    "  return s / max(4.0 * quarter, 0.0001);",
    "}",
    "",
    "float lobe(float position, float center) {",
    "  float gap = abs(fract(position - center + 0.5) - 0.5);",
    "  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);",
    "}",
    "",
    "void main() {",
    "  vec2 p = gl_FragCoord.xy - uCenter;",
    "  float d = roundedBox(p, uHalf, uRadius);",
    "  float position = loopPosition(p, uHalf, uRadius);",
    "  float key = lobe(position, uSpot);",
    "  float back = lobe(position, uSpot + 0.5);",
    "  float streak = key + back * 0.45;",
    "  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);",
    "  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));",
    "  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));",
    "  float inside = 1.0 - smoothstep(-0.6, 0.6, d);",
    "  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));",
    "  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));",
    "  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);",
    "  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;",
    "  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);",
    "}"
  ].join("\n");

  var UNIFORMS = [
    "uCenter", "uHalf", "uRadius", "uPx", "uSpot", "uEntry", "uLineColor",
    "uBaseColor", "uIntensity", "uWindow", "uThickness", "uGlow"
  ];

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  var wrap = function (value) { return value - Math.floor(value); };

  var loopPosition = function (x, y, halfX, halfY, r) {
    var innerX = halfX - r;
    var innerY = halfY - r;
    var arc = (Math.PI / 2) * r;
    var quarter = innerX + innerY + arc;
    var ax = Math.abs(x);
    var ay = Math.abs(y);
    var qx = ax - innerX;
    var qy = ay - innerY;
    var s;
    if (qx > 0 && qy > 0) s = innerY + Math.atan2(qy, qx) * r;
    else if (qx > qy) s = Math.min(ay, innerY);
    else s = innerY + arc + innerX - Math.min(ax, innerX);
    if (x < 0) s = y >= 0 ? 2 * quarter - s : 2 * quarter + s;
    else if (y < 0) s = 4 * quarter - s;
    return wrap(s / Math.max(4 * quarter, 0.0001));
  };

  var rimPoint = function (position, halfX, halfY, r) {
    var innerX = halfX - r;
    var innerY = halfY - r;
    var arc = (Math.PI / 2) * r;
    var quarter = innerX + innerY + arc;
    var s = wrap(position) * 4 * quarter;
    var signX = 1;
    var signY = 1;
    if (s > 3 * quarter) {
      s = 4 * quarter - s;
      signY = -1;
    } else if (s > 2 * quarter) {
      s -= 2 * quarter;
      signX = -1;
      signY = -1;
    } else if (s > quarter) {
      s = 2 * quarter - s;
      signX = -1;
    }
    var x = innerX - (s - innerY - arc);
    var y = halfY;
    if (s <= innerY) {
      x = halfX;
      y = s;
    } else if (s <= innerY + arc) {
      var angle = (s - innerY) / Math.max(r, 0.0001);
      x = innerX + Math.cos(angle) * r;
      y = innerY + Math.sin(angle) * r;
    }
    return [x * signX, y * signY];
  };

  var compile = function (gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };

  var link = function (gl) {
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    gl.deleteProgram(program);
    return null;
  };

  var DEFAULTS = {
    size: "lg",
    radius: 18,
    tint: "#ffffff",
    tintOpacity: 0.04,
    blur: 0,
    textColor: "#f5f5f5",
    lineColor: "#ffffff",
    baseColor: "#525252",
    intensity: 1,
    idleIntensity: 0.35,
    shineSize: 10,
    shineFade: 34,
    thickness: 1.2,
    glow: 1,
    speed: 0.35,
    followMouse: true,
    proximity: 250,
    autoAnimate: false,
    disabled: false
  };

  function SpecularButton(button, options) {
    if (!button || button.__specular) return button && button.__specular;
    var p = Object.assign({}, DEFAULTS, options || {});

    /* Marcação equivalente ao JSX do componente */
    button.classList.add("specular-button", "specular-button--" + p.size);
    button.style.setProperty("--sb-radius", p.radius + "px");
    button.style.setProperty("--sb-tint", p.tint);
    button.style.setProperty("--sb-tint-opacity", p.tintOpacity);
    button.style.setProperty("--sb-blur", p.blur + "px");
    button.style.setProperty("--sb-text-color", p.textColor);

    var label = document.createElement("span");
    label.className = "specular-button__label";
    while (button.firstChild) label.appendChild(button.firstChild);
    var canvas = document.createElement("canvas");
    canvas.className = "specular-button__light";
    canvas.setAttribute("aria-hidden", "true");
    button.appendChild(canvas);
    button.appendChild(label);

    var settingsRef = { current: null };
    var setSettings = function () {
      settingsRef.current = {
        radius: Math.max(0, p.radius),
        lineColor: String(p.lineColor),
        baseColor: String(p.baseColor),
        intensity: Math.max(0, p.intensity),
        idleIntensity: clamp(p.idleIntensity, 0, 1),
        shineSize: Math.max(0, p.shineSize),
        shineFade: Math.max(0, p.shineFade),
        thickness: Math.max(0, p.thickness),
        glow: Math.max(0, p.glow),
        speed: p.speed,
        followMouse: p.followMouse,
        proximity: Math.max(1, p.proximity),
        autoAnimate: p.autoAnimate,
        disabled: p.disabled
      };
    };
    setSettings();

    var api = { element: button, set: function () {}, destroy: function () {} };
    button.__specular = api;

    var gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false
    });
    if (!gl) { button.classList.add("is-flat"); return api; }
    var program = link(gl);
    if (!program) { button.classList.add("is-flat"); return api; }
    var uniforms = {};
    UNIFORMS.forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
    var buffer = gl.createBuffer();
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var colors = new Map();
    var view = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, known: false };
    var state = { spot: 0, level: 0, press: 0, ready: false };
    var raf = 0;
    var last = 0;
    var visible = true;

    var toRgb = function (value) {
      if (colors.has(value)) return colors.get(value);
      var rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#000000";
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        var d = probe.getImageData(0, 0, 1, 1).data;
        rgb = [d[0] / 255, d[1] / 255, d[2] / 255];
      }
      colors.set(value, rgb);
      return rgb;
    };

    var cornerRadius = function (s) { return Math.min(s.radius, view.width / 2, view.height / 2); };

    var restSpot = function (s) {
      var r = cornerRadius(s);
      var inset = r * (1 - Math.SQRT1_2);
      return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, r);
    };

    var aim = function (s) {
      if (!s.followMouse || s.disabled || !pointer.known) return null;
      var rect = button.getBoundingClientRect();
      var scale = rect.width / view.width || 1;
      var halfX = view.width / 2;
      var halfY = view.height / 2;
      var x = (pointer.x - rect.left - rect.width / 2) / scale;
      var y = (rect.top + rect.height / 2 - pointer.y) / scale;
      var distance = Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(Math.abs(y) - halfY, 0));
      var t = clamp(1 - distance / s.proximity, 0, 1);
      var near = t * t * (3 - 2 * t);
      var nearest = loopPosition(x, y, halfX, halfY, cornerRadius(s));
      if (distance > 0) return { spot: nearest, near: near };
      var depth = clamp(Math.min(halfX - Math.abs(x), halfY - Math.abs(y)) / (halfY * 0.8), 0, 1);
      var sway = restSpot(s) - (x / halfX) * 0.06 - (y / halfY) * 0.02;
      var offset = sway - nearest - Math.round(sway - nearest);
      return { spot: wrap(nearest + offset * depth * depth * (3 - 2 * depth)), near: near };
    };

    var draw = function (s) {
      var width = view.width;
      var height = view.height;
      var scaleX = canvas.width / (width + PAD * 2);
      var scaleY = canvas.height / (height + PAD * 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
      gl.uniform2f(uniforms.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
      gl.uniform1f(uniforms.uRadius, Math.min(s.radius, width / 2, height / 2) * scaleX);
      gl.uniform1f(uniforms.uPx, view.ratio);
      var r = Math.min(s.radius, width / 2, height / 2);
      var rim = rimPoint(state.spot, width / 2, height / 2, r);
      var rimX = rim[0];
      var rimY = rim[1];
      var pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), 0.0001);
      gl.uniform1f(uniforms.uSpot, state.spot);
      gl.uniform2f(uniforms.uEntry, rimX * pull * scaleX, rimY * pull * scaleY);
      gl.uniform3fv(uniforms.uLineColor, toRgb(s.lineColor));
      gl.uniform3fv(uniforms.uBaseColor, toRgb(s.baseColor));
      gl.uniform1f(uniforms.uIntensity, s.intensity * (state.level + state.press * 0.8));
      gl.uniform2f(uniforms.uWindow, s.shineSize / 360 + state.press * 0.06, s.shineFade / 360 + 0.0001);
      gl.uniform1f(uniforms.uThickness, s.thickness);
      gl.uniform1f(uniforms.uGlow, s.glow);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    var frame = function (now) {
      raf = 0;
      if (!visible) return;
      var s = settingsRef.current;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var target = aim(s);
      var spinning = s.autoAnimate && !reduce;
      var steering = !!target && target.near > 0;
      if (!state.ready) {
        state.spot = restSpot(s);
        state.level = s.autoAnimate ? 1 : s.idleIntensity;
        state.ready = true;
      }
      var diff = 0;
      if (spinning && !steering) state.spot = wrap(state.spot + (s.speed / TAU) * dt);
      else {
        diff = (steering ? target.spot : restSpot(s)) - state.spot;
        diff -= Math.round(diff);
        state.spot = wrap(state.spot + diff * (1 - Math.exp(-dt * 8)));
      }
      var level = s.autoAnimate ? 1 : s.idleIntensity + (1 - s.idleIntensity) * (target ? target.near : 0);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 7));
      state.press *= Math.exp(-dt * 5);
      draw(s);
      var settling = Math.abs(diff) > 0.0002 || Math.abs(level - state.level) > 0.001 || state.press > 0.002;
      if (settling || (spinning && !steering)) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    var wake = function () {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    var measure = function (entry) {
      var box = entry && entry.borderBoxSize && entry.borderBoxSize[0];
      view.width = Math.max(1, box ? box.inlineSize : button.offsetWidth);
      view.height = Math.max(1, box ? box.blockSize : button.offsetHeight);
      view.ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
      canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
      if (state.ready) draw(settingsRef.current);
      wake();
    };

    var onPointerMove = function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      wake();
    };

    var onPointerDown = function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      if (!settingsRef.current.disabled) state.press = 1;
      wake();
    };

    var onPointerEnd = function (event) {
      if (event.pointerType === "mouse") return;
      pointer.known = false;
      wake();
    };

    var onPointerLeave = function () {
      pointer.known = false;
      wake();
    };

    var resizeObserver = new ResizeObserver(function (entries) { measure(entries[entries.length - 1]); });
    resizeObserver.observe(button);
    var intersection = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(button);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    button.addEventListener("pointerdown", onPointerDown);
    measure();

    api.set = function (next) {
      p = Object.assign(p, next || {});
      setSettings();
      if (next && next.textColor) button.style.setProperty("--sb-text-color", p.textColor);
      if (next && next.tint) button.style.setProperty("--sb-tint", p.tint);
      if (next && next.tintOpacity !== undefined) button.style.setProperty("--sb-tint-opacity", p.tintOpacity);
      wake();
    };
    api.destroy = function () {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      button.removeEventListener("pointerdown", onPointerDown);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      var lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    };
    return api;
  }

  window.SpecularButton = SpecularButton;
})(window);

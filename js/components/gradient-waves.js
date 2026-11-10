/* ============================================================
   GradientWaves — porte do componente React Bits para JS puro.
   Mesmo shader WebGL2, mesmos parâmetros e mesma lógica de
   intro, swell no clique e paralaxe pelo cursor.
   Uso: GradientWaves(elemento, { horizonColor, waveColor, ... })
   ============================================================ */
(function (window) {
  "use strict";

  var ROOT = "gradient-waves-container";
  var CANVAS = "gradient-waves-canvas";

  var MAX_SWELLS = 4;
  var SWELL_SECONDS = 3.2;
  var SWELL_GAIN = 2.8;
  var SWELL_WIDTH = 8;
  var INTRO_SECONDS = 2.6;
  var CAMERA_HEIGHT = 30;
  var QUALITY = { low: 56, medium: 84, high: 120 };

  var VERTEX = [
    "#version 300 es",
    "in vec2 aPosition;",
    "void main() {",
    "  gl_Position = vec4(aPosition, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT = "#version 300 es\n" +
    "precision highp float;\n" +
    "uniform vec2 uResolution;\n" +
    "uniform float uTime;\n" +
    "uniform float uClock;\n" +
    "uniform float uAmplitude;\n" +
    "uniform float uWaveScale;\n" +
    "uniform float uWaveRatio;\n" +
    "uniform float uSwell;\n" +
    "uniform float uTurbulence;\n" +
    "uniform float uHeight;\n" +
    "uniform float uTilt;\n" +
    "uniform float uZoom;\n" +
    "uniform vec2 uLook;\n" +
    "uniform float uFogDepth;\n" +
    "uniform float uBrightness;\n" +
    "uniform float uOpacity;\n" +
    "uniform float uGrain;\n" +
    "uniform vec3 uHorizon;\n" +
    "uniform vec3 uWave;\n" +
    "uniform vec3 uCrest;\n" +
    "uniform vec3 uBackground;\n" +
    "uniform float uOpaque;\n" +
    "uniform float uLight;\n" +
    "uniform vec3 uSun;\n" +
    "uniform float uRelief;\n" +
    "uniform float uSheen;\n" +
    "uniform float uSteps;\n" +
    "uniform float uStride;\n" +
    "uniform vec3 uIntro;\n" +
    "uniform vec3 uSwells[" + MAX_SWELLS + "];\n" +
    "uniform float uSwellWidth;\n" +
    "out vec4 outColor;\n" +
    "\n" +
    "const float FAR = 4000.0;\n" +
    "\n" +
    "float hash(vec2 p) {\n" +
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n" +
    "  p3 += dot(p3, p3.yzx + 33.33);\n" +
    "  return fract((p3.x + p3.y) * p3.z);\n" +
    "}\n" +
    "\n" +
    "vec3 surface(vec2 xy) {\n" +
    "  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);\n" +
    "  vec4 tc = vec4(uTime / 0.130, uTime / 0.810, uTime / 0.200, uTime / 0.710);\n" +
    "  float a = xy.x + tc.x;\n" +
    "  float swellPhase = (xy.y + a) / 20.0 + tc.y;\n" +
    "  float bend = uSwell * cos(swellPhase) / 20.0;\n" +
    "  float mx = a + uSwell * sin(swellPhase);\n" +
    "  float crossPhase = xy.x / 23.0 + tc.w;\n" +
    "  float my = xy.y - tc.z + uTurbulence * cos(crossPhase);\n" +
    "  float twist = -uTurbulence * sin(crossPhase) / 23.0;\n" +
    "  float cx = cos(mx * freq.x);\n" +
    "  float cy = cos(my * freq.y);\n" +
    "  float rise = 1.0;\n" +
    "  if (uIntro.z > 0.0) rise = mix(1.0, smoothstep(uIntro.y * 0.45, uIntro.y * 1.6, xy.x), uIntro.z);\n" +
    "  float amp = uAmplitude * rise;\n" +
    "  float h = (sin(mx * freq.x) + sin(my * freq.y)) * amp + uHeight;\n" +
    "  float dx = amp * (freq.x * cx * (1.0 + bend) + freq.y * cy * twist);\n" +
    "  float dy = amp * (freq.x * cx * bend + freq.y * cy);\n" +
    "  for (int k = 0; k < " + MAX_SWELLS + "; k++) {\n" +
    "    vec3 sw = uSwells[k];\n" +
    "    if (sw.z <= 0.0) continue;\n" +
    "    float u = (xy.x - sw.x) / uSwellWidth;\n" +
    "    float v = (xy.y - sw.y) / (uSwellWidth * 3.5);\n" +
    "    float bump = sw.z * exp(-u * u - v * v);\n" +
    "    h += bump;\n" +
    "    dx += bump * (-2.0 * u / uSwellWidth);\n" +
    "    dy += bump * (-2.0 * v / (uSwellWidth * 3.5));\n" +
    "  }\n" +
    "  return vec3(h, dx, dy);\n" +
    "}\n" +
    "\n" +
    "float march(vec3 origin, vec3 dir) {\n" +
    "  float dist = 0.0;\n" +
    "  for (int i = 0; i < 128; i++) {\n" +
    "    if (float(i) >= uSteps) break;\n" +
    "    float gap = origin.z + dist * dir.z - surface(origin.xy + dist * dir.xy).x;\n" +
    "    if (abs(gap) < 0.002 * dist + 0.01) break;\n" +
    "    dist += uStride * gap;\n" +
    "    if (!(abs(dist) < FAR)) return FAR;\n" +
    "  }\n" +
    "  return dist;\n" +
    "}\n" +
    "\n" +
    "void main() {\n" +
    "  float c;\n" +
    "  float s;\n" +
    "  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);\n" +
    "  vec3 cam = vec3(0.0, 0.0, " + CAMERA_HEIGHT.toFixed(1) + ");\n" +
    "  vec2 uv = gl_FragCoord.xy / uResolution - 0.5;\n" +
    "  uv.x *= uResolution.x / uResolution.y;\n" +
    "  uv.y *= -1.0;\n" +
    "\n" +
    "  vec3 dir = vec3(0.0, 0.0, -1.0);\n" +
    "  float ulen = length(uv);\n" +
    "  float xrot = vfov * ulen;\n" +
    "  c = cos(xrot);\n" +
    "  s = sin(xrot);\n" +
    "  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;\n" +
    "  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);\n" +
    "  dir = mat3(nuv.x, -nuv.y, 0.0, nuv.y, nuv.x, 0.0, 0.0, 0.0, 1.0) * dir;\n" +
    "  c = cos(uTilt + uLook.y);\n" +
    "  s = sin(uTilt + uLook.y);\n" +
    "  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;\n" +
    "  c = cos(uLook.x);\n" +
    "  s = sin(uLook.x);\n" +
    "  dir = mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0) * dir;\n" +
    "\n" +
    "  float dist = march(cam, dir);\n" +
    "  vec3 pos = cam + dist * dir;\n" +
    "  vec3 field = surface(pos.xy);\n" +
    "  vec3 view = -dir;\n" +
    "\n" +
    "  float crest = clamp((field.x - uHeight) / max(2.0 * uAmplitude, 0.001) * 0.5 + 0.5, 0.0, 1.0);\n" +
    "  vec3 body = mix(uWave, uCrest, smoothstep(0.45, 1.0, crest) * 0.5);\n" +
    "  vec3 normal = normalize(vec3(-field.yz * (1.0 + 1.5 * uRelief), 1.0));\n" +
    "  float diffuse = clamp(dot(normal, uSun) * 0.5 + 0.5, 0.0, 1.0);\n" +
    "  float lightness = mix(1.0, diffuse * diffuse * (3.0 - 2.0 * diffuse), uRelief);\n" +
    "  float sheen = pow(clamp(dot(normal, normalize(uSun + view)), 0.0, 1.0), 14.0) * uSheen * (0.4 + 0.6 * uRelief);\n" +
    "  float rim = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);\n" +
    "\n" +
    "  vec3 col;\n" +
    "  float alpha;\n" +
    "  float haze = 1.0 - exp(-dist / (uFogDepth * 5.0));\n" +
    "  float fade = 1.0 - smoothstep(0.35, 1.0, haze);\n" +
    "  if (uLight < 0.5) {\n" +
    "    vec3 lit = mix(uHorizon * 0.18, body, lightness) + uCrest * sheen;\n" +
    "    lit = mix(lit, uHorizon, rim * 0.15 * uRelief);\n" +
    "    col = mix(lit, uHorizon, smoothstep(0.0, 1.0, haze)) * 0.85 * uBrightness;\n" +
    "    alpha = fade;\n" +
    "  } else {\n" +
    "    vec3 hue = mix(uHorizon, body, 0.35 + 0.65 * lightness);\n" +
    "    float density = mix(0.16, 0.9, 1.0 - lightness);\n" +
    "    density *= 1.0 - clamp(sheen, 0.0, 1.0) * 0.85;\n" +
    "    density *= 1.0 - 0.5 * smoothstep(0.0, 1.0, haze);\n" +
    "    col = hue;\n" +
    "    alpha = fade * clamp(density * uBrightness, 0.0, 1.0);\n" +
    "  }\n" +
    "\n" +
    "  float reveal = uIntro.x;\n" +
    "  col = clamp(col, 0.0, 1.0);\n" +
    "  float grain = (hash(gl_FragCoord.xy + fract(uClock) * 64.0) - 0.5) * uGrain;\n" +
    "  alpha = clamp(alpha * (1.0 + grain), 0.0, 1.0) * reveal * uOpacity;\n" +
    "  if (uOpaque > 0.5) {\n" +
    "    outColor = vec4(mix(uBackground, col, alpha), 1.0);\n" +
    "  } else {\n" +
    "    outColor = vec4(col * alpha, alpha);\n" +
    "  }\n" +
    "}";

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };

  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  var probe = null;

  var parseColor = function (value, fallback) {
    if (value === "transparent") return null;
    if (!probe) probe = document.createElement("canvas").getContext("2d");
    if (!probe) return fallback;
    probe.fillStyle = "#000000";
    probe.fillStyle = value;
    var text = probe.fillStyle;
    if (text.charAt(0) === "#") {
      var hex = parseInt(text.slice(1), 16);
      return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    }
    var match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(text);
    if (!match) return fallback;
    if (match[4] !== undefined && Number(match[4]) === 0) return null;
    return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
  };

  var compile = function (gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  var rayAt = function (point, aspect, s, look) {
    var uvx = (point[0] - 0.5) * aspect;
    var uvy = point[1] - 0.5;
    var vfov = Math.PI / 2.3 / Math.max(s.zoom, 0.05);
    var length = Math.hypot(uvx, uvy);
    var turn = vfov * length;
    var dir = [0, -Math.sin(turn), -Math.cos(turn)];
    var nx = length > 1e-5 ? uvx / length : 1;
    var ny = length > 1e-5 ? uvy / length : 0;
    dir = [nx * dir[0] + ny * dir[1], -ny * dir[0] + nx * dir[1], dir[2]];
    var pitch = s.tilt + look[1];
    var cp = Math.cos(pitch);
    var sp = Math.sin(pitch);
    dir = [cp * dir[0] - sp * dir[2], dir[1], sp * dir[0] + cp * dir[2]];
    var cy = Math.cos(look[0]);
    var sy = Math.sin(look[0]);
    dir = [cy * dir[0] - sy * dir[1], sy * dir[0] + cy * dir[1], dir[2]];
    return dir;
  };

  var groundAt = function (point, aspect, s, look) {
    var dir = rayAt(point, aspect, s, look);
    if (dir[2] > -0.02) return null;
    var travel = (CAMERA_HEIGHT - s.height) / -dir[2];
    return [dir[0] * travel, dir[1] * travel];
  };

  var prefersReduced = function () {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  var DEFAULTS = {
    horizonColor: "#5227FF",
    waveColor: "#FF9FFC",
    crestColor: "#FFFFFF",
    backgroundColor: "transparent",
    lightMode: false,
    speed: 0.4,
    amplitude: 2.5,
    waveScale: 0.6,
    waveRatio: 0.9,
    swell: 35,
    turbulence: 20,
    tilt: 64,
    zoom: 1,
    height: 5.5,
    fogDepth: 15,
    relief: 1,
    lightAngle: 120,
    sheen: 0,
    brightness: 1,
    opacity: 1,
    grain: 0.2,
    quality: "medium",
    intro: true,
    mouseInteraction: true,
    parallaxStrength: 0.5,
    mouseStrength: 0.6,
    swellOnClick: true,
    paused: false,
    dpr: 2
  };

  function buildSettings(p) {
    return {
      horizon: parseColor(p.horizonColor, [0.32, 0.15, 1]) || [0.32, 0.15, 1],
      wave: parseColor(p.waveColor, [1, 0.62, 0.99]) || [1, 0.62, 0.99],
      crest: parseColor(p.crestColor, [1, 1, 1]) || [1, 1, 1],
      paper: parseColor(p.backgroundColor, null),
      lightMode: p.lightMode,
      speed: p.speed,
      amplitude: Math.max(0, p.amplitude),
      waveScale: Math.max(0.01, p.waveScale),
      waveRatio: Math.max(0.01, p.waveRatio),
      swell: p.swell,
      turbulence: p.turbulence,
      tilt: (clamp(p.tilt, 10, 85) * Math.PI) / 180,
      zoom: Math.max(0.05, p.zoom),
      height: p.height,
      fogDepth: Math.max(0.5, p.fogDepth),
      relief: clamp(p.relief, 0, 1),
      lightAngle: (p.lightAngle * Math.PI) / 180,
      sheen: Math.max(0, p.sheen),
      brightness: Math.max(0, p.brightness),
      opacity: clamp(p.opacity, 0, 1),
      grain: typeof p.grain === "number" ? Math.max(0, p.grain) : p.grain ? 0.05 : 0,
      steps: QUALITY[p.quality] || QUALITY.medium,
      intro: p.intro,
      mouseInteraction: p.mouseInteraction,
      parallaxStrength: Math.max(0, p.parallaxStrength),
      mouseStrength: clamp(p.mouseStrength, 0, 1),
      swellOnClick: p.swellOnClick,
      paused: p.paused,
      dpr: Math.max(0.5, p.dpr)
    };
  }

  function GradientWaves(container, options) {
    if (!container) return null;
    var props = Object.assign({}, DEFAULTS, options || {});
    var settingsRef = { current: buildSettings(props) };

    container.classList.add(ROOT);
    var canvas = document.createElement("canvas");
    canvas.className = CANVAS;
    container.appendChild(canvas);
    var gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });
    if (!gl) {
      canvas.remove();
      container.classList.add("is-unsupported");
      return null;
    }
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      canvas.remove();
      container.classList.add("is-unsupported");
      return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      canvas.remove();
      container.classList.add("is-unsupported");
      return null;
    }
    var names = [
      "uResolution", "uTime", "uClock", "uAmplitude", "uWaveScale", "uWaveRatio", "uSwell",
      "uTurbulence", "uHeight", "uTilt", "uZoom", "uLook", "uFogDepth", "uBrightness", "uOpacity",
      "uGrain", "uHorizon", "uWave", "uCrest", "uBackground", "uOpaque", "uLight", "uSun",
      "uRelief", "uSheen", "uSteps", "uStride", "uIntro", "uSwells", "uSwellWidth"
    ];
    var u = {};
    names.forEach(function (name) { u[name] = gl.getUniformLocation(program, name); });
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    var swellData = new Float32Array(MAX_SWELLS * 3);
    var state = {
      width: 1, height: 1, cssWidth: 0, cssHeight: 0,
      time: 0, clock: 0, last: 0, raf: 0, visible: false, introAt: -1,
      pointer: [0.5, 0.5], inside: false, look: [0, 0], steer: [0, 0],
      swells: [], quiet: 0, seen: null
    };

    var fit = function () {
      var s = settingsRef.current;
      var ratio = Math.min(window.devicePixelRatio || 1, s.dpr);
      var width = Math.max(1, Math.round(state.cssWidth * ratio));
      var height = Math.max(1, Math.round(state.cssHeight * ratio));
      if (width === state.width && height === state.height) return;
      state.quiet = 0;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
    };

    var introProgress = function (s, reduced) {
      if (!s.intro || reduced || state.introAt < 0) return 1;
      return clamp((state.clock - state.introAt) / INTRO_SECONDS, 0, 1);
    };

    var render = function (reduced) {
      var s = settingsRef.current;
      gl.viewport(0, 0, state.width, state.height);
      gl.uniform2f(u.uResolution, state.width, state.height);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uClock, state.clock);
      gl.uniform1f(u.uAmplitude, s.amplitude);
      gl.uniform1f(u.uWaveScale, s.waveScale);
      gl.uniform1f(u.uWaveRatio, s.waveRatio);
      gl.uniform1f(u.uSwell, s.swell);
      gl.uniform1f(u.uTurbulence, s.turbulence);
      gl.uniform1f(u.uHeight, s.height);
      gl.uniform1f(u.uTilt, s.tilt);
      gl.uniform1f(u.uZoom, s.zoom);
      gl.uniform2f(u.uLook, state.look[0], state.look[1]);
      gl.uniform1f(u.uFogDepth, s.fogDepth);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform1f(u.uGrain, s.grain);
      gl.uniform3fv(u.uHorizon, s.horizon);
      gl.uniform3fv(u.uWave, s.wave);
      gl.uniform3fv(u.uCrest, s.crest);
      var paperColor = s.paper || [0, 0, 0];
      gl.uniform3f(u.uBackground, paperColor[0], paperColor[1], paperColor[2]);
      gl.uniform1f(u.uOpaque, s.paper ? 1 : 0);
      gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
      var elevation = 0.52;
      var angle = s.lightAngle + state.steer[0] * s.mouseStrength * 2;
      var altitude = elevation - state.steer[1] * s.mouseStrength * 0.7;
      gl.uniform3f(
        u.uSun,
        Math.cos(altitude) * Math.cos(angle),
        Math.cos(altitude) * Math.sin(angle),
        Math.sin(altitude)
      );
      gl.uniform1f(u.uRelief, s.relief);
      gl.uniform1f(u.uSheen, s.sheen);
      gl.uniform1f(u.uSteps, s.steps);
      var slope =
        s.amplitude *
        ((s.waveScale / 7) * (1 + Math.abs(s.swell) / 20) +
          ((s.waveScale * s.waveRatio) / 3) * (1 + Math.abs(s.turbulence) / 23));
      var progress = introProgress(s, reduced);
      var shown = Math.min(1, progress / 0.22);
      var crest = 160 * Math.pow(3 / 160, easeInOut(Math.max(0, (progress - 0.1) / 0.9)));
      var settle = clamp((progress - 0.75) / 0.25, 0, 1);
      gl.uniform3f(u.uIntro, shown * shown * (3 - 2 * shown), crest, 1 - settle * settle * (3 - 2 * settle));
      swellData.fill(0);
      var swellPeak = 0;
      state.swells.forEach(function (swell, index) {
        var age = state.clock - swell.at;
        var life = age / SWELL_SECONDS;
        var envelope = (1 - Math.exp(-age / 0.25)) * Math.pow(1 - life, 1.6);
        var lift = s.amplitude * SWELL_GAIN * envelope;
        swellData.set([swell.x - age * 12, swell.y, lift], index * 3);
        swellPeak = Math.max(swellPeak, lift);
      });
      gl.uniform3fv(u.uSwells, swellData);
      gl.uniform1f(u.uSwellWidth, SWELL_WIDTH);
      gl.uniform1f(u.uStride, 0.9 / Math.max(1, (slope + (swellPeak * 0.86) / SWELL_WIDTH) / 1.5));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    var tick = function (now) {
      state.raf = 0;
      if (!state.visible || document.hidden) return;
      var s = settingsRef.current;
      var dt = state.last ? Math.min((now - state.last) / 1000, 0.1) : 0;
      state.last = now;
      var reduced = prefersReduced();
      state.clock += dt;
      if (state.introAt < 0) state.introAt = state.clock;
      if (!s.paused && !reduced) state.time += dt * s.speed;

      var steering = s.mouseInteraction && state.inside && !reduced;
      var target = steering ? state.pointer : [0.5, 0.5];
      var ease = 1 - Math.exp(-dt / 0.45);
      var goalX = (target[0] - 0.5) * s.parallaxStrength * 0.35;
      var goalY = (target[1] - 0.5) * s.parallaxStrength * 0.18;
      state.look[0] += (goalX - state.look[0]) * ease;
      state.look[1] += (goalY - state.look[1]) * ease;
      var moving = Math.abs(goalX - state.look[0]) + Math.abs(goalY - state.look[1]) > 0.0002;

      var steerEase = 1 - Math.exp(-dt / 0.6);
      var steerX = steering ? state.pointer[0] - 0.5 : 0;
      var steerY = steering ? 0.5 - state.pointer[1] : 0;
      state.steer[0] += (steerX - state.steer[0]) * steerEase;
      state.steer[1] += (steerY - state.steer[1]) * steerEase;
      var turning = Math.abs(steerX - state.steer[0]) + Math.abs(steerY - state.steer[1]) > 0.0005;
      state.swells = state.swells.filter(function (swell) { return state.clock - swell.at < SWELL_SECONDS; });

      var still = s.paused || reduced;
      var transient = moving || turning || state.swells.length > 0 || introProgress(s, reduced) < 1;
      if (state.seen !== s || transient || !still) state.quiet = 0;
      else state.quiet += 1;
      state.seen = s;
      if (state.quiet > 3) return;

      state.raf = requestAnimationFrame(tick);
      fit();
      render(reduced);
    };

    var wake = function () {
      if (state.raf || !state.visible || document.hidden) return;
      state.last = 0;
      state.raf = requestAnimationFrame(tick);
    };

    var measure = function () {
      state.cssWidth = container.clientWidth;
      state.cssHeight = container.clientHeight;
      fit();
      wake();
    };

    var local = function (event) {
      var rect = container.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1),
        y: (event.clientY - rect.top) / Math.max(rect.height, 1),
        inside:
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
      };
    };

    var onMove = function (event) {
      var point = local(event);
      var was = state.inside;
      state.inside = point.inside;
      if (point.inside) state.pointer = [point.x, point.y];
      if ((point.inside || was) && settingsRef.current.mouseInteraction) wake();
    };

    var onLeave = function () {
      state.inside = false;
      wake();
    };

    var onDown = function (event) {
      var s = settingsRef.current;
      if (!s.swellOnClick || event.button !== 0 || prefersReduced()) return;
      if (
        event.target instanceof Element &&
        event.target.closest('a, button, input, textarea, select, label, [role="button"]')
      ) return;
      var point = local(event);
      if (!point.inside) return;
      var ground = groundAt([point.x, point.y], state.width / Math.max(state.height, 1), s, state.look);
      if (!ground) return;
      state.swells.push({ x: ground[0], y: ground[1], at: state.clock });
      if (state.swells.length > MAX_SWELLS) state.swells.shift();
      wake();
    };

    var visibility = new IntersectionObserver(function (entries) {
      state.visible = entries.some(function (entry) { return entry.isIntersecting; });
      wake();
    });
    visibility.observe(container);
    var sizes = new ResizeObserver(measure);
    sizes.observe(container);
    measure();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    document.documentElement.addEventListener("pointerleave", onLeave);
    state.raf = requestAnimationFrame(tick);

    return {
      /* Equivalente a trocar as props do componente React. */
      set: function (next) {
        props = Object.assign(props, next || {});
        settingsRef.current = buildSettings(props);
        wake();
      },
      destroy: function () {
        cancelAnimationFrame(state.raf);
        document.removeEventListener("visibilitychange", wake);
        visibility.disconnect();
        sizes.disconnect();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        var lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
        canvas.remove();
      }
    };
  }

  window.GradientWaves = GradientWaves;
})(window);

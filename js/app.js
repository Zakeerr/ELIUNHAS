/* ============================================================
   ELIANE REIS — ORQUESTRAÇÃO DO SITE
   jQuery (DOM e eventos) · GSAP + ScrollTrigger + SplitText + Flip
   (animações) · Lenis (rolagem suave) · Swiper (carrossel) ·
   componentes React Bits portados para JS puro (js/components).
   ============================================================ */
(function ($) {
  "use strict";

  var root = document.documentElement;

  /* Sem as bibliotecas (sem internet, CDN fora do ar) a página
     continua inteira e navegável, só que estática. */
  if (!$ || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove("js-anim");
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.Flip) gsap.registerPlugin(window.Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  /* Em celular e tablet os efeitos WebGL rodam em resolução menor. */
  var lowPower = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || screen.width < 1100;

  var SECTIONS = [
    { id: "inicio", label: "Início" },
    { id: "sobre", label: "Sobre mim" },
    { id: "resultados", label: "Resultados" },
    { id: "contato", label: "Contato" },
    { id: "localizacao", label: "Localização" }
  ];

  var COLORS = {
    violet: "#9900ff",
    lilac: "#c7a6f5",
    night: "#12051f"
  };

  var lenis = null;
  var sidebars = [];
  /* Enquanto a página rola até a seção escolhida no menu, a marcação do
     item ativo não muda: fica no item que a pessoa tocou. */
  var navLock = false;
  var navLockTimer = 0;
  var setActiveSection = function () {};

  /* ---------------------------------------------------------
     ROLAGEM SUAVE — Lenis sincronizado com o ScrollTrigger
     --------------------------------------------------------- */
  function initLenis() {
    if (reduce || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function lockScroll(locked) {
    root.classList.toggle("is-locked", locked);
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
  }

  function scrollToHash(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    var moveFocus = function () {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    var index = SECTIONS.map(function (sec) { return "#" + sec.id; }).indexOf(hash);
    var unlock = function (delay) {
      clearTimeout(navLockTimer);
      navLockTimer = setTimeout(function () { navLock = false; }, delay);
    };
    if (index !== -1) {
      setActiveSection(index);
      navLock = true;
      unlock(2500);
    }
    if (lenis) {
      lenis.scrollTo(target, {
        duration: 1.5,
        easing: function (t) { return 1 - Math.pow(1 - t, 4); },
        onComplete: function () { moveFocus(); unlock(150); }
      });
    } else {
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      moveFocus();
    }
  }

  function initAnchors() {
    $(document).on("click", 'a[href^="#"]', function (event) {
      var hash = $(this).attr("href");
      if (!hash || hash.length < 2 || !document.querySelector(hash)) return;
      event.preventDefault();
      /* A gaveta precisa fechar antes: com ela aberta a rolagem fica travada. */
      closeMenu();
      scrollToHash(hash);
    });
  }

  /* ---------------------------------------------------------
     GAVETA DO CELULAR — a mesma barra lateral, aberta pelo botão Menu
     --------------------------------------------------------- */
  var menuOpen = false;

  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    var toggle = document.querySelector(".m-bar-toggle");
    $(".rail, .rail-scrim").toggleClass("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    lockScroll(open);
    if (open) {
      var first = document.querySelector(".rail .line-sidebar__link");
      /* A gaveta só recebe foco depois de ficar visível. */
      if (first) first.focus({ preventScroll: true });
    } else if (document.activeElement && document.activeElement.closest(".rail")) {
      toggle.focus({ preventScroll: true });
    }
  }

  function closeMenu() { setMenu(false); }

  function initMenu() {
    $(".m-bar-toggle").on("click", function () { setMenu(!menuOpen); });
    $(document).on("click", "[data-menu-close], .rail-cta", closeMenu);
    $(document).on("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  /* ---------------------------------------------------------
     NAVEGAÇÃO — LineSidebar na barra lateral (computador e celular)
     --------------------------------------------------------- */
  function initNavigation() {
    if (!window.LineSidebar) return;
    var items = SECTIONS.map(function (s) { return { label: s.label, href: "#" + s.id }; });

    sidebars.push(window.LineSidebar(document.querySelector('[data-line-sidebar="rail"]'), {
      items: items,
      ariaLabel: "Seções do site",
      accentColor: COLORS.violet,
      textColor: "rgba(22, 11, 34, 0.62)",
      markerColor: "rgba(153, 0, 255, 0.3)",
      showIndex: true,
      showMarker: true,
      proximityRadius: 90,
      maxShift: 16,
      falloff: "smooth",
      markerLength: 34,
      markerGap: 12,
      tickScale: 0.5,
      scaleTick: true,
      itemGap: 14,
      fontSize: 0.92,
      smoothing: 110,
      defaultActive: 0
    }));

    var setActive = function (index) {
      sidebars.forEach(function (s) { if (s) s.setActive(index); });
    };
    setActiveSection = setActive;

    /* Linha que decide a seção ativa: 55% da tela. */
    var activeLine = function () { return Math.round(window.innerHeight * 0.55); };

    SECTIONS.forEach(function (section, index) {
      var last = index === SECTIONS.length - 1;
      var el = document.getElementById(section.id);
      ScrollTrigger.create({
        trigger: el,
        /* A última seção fica ativa a partir do ponto normal ou do fim da
           página, o que vier primeiro: a página pode acabar antes de a
           Localização chegar a 55% da tela. */
        start: last
          ? function () {
            var normal = el.getBoundingClientRect().top + window.scrollY - activeLine();
            return Math.max(0, Math.min(normal, ScrollTrigger.maxScroll(window) - 2));
          }
          : function () { return "top " + activeLine() + "px"; },
        /* e continua ativa até o fim da página (rodapé) */
        end: last ? "+=100000" : function () { return "bottom " + activeLine() + "px"; },
        invalidateOnRefresh: true,
        onToggle: function (self) { if (self.isActive && !navLock) setActive(index); }
      });
    });
  }

  /* A barra lateral (ou a barra do celular) entra junto com o Início.
     O matchMedia desfaz tudo sozinho quando a largura muda de faixa. */
  function initChrome() {
    var rail = document.querySelector(".rail");
    var bar = document.querySelector(".m-bar");
    var mm = gsap.matchMedia();

    mm.add("(min-width: 1100px)", function () {
      var parts = $(rail).children(".brand, .rail-nav, .rail-foot");
      closeMenu();

      if (reduce) {
        gsap.set(rail, { autoAlpha: 1 });
      } else {
        gsap.fromTo(rail, { autoAlpha: 0, x: -18 }, { autoAlpha: 1, x: 0, duration: 1, delay: 0.9, ease: "power3.out" });
      }

      /* Cada parte da barra (marca no topo, menu e botão no pé) inverte as
         cores só enquanto o Contato escuro estiver exatamente atrás dela. */
      parts.each(function () {
        var part = this;
        var middle = function () {
          var r = part.getBoundingClientRect();
          return Math.round(r.top + r.height / 2);
        };
        ScrollTrigger.create({
          trigger: "#contato",
          start: function () { return "top " + middle() + "px"; },
          end: function () { return "bottom " + middle() + "px"; },
          invalidateOnRefresh: true,
          onToggle: function (self) { part.classList.toggle("is-dark", self.isActive); }
        });
      });

      return function () { parts.removeClass("is-dark"); };
    });

    mm.add("(max-width: 1099px)", function () {
      if (reduce) {
        gsap.set(bar, { autoAlpha: 1 });
      } else {
        gsap.fromTo(bar, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.9, ease: "power3.out" });
      }

      /* A barra é transparente sobre o Início e ganha fundo ao sair dele;
         sobre o Contato escuro ela inverte as cores. */
      ScrollTrigger.create({
        trigger: ".hero",
        start: "bottom 60px",
        /* vai além do fim da página: a barra não perde o fundo ao chegar lá */
        end: "+=1000000",
        toggleClass: { targets: bar, className: "is-stuck" }
      });
      ScrollTrigger.create({
        trigger: "#contato",
        start: "top 30px",
        end: "bottom 30px",
        toggleClass: { targets: bar, className: "is-dark" }
      });

      return function () { closeMenu(); };
    });
  }

  /* ---------------------------------------------------------
     COMPONENTES: SpecularButton e SpotlightCard
     --------------------------------------------------------- */
  var SPECULAR = {
    primary: {
      tint: COLORS.violet, tintOpacity: 1, textColor: "#ffffff",
      lineColor: "#ffffff", baseColor: "#c9a4ff", idleIntensity: 0.45, glow: 1
    },
    light: {
      tint: COLORS.violet, tintOpacity: 0.06, textColor: COLORS.violet,
      lineColor: COLORS.violet, baseColor: "#d9c3f8", idleIntensity: 0.4, glow: 0.6
    },
    dark: {
      tint: "#ffffff", tintOpacity: 0.07, textColor: "#ffffff",
      lineColor: "#ffffff", baseColor: "#6d5a85", idleIntensity: 0.35, glow: 1, blur: 8
    },
    /* vidro claro sobre a foto e as ondas */
    glass: {
      tint: "#ffffff", tintOpacity: 0.72, textColor: COLORS.violet,
      lineColor: COLORS.violet, baseColor: "#d9c3f8", idleIntensity: 0.4, glow: 0.7, blur: 10
    }
  };

  function initSpecular() {
    if (!window.SpecularButton) return;
    $("[data-specular]").each(function () {
      var preset = SPECULAR[this.getAttribute("data-specular")] || SPECULAR.primary;
      window.SpecularButton(this, $.extend({
        size: this.getAttribute("data-size") || "md",
        radius: 999,
        intensity: 1,
        shineSize: 10,
        shineFade: 34,
        thickness: 1.2,
        followMouse: true,
        proximity: 220
      }, preset));
    });
  }

  function initSpotlight() {
    if (!window.SpotlightCard) return;
    $('[data-spotlight="light"]').each(function () {
      window.SpotlightCard(this, {
        theme: "light",
        surface: "#fcfaff",
        spotlightColor: COLORS.violet,
        intensity: 0.4,
        spotlightSize: 260,
        softness: 0.8,
        borderGlow: 0.9,
        proximity: 80,
        smoothing: 0.3,
        flare: true
      });
    });
    $('[data-spotlight="photo"]').each(function () {
      window.SpotlightCard(this, {
        theme: "light",
        spotlightColor: "#ffffff",
        intensity: 0,
        spotlightSize: 220,
        softness: 1,
        borderGlow: 1,
        proximity: 60,
        smoothing: 0.25,
        flare: true
      });
    });
  }

  /* ---------------------------------------------------------
     INÍCIO — nome, foto, frase rotativa e botões
     --------------------------------------------------------- */
  function initHero() {
    var portrait = document.querySelector(".hero-portrait");
    var mast = document.querySelector('[data-fold="masthead"]');
    var meta = gsap.utils.toArray(".hero-meta > *");

    /* FoldText: o nome desdobra letra a letra, a partir do centro,
       e as letras se dobram de leve quando o cursor passa perto. */
    var foldMasthead = function () {
      if (!mast) return;
      gsap.set(mast, { autoAlpha: 1 });
      if (!window.FoldText) return;
      window.FoldText(mast, {
        foldStyle: "paper",
        splitBy: "char",
        hinge: "top",
        trigger: "mount",
        foldAngle: 96,
        duration: 0.9,
        stagger: 0.06,
        staggerFrom: "center",
        ease: "power3.out",
        perspective: 900,
        creaseShading: 0.55,
        hoverRefold: true,
        refoldRadius: 170,
        refoldAngle: 45,
        fontSize: "inherit",
        fontWeight: "inherit"
      });
    };
    var bottom = gsap.utils.toArray(".hero-bottom > *");

    if (reduce) {
      gsap.set([portrait].concat(meta, bottom), { autoAlpha: 1 });
      foldMasthead();
      return;
    }

    gsap.set(mast, { autoAlpha: 0 });
    gsap.set(meta, { autoAlpha: 0, y: 10 });
    gsap.set(bottom, { autoAlpha: 0, y: 24 });
    gsap.set(portrait, { autoAlpha: 0, y: 56, scale: 0.965, filter: "blur(16px)" });

    var intro = gsap.timeline({ paused: true, delay: 0.1 })
      .call(foldMasthead, null, 0)
      .to(portrait, { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.6, ease: "power3.out", clearProps: "filter" }, 0.3)
      .to(meta, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power2.out" }, 0.8)
      .to(bottom, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power3.out" }, 1);

    var play = function () { intro.play(); };
    if (portrait && portrait.decode) portrait.decode().then(play, play);
    else play();

    /* Saída com profundidade: o nome sobe mais devagar que a foto */
    var out = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero-figure", { yPercent: 10, scale: 0.94, ease: "none", scrollTrigger: out });
    gsap.to(".hero-top", { yPercent: -40, opacity: 0.2, ease: "none", scrollTrigger: out });
    gsap.to(".hero-bottom", { yPercent: 40, opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "40% top", scrub: true } });
  }

  /* ---------------------------------------------------------
     FUNDO ANIMADO — GradientWaves atrás do site inteiro
     --------------------------------------------------------- */
  function initBackground() {
    var el = document.querySelector(".site-waves");
    if (!el || !window.GradientWaves) return;
    /* No celular as ondas são desenhadas num quadro com metade do tamanho
       e ampliadas (ver .is-low-power no CSS): ficam iguais, pesando 1/4. */
    if (lowPower) root.classList.add("is-low-power");
    var bg = window.GradientWaves(el, {
      horizonColor: "#eadcff",
      waveColor: "#a66bff",
      crestColor: "#ffffff",
      backgroundColor: "transparent",
      lightMode: true,
      speed: 0.3,
      amplitude: 2.4,
      waveScale: 0.6,
      waveRatio: 0.9,
      swell: 35,
      turbulence: 20,
      tilt: 64,
      height: 5.5,
      fogDepth: 15,
      relief: 1,
      lightAngle: 120,
      sheen: 0.4,
      brightness: 1,
      opacity: 0.85,
      grain: 0,
      quality: "low",
      intro: true,
      mouseInteraction: !lowPower,
      parallaxStrength: 0.4,
      mouseStrength: 0.5,
      swellOnClick: true,
      dpr: lowPower ? 0.5 : 1
    });
    if (!bg) return;

    /* Enquanto o Contato (que tem as próprias ondas) cobre a tela,
       o fundo global para de desenhar e economiza a placa de vídeo.
       Se o Contato for mais baixo que a tela, o fundo continua aparecendo
       em volta dele e não pausa. */
    var contact = document.getElementById("contato");
    ScrollTrigger.create({
      trigger: contact,
      start: "top top",
      end: "bottom bottom",
      onToggle: function (self) {
        bg.set({ paused: self.isActive && contact.offsetHeight >= window.innerHeight });
      }
    });
  }

  /* ---------------------------------------------------------
     TEXTOS — SplitText por linhas com máscara
     --------------------------------------------------------- */
  function initSplits() {
    if (!window.SplitText) return;

    $("[data-split]").each(function () {
      var el = this;
      window.SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit: function (self) {
          if (reduce) return null;
          return gsap.from(self.lines, {
            yPercent: 115,
            duration: 1.15,
            stagger: 0.09,
            ease: "power4.out",
            scrollTrigger: { trigger: el, start: "top 86%", once: true }
          });
        }
      });
    });

    $("[data-split-lines]").each(function () {
      var el = this;
      window.SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit: function (self) {
          if (reduce) return null;
          return gsap.from(self.lines, {
            yPercent: 100,
            opacity: 0,
            duration: 0.95,
            stagger: 0.06,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true }
          });
        }
      });
    });

  }

  /* ---------------------------------------------------------
     FOLDTEXT — título do Contato e letreiro do rodapé
     --------------------------------------------------------- */
  function initFolds() {
    if (!window.FoldText) return;

    var contact = document.querySelector('[data-fold="contact"]');
    if (contact) {
      window.FoldText(contact, {
        foldStyle: "paper",
        splitBy: "char",
        hinge: "bottom",
        trigger: "scroll",
        foldAngle: 100,
        duration: 0.75,
        stagger: 0.03,
        staggerFrom: "start",
        ease: "power3.out",
        perspective: 800,
        creaseShading: 0.6,
        hoverRefold: true,
        refoldRadius: 140,
        refoldAngle: 40,
        fontSize: "inherit",
        fontWeight: "inherit"
      });
    }

    var footer = document.querySelector('[data-fold="footer"]');
    if (footer) {
      window.FoldText(footer, {
        foldStyle: "blinds",
        splitBy: "char",
        hinge: "top",
        trigger: "scroll",
        foldAngle: 92,
        duration: 0.8,
        stagger: 0.06,
        staggerFrom: "edges",
        ease: "power3.out",
        perspective: 1000,
        creaseShading: 0.55,
        hoverRefold: true,
        refoldRadius: 220,
        refoldAngle: 50,
        fontSize: "inherit",
        fontWeight: "inherit"
      });
    }
  }

  /* ---------------------------------------------------------
     SOBRE MIM — RotatingText, retrato e etapas
     --------------------------------------------------------- */
  function initAbout() {
    /* HoloCard: a faixa de arco-íris do preset "rainbow" atravessa a foto
       conforme o cartão inclina (efeito de esmalte holográfico) e deixa
       o rosto limpo; um clique vira o cartão e mostra o cartão de visita. */
    var holo = document.querySelector("[data-holo]");
    if (holo && window.HoloCard) {
      var assets = window.HOLO_ASSETS || {};
      window.HoloCard(holo, {
        image: assets.sobre || "assets/sobre.jpg",
        backImage: "assets/cartao-verso.jpg",
        alt: "Cartão de Eliane Reis: foto na frente, WhatsApp e Instagram no verso. Pressione para virar.",
        preset: "rainbow",
        foilColor: "#e7dcfb",
        intensity: 0.55,
        scale: 1,
        edgeSparkle: 0.85,
        frame: 3,
        glare: 0.5,
        tiltMax: 12,
        hoverScale: 1.03,
        radius: 22,
        width: "100%",
        idle: true,
        shadow: true
      });
    }

    if (reduce) return;

    gsap.from(".about-card", {
      y: 48,
      autoAlpha: 0,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: { trigger: ".about-card", start: "top 88%", once: true }
    });

    gsap.utils.toArray(".eyebrow").forEach(function (eyebrow) {
      gsap.from(eyebrow, {
        x: -14,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: eyebrow, start: "top 90%", once: true }
      });
    });

    gsap.from(".services-list li", {
      y: 14,
      autoAlpha: 0,
      duration: 0.6,
      stagger: 0.05,
      ease: "power2.out",
      scrollTrigger: { trigger: ".services-list", start: "top 90%", once: true }
    });

    gsap.to(".process-rule span", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: ".process-list", start: "top 85%", end: "bottom 65%", scrub: true }
    });

    gsap.from(".process-card", {
      y: 42,
      autoAlpha: 0,
      duration: 0.95,
      stagger: 0.1,
      ease: "power3.out",
      scrollTrigger: { trigger: ".process-list", start: "top 86%", once: true }
    });
  }

  /* ---------------------------------------------------------
     RESULTADOS — Swiper + visualizador com Flip
     --------------------------------------------------------- */
  var swiper = null;

  function gutterPx() {
    var shell = document.querySelector(".shell");
    return shell ? parseFloat(window.getComputedStyle(shell).paddingRight) || 20 : 20;
  }

  function initWorks() {
    var $current = $(".works-current");
    var total = $(".works-swiper .swiper-slide").length;
    $(".works-total").text(" / " + String(total).padStart(2, "0"));

    var updateCounter = function (s) {
      var n = s.isEnd ? total : s.activeIndex + 1;
      $current.text(String(n).padStart(2, "0"));
    };

    if (window.Swiper) {
      swiper = new window.Swiper(".works-swiper", {
        slidesPerView: "auto",
        spaceBetween: 16,
        speed: 750,
        grabCursor: true,
        watchSlidesProgress: true,
        slidesOffsetAfter: gutterPx(),
        keyboard: { enabled: true, onlyInViewport: true },
        mousewheel: { forceToAxis: true, releaseOnEdges: true },
        navigation: { prevEl: ".works-prev", nextEl: ".works-next" },
        pagination: { el: ".works-progress", type: "progressbar" },
        a11y: {
          prevSlideMessage: "Foto anterior",
          nextSlideMessage: "Próxima foto",
          firstSlideMessage: "Esta é a primeira foto",
          lastSlideMessage: "Esta é a última foto",
          slideLabelMessage: "{{index}} de {{slidesLength}}"
        },
        breakpoints: { 768: { spaceBetween: 20 } },
        on: {
          init: updateCounter,
          slideChange: updateCounter,
          reachEnd: updateCounter,
          fromEdge: updateCounter
        }
      });

      $(window).on("resize", function () {
        swiper.params.slidesOffsetAfter = gutterPx();
        swiper.update();
      });
    }

    if (!reduce) {
      gsap.from(".works-swiper .swiper-slide", {
        x: 90,
        autoAlpha: 0,
        duration: 1.2,
        stagger: 0.08,
        ease: "expo.out",
        clearProps: "transform",
        scrollTrigger: { trigger: ".works-swiper", start: "top 86%", once: true }
      });
    }

    initLightbox();
  }

  function initLightbox() {
    var $lb = $(".lightbox");
    var lb = $lb[0];
    var stage = $lb.find(".lightbox-stage")[0];
    var lbImg = $lb.find(".lightbox-image")[0];
    var backdrop = $lb.find(".lightbox-backdrop")[0];
    var caption = $lb.find(".lightbox-caption")[0];
    var closeBtn = $lb.find(".lightbox-close")[0];
    var activeCard = null;
    var busy = false;
    var Flip = window.Flip;

    function open(card) {
      if (busy || activeCard) return;
      var cardImg = card.querySelector(".work-image");
      if (!cardImg) return;
      busy = true;
      activeCard = card;

      var w = cardImg.naturalWidth || Number(cardImg.getAttribute("width")) || 4;
      var h = cardImg.naturalHeight || Number(cardImg.getAttribute("height")) || 5;
      stage.style.setProperty("--ar", (w / h).toFixed(4));
      lbImg.src = cardImg.currentSrc || cardImg.src;
      lbImg.alt = cardImg.alt;
      lbImg.width = w;
      lbImg.height = h;

      var tags = $(card).find(".work-tags span").map(function () { return $(this).text(); }).get();
      $lb.find(".lightbox-tags").text(tags.join(" · "));
      $lb.find(".lightbox-title").text($(card).find(".work-title").text());
      $lb.find(".lightbox-sub").text($(card).find(".work-sub").text());

      /* O id precisa existir antes do getState: é por ele que o Flip
         casa a foto do card com a foto do visualizador. */
      cardImg.setAttribute("data-flip-id", "work");
      lbImg.setAttribute("data-flip-id", "work");
      var state = Flip ? Flip.getState(cardImg) : null;

      lockScroll(true);
      $lb.prop("hidden", false);

      var finish = function () { busy = false; closeBtn.focus({ preventScroll: true }); };

      if (reduce || !Flip) {
        finish();
        return;
      }

      gsap.set(cardImg, { autoAlpha: 0 });
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
      gsap.fromTo([closeBtn].concat($(caption).children().get()),
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.06, delay: 0.35, ease: "power3.out" });
      Flip.from(state, {
        targets: lbImg,
        duration: 0.85,
        ease: "power3.inOut",
        absolute: true,
        onComplete: finish
      });
    }

    function close() {
      if (busy || !activeCard) return;
      busy = true;
      var card = activeCard;
      var cardImg = card.querySelector(".work-image");

      var done = function () {
        $lb.prop("hidden", true);
        gsap.set([lbImg, backdrop, closeBtn].concat($(caption).children().get()), { clearProps: "all" });
        gsap.set(cardImg, { clearProps: "opacity,visibility" });
        cardImg.removeAttribute("data-flip-id");
        lbImg.removeAttribute("data-flip-id");
        lockScroll(false);
        activeCard = null;
        busy = false;
        card.focus({ preventScroll: true });
      };

      if (reduce || !Flip) { done(); return; }

      gsap.to([closeBtn].concat($(caption).children().get()), { autoAlpha: 0, y: 10, duration: 0.25, ease: "power2.in" });
      gsap.to(backdrop, { opacity: 0, duration: 0.55, delay: 0.15, ease: "power2.inOut" });
      Flip.fit(lbImg, cardImg, {
        duration: 0.7,
        ease: "power3.inOut",
        absolute: true,
        onComplete: done
      });
    }

    $(".works-swiper").on("click", ".work-card", function (event) {
      if (event.isDefaultPrevented() || (swiper && !swiper.allowClick)) return;
      open(this);
    });
    $lb.on("click", "[data-lightbox-close]", close);
    $(document).on("keydown", function (event) {
      if (!activeCard) return;
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      var focusables = $lb.find("a[href], button").filter(":visible").get();
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  /* ---------------------------------------------------------
     CONTATO — GradientWaves + copiar número
     --------------------------------------------------------- */
  function initContact() {
    /* RotatingText: "Agende [alongamento em gel / fibra de vidro / …]" */
    var rotor = document.querySelector("[data-rotating]");
    if (rotor && window.RotatingText) {
      var texts = [];
      try { texts = JSON.parse(rotor.getAttribute("data-rotating")); } catch (e) { texts = [rotor.textContent]; }
      window.RotatingText(rotor, {
        texts: texts,
        effect: "slide",
        direction: "up",
        highlight: true,
        highlightColor: COLORS.violet,
        staggerFrom: "last",
        staggerDuration: 0.025,
        splitLevelClassName: "rotor-split",
        rotationInterval: 2400,
        pauseOnHover: true
      });
    }

    var waves = document.querySelector(".contact-waves");
    if (waves && window.GradientWaves) {
      window.GradientWaves(waves, {
        horizonColor: "#7a1cff",
        waveColor: "#b88cff",
        crestColor: "#ffffff",
        backgroundColor: COLORS.night,
        speed: 0.35,
        amplitude: 2.4,
        waveScale: 0.6,
        waveRatio: 0.9,
        swell: 35,
        turbulence: 20,
        tilt: 72,
        zoom: 1,
        height: 5.5,
        fogDepth: 15,
        relief: 1,
        lightAngle: 120,
        sheen: 0.35,
        brightness: 1.05,
        grain: 0.12,
        quality: lowPower ? "low" : "medium",
        intro: true,
        mouseInteraction: !lowPower,
        parallaxStrength: 0.5,
        mouseStrength: 0.6,
        swellOnClick: true,
        dpr: lowPower ? 0.5 : 1.75
      });
    }

    if (!reduce) {
      gsap.from(".contact-services, .contact-actions > *, .copy-phone", {
        y: 26,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: ".contact-actions", start: "top 90%", once: true }
      });
    }

    var $toast = $(".toast");
    var toastTween = null;
    var showToast = function (message) {
      $toast.text(message);
      if (toastTween) toastTween.kill();
      toastTween = gsap.timeline()
        .to($toast[0], { opacity: 1, y: 0, xPercent: -50, x: 0, duration: 0.35, ease: "power2.out" })
        .to($toast[0], { opacity: 0, y: 16, duration: 0.35, ease: "power2.in" }, "+=2");
    };
    gsap.set($toast[0], { xPercent: -50, x: 0, left: "50%", y: 16 });

    $(".copy-phone").on("click", function () {
      var $btn = $(this);
      var phone = String($btn.attr("data-phone"));
      var done = function () {
        $btn.find(".copy-phone-text").text("Número copiado");
        showToast("Número copiado: (11) 98032-6159");
        setTimeout(function () { $btn.find(".copy-phone-text").text("Copiar número"); }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone).then(done, function () { fallbackCopy(phone); done(); });
      } else {
        fallbackCopy(phone);
        done();
      }
    });
  }

  function fallbackCopy(value) {
    var ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* sem suporte */ }
    document.body.removeChild(ta);
  }

  /* ---------------------------------------------------------
     LOCALIZAÇÃO
     --------------------------------------------------------- */
  function initMap() {
    if (reduce) return;
    gsap.from(".map-card, .map-frame", {
      y: 40,
      autoAlpha: 0,
      duration: 1,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: ".map-grid", start: "top 86%", once: true }
    });
  }

  /* ---------------------------------------------------------
     INICIALIZAÇÃO
     --------------------------------------------------------- */
  $(function () {
    $("[data-year]").text(new Date().getFullYear());

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    initLenis();
    initBackground();
    initHero();
    initMenu();
    initChrome();
    initNavigation();
    initAnchors();
    initSpecular();
    initSpotlight();
    initAbout();
    initWorks();
    initContact();
    initMap();
    initFolds();

    /* Estados iniciais já aplicados pelo GSAP: pode liberar a página */
    root.classList.remove("js-anim");

    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function () {
      initSplits();
      ScrollTrigger.refresh();
    });
    $(window).on("load", function () { ScrollTrigger.refresh(); });
  });
})(window.jQuery);

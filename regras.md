precisamos mexer no visual inteiro do site .
voce deve adicionar as seguintes coisas para o site ficar bom 

Categoria	Tecnologia
Estrutura	HTML5
Estilo e responsividade	CSS3
Programação e interações	JavaScript
Animações	GSAP
Animações ligadas à rolagem	GSAP ScrollTrigger
Texto animado por linhas	GSAP SplitText
Transições entre estados	GSAP Flip
Rolagem suave	Lenis
Carrosséis e sliders	Swiper
Plataforma de desenvolvimento	Webflow
Manipulação de elementos	jQuery
Ícones e logotipos	SVG




as animações que voce vai usar sao dos seguintes prompts


## Integrate the <RotatingText /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: RotatingText
### Variant: JavaScript + CSS
### Dependencies: motion

---

### Usage Example
```jsx
import RotatingText from './RotatingText';

<RotatingText
  texts={['React', 'Bits', 'Is', 'Cool!']}
  effect="slide"
  direction="up"
  highlight={true}
  highlightColor="#a855f7"
  staggerFrom="last"
  staggerDuration={0.025}
  splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
  rotationInterval={2000}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| texts | string[] | [] | The texts to rotate through. |
| effect | 'slide' | 'flip' | 'blur' | 'scale' | 'drop' | "slide" | How letters swap. Flip rolls them over like a drum, blur dissolves them, scale zooms through and drop lets them fall in with a small bounce. |
| direction | 'up' | 'down' | "up" | Which way letters travel. Drop always falls from above. |
| highlight | boolean | false | Puts the rotating text on a colored block that smoothly resizes to fit each new text, with a text color picked for contrast. |
| highlightColor | string | "#a855f7" | Color of the highlight block. Hex or rgb colors also set a readable text color automatically. |
| rotationInterval | number | 2000 | Time each text stays on screen, in milliseconds. |
| blur | number | 0 | Blurs letters as they come and go, in px. The blur effect uses 10 when this is 0. |
| staggerDuration | number | 0 | Delay between letters, in seconds. |
| staggerFrom | 'first' | 'last' | 'center' | 'random' | number | "first" | Which letter moves first. A number starts from that letter, random shuffles the order. |
| splitBy | 'characters' | 'words' | 'lines' | string | "characters" | How each text is split into moving pieces. Any other string is used as the separator. |
| loop | boolean | true | Goes back to the first text after the last one. |
| auto | boolean | true | Rotates on its own. Turn off to drive it with the ref methods. |
| pauseOnHover | boolean | false | Holds the current text while the pointer is over it. |
| initial | object | - | Overrides the state each letter enters from. Leave unset to use the effect. |
| animate | object | - | Overrides the state each letter settles into. |
| exit | object | - | Overrides the state each letter leaves to. |
| transition | object | - | Overrides the Motion transition used for every letter. Each effect brings its own by default. |
| animatePresenceMode | 'wait' | 'sync' | "wait" | 'wait' lets the old text leave before the new one enters, 'sync' runs both at once. |
| animatePresenceInitial | boolean | false | Animates the first text in on mount. |
| onNext | (index: number) => void | undefined | Called with the new index whenever the text changes. |
| mainClassName | string | '' | Extra class names for the outer element. |
| splitLevelClassName | string | '' | Extra class names for each group of letters. Add overflow hidden here for a masked slide. |
| elementLevelClassName | string | '' | Extra class names for each moving letter. |

### Full Component Source
```jsx
'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  motion,
  AnimatePresence,
  MotionConfig,
  animate as animateValue,
  useMotionValue,
  useReducedMotion
} from 'motion/react';

import './RotatingText.css';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

const splitIntoCharacters = text =>
  segmenter ? Array.from(segmenter.segment(text), segment => segment.segment) : Array.from(text);

const withFilter = (state, filter) =>
  state && typeof state === 'object' && !Array.isArray(state) ? { ...state, filter } : state;

const LAYOUT_SPRING = { type: 'spring', damping: 25, stiffness: 300 };
const WIDTH_SPRING = { type: 'spring', damping: 34, stiffness: 320 };
const FLIP_STYLE = { transformOrigin: '50% 50% -0.45em', backfaceVisibility: 'hidden' };

const EFFECTS = {
  slide: up => ({
    initial: { y: up ? '100%' : '-100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: up ? '-120%' : '120%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 300 }
  }),
  flip: up => ({
    initial: { rotateX: up ? -90 : 90, opacity: 0, transformPerspective: 480 },
    animate: { rotateX: 0, opacity: 1, transformPerspective: 480 },
    exit: { rotateX: up ? 90 : -90, opacity: 0, transformPerspective: 480 },
    transition: { type: 'tween', duration: 0.6, ease: [0.34, 1.4, 0.64, 1] },
    exitTransition: { type: 'tween', duration: 0.32, ease: [0.5, 0, 0.75, 0] }
  }),
  blur: up => ({
    initial: { y: up ? '45%' : '-45%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: up ? '-45%' : '45%', opacity: 0 },
    transition: { type: 'tween', duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  }),
  scale: up => ({
    initial: { scale: up ? 0.35 : 1.7, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: up ? 1.7 : 0.35, opacity: 0 },
    transition: { type: 'spring', damping: 17, stiffness: 240 }
  }),
  drop: () => ({
    initial: { y: '-110%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '110%', opacity: 0 },
    transition: { type: 'spring', damping: 18, stiffness: 320, mass: 0.9 },
    exitTransition: { type: 'tween', duration: 0.3, ease: [0.55, 0, 1, 0.45] }
  })
};

const readableText = color => {
  const value = String(color ?? '').trim();
  let rgb = null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const digits = hex[1].length < 6 ? [...hex[1].slice(0, 3)].map(c => c + c).join('') : hex[1].slice(0, 6);
    rgb = [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
  } else {
    const fn = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (fn) rgb = fn.slice(1, 4).map(Number);
  }
  if (!rgb) return undefined;
  const [r, g, b] = rgb.map(channel => {
    const c = Math.min(Math.max(channel / 255, 0), 1);
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b0b0c' : '#ffffff';
};

const RotatingText = forwardRef((props, ref) => {
  const {
    texts,
    transition,
    initial,
    animate,
    exit,
    effect = 'slide',
    direction = 'up',
    highlight = false,
    highlightColor = '#a855f7',
    animatePresenceMode = 'wait',
    animatePresenceInitial = false,
    rotationInterval = 2000,
    staggerDuration = 0,
    staggerFrom = 'first',
    loop = true,
    auto = true,
    pauseOnHover = false,
    blur = 0,
    splitBy = 'characters',
    onNext,
    onMouseEnter,
    onMouseLeave,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    style,
    ...rest
  } = props;

  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const indexRef = useRef(0);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const contentRef = useRef(null);
  const width = useMotionValue('auto');
  const reduceMotion = useReducedMotion();

  const lastIndex = Math.max(texts.length - 1, 0);
  const activeIndex = Math.min(currentTextIndex, lastIndex);

  const elements = useMemo(() => {
    const currentText = texts[activeIndex] ?? '';
    if (splitBy === 'characters') {
      const words = currentText.split(' ');
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1
      }));
    }
    if (splitBy === 'words') {
      return currentText.split(' ').map((word, i, arr) => ({
        characters: [word],
        needsSpace: i !== arr.length - 1
      }));
    }
    if (splitBy === 'lines') {
      return currentText.split('\n').map((line, i, arr) => ({
        characters: [line],
        needsSpace: i !== arr.length - 1
      }));
    }

    return currentText.split(splitBy).map((part, i, arr) => ({
      characters: [part],
      needsSpace: i !== arr.length - 1
    }));
  }, [texts, activeIndex, splitBy]);

  const order = useMemo(() => {
    const total = elements.reduce((sum, word) => sum + word.characters.length, 0);
    const shuffled = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5);
    return { total, shuffled };
  }, [elements]);

  const getStaggerDelay = index => {
    const { total, shuffled } = order;
    if (staggerFrom === 'first') return index * staggerDuration;
    if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
    if (staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
    if (staggerFrom === 'random') return shuffled[index] * staggerDuration;
    return Math.abs(staggerFrom - index) * staggerDuration;
  };

  const goTo = useCallback(index => {
    if (index === indexRef.current) return;
    indexRef.current = index;
    setCurrentTextIndex(index);
    onNextRef.current?.(index);
  }, []);

  const next = useCallback(() => {
    const current = Math.min(indexRef.current, lastIndex);
    goTo(current < lastIndex ? current + 1 : loop ? 0 : current);
  }, [lastIndex, loop, goTo]);

  const previous = useCallback(() => {
    const current = Math.min(indexRef.current, lastIndex);
    goTo(current > 0 ? current - 1 : loop ? lastIndex : current);
  }, [lastIndex, loop, goTo]);

  const jumpTo = useCallback(index => goTo(Math.max(0, Math.min(index, lastIndex))), [lastIndex, goTo]);

  const reset = useCallback(() => goTo(0), [goTo]);

  useImperativeHandle(
    ref,
    () => ({
      next,
      previous,
      jumpTo,
      reset
    }),
    [next, previous, jumpTo, reset]
  );

  const paused = pauseOnHover && hovered;

  useEffect(() => {
    if (!auto || paused) return;
    const timeoutId = setTimeout(next, rotationInterval);
    return () => clearTimeout(timeoutId);
  }, [next, rotationInterval, auto, paused, activeIndex]);

  useIsomorphicLayoutEffect(() => {
    const content = contentRef.current;
    if (!highlight || !content) {
      width.set('auto');
      return undefined;
    }
    let controls = null;
    let settled = false;
    const fit = () => {
      const target = content.offsetWidth + 1;
      controls?.stop();
      if (!settled || reduceMotion) {
        settled = true;
        width.set(target);
        return;
      }
      controls = animateValue(width, target, WIDTH_SPRING);
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(content);
    return () => {
      observer?.disconnect();
      controls?.stop();
    };
  }, [highlight, reduceMotion, width]);

  const handleMouseEnter = event => {
    if (pauseOnHover) setHovered(true);
    onMouseEnter?.(event);
  };

  const handleMouseLeave = event => {
    setHovered(false);
    onMouseLeave?.(event);
  };

  const motionPreset = (EFFECTS[effect] ?? EFFECTS.slide)(direction !== 'down');
  const blurAmount = blur > 0 ? blur : effect === 'blur' ? 10 : 0;
  const enterState = initial ?? motionPreset.initial;
  const restState = animate ?? motionPreset.animate;
  const leaveState = exit ?? motionPreset.exit;
  const charTransition = transition ?? motionPreset.transition;
  const exitTransition = transition || exit ? null : motionPreset.exitTransition;
  const enterFrom = blurAmount > 0 ? withFilter(enterState, `blur(${blurAmount}px)`) : enterState;
  const enterTo = blurAmount > 0 ? withFilter(restState, 'blur(0px)') : restState;
  const leaveTo = blurAmount > 0 ? withFilter(leaveState, `blur(${blurAmount}px)`) : leaveState;
  const charStyle = effect === 'flip' ? FLIP_STYLE : undefined;

  const blockStyle = highlight
    ? { ...style, width, backgroundColor: highlightColor, color: readableText(highlightColor) ?? style?.color }
    : style;

  const presence = (
    <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
      <motion.span
        key={activeIndex}
        className={cn(splitBy === 'lines' ? 'text-rotate-lines' : 'text-rotate')}
        layout={!highlight}
        aria-hidden="true"
      >
        {elements.map((wordObj, wordIndex, array) => {
          const previousCharsCount = array.slice(0, wordIndex).reduce((sum, word) => sum + word.characters.length, 0);
          return (
            <span key={wordIndex} className={cn('text-rotate-word', splitLevelClassName)}>
              {wordObj.characters.map((char, charIndex) => {
                const delay = getStaggerDelay(previousCharsCount + charIndex);
                return (
                  <motion.span
                    key={charIndex}
                    initial={enterFrom}
                    animate={enterTo}
                    exit={exitTransition ? { ...leaveTo, transition: { ...exitTransition, delay } } : leaveTo}
                    transition={{ ...charTransition, delay }}
                    className={cn('text-rotate-element', elementLevelClassName)}
                    style={charStyle}
                  >
                    {char}
                  </motion.span>
                );
              })}
              {wordObj.needsSpace && <span className="text-rotate-space"> </span>}
            </span>
          );
        })}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        className={cn('text-rotate', highlight && 'text-rotate-highlight', mainClassName)}
        {...rest}
        style={blockStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        layout={!highlight}
        transition={transition ?? LAYOUT_SPRING}
      >
        <span className="text-rotate-sr-only">{texts[activeIndex]}</span>
        {highlight ? (
          <span ref={contentRef} className="text-rotate-highlight-content">
            {presence}
          </span>
        ) : (
          presence
        )}
      </motion.span>
    </MotionConfig>
  );
});

RotatingText.displayName = 'RotatingText';
export default RotatingText;

```

### Component CSS
```css
.text-rotate {
  display: flex;
  flex-wrap: wrap;
  white-space: pre-wrap;
  position: relative;
}

.text-rotate-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.text-rotate-word {
  display: inline-flex;
}

.text-rotate-lines {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.text-rotate-element {
  display: inline-block;
}

.text-rotate-space {
  white-space: pre;
}

.text-rotate-highlight {
  box-sizing: content-box;
  flex-wrap: nowrap;
  justify-content: center;
  overflow: hidden;
  padding: 0.1em 0.28em;
  border-radius: 0.16em;
}

.text-rotate-highlight-content {
  display: flex;
  flex-shrink: 0;
  white-space: pre;
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.




esse tbm :

## Integrate the <LineSidebar /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: LineSidebar
### Variant: JavaScript + CSS


---

### Usage Example
```jsx
import LineSidebar from './LineSidebar';

<LineSidebar
  items={['Overview', 'Components', 'Animations', 'Backgrounds', 'Showcase']}
  accentColor="#A855F7"
  textColor="#c4c4c4"
  markerColor="#6c6c6c"
  showIndex
  showMarker
  proximityRadius={100}
  maxShift={30}
  falloff="smooth"
  markerLength={60}
  markerGap={0}
  tickScale={0.5}
  scaleTick
  itemGap={20}
  fontSize={1.1}
  smoothing={100}
  defaultActive={0}
  onItemClick={(index, label) => console.log(index, label)}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| items | string[] | [...] | Labels rendered as the list of sidebar entries. |
| accentColor | string | "#A855F7" | Color items and markers shift toward as the cursor gets close. |
| textColor | string | "#c4c4c4" | Resting color of the item labels. |
| markerColor | string | "#6c6c6c" | Resting color of the leading marker lines. |
| showIndex | boolean | true | Show the zero-padded index before each label. |
| showMarker | boolean | true | Show the marker lines (and short ticks) beside each item. |
| proximityRadius | number | 100 | Vertical distance in pixels within which the cursor influences an item. |
| maxShift | number | 30 | Maximum horizontal shift in pixels the label slides at full proximity. |
| falloff | "linear" | "smooth" | "sharp" | "smooth" | Curve mapping cursor distance to the proximity effect. |
| markerLength | number | 60 | Length in pixels of the marker line; the in-between ticks scale from this too. |
| markerGap | number | 0 | Gap in pixels between the labels and the markers. |
| tickScale | number | 0.5 | Length of the in-between ticks as a fraction of markerLength. |
| scaleTick | boolean | true | When true, the in-between ticks also grow with cursor proximity. |
| itemGap | number | 20 | Vertical gap between items in pixels. |
| fontSize | number | 1.1 | Font size of the labels in rem. |
| smoothing | number | 100 | Transition duration in milliseconds for the proximity response. |
| defaultActive | number | null | null | Index of the item selected on mount. |
| onItemClick | (index, label) => void | - | Called when an item is clicked; the clicked item also becomes active. |
| className | string | "" | Additional CSS classes for the outer wrapper. |

### Full Component Source
```jsx
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import './LineSidebar.css';

const FALLOFF_CURVES = {
  linear: p => p,
  smooth: p => p * p * (3 - 2 * p),
  sharp: p => p * p * p
};

const DEFAULT_ITEMS = [
  'Overview',
  'Components',
  'Animations',
  'Backgrounds',
  'Showcase',
  'Playground',
  'Templates',
  'Changelog',
  'Community',
  'Resources',
  'Documentation',
  'Support'
];

const LineSidebar = ({
  items = DEFAULT_ITEMS,
  accentColor = '#A855F7',
  textColor = '#c4c4c4',
  markerColor = '#6c6c6c',
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 30,
  falloff = 'smooth',
  markerLength = 60,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 20,
  fontSize = 1.1,
  smoothing = 100,
  defaultActive = null,
  onItemClick,
  className = ''
}) => {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const targetsRef = useRef([]);
  const currentRef = useRef([]);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const activeRef = useRef(defaultActive);
  const smoothingRef = useRef(smoothing);
  const [activeIndex, setActiveIndex] = useState(defaultActive);

  activeRef.current = activeIndex;
  smoothingRef.current = smoothing;

  // Single rAF loop that eases every item's --effect toward its target using
  // frame-rate independent exponential smoothing, so color, shift and scale
  // all move together without staggering CSS transitions.
  const runFrame = useCallback(now => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let moving = false;
    const items = itemRefs.current;
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      if (!el) continue;
      const target = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0);
      const cur = currentRef.current[i] || 0;
      const next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty('--effect', value.toFixed(4));
      if (!settled) moving = true;
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback(
    e => {
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;
      const items = itemRefs.current;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (!el) continue;
        const center = el.offsetTop + el.offsetHeight / 2;
        const distance = Math.abs(pointerY - center);
        targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
      }
      startLoop();
    },
    [falloff, proximityRadius, startLoop]
  );

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleClick = useCallback(
    (index, label) => {
      setActiveIndex(index);
      onItemClick?.(index, label);
    },
    [onItemClick]
  );

  useEffect(() => {
    startLoop();
  }, [activeIndex, startLoop]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    []
  );

  return (
    <nav
      className={`line-sidebar${showMarker ? ' line-sidebar--markers' : ''}${scaleTick ? ' line-sidebar--scale-tick' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--accent-color': accentColor,
        '--text-color': textColor,
        '--marker-color': markerColor,
        '--marker-length': `${markerLength}px`,
        '--marker-gap': `${markerGap}px`,
        '--tick-scale': tickScale,
        '--max-shift': `${maxShift}px`,
        '--item-gap': `${itemGap}px`,
        '--font-size': `${fontSize}rem`,
        '--smoothing': `${smoothing}ms`
      }}
    >
      <ul ref={listRef} className="line-sidebar__list" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={el => {
              itemRefs.current[index] = el;
            }}
            className="line-sidebar__item"
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => handleClick(index, label)}
          >
            {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
            <span className="line-sidebar__label">
              {showIndex && <span className="line-sidebar__index">{String(index + 1).padStart(2, '0')}</span>}
              <span className="line-sidebar__text">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default LineSidebar;

```

### Component CSS
```css
.line-sidebar {
  --accent-color: #a855f7;
  --text-color: #c4c4c4;
  --marker-color: #6c6c6c;
  --marker-length: 60px;
  --marker-gap: 0px;
  --tick-scale: 0.5;
  --max-shift: 30px;
  --item-gap: 20px;
  --font-size: 1.1rem;
  --smoothing: 100ms;

  position: relative;
  display: flex;
  justify-content: flex-start;
}

.line-sidebar--markers {
  padding-left: calc(var(--marker-length) + var(--marker-gap));
}

.line-sidebar__list {
  list-style: none;
  margin: 0;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: var(--item-gap);
}

/* --effect (0..1) is driven per item by a rAF lerp in JS, so every derived
   property below reads the same continuously-animating value and stays in
   step, with no CSS transitions to stagger. */
.line-sidebar__item {
  position: relative;
  cursor: pointer;
}

/* Widen the pointer target so items react a touch before the cursor arrives */
.line-sidebar__item::before {
  content: '';
  position: absolute;
  inset: -6px -48px;
}

.line-sidebar__label {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  font-size: var(--font-size);
  line-height: 1.2;
  color: color-mix(in srgb, var(--accent-color) calc(var(--effect, 0) * 100%), var(--text-color));
  transform: translateX(calc(var(--effect, 0) * var(--max-shift)));
}

.line-sidebar__index {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-right: 0.6rem;
  font-size: 0.85em;
  opacity: calc(0.55 + var(--effect, 0) * 0.45);
}

.line-sidebar__marker {
  position: absolute;
  top: 50%;
  left: calc(-1 * var(--marker-length) - var(--marker-gap));
  height: 1px;
  width: var(--marker-length);
  background-color: color-mix(in srgb, var(--accent-color) calc(var(--effect, 0) * 100%), var(--marker-color));
  transform-origin: left center;
  transform: translateY(-50%) scaleX(calc(0.7 + var(--effect, 0) * 0.5));
}

/* Short static tick centered in the gap between two menu items */
.line-sidebar--markers .line-sidebar__item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: calc(100% + var(--item-gap) / 2);
  left: calc(-1 * var(--marker-length) - var(--marker-gap));
  height: 1px;
  width: calc(var(--marker-length) * var(--tick-scale));
  background-color: var(--marker-color);
  opacity: 0.5;
  transform: translateY(-50%);
}

/* When enabled, the in-between ticks grow with cursor proximity too */
.line-sidebar--scale-tick .line-sidebar__item:not(:last-child)::after {
  transform-origin: left center;
  transform: translateY(-50%) scaleX(calc(0.7 + var(--effect, 0) * 0.6));
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.



esse :
## Integrate the <GradientWaves /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: GradientWaves
### Variant: JavaScript + CSS


---

### Usage Example
```jsx
import GradientWaves from './GradientWaves';

<div style={{ width: '100%', height: '600px', position: 'relative' }}>
  <GradientWaves
    horizonColor="#5227FF"
    waveColor="#FF9FFC"
    crestColor="#FFFFFF"
    speed={0.4}
    amplitude={2.5}
    relief={1}
    lightAngle={120}
    mouseInteraction
    swellOnClick
  />
</div>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| horizonColor | string | '#5227FF' | Haze the waves fade into toward the horizon, and the tint of their shadows. |
| waveColor | string | '#FF9FFC' | Main color of the wave bodies. |
| crestColor | string | '#FFFFFF' | Color of the crests and the light they catch. |
| backgroundColor | string | 'transparent' | Fills the canvas behind the waves. Transparent lets the page show through. |
| lightMode | boolean | false | Draws the waves as soft colored ink for light pages. |
| speed | number | 0.4 | How fast the waves roll in. |
| amplitude | number | 2.5 | Height of the waves. |
| waveScale | number | 0.6 | How many waves fit in view. Higher is choppier. |
| waveRatio | number | 0.9 | Balance between the long rolling waves and the shorter cross waves. |
| swell | number | 35 | How much the long waves bend and meander. |
| turbulence | number | 20 | How much the cross waves wander. |
| tilt | number | 64 | Camera angle in degrees, from looking down to facing the horizon. |
| zoom | number | 1 | Field of view. Higher zooms in. |
| height | number | 5.5 | Water level. Higher brings the waves closer. |
| fogDepth | number | 15 | How far you can see before the waves fade out. |
| relief | number | 1 | Depth of the light and shadow on the waves. 0 gives flat gradient waves. |
| lightAngle | number | 120 | Direction the light comes from, in degrees. 0 lights the waves from behind you, 180 from the horizon. |
| sheen | number | 0 | Strength of a soft highlight on the crests. |
| brightness | number | 1 | Overall brightness. |
| opacity | number | 1 | Opacity of the whole effect. |
| grain | number | 0.2 | Film grain on the waves, up to 0.5. 0 turns it off. |
| quality | 'low' | 'medium' | 'high' | 'medium' | Rendering precision. Lower is faster on weak devices. |
| intro | boolean | true | Starts from calm water and lets the waves rise from the horizon toward you. |
| mouseInteraction | boolean | true | The light follows the cursor across the waves and the view turns gently toward it. |
| parallaxStrength | number | 0.5 | How far the view turns toward the cursor. |
| mouseStrength | number | 0.6 | How far the light turns to follow the cursor. |
| swellOnClick | boolean | true | Clicking sends a swell rolling in from that point. |
| paused | boolean | false | Freezes the waves. |
| dpr | number | 2 | Maximum device pixel ratio of the canvas. |
| className | string | '' | Extra class names for the container. |
| style | CSSProperties | - | Inline styles for the container. |

### Full Component Source
```jsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import './GradientWaves.css';

const ROOT = 'gradient-waves-container';
const CANVAS = 'gradient-waves-canvas';

const MAX_SWELLS = 4;
const SWELL_SECONDS = 3.2;
const SWELL_GAIN = 2.8;
const SWELL_WIDTH = 8;
const INTRO_SECONDS = 2.6;
const CAMERA_HEIGHT = 30;
const QUALITY = { low: 56, medium: 84, high: 120 };

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uClock;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uHeight;
uniform float uTilt;
uniform float uZoom;
uniform vec2 uLook;
uniform float uFogDepth;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform vec3 uHorizon;
uniform vec3 uWave;
uniform vec3 uCrest;
uniform vec3 uBackground;
uniform float uOpaque;
uniform float uLight;
uniform vec3 uSun;
uniform float uRelief;
uniform float uSheen;
uniform float uSteps;
uniform float uStride;
uniform vec3 uIntro;
uniform vec3 uSwells[${MAX_SWELLS}];
uniform float uSwellWidth;
out vec4 outColor;

const float FAR = 4000.0;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 surface(vec2 xy) {
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(uTime / 0.130, uTime / 0.810, uTime / 0.200, uTime / 0.710);
  float a = xy.x + tc.x;
  float swellPhase = (xy.y + a) / 20.0 + tc.y;
  float bend = uSwell * cos(swellPhase) / 20.0;
  float mx = a + uSwell * sin(swellPhase);
  float crossPhase = xy.x / 23.0 + tc.w;
  float my = xy.y - tc.z + uTurbulence * cos(crossPhase);
  float twist = -uTurbulence * sin(crossPhase) / 23.0;
  float cx = cos(mx * freq.x);
  float cy = cos(my * freq.y);
  float rise = 1.0;
  if (uIntro.z > 0.0) rise = mix(1.0, smoothstep(uIntro.y * 0.45, uIntro.y * 1.6, xy.x), uIntro.z);
  float amp = uAmplitude * rise;
  float h = (sin(mx * freq.x) + sin(my * freq.y)) * amp + uHeight;
  float dx = amp * (freq.x * cx * (1.0 + bend) + freq.y * cy * twist);
  float dy = amp * (freq.x * cx * bend + freq.y * cy);
  for (int k = 0; k < ${MAX_SWELLS}; k++) {
    vec3 sw = uSwells[k];
    if (sw.z <= 0.0) continue;
    float u = (xy.x - sw.x) / uSwellWidth;
    float v = (xy.y - sw.y) / (uSwellWidth * 3.5);
    float bump = sw.z * exp(-u * u - v * v);
    h += bump;
    dx += bump * (-2.0 * u / uSwellWidth);
    dy += bump * (-2.0 * v / (uSwellWidth * 3.5));
  }
  return vec3(h, dx, dy);
}

float march(vec3 origin, vec3 dir) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float gap = origin.z + dist * dir.z - surface(origin.xy + dist * dir.xy).x;
    if (abs(gap) < 0.002 * dist + 0.01) break;
    dist += uStride * gap;
    if (!(abs(dist) < FAR)) return FAR;
  }
  return dist;
}

void main() {
  float c;
  float s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, ${CAMERA_HEIGHT.toFixed(1)});
  vec2 uv = gl_FragCoord.xy / uResolution - 0.5;
  uv.x *= uResolution.x / uResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot);
  s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  dir = mat3(nuv.x, -nuv.y, 0.0, nuv.y, nuv.x, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt + uLook.y);
  s = sin(uTilt + uLook.y);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
  c = cos(uLook.x);
  s = sin(uLook.x);
  dir = mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0) * dir;

  float dist = march(cam, dir);
  vec3 pos = cam + dist * dir;
  vec3 field = surface(pos.xy);
  vec3 view = -dir;

  float crest = clamp((field.x - uHeight) / max(2.0 * uAmplitude, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  vec3 body = mix(uWave, uCrest, smoothstep(0.45, 1.0, crest) * 0.5);
  vec3 normal = normalize(vec3(-field.yz * (1.0 + 1.5 * uRelief), 1.0));
  float diffuse = clamp(dot(normal, uSun) * 0.5 + 0.5, 0.0, 1.0);
  float lightness = mix(1.0, diffuse * diffuse * (3.0 - 2.0 * diffuse), uRelief);
  float sheen = pow(clamp(dot(normal, normalize(uSun + view)), 0.0, 1.0), 14.0) * uSheen * (0.4 + 0.6 * uRelief);
  float rim = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);

  vec3 col;
  float alpha;
  float haze = 1.0 - exp(-dist / (uFogDepth * 5.0));
  float fade = 1.0 - smoothstep(0.35, 1.0, haze);
  if (uLight < 0.5) {
    vec3 lit = mix(uHorizon * 0.18, body, lightness) + uCrest * sheen;
    lit = mix(lit, uHorizon, rim * 0.15 * uRelief);
    col = mix(lit, uHorizon, smoothstep(0.0, 1.0, haze)) * 0.85 * uBrightness;
    alpha = fade;
  } else {
    vec3 hue = mix(uHorizon, body, 0.35 + 0.65 * lightness);
    float density = mix(0.16, 0.9, 1.0 - lightness);
    density *= 1.0 - clamp(sheen, 0.0, 1.0) * 0.85;
    density *= 1.0 - 0.5 * smoothstep(0.0, 1.0, haze);
    col = hue;
    alpha = fade * clamp(density * uBrightness, 0.0, 1.0);
  }

  float reveal = uIntro.x;
  col = clamp(col, 0.0, 1.0);
  float grain = (hash(gl_FragCoord.xy + fract(uClock) * 64.0) - 0.5) * uGrain;
  alpha = clamp(alpha * (1.0 + grain), 0.0, 1.0) * reveal * uOpacity;
  if (uOpaque > 0.5) {
    outColor = vec4(mix(uBackground, col, alpha), 1.0);
  } else {
    outColor = vec4(col * alpha, alpha);
  }
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

let probe = null;

const parseColor = (value, fallback) => {
  if (value === 'transparent') return null;
  if (typeof document === 'undefined') return fallback;
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return fallback;
  probe.fillStyle = '#000000';
  probe.fillStyle = value;
  const text = probe.fillStyle;
  if (text.startsWith('#')) {
    const hex = parseInt(text.slice(1), 16);
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }
  const match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(text);
  if (!match) return fallback;
  if (match[4] !== undefined && Number(match[4]) === 0) return null;
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
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

const rayAt = (point, aspect, s, look) => {
  const uvx = (point[0] - 0.5) * aspect;
  const uvy = point[1] - 0.5;
  const vfov = Math.PI / 2.3 / Math.max(s.zoom, 0.05);
  const length = Math.hypot(uvx, uvy);
  const turn = vfov * length;
  let dir = [0, -Math.sin(turn), -Math.cos(turn)];
  const nx = length > 1e-5 ? uvx / length : 1;
  const ny = length > 1e-5 ? uvy / length : 0;
  dir = [nx * dir[0] + ny * dir[1], -ny * dir[0] + nx * dir[1], dir[2]];
  const pitch = s.tilt + look[1];
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  dir = [cp * dir[0] - sp * dir[2], dir[1], sp * dir[0] + cp * dir[2]];
  const cy = Math.cos(look[0]);
  const sy = Math.sin(look[0]);
  dir = [cy * dir[0] - sy * dir[1], sy * dir[0] + cy * dir[1], dir[2]];
  return dir;
};

const groundAt = (point, aspect, s, look) => {
  const dir = rayAt(point, aspect, s, look);
  if (dir[2] > -0.02) return null;
  const travel = (CAMERA_HEIGHT - s.height) / -dir[2];
  return [dir[0] * travel, dir[1] * travel];
};

const prefersReduced = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export default function GradientWaves({
  horizonColor = '#5227FF',
  waveColor = '#FF9FFC',
  crestColor = '#FFFFFF',
  backgroundColor = 'transparent',
  lightMode = false,
  speed = 0.4,
  amplitude = 2.5,
  waveScale = 0.6,
  waveRatio = 0.9,
  swell = 35,
  turbulence = 20,
  tilt = 64,
  zoom = 1,
  height = 5.5,
  fogDepth = 15,
  relief = 1,
  lightAngle = 120,
  sheen = 0,
  brightness = 1,
  opacity = 1,
  grain = 0.2,
  quality = 'medium',
  intro = true,
  mouseInteraction = true,
  parallaxStrength = 0.5,
  mouseStrength = 0.6,
  swellOnClick = true,
  paused = false,
  dpr = 2,
  className = '',
  style
}) {
  const containerRef = useRef(null);
  const horizon = useMemo(() => parseColor(horizonColor, [0.32, 0.15, 1]) ?? [0.32, 0.15, 1], [horizonColor]);
  const wave = useMemo(() => parseColor(waveColor, [1, 0.62, 0.99]) ?? [1, 0.62, 0.99], [waveColor]);
  const crest = useMemo(() => parseColor(crestColor, [1, 1, 1]) ?? [1, 1, 1], [crestColor]);
  const paper = useMemo(() => parseColor(backgroundColor, null), [backgroundColor]);

  const settings = {
    horizon,
    wave,
    crest,
    paper,
    lightMode,
    speed,
    amplitude: Math.max(0, amplitude),
    waveScale: Math.max(0.01, waveScale),
    waveRatio: Math.max(0.01, waveRatio),
    swell,
    turbulence,
    tilt: (clamp(tilt, 10, 85) * Math.PI) / 180,
    zoom: Math.max(0.05, zoom),
    height,
    fogDepth: Math.max(0.5, fogDepth),
    relief: clamp(relief, 0, 1),
    lightAngle: (lightAngle * Math.PI) / 180,
    sheen: Math.max(0, sheen),
    brightness: Math.max(0, brightness),
    opacity: clamp(opacity, 0, 1),
    grain: typeof grain === 'number' ? Math.max(0, grain) : grain ? 0.05 : 0,
    steps: QUALITY[quality] ?? QUALITY.medium,
    intro,
    mouseInteraction,
    parallaxStrength: Math.max(0, parallaxStrength),
    mouseStrength: clamp(mouseStrength, 0, 1),
    swellOnClick,
    paused,
    dpr: Math.max(0.5, dpr)
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wakeRef = useRef(null);

  useEffect(() => {
    wakeRef.current?.();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = CANVAS;
    container.appendChild(canvas);
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) {
      canvas.remove();
      return undefined;
    }
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      canvas.remove();
      return undefined;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      canvas.remove();
      return undefined;
    }
    const names = [
      'uResolution',
      'uTime',
      'uClock',
      'uAmplitude',
      'uWaveScale',
      'uWaveRatio',
      'uSwell',
      'uTurbulence',
      'uHeight',
      'uTilt',
      'uZoom',
      'uLook',
      'uFogDepth',
      'uBrightness',
      'uOpacity',
      'uGrain',
      'uHorizon',
      'uWave',
      'uCrest',
      'uBackground',
      'uOpaque',
      'uLight',
      'uSun',
      'uRelief',
      'uSheen',
      'uSteps',
      'uStride',
      'uIntro',
      'uSwells',
      'uSwellWidth'
    ];
    const u = {};
    names.forEach(name => {
      u[name] = gl.getUniformLocation(program, name);
    });
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const swellData = new Float32Array(MAX_SWELLS * 3);
    const state = {
      width: 1,
      height: 1,
      cssWidth: 0,
      cssHeight: 0,
      time: 0,
      clock: 0,
      last: 0,
      raf: 0,
      visible: false,
      introAt: -1,
      pointer: [0.5, 0.5],
      inside: false,
      look: [0, 0],
      steer: [0, 0],
      swells: [],
      quiet: 0,
      seen: null
    };

    const fit = () => {
      const s = settingsRef.current;
      const ratio = Math.min(window.devicePixelRatio || 1, s.dpr);
      const width = Math.max(1, Math.round(state.cssWidth * ratio));
      const height = Math.max(1, Math.round(state.cssHeight * ratio));
      if (width === state.width && height === state.height) return;
      state.quiet = 0;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
    };

    const measure = () => {
      state.cssWidth = container.clientWidth;
      state.cssHeight = container.clientHeight;
      fit();
      wake();
    };

    const introProgress = (s, reduced) => {
      if (!s.intro || reduced || state.introAt < 0) return 1;
      return clamp((state.clock - state.introAt) / INTRO_SECONDS, 0, 1);
    };

    const render = reduced => {
      const s = settingsRef.current;
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
      const paperColor = s.paper ?? [0, 0, 0];
      gl.uniform3f(u.uBackground, paperColor[0], paperColor[1], paperColor[2]);
      gl.uniform1f(u.uOpaque, s.paper ? 1 : 0);
      gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
      const elevation = 0.52;
      const angle = s.lightAngle + state.steer[0] * s.mouseStrength * 2;
      const altitude = elevation - state.steer[1] * s.mouseStrength * 0.7;
      gl.uniform3f(
        u.uSun,
        Math.cos(altitude) * Math.cos(angle),
        Math.cos(altitude) * Math.sin(angle),
        Math.sin(altitude)
      );
      gl.uniform1f(u.uRelief, s.relief);
      gl.uniform1f(u.uSheen, s.sheen);
      gl.uniform1f(u.uSteps, s.steps);
      const slope =
        s.amplitude *
        ((s.waveScale / 7) * (1 + Math.abs(s.swell) / 20) +
          ((s.waveScale * s.waveRatio) / 3) * (1 + Math.abs(s.turbulence) / 23));
      const progress = introProgress(s, reduced);
      const shown = Math.min(1, progress / 0.22);
      const crest = 160 * Math.pow(3 / 160, easeInOut(Math.max(0, (progress - 0.1) / 0.9)));
      const settle = clamp((progress - 0.75) / 0.25, 0, 1);
      gl.uniform3f(u.uIntro, shown * shown * (3 - 2 * shown), crest, 1 - settle * settle * (3 - 2 * settle));
      swellData.fill(0);
      let swellPeak = 0;
      state.swells.forEach((swell, index) => {
        const age = state.clock - swell.at;
        const life = age / SWELL_SECONDS;
        const envelope = (1 - Math.exp(-age / 0.25)) * Math.pow(1 - life, 1.6);
        const lift = s.amplitude * SWELL_GAIN * envelope;
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

    const tick = now => {
      state.raf = 0;
      if (!state.visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.1) : 0;
      state.last = now;
      const reduced = prefersReduced();
      state.clock += dt;
      if (state.introAt < 0) state.introAt = state.clock;
      if (!s.paused && !reduced) state.time += dt * s.speed;

      const steering = s.mouseInteraction && state.inside && !reduced;
      const target = steering ? state.pointer : [0.5, 0.5];
      const ease = 1 - Math.exp(-dt / 0.45);
      const goalX = (target[0] - 0.5) * s.parallaxStrength * 0.35;
      const goalY = (target[1] - 0.5) * s.parallaxStrength * 0.18;
      state.look[0] += (goalX - state.look[0]) * ease;
      state.look[1] += (goalY - state.look[1]) * ease;
      const moving = Math.abs(goalX - state.look[0]) + Math.abs(goalY - state.look[1]) > 0.0002;

      const steerEase = 1 - Math.exp(-dt / 0.6);
      const steerX = steering ? state.pointer[0] - 0.5 : 0;
      const steerY = steering ? 0.5 - state.pointer[1] : 0;
      state.steer[0] += (steerX - state.steer[0]) * steerEase;
      state.steer[1] += (steerY - state.steer[1]) * steerEase;
      const turning = Math.abs(steerX - state.steer[0]) + Math.abs(steerY - state.steer[1]) > 0.0005;
      state.swells = state.swells.filter(swell => state.clock - swell.at < SWELL_SECONDS);

      const still = s.paused || reduced;
      const transient = moving || turning || state.swells.length > 0 || introProgress(s, reduced) < 1;
      if (state.seen !== s || transient || !still) state.quiet = 0;
      else state.quiet += 1;
      state.seen = s;
      if (state.quiet > 3) return;

      state.raf = requestAnimationFrame(tick);
      fit();
      render(reduced);
    };

    const wake = () => {
      if (state.raf || !state.visible || document.hidden) return;
      state.last = 0;
      state.raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const local = event => {
      const rect = container.getBoundingClientRect();
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

    const onMove = event => {
      const point = local(event);
      const was = state.inside;
      state.inside = point.inside;
      if (point.inside) state.pointer = [point.x, point.y];
      if ((point.inside || was) && settingsRef.current.mouseInteraction) wake();
    };

    const onLeave = () => {
      state.inside = false;
      wake();
    };

    const onDown = event => {
      const s = settingsRef.current;
      if (!s.swellOnClick || event.button !== 0 || prefersReduced()) return;
      if (
        event.target instanceof Element &&
        event.target.closest('a, button, input, textarea, select, label, [role="button"]')
      )
        return;
      const point = local(event);
      if (!point.inside) return;
      const ground = groundAt([point.x, point.y], state.width / Math.max(state.height, 1), s, state.look);
      if (!ground) return;
      state.swells.push({ x: ground[0], y: ground[1], at: state.clock });
      if (state.swells.length > MAX_SWELLS) state.swells.shift();
      wake();
    };

    const visibility = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      wake();
    });
    visibility.observe(container);
    const sizes = new ResizeObserver(measure);
    sizes.observe(container);
    measure();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    document.documentElement.addEventListener('pointerleave', onLeave);
    state.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(state.raf);
      wakeRef.current = null;
      document.removeEventListener('visibilitychange', wake);
      visibility.disconnect();
      sizes.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className={[ROOT, className].filter(Boolean).join(' ')} style={style} />;
}

```

### Component CSS
```css
.gradient-waves-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.gradient-waves-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.

esse :

## Integrate the <SpecularButton /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: SpecularButton
### Variant: JavaScript + CSS


---

### Usage Example
```jsx
import SpecularButton from './SpecularButton';

<SpecularButton
  size="lg"
  radius={18}
  tint="#ffffff"
  tintOpacity={0.04}
  textColor="#f5f5f5"
  lineColor="#ffffff"
  baseColor="#525252"
  intensity={1}
  idleIntensity={0.35}
  shineSize={10}
  shineFade={34}
  thickness={1.2}
  glow={1}
  followMouse
  proximity={250}
  onClick={() => console.log('clicked')}
>
  Get Started
</SpecularButton>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | 'Get Started' | Button label or any content. |
| size | 'sm' | 'md' | 'lg' | 'lg' | Padding and font size of the button. |
| radius | number | 18 | Corner radius in px. Values past half the height make a pill. |
| tint | string | '#ffffff' | Color of the glass body. |
| tintOpacity | number | 0.04 | How strongly the tint fills the body, from 0 for clear glass to 1 for a solid button. |
| blur | number | 0 | Blur of whatever sits behind the button, in px. |
| textColor | string | '#f5f5f5' | Color of the label. |
| lineColor | string | '#ffffff' | Color of the light on the edge. |
| baseColor | string | '#525252' | Color of the thin edge line that stays visible under the light. |
| intensity | number | 1 | Brightness of the light on the edge. |
| idleIntensity | number | 0.35 | How much of the light stays on when the cursor is away, from 0 to 1. |
| shineSize | number | 10 | How much of the edge the light covers at full strength, in degrees around the button. |
| shineFade | number | 34 | How far the light fades out past that, in degrees around the button. |
| thickness | number | 1.2 | Width of the lit edge in px. |
| glow | number | 1 | Soft light around the lit edge and inside the glass. 0 keeps only the crisp line. |
| followMouse | boolean | true | Moves the light to the part of the edge nearest the cursor. |
| proximity | number | 250 | Distance in px at which the light starts to follow the cursor and brighten. |
| autoAnimate | boolean | false | Keeps the light on and circling the edge whenever the cursor is away. |
| speed | number | 0.35 | How fast the light circles when autoAnimate is on. |
| disabled | boolean | false | Disables the button. |
| onClick | MouseEventHandler | - | Click handler. |
| type | 'button' | 'submit' | 'reset' | 'button' | Native button type. |
| className | string | '' | Extra class names for the button. |
| style | CSSProperties | - | Inline styles for the button. |

### Full Component Source
```jsx
'use client';

import { useEffect, useRef } from 'react';

import './SpecularButton.css';

const PAD = 24;
const TAU = Math.PI * 2;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform vec2 uWindow;
uniform float uThickness;
uniform float uGlow;
out vec4 outColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

const UNIFORMS = [
  'uCenter',
  'uHalf',
  'uRadius',
  'uPx',
  'uSpot',
  'uEntry',
  'uLineColor',
  'uBaseColor',
  'uIntensity',
  'uWindow',
  'uThickness',
  'uGlow'
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const wrap = value => value - Math.floor(value);

const loopPosition = (x, y, halfX, halfY, r) => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const qx = ax - innerX;
  const qy = ay - innerY;
  let s;
  if (qx > 0 && qy > 0) s = innerY + Math.atan2(qy, qx) * r;
  else if (qx > qy) s = Math.min(ay, innerY);
  else s = innerY + arc + innerX - Math.min(ax, innerX);
  if (x < 0) s = y >= 0 ? 2 * quarter - s : 2 * quarter + s;
  else if (y < 0) s = 4 * quarter - s;
  return wrap(s / Math.max(4 * quarter, 0.0001));
};

const rimPoint = (position, halfX, halfY, r) => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  let s = wrap(position) * 4 * quarter;
  let signX = 1;
  let signY = 1;
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
  let x = innerX - (s - innerY - arc);
  let y = halfY;
  if (s <= innerY) {
    x = halfX;
    y = s;
  } else if (s <= innerY + arc) {
    const angle = (s - innerY) / Math.max(r, 0.0001);
    x = innerX + Math.cos(angle) * r;
    y = innerY + Math.sin(angle) * r;
  }
  return [x * signX, y * signY];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = gl => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
};

const SpecularButton = ({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0.04,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  idleIntensity = 0.35,
  shineSize = 10,
  shineFade = 34,
  thickness = 1.2,
  glow = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  style,
  ...rest
}) => {
  const buttonRef = useRef(null);
  const canvasRef = useRef(null);
  const wakeRef = useRef(null);
  const settings = {
    radius: Math.max(0, radius),
    lineColor: String(lineColor),
    baseColor: String(baseColor),
    intensity: Math.max(0, intensity),
    idleIntensity: clamp(idleIntensity, 0, 1),
    shineSize: Math.max(0, shineSize),
    shineFade: Math.max(0, shineFade),
    thickness: Math.max(0, thickness),
    glow: Math.max(0, glow),
    speed,
    followMouse,
    proximity: Math.max(1, proximity),
    autoAnimate,
    disabled
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const button = buttonRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false
    });
    if (!button || !canvas || !gl) return undefined;
    const program = link(gl);
    if (!program) return undefined;
    const uniforms = {};
    for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(program, name);
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const colors = new Map();
    const view = { width: 1, height: 1, ratio: 1 };
    const pointer = { x: 0, y: 0, known: false };
    const state = { spot: 0, level: 0, press: 0, ready: false };
    let raf = 0;
    let last = 0;
    let visible = true;

    const toRgb = value => {
      if (colors.has(value)) return colors.get(value);
      let rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000000';
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      colors.set(value, rgb);
      return rgb;
    };

    const cornerRadius = s => Math.min(s.radius, view.width / 2, view.height / 2);

    const restSpot = s => {
      const r = cornerRadius(s);
      const inset = r * (1 - Math.SQRT1_2);
      return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, r);
    };

    const aim = s => {
      if (!s.followMouse || s.disabled || !pointer.known) return null;
      const rect = button.getBoundingClientRect();
      const scale = rect.width / view.width || 1;
      const halfX = view.width / 2;
      const halfY = view.height / 2;
      const x = (pointer.x - rect.left - rect.width / 2) / scale;
      const y = (rect.top + rect.height / 2 - pointer.y) / scale;
      const distance = Math.hypot(Math.max(Math.abs(x) - halfX, 0), Math.max(Math.abs(y) - halfY, 0));
      const t = clamp(1 - distance / s.proximity, 0, 1);
      const near = t * t * (3 - 2 * t);
      const nearest = loopPosition(x, y, halfX, halfY, cornerRadius(s));
      if (distance > 0) return { spot: nearest, near };
      const depth = clamp(Math.min(halfX - Math.abs(x), halfY - Math.abs(y)) / (halfY * 0.8), 0, 1);
      const sway = restSpot(s) - (x / halfX) * 0.06 - (y / halfY) * 0.02;
      const offset = sway - nearest - Math.round(sway - nearest);
      return { spot: wrap(nearest + offset * depth * depth * (3 - 2 * depth)), near };
    };

    const draw = s => {
      const { width, height } = view;
      const scaleX = canvas.width / (width + PAD * 2);
      const scaleY = canvas.height / (height + PAD * 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uCenter, (PAD + width / 2) * scaleX, (PAD + height / 2) * scaleY);
      gl.uniform2f(uniforms.uHalf, (width / 2) * scaleX, (height / 2) * scaleY);
      gl.uniform1f(uniforms.uRadius, Math.min(s.radius, width / 2, height / 2) * scaleX);
      gl.uniform1f(uniforms.uPx, view.ratio);
      const r = Math.min(s.radius, width / 2, height / 2);
      const [rimX, rimY] = rimPoint(state.spot, width / 2, height / 2, r);
      const pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rimX, rimY)) / Math.max(Math.hypot(rimX, rimY), 0.0001);
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

    const frame = now => {
      raf = 0;
      if (!visible) return;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = aim(s);
      const spinning = s.autoAnimate && !reduce;
      const steering = !!target && target.near > 0;
      if (!state.ready) {
        state.spot = restSpot(s);
        state.level = s.autoAnimate ? 1 : s.idleIntensity;
        state.ready = true;
      }
      let diff = 0;
      if (spinning && !steering) state.spot = wrap(state.spot + (s.speed / TAU) * dt);
      else {
        diff = (steering ? target.spot : restSpot(s)) - state.spot;
        diff -= Math.round(diff);
        state.spot = wrap(state.spot + diff * (1 - Math.exp(-dt * 8)));
      }
      const level = s.autoAnimate ? 1 : s.idleIntensity + (1 - s.idleIntensity) * (target ? target.near : 0);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 7));
      state.press *= Math.exp(-dt * 5);
      draw(s);
      const settling = Math.abs(diff) > 0.0002 || Math.abs(level - state.level) > 0.001 || state.press > 0.002;
      if (settling || (spinning && !steering)) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    const measure = entry => {
      const box = entry?.borderBoxSize?.[0];
      view.width = Math.max(1, box ? box.inlineSize : button.offsetWidth);
      view.height = Math.max(1, box ? box.blockSize : button.offsetHeight);
      view.ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
      canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
      if (state.ready) draw(settingsRef.current);
      wake();
    };

    const onPointerMove = event => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      wake();
    };

    const onPointerDown = event => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      if (!settingsRef.current.disabled) state.press = 1;
      wake();
    };

    const onPointerEnd = event => {
      if (event.pointerType === 'mouse') return;
      pointer.known = false;
      wake();
    };

    const onPointerLeave = () => {
      pointer.known = false;
      wake();
    };

    const resizeObserver = new ResizeObserver(entries => measure(entries[entries.length - 1]));
    resizeObserver.observe(button);
    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(button);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerEnd, { passive: true });
    window.addEventListener('pointercancel', onPointerEnd, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    button.addEventListener('pointerdown', onPointerDown);
    measure();
    wakeRef.current = wake;

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      button.removeEventListener('pointerdown', onPointerDown);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={{
        '--sb-radius': `${radius}px`,
        '--sb-tint': tint,
        '--sb-tint-opacity': tintOpacity,
        '--sb-blur': `${blur}px`,
        '--sb-text-color': textColor,
        ...style
      }}
      {...rest}
    >
      <canvas ref={canvasRef} className="specular-button__light" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
};

export default SpecularButton;

```

### Component CSS
```css
.specular-button {
  --sb-radius: 18px;
  --sb-tint: #ffffff;
  --sb-tint-opacity: 0.04;
  --sb-blur: 0px;
  --sb-text-color: #f5f5f5;

  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  margin: 0;
  border: 0;
  border-radius: var(--sb-radius);
  font: inherit;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--sb-text-color);
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent);
  box-shadow: 0 10px 24px -14px rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(var(--sb-blur));
  backdrop-filter: blur(var(--sb-blur));
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.specular-button:active {
  transform: scale(0.97);
}

.specular-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--sb-text-color) 55%, transparent);
  outline-offset: 3px;
}

.specular-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.specular-button:disabled:active {
  transform: none;
}

.specular-button--sm {
  padding: 10px 20px;
  font-size: 0.875rem;
}

.specular-button--md {
  padding: 14px 28px;
  font-size: 1rem;
}

.specular-button--lg {
  padding: 18px 38px;
  font-size: 1.125rem;
}

.specular-button__light {
  position: absolute;
  inset: -24px;
  z-index: 1;
  display: block;
  width: calc(100% + 48px);
  height: calc(100% + 48px);
  pointer-events: none;
}

.specular-button__label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: inherit;
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.



esse:

## Integrate the <SpotlightCard /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: SpotlightCard
### Variant: JavaScript + CSS


---

### Usage Example
```jsx
import SpotlightCard from './SpotlightCard';

<SpotlightCard
  theme="dark"
  spotlightColor="#ffffff"
  intensity={0.15}
  spotlightSize={240}
  softness={0.7}
  shape="circle"
  borderGlow={0.6}
  proximity={80}
  smoothing={0.3}
  grain={0}
  ambient={false}
  flare
>
  <h3>Ethan Harrison</h3>
  <p>Product designer</p>
  <button>Get in touch</button>
</SpotlightCard>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | - | Content of the card. |
| spotlightColor | string | undefined | Color of the light. Any CSS color works and its alpha is respected. Defaults to white on dark cards and near black on light ones. |
| intensity | number | 0.15 | Brightness of the light on the card surface, from 0 to 1. |
| spotlightSize | number | 240 | Radius of the light in px. |
| softness | number | 0.7 | How gradually the light fades out. 0 gives a crisp disc, 1 a soft glow that fades from the center. |
| shape | 'circle' | 'beam' | 'circle' | Circle is a round spotlight around the pointer. Beam pours light down from the top edge toward it, like a stage light. |
| borderGlow | number | 0.6 | How much the card edge catches the light near the pointer, from 0 to 1. |
| proximity | number | 80 | Distance in px outside the card at which the light starts to reach it. Cards placed together share one light this way. 0 lights a card only while hovered. |
| smoothing | number | 0.3 | How far the light floats behind the pointer. 0 sticks to it. |
| ambient | boolean | false | Lets the light drift slowly across the card while nothing points at it, which keeps cards alive on touch screens. |
| flare | boolean | true | The light swells and brightens while the card is pressed. |
| grain | number | 0 | Film grain inside the light, from 0 to 1. A little removes banding from large soft gradients. |
| theme | 'dark' | 'light' | 'dark' | Surface, border and light treatment for dark or light pages. Override the colors with the --spotlight-card-surface and --spotlight-card-border CSS variables. |
| className | string | '' | Extra class names for the card. |
| style | CSSProperties | - | Inline styles for the card. |
| ...rest | HTMLAttributes<HTMLDivElement> | - | Any other div props, such as onClick, id or aria attributes, are passed to the card. |

### Full Component Source
```jsx
'use client';

import { useEffect, useRef } from 'react';

import './SpotlightCard.css';

const THEMES = {
  dark: {
    surface: '#111111',
    border: 'rgba(255, 255, 255, 0.08)',
    shadow: '0 24px 48px -24px rgba(0, 0, 0, 0.6)',
    light: '#ffffff',
    fill: 1,
    edge: 1
  },
  light: {
    surface: '#ffffff',
    border: 'rgba(24, 24, 27, 0.1)',
    shadow: '0 1px 2px rgba(24, 24, 27, 0.04), 0 18px 40px -20px rgba(24, 24, 27, 0.16)',
    light: '#18181b',
    fill: 0.28,
    edge: 0.7
  }
};

const SHAPES = ['circle', 'beam'];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const falloff = (color, softness) => {
  const soft = clamp(softness, 0, 1);
  const core = (1 - soft) ** 1.5 * 0.85;
  const stop = (alpha, at) =>
    `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(2)}%, transparent) ${(at * 100).toFixed(2)}%`;
  const list = [stop(1, 0)];
  for (let i = 0; i <= 14; i++) {
    const t = core + ((1 - core) * i) / 14;
    const g = (t - core) / (1 - core);
    const smooth = 1 - g * g * (3 - 2 * g);
    const glow = Math.exp(-4.6 * g * g) * (1 - g ** 6);
    list.push(stop(smooth + (glow - smooth) * soft, t));
  }
  return list.join(', ');
};

const SpotlightCard = ({
  children,
  className = '',
  style,
  spotlightColor,
  intensity = 0.15,
  spotlightSize = 240,
  softness = 0.7,
  shape = 'circle',
  borderGlow = 0.6,
  proximity = 80,
  smoothing = 0.3,
  ambient = false,
  flare = true,
  grain = 0,
  theme = 'dark',
  ...rest
}) => {
  const rootRef = useRef(null);
  const lightRef = useRef(null);
  const grainRef = useRef(null);
  const edgeRef = useRef(null);
  const wakeRef = useRef(null);
  const palette = THEMES[theme] ?? THEMES.dark;
  const color = spotlightColor ?? palette.light;
  const form = SHAPES.includes(shape) ? shape : 'circle';
  const settings = {
    shape: form,
    fill: falloff(color, softness),
    edge: falloff(color, 1),
    size: Math.max(20, spotlightSize),
    intensity: clamp(intensity, 0, 1) * palette.fill,
    borderGlow: clamp(borderGlow, 0, 1) * palette.edge,
    proximity: Math.max(0, proximity),
    smoothing: clamp(smoothing, 0, 1),
    ambient,
    flare,
    grain: clamp(grain, 0, 1)
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    wakeRef.current?.();
  });

  useEffect(() => {
    const root = rootRef.current;
    const light = lightRef.current;
    const noise = grainRef.current;
    const edge = edgeRef.current;
    if (!root || !light || !noise || !edge) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const state = { x: 0, y: 0, presence: 0, flare: 0, time: Math.random() * 60, pressed: false, visible: true };
    const pointer = { x: 0, y: 0, active: false };
    const drawn = { light: '', edge: '', noise: '' };
    let focus = null;
    let raf = 0;
    let last = 0;
    let alive = true;

    const gradient = (s, size, x, y, stops) => {
      if (s.shape === 'beam') {
        const reach = Math.max(size * 0.6, y + size * 0.55);
        return `radial-gradient(${(size * 0.55).toFixed(1)}px ${reach.toFixed(1)}px at ${x.toFixed(1)}px 0px, ${stops})`;
      }
      return `radial-gradient(circle ${size.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, ${stops})`;
    };

    const paint = s => {
      const size = s.size * (1 + 0.2 * state.flare);
      const boost = 1 + 0.7 * state.flare;
      const fill = gradient(s, size, state.x, state.y, s.fill);
      const rim = gradient(s, size * 0.6, state.x, s.shape === 'beam' ? 0 : state.y, s.edge);
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
      const grainy = s.grain > 0 ? gradient(s, size, state.x, state.y, '#000 0%, transparent 100%') : 'none';
      if (grainy !== drawn.noise) {
        drawn.noise = grainy;
        noise.style.webkitMaskImage = grainy;
        noise.style.maskImage = grainy;
      }
      noise.style.opacity = String(state.presence * s.grain);
    };

    const tick = now => {
      raf = 0;
      if (!alive) return;
      const s = settingsRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const rect = root.getBoundingClientRect();
      let tx = state.x;
      let ty = state.y;
      let target = 0;
      if (focus && root.contains(focus)) {
        const box = focus.getBoundingClientRect();
        tx = box.left + box.width / 2 - rect.left;
        ty = box.top + box.height / 2 - rect.top;
        target = 1;
      } else if (pointer.active) {
        tx = pointer.x - rect.left;
        ty = pointer.y - rect.top;
        const gap = Math.hypot(Math.max(0, -tx, tx - rect.width), Math.max(0, -ty, ty - rect.height));
        if (gap === 0) target = 1;
        else if (s.proximity > 0) target = Math.max(0, 1 - gap / s.proximity) ** 2;
      }
      if (target < 0.6 && s.ambient && state.visible) {
        if (!reduce) state.time += dt;
        const drift = 0.6 - target;
        tx += (rect.width * (0.5 + 0.34 * Math.sin(state.time * 0.43)) - tx) * (drift / 0.6);
        ty += (rect.height * (0.5 + 0.3 * Math.sin(state.time * 0.61 + 1.3)) - ty) * (drift / 0.6);
        target = 0.6;
      }
      if (state.presence < 0.02 && target > 0 && !s.ambient) {
        state.x = tx;
        state.y = ty;
      }
      const follow = reduce || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (0.015 + s.smoothing * 0.22));
      state.x += (tx - state.x) * follow;
      state.y += (ty - state.y) * follow;
      const fade = reduce ? 1 : 1 - Math.exp(-dt / (target > state.presence ? 0.1 : 0.32));
      state.presence += (target - state.presence) * fade;
      if (Math.abs(target - state.presence) < 0.002) state.presence = target;
      const press = state.pressed && s.flare && !reduce ? 1 : 0;
      state.flare += (press - state.flare) * (1 - Math.exp(-dt / (press ? 0.05 : 0.28)));
      if (Math.abs(press - state.flare) < 0.002) state.flare = press;
      paint(s);
      const moving = Math.abs(tx - state.x) > 0.1 || Math.abs(ty - state.y) > 0.1;
      const settled = !moving && state.presence === target && state.flare === press;
      if (!settled || (s.ambient && state.visible && !reduce)) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const onMove = event => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      if (state.presence > 0 || settingsRef.current.proximity > 0 || root.contains(event.target)) wake();
    };
    const onOut = event => {
      if (event.relatedTarget) return;
      pointer.active = false;
      wake();
    };
    const onDown = event => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      state.pressed = true;
      wake();
    };
    const onUp = event => {
      if (event.pointerType !== 'mouse') pointer.active = false;
      if (!state.pressed && event.pointerType === 'mouse') return;
      state.pressed = false;
      wake();
    };
    const onFocusIn = event => {
      if (!(event.target instanceof Element) || !event.target.matches(':focus-visible')) return;
      focus = event.target;
      wake();
    };
    const onFocusOut = event => {
      if (root.contains(event.relatedTarget)) return;
      focus = null;
      wake();
    };
    const onScroll = () => {
      if (pointer.active || state.presence > 0) wake();
    };

    const observer = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      if (state.visible) wake();
    });
    observer.observe(root);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('pointerout', onOut);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    wake();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('pointerout', onOut);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      wakeRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`spotlight-card${className ? ` ${className}` : ''}`}
      style={{
        '--spotlight-card-surface': palette.surface,
        '--spotlight-card-border': palette.border,
        '--spotlight-card-shadow': palette.shadow,
        ...style
      }}
      {...rest}
    >
      <span ref={lightRef} className="spotlight-card__light" aria-hidden="true" />
      <span ref={grainRef} className="spotlight-card__grain" style={{ backgroundImage: NOISE }} aria-hidden="true" />
      {children}
      <span className="spotlight-card__border" aria-hidden="true" />
      <span ref={edgeRef} className="spotlight-card__edge" aria-hidden="true" />
    </div>
  );
};

export default SpotlightCard;

```

### Component CSS
```css
.spotlight-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 2rem;
  border-radius: 1.5rem;
  background-color: var(--spotlight-card-surface);
  box-shadow: var(--spotlight-card-shadow);
}

.spotlight-card__light,
.spotlight-card__grain,
.spotlight-card__border,
.spotlight-card__edge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.spotlight-card__light,
.spotlight-card__grain {
  z-index: -1;
  opacity: 0;
}

.spotlight-card__grain {
  background-size: 160px 160px;
  mix-blend-mode: overlay;
}

.spotlight-card__border,
.spotlight-card__edge {
  z-index: 1;
  padding: 1px;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box exclude,
    linear-gradient(#000 0 0);
}

.spotlight-card__border {
  background: var(--spotlight-card-border);
}

.spotlight-card__edge {
  opacity: 0;
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.



MT IMPORTANTE , na aba inicio voce deve colocar a imagem "png1.png" centralizado na tela somente isso . tem que tirar tambem as seguintes coisas " Detalhista

Higiênica

Pontual

Criativa

Caprichosa

28 anos de experiencia 
100+ clientes atendidas 


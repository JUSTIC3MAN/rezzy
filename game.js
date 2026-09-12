'use strict';

/* ════════════════════════════════════════════════════════════════════════════
   Rezzy — canvas game

   Rendering model
   ---------------
   All game logic and draw calls use a fixed 1920x1080 coordinate space. The
   canvas backing store is sized to the *actual* device pixels needed (see
   applyRenderScale) and the context carries a matching transform, so on a small
   or low-DPI screen we do proportionally less pixel work for identical output.

   Anything that doesn't change frame to frame is pre-rendered ("baked") into an
   offscreen canvas at exact device-pixel size, so the per-frame draw is a 1:1
   blit with no resampling. Bakes happen once at startup and again on resize.
   ════════════════════════════════════════════════════════════════════════════ */

// ─── Canvas & coordinate space ──────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const bgVideo = document.getElementById('bg-video');

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

// Backing store is clamped to this multiple of the 1920x1080 design size.
// 1.0 keeps the current quality ceiling; raise for sharper output on high-DPI
// displays at the cost of fill rate.
const MAX_RENDER_SCALE = 1.0;
const MIN_RENDER_SCALE = 0.5;

let renderScale = 1;
let renderScaleInitialized = false;

/** Snap a game-space coordinate to the device pixel grid (keeps blits crisp).
 *  At renderScale === 1 this is exactly Math.floor(v), matching the original. */
function snap(v) {
    return Math.floor(v * renderScale) / renderScale;
}

// ─── Tunables ───────────────────────────────────────────────────────────────
const STATIC_BOTTLE_BRIGHTNESS = '70%';
const ARROW_SIZE = 400;       // arrow height in game px
const ARROW_H_PAD = -160;     // horizontal padding (negative = pushed outward)
const ARROW_V_PAD = -10;      // vertical padding
const ARROW_BRIGHTNESS = '200%';
const ARROW_GLOW_BLUR = 10;   // glow radius in game px (scaled at bake time)
const ARROW_GLOW_COLOR = 'rgba(255,255,255,0.5)';
const ARROW_BAKE_PAD = 24;    // padding around the baked arrow so glow isn't clipped
// Resampling quality used when pre-rendering art to its on-screen size.
// 'low' reproduces the original look exactly; 'high' is smoother but softer.
const BAKE_SMOOTHING = 'low';
// brightness(60%) of #39FF14 baked to a flat colour: (57,255,20) * 0.6 = (34,153,12)
const STREAK_COLOR = '#22990C';
const VICTORY_COLOR = '#39FF14';

const STREAK_X = 140;
const STREAK_Y = 200;
const STREAK_LINE_SPACING = 100;
const STREAK_LABEL_SIZE = 100;
const STREAK_VALUE_SIZE = 180;
const TEXT_BAKE_PAD = 24;

const BOTTLE_SCALE = 0.47;
const BOTTLE_Y = GAME_HEIGHT * 0.85;

const BUBBLE_HEIGHT_FRAC = 0.22;   // of GAME_HEIGHT
const BUBBLE_CENTER_Y = GAME_HEIGHT * 0.515 - 220;
const BUBBLE_ITEM_HEIGHT_FRAC = 0.5;   // of bubble height
const BUBBLE_ITEM_CENTER_FRAC = 0.38;  // of bubble height, from bubble top
const CUSTOMER_OFFSETS = [0.35, 0.47, 0.58, 0.70, 0.82];

const REZZY_HEIGHT_FRAC = 0.70;    // of GAME_HEIGHT
const ITEM_SPRITE_HEIGHT_FRAC = 0.40;
const ITEM_SPRITE_OFFSET_Y = 250;

const PROGRESS_BAR_SCALE = 0.65;
const PROGRESS_BAR_Y = 20;
// The green fill inside progressbarfilled.png spans x=433..1233 of 1672px.
const PROGRESS_GREEN_START = 433 / 1672;
const PROGRESS_GREEN_WIDTH = 800 / 1672;

const CUSTOMER_COUNT = 5;
const ELF_CUSTOMER_INDEX = 2;   // the Elf never orders the Mermaid Lagoon
const LAGOON_ITEM_INDEX = 3;

const BG_LEVEL1 = 'backgroundloop/newbackground.webm';
const BG_LEVEL2 = 'backgroundloop/Level2Background.webm';
const CUTSCENES = [null, 'backgroundloop/cutscene1.webm',
                         'backgroundloop/cutscene2.webm',
                         'backgroundloop/cutscene3.webm'];

// ─── Item definitions ───────────────────────────────────────────────────────
// Each of the four items has a counter bottle, an order icon, and a burst
// animation. Previously these were four near-identical copies of every block.
const ITEM_SPRITE_SIZE = 160;   // frame is 160x160 in an 800px-wide sheet
const ITEM_SPRITE_COLS = 5;
const ITEM_SPRITE_DELAY = 4;
// Timer increment per tick. 1.0 is the sprite sheet's native rate; 1.25 was the
// previous "+25%", and 1.625 is a further 30% on top of that.
const ITEM_SPRITE_STEP = 1.625;

const ITEMS = [
    { bottleSrc: 'Items/FairyInBottle.png', sheetSrc: 'Items/FairyInBottleSprite.png', frames: 81 },
    { bottleSrc: 'Items/BlueLightning.png', sheetSrc: 'Items/BlueLightningSprite.png', frames: 51 },
    { bottleSrc: 'Items/RedWhiteBoom.png',  sheetSrc: 'Items/RedWhiteBoomSprite.png',  frames: 81 },
    { bottleSrc: 'Items/MermaidLagoon.png', sheetSrc: 'Items/MermaidLagoonSprite.png', frames: 66 },
];
const ITEM_COUNT = ITEMS.length;

const slotPositions = [
    GAME_WIDTH * 0.25,
    GAME_WIDTH * 0.40,
    GAME_WIDTH * 0.55,
    GAME_WIDTH * 0.70,
];

// ─── Asset loading ──────────────────────────────────────────────────────────
function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

const spriteImage = loadImage('RezzySpriteSheet/Idle_Rezzy.png');
const grabImage = loadImage('RezzySpriteSheet/Grab_Rezzy.png');
const thoughtBubbleImage = loadImage('Items/thoughtbubble.png');
const progressBarImage = loadImage('Items/progressbar.png');
const progressBarFilledImage = loadImage('Items/progressbarfilled.png');
const arrowImage = loadImage('Items/arrow.png');

ITEMS.forEach(item => {
    item.bottleImage = loadImage(item.bottleSrc);
    item.sheetImage = loadImage(item.sheetSrc);
    item.playing = false;
    item.frame = 0;
    item.timer = 0;
});

const criticalImages = [
    spriteImage, grabImage, thoughtBubbleImage,
    progressBarImage, progressBarFilledImage, arrowImage,
    ...ITEMS.map(i => i.bottleImage),
];

function isReady(img) {
    return img.complete && img.naturalWidth > 0;
}

// ─── Font ───────────────────────────────────────────────────────────────────
let fontReady = false;
const bangersFont = new FontFace('Bangers', 'url(font/Bangers/Bangers-Regular.ttf)');
bangersFont.load().then(font => {
    document.fonts.add(font);
    fontReady = true;
    // Text bakes made before the font arrived used a fallback face — drop them.
    baked.streak = null;
    baked.victory = null;
}).catch(() => { /* keep playing without the custom face */ });

// ─── Sprite sheet geometry ──────────────────────────────────────────────────
// Sheet heights (1954, 1598) are not evenly divisible by their row counts
// (11, 9), so frame height MUST stay a float — flooring accumulates source-Y
// error that shows up as vertical drift during the animation.
const COLS = 5;
const ROWS = 11;
const TOTAL_FRAMES = 52;
let FRAME_WIDTH = 320;
let FRAME_HEIGHT = 178;

const GRAB_COLS = 5;
const GRAB_ROWS = 9;
const GRAB_TOTAL_FRAMES = 43;   // 9 rows, stopping before the trailing empty frames
let GRAB_FRAME_HEIGHT = 1598 / 9;

const frameDelay = 8;
const grabFrameDelay = 4;
const grabOffsetX = 0;
const grabOffsetY = 0;

// ─── Game state ─────────────────────────────────────────────────────────────
let currentProgressBarFill = 0;
let totalCorrectOrders = 0;
let currentLevel = 1;
let maxOrdersForLevel = 10;     // 10 for levels 1-3, 15 after
let isVictoryState = false;
let isCutscenePlaying = false;
let isModalOpen = false;

let currentSlot = 0;
let characterX = slotPositions[currentSlot];
let targetX = characterX;
const characterY = GAME_HEIGHT * 0.58;
const speed = 12;
let freezeTimer = 0;

let currentStreak = 0;
let nextCustomerIndex = 1;
let activeOrders = [
    { customerIndex: 0, itemIndex: randomItemIndex(), revealProgress: 0 }
];

let currentFrame = 0;
let frameTimer = 0;
let isGrabbing = false;
let currentGrabFrame = 0;
let grabFrameTimer = 0;

let victoryTimeoutId = null;

function randomItemIndex() {
    return Math.floor(Math.random() * ITEM_COUNT);
}

/** Push the next customer's order. `exclude` blocks a specific item index
 *  (used so a fulfilled order isn't immediately repeated); pass -1 for none. */
function pushNewOrder(exclude) {
    let idx = randomItemIndex();
    while (idx === exclude ||
           (nextCustomerIndex === ELF_CUSTOMER_INDEX && idx === LAGOON_ITEM_INDEX)) {
        idx = randomItemIndex();
    }
    activeOrders.push({ customerIndex: nextCustomerIndex, itemIndex: idx, revealProgress: 0 });
    nextCustomerIndex = (nextCustomerIndex + 1) % CUSTOMER_COUNT;
}

// ═══ Baked assets ═══════════════════════════════════════════════════════════
// Every entry is { c: HTMLCanvasElement, w, h } where w/h are in GAME units but
// derived from a whole number of device pixels, so drawing at that size is an
// exact 1:1 blit.

const baked = {
    bottles: [],        // counter bottles, brightness pre-applied
    orderIcons: [],     // full-colour item at thought-bubble size
    orderSilhouettes: [],
    bubble: null,
    progressBar: null,
    progressBarFilled: null,
    arrow: null,
    streak: null,       // { c, w, h, x, y, value }
    victory: null,      // { c, w, h, x, y, level }
};

const measureCtx = document.createElement('canvas').getContext('2d');

/**
 * Render `source` into an offscreen canvas at exactly gameW x gameH game units.
 *
 * `filterAtNative` matters more than it looks. Chrome picks a different
 * resampling filter for <img> sources than for <canvas> sources, so where the
 * original applied a filter at full resolution and downscaled the *canvas* at
 * draw time, we must do the same two stages here — downscaling straight from
 * the image instead produces a visibly softer result. Verified by pixel-diffing
 * against the pre-refactor renderer.
 */
function bakeToSize(source, gameW, gameH, filter, filterAtNative) {
    const dw = Math.max(1, Math.round(gameW * renderScale));
    const dh = Math.max(1, Math.round(gameH * renderScale));

    let src = source;
    let downscaleFilter = filter;

    if (filter && filterAtNative) {
        const nat = document.createElement('canvas');
        nat.width = source.naturalWidth;
        nat.height = source.naturalHeight;
        const ncx = nat.getContext('2d');
        ncx.filter = filter;
        ncx.drawImage(source, 0, 0);
        src = nat;
        downscaleFilter = null;
    }

    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = BAKE_SMOOTHING;
    if (downscaleFilter) cx.filter = downscaleFilter;
    cx.drawImage(src, 0, 0, dw, dh);
    return { c, w: dw / renderScale, h: dh / renderScale };
}

function bakeArrow() {
    if (!isReady(arrowImage)) return null;
    const gh = ARROW_SIZE;
    const gw = ARROW_SIZE * (arrowImage.naturalWidth / arrowImage.naturalHeight);
    const dw = Math.round(gw * renderScale);
    const dh = Math.round(gh * renderScale);
    const padDev = Math.round(ARROW_BAKE_PAD * renderScale);

    const c = document.createElement('canvas');
    c.width = dw + padDev * 2;
    c.height = dh + padDev * 2;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = BAKE_SMOOTHING;
    cx.filter = `brightness(${ARROW_BRIGHTNESS}) drop-shadow(0px 0px ` +
                `${ARROW_GLOW_BLUR * renderScale}px ${ARROW_GLOW_COLOR})`;
    cx.drawImage(arrowImage, padDev, padDev, dw, dh);

    return {
        c,
        w: dw / renderScale,
        h: dh / renderScale,
        pad: padDev / renderScale,
        drawW: c.width / renderScale,
        drawH: c.height / renderScale,
    };
}

function buildBakedAssets() {
    // Counter bottles
    baked.bottles = ITEMS.map(item => {
        if (!isReady(item.bottleImage)) return null;
        const w = item.bottleImage.naturalWidth * BOTTLE_SCALE;
        const h = item.bottleImage.naturalHeight * BOTTLE_SCALE;
        return bakeToSize(item.bottleImage, w, h, `brightness(${STATIC_BOTTLE_BRIGHTNESS})`, true);
    });

    // Thought bubble + the order icons that sit inside it
    if (isReady(thoughtBubbleImage)) {
        const bh = GAME_HEIGHT * BUBBLE_HEIGHT_FRAC;
        const bw = thoughtBubbleImage.naturalWidth * (bh / thoughtBubbleImage.naturalHeight);
        baked.bubble = bakeToSize(thoughtBubbleImage, bw, bh);

        const iconH = bh * BUBBLE_ITEM_HEIGHT_FRAC;
        baked.orderIcons = ITEMS.map(item => {
            if (!isReady(item.bottleImage)) return null;
            const s = iconH / item.bottleImage.naturalHeight;
            return bakeToSize(item.bottleImage, item.bottleImage.naturalWidth * s, iconH);
        });
        baked.orderSilhouettes = ITEMS.map(item => {
            if (!isReady(item.bottleImage)) return null;
            const s = iconH / item.bottleImage.naturalHeight;
            return bakeToSize(item.bottleImage, item.bottleImage.naturalWidth * s, iconH, 'brightness(0)', true);
        });
    }

    // Progress bar (both states pre-scaled to their on-screen size)
    if (isReady(progressBarImage)) {
        baked.progressBar = bakeToSize(
            progressBarImage,
            progressBarImage.naturalWidth * PROGRESS_BAR_SCALE,
            progressBarImage.naturalHeight * PROGRESS_BAR_SCALE);
    }
    if (isReady(progressBarFilledImage)) {
        baked.progressBarFilled = bakeToSize(
            progressBarFilledImage,
            progressBarFilledImage.naturalWidth * PROGRESS_BAR_SCALE,
            progressBarFilledImage.naturalHeight * PROGRESS_BAR_SCALE);
    }

    baked.arrow = bakeArrow();

    // Text caches depend on renderScale, so drop them too.
    baked.streak = null;
    baked.victory = null;
}

/** Bake the two-line streak readout. Re-run only when the number changes. */
function bakeStreakText(value) {
    const label = 'Streak';
    const number = `X  ${value}`;

    measureCtx.font = `${STREAK_LABEL_SIZE}px Bangers`;
    const labelW = measureCtx.measureText(label).width;
    measureCtx.font = `${STREAK_VALUE_SIZE}px Bangers`;
    const numberW = measureCtx.measureText(number).width;

    // textBaseline 'top' + a generous descender allowance for the display face.
    const boxW = Math.max(labelW, numberW) + TEXT_BAKE_PAD * 2;
    const boxH = STREAK_LINE_SPACING + STREAK_VALUE_SIZE * 1.4 + TEXT_BAKE_PAD * 2;

    const dw = Math.max(1, Math.ceil(boxW * renderScale));
    const dh = Math.max(1, Math.ceil(boxH * renderScale));
    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;

    const cx = c.getContext('2d');
    cx.scale(renderScale, renderScale);
    cx.fillStyle = STREAK_COLOR;
    cx.strokeStyle = '#000000';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.lineJoin = 'round';   // avoids spikes where thick strokes meet

    cx.font = `${STREAK_LABEL_SIZE}px Bangers`;
    cx.lineWidth = 6;
    cx.strokeText(label, TEXT_BAKE_PAD, TEXT_BAKE_PAD);
    cx.fillText(label, TEXT_BAKE_PAD, TEXT_BAKE_PAD);

    cx.font = `${STREAK_VALUE_SIZE}px Bangers`;
    cx.lineWidth = 10;
    cx.strokeText(number, TEXT_BAKE_PAD, TEXT_BAKE_PAD + STREAK_LINE_SPACING);
    cx.fillText(number, TEXT_BAKE_PAD, TEXT_BAKE_PAD + STREAK_LINE_SPACING);

    return {
        c,
        w: dw / renderScale,
        h: dh / renderScale,
        x: STREAK_X - TEXT_BAKE_PAD,
        y: STREAK_Y - TEXT_BAKE_PAD,
        value,
    };
}

function bakeVictoryText(level) {
    const text = `Level ${level} Complete`;
    const size = 150;

    measureCtx.font = `${size}px Bangers`;
    const boxW = measureCtx.measureText(text).width + TEXT_BAKE_PAD * 2;
    const boxH = size * 1.6 + TEXT_BAKE_PAD * 2;

    const dw = Math.max(1, Math.ceil(boxW * renderScale));
    const dh = Math.max(1, Math.ceil(boxH * renderScale));
    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;

    const cx = c.getContext('2d');
    cx.scale(renderScale, renderScale);
    cx.fillStyle = VICTORY_COLOR;
    cx.strokeStyle = '#000000';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.lineJoin = 'round';
    cx.font = `${size}px Bangers`;
    cx.lineWidth = 10;
    cx.strokeText(text, boxW / 2, boxH / 2);
    cx.fillText(text, boxW / 2, boxH / 2);

    return {
        c,
        w: dw / renderScale,
        h: dh / renderScale,
        x: GAME_WIDTH / 2 - boxW / 2,
        y: 350 - boxH / 2,
        level,
    };
}

// ═══ Resolution handling ════════════════════════════════════════════════════
function applyRenderScale() {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || window.innerWidth || GAME_WIDTH;
    const dpr = window.devicePixelRatio || 1;

    const wanted = (cssWidth * dpr) / GAME_WIDTH;
    const next = Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, wanted));

    // Ignore sub-2% jitter (mobile browsers resize constantly as chrome hides),
    // but always run the first time so the backing store and transform get set.
    if (renderScaleInitialized && Math.abs(next - renderScale) < 0.02) return false;

    renderScaleInitialized = true;
    renderScale = next;
    canvas.width = Math.round(GAME_WIDTH * renderScale);
    canvas.height = Math.round(GAME_HEIGHT * renderScale);
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return true;
}

let resizeTimer = null;
function scheduleRescale() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (applyRenderScale() && gameLoopStarted) buildBakedAssets();
    }, 150);
}

// ResizeObserver catches every case that changes the canvas's layout size —
// including ones that never fire a window resize (container/CSS changes, some
// mobile rotations). The window listener stays for devicePixelRatio changes,
// e.g. dragging the window to a monitor with different scaling.
if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(scheduleRescale).observe(canvas);
}
window.addEventListener('resize', scheduleRescale);
window.addEventListener('orientationchange', scheduleRescale);

// ═══ Input ══════════════════════════════════════════════════════════════════
function inputLocked() {
    return freezeTimer > 0 || isVictoryState || isCutscenePlaying || isModalOpen;
}

function moveTo(slot) {
    if (slot < 0 || slot >= ITEM_COUNT || slot === currentSlot) return;
    currentSlot = slot;
    targetX = slotPositions[currentSlot];
    isGrabbing = false;
}

function executeGrabAction() {
    if (isGrabbing) return;

    freezeTimer = 20;   // ~1/3 s at 60Hz
    isGrabbing = true;
    currentGrabFrame = 0;
    grabFrameTimer = 0;

    // Fire the burst animation for whichever bottle we're standing at.
    const item = ITEMS[currentSlot];
    if (item) {
        item.playing = true;
        item.frame = 0;
        item.timer = 0;
    }

    if (activeOrders.length === 0) return;

    if (currentSlot === activeOrders[0].itemIndex) {
        currentStreak++;
        totalCorrectOrders++;
        activeOrders.shift();

        if (totalCorrectOrders >= maxOrdersForLevel) {
            isVictoryState = true;
            victoryTimeoutId = setTimeout(finishLevel, 3000);
        } else {
            pushNewOrder(currentSlot);
        }
    } else {
        if (currentStreak > 0) showNameEntryModal(currentStreak);
        currentStreak = 0;
    }
}

window.addEventListener('keydown', (e) => {
    if (inputLocked()) return;
    if (characterX !== targetX) return;   // mid-move
    if (e.repeat) return;                 // holding a key must not skip slots

    const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';

    if (e.code === 'Space' || key === ' ') {
        e.preventDefault();
        executeGrabAction();
    } else if (key === 'arrowleft' || key === 'a') {
        moveTo(currentSlot - 1);
    } else if (key === 'arrowright' || key === 'd') {
        moveTo(currentSlot + 1);
    }
});

window.addEventListener('pointerdown', (e) => {
    if (inputLocked()) return;
    if (characterX !== targetX) return;

    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) return;

    // Map screen coordinates into the 1920x1080 game space.
    const x = (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (GAME_HEIGHT / rect.height);

    if (x < GAME_WIDTH * 0.25 && y > GAME_HEIGHT * 0.70) {
        moveTo(currentSlot - 1);
    } else if (x > GAME_WIDTH * 0.75 && y > GAME_HEIGHT * 0.70) {
        moveTo(currentSlot + 1);
    } else if (x > GAME_WIDTH * 0.25 && x < GAME_WIDTH * 0.75 && y > GAME_HEIGHT * 0.40) {
        executeGrabAction();
    }
});

// ═══ Level flow ═════════════════════════════════════════════════════════════
function startNextLevel() {
    currentLevel++;
    maxOrdersForLevel = currentLevel <= 3 ? 10 : 15;
    totalCorrectOrders = 0;
    currentProgressBarFill = 0;
    isVictoryState = false;
    pushNewOrder(-1);
}

function finishLevel() {
    victoryTimeoutId = null;
    const cutsceneSrc = CUTSCENES[currentLevel] || null;

    if (!cutsceneSrc) {
        startNextLevel();
        return;
    }

    isCutscenePlaying = true;
    canvas.style.display = 'none';
    if (trophyBtn) trophyBtn.style.display = 'none';

    bgVideo.loop = false;
    bgVideo.src = cutsceneSrc;
    bgVideo.load();
    bgVideo.play().catch(() => {});

    bgVideo.onended = () => {
        bgVideo.onended = null;
        bgVideo.loop = true;
        bgVideo.src = BG_LEVEL2;
        bgVideo.load();
        bgVideo.play().catch(() => {});

        canvas.style.display = 'block';
        if (trophyBtn) trophyBtn.style.display = 'block';

        isCutscenePlaying = false;
        startNextLevel();
    };
}

// Pull the upcoming cutscene into cache once the player is most of the way
// through a level, so the transition doesn't stall on a 3-6 MB download.
let prefetchedCutscene = null;
function maybePrefetchCutscene() {
    const next = CUTSCENES[currentLevel];
    if (!next || prefetchedCutscene === next) return;
    if (currentProgressBarFill < 0.6) return;

    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;

    prefetchedCutscene = next;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = next;
    document.head.appendChild(link);
}

// ═══ Update ═════════════════════════════════════════════════════════════════
function update() {
    if (freezeTimer > 0) freezeTimer--;

    // Slide toward the target slot
    if (characterX < targetX) {
        characterX = Math.min(characterX + speed, targetX);
    } else if (characterX > targetX) {
        characterX = Math.max(characterX - speed, targetX);
    }

    // Progress bar easing (5% of remaining distance per tick). Snap once we're
    // within a pixel's worth — exponential easing never reaches 1.0 on its own,
    // which meant a "full" bar never showed its end-cap glow.
    const targetFill = Math.min(totalCorrectOrders / maxOrdersForLevel, 1);
    currentProgressBarFill += (targetFill - currentProgressBarFill) * 0.05;
    if (Math.abs(targetFill - currentProgressBarFill) < 0.001) {
        currentProgressBarFill = targetFill;
    }

    // Order reveal (~5 s at 60Hz)
    for (let i = 0; i < activeOrders.length; i++) {
        const order = activeOrders[i];
        if (order.revealProgress < 1) {
            order.revealProgress = Math.min(order.revealProgress + 1 / 300, 1);
        }
    }

    // Rezzy: idle and grab are mutually exclusive
    if (isGrabbing) {
        if (++grabFrameTimer >= grabFrameDelay) {
            grabFrameTimer = 0;
            if (++currentGrabFrame >= GRAB_TOTAL_FRAMES) {
                isGrabbing = false;
                currentGrabFrame = 0;
            }
        }
    } else if (++frameTimer >= frameDelay) {
        frameTimer = 0;
        currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
    }

    // Item burst animations (independent of each other)
    for (let i = 0; i < ITEM_COUNT; i++) {
        const item = ITEMS[i];
        if (!item.playing) continue;
        item.timer += ITEM_SPRITE_STEP;
        if (item.timer >= ITEM_SPRITE_DELAY) {
            item.timer -= ITEM_SPRITE_DELAY;   // keep remainder for smooth sub-frame timing
            if (++item.frame >= item.frames) {
                item.playing = false;
                item.frame = 0;
            }
        }
    }

    maybePrefetchCutscene();
}

// ═══ Draw ═══════════════════════════════════════════════════════════════════
function drawThoughtBubbles() {
    if (isVictoryState || !baked.bubble) return;

    const bubble = baked.bubble;
    const bubbleTop = BUBBLE_CENTER_Y - bubble.h / 2;

    for (let i = 0; i < activeOrders.length; i++) {
        const order = activeOrders[i];
        const charX = GAME_WIDTH * CUSTOMER_OFFSETS[order.customerIndex];

        ctx.drawImage(bubble.c, snap(charX - bubble.w / 2), snap(bubbleTop), bubble.w, bubble.h);

        const icon = baked.orderIcons[order.itemIndex];
        if (!icon) continue;

        const destX = snap(charX - icon.w / 2);
        const destY = snap(bubbleTop + bubble.h * BUBBLE_ITEM_CENTER_FRAC - icon.h / 2);
        const reveal = order.revealProgress;

        if (reveal >= 1) {
            ctx.drawImage(icon.c, destX, destY, icon.w, icon.h);
            continue;
        }

        // Silhouette, then wipe the real artwork upward from the base.
        const sil = baked.orderSilhouettes[order.itemIndex] || icon;
        ctx.drawImage(sil.c, destX, destY, icon.w, icon.h);

        if (reveal > 0) {
            const srcH = icon.c.height * reveal;
            const destH = icon.h * reveal;
            ctx.drawImage(
                icon.c,
                0, icon.c.height - srcH, icon.c.width, srcH,
                destX, destY + icon.h - destH, icon.w, destH
            );
        }
    }
}

function drawRezzy() {
    const image = isGrabbing ? grabImage : spriteImage;
    if (!isReady(image)) return;

    const frame = isGrabbing ? currentGrabFrame : currentFrame;
    const cols = isGrabbing ? GRAB_COLS : COLS;
    const frameH = isGrabbing ? GRAB_FRAME_HEIGHT : FRAME_HEIGHT;

    const scale = (GAME_HEIGHT * REZZY_HEIGHT_FRAC) / frameH;
    const w = FRAME_WIDTH * scale;
    const h = frameH * scale;
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    const offX = isGrabbing ? grabOffsetX : 0;
    const offY = isGrabbing ? grabOffsetY : 0;

    ctx.drawImage(
        image,
        col * FRAME_WIDTH, row * frameH, FRAME_WIDTH, frameH,
        snap(characterX - w / 2 + offX), snap(characterY - h / 2 + offY), w, h
    );
}

function drawCounterBottles() {
    for (let i = 0; i < ITEM_COUNT; i++) {
        const b = baked.bottles[i];
        if (!b) continue;
        // snap() as well as an exact size — a 1:1 blit at a fractional offset
        // still goes through the resampler and softens the art.
        ctx.drawImage(b.c, snap(slotPositions[i] - b.w / 2), snap(BOTTLE_Y - b.h / 2), b.w, b.h);
    }
}

function drawStreak() {
    if (!fontReady) return;
    if (!baked.streak || baked.streak.value !== currentStreak) {
        baked.streak = bakeStreakText(currentStreak);
    }
    const s = baked.streak;
    ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
}

function drawItemSprites() {
    const scale = (GAME_HEIGHT * ITEM_SPRITE_HEIGHT_FRAC) / ITEM_SPRITE_SIZE;
    const size = ITEM_SPRITE_SIZE * scale;
    const baseY = characterY - (GAME_HEIGHT * REZZY_HEIGHT_FRAC) / 2 - size + ITEM_SPRITE_OFFSET_Y;

    for (let i = 0; i < ITEM_COUNT; i++) {
        const item = ITEMS[i];
        if (!item.playing || !isReady(item.sheetImage)) continue;

        const col = item.frame % ITEM_SPRITE_COLS;
        const row = Math.floor(item.frame / ITEM_SPRITE_COLS);

        ctx.drawImage(
            item.sheetImage,
            col * ITEM_SPRITE_SIZE, row * ITEM_SPRITE_SIZE, ITEM_SPRITE_SIZE, ITEM_SPRITE_SIZE,
            snap(slotPositions[i] - size / 2), snap(baseY), size, size
        );
    }
}

function drawProgressBar() {
    const bar = baked.progressBar;
    const fill = baked.progressBarFilled;
    if (!bar || !fill) return;

    const x = snap((GAME_WIDTH - bar.w) / 2);
    ctx.drawImage(bar.c, x, PROGRESS_BAR_Y, bar.w, bar.h);

    if (currentProgressBarFill <= 0) return;

    // Reveal left-to-right. At full, show the whole image so the end glow lands.
    const frac = currentProgressBarFill >= 1
        ? 1
        : PROGRESS_GREEN_START + PROGRESS_GREEN_WIDTH * currentProgressBarFill;

    const srcW = fill.c.width * frac;
    const destW = fill.w * frac;
    ctx.drawImage(
        fill.c,
        0, 0, srcW, fill.c.height,
        x, PROGRESS_BAR_Y, destW, fill.h
    );
}

function drawVictory() {
    if (!isVictoryState || !fontReady) return;
    if (!baked.victory || baked.victory.level !== currentLevel) {
        baked.victory = bakeVictoryText(currentLevel);
    }
    const v = baked.victory;
    ctx.drawImage(v.c, v.x, v.y, v.w, v.h);
}

function drawArrows() {
    const a = baked.arrow;
    if (!a) return;

    // Right arrow
    const rx = GAME_WIDTH - ARROW_H_PAD - a.w;
    const ry = GAME_HEIGHT - ARROW_V_PAD - a.h;
    ctx.drawImage(a.c, snap(rx - a.pad), snap(ry - a.pad), a.drawW, a.drawH);

    // Left arrow, mirrored
    ctx.save();
    ctx.translate(ARROW_H_PAD + a.w / 2, GAME_HEIGHT - ARROW_V_PAD - a.h / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(a.c, -a.w / 2 - a.pad, -a.h / 2 - a.pad, a.drawW, a.drawH);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawThoughtBubbles();   // behind Rezzy
    drawRezzy();
    drawCounterBottles();   // counter occludes Rezzy's lower half
    drawStreak();
    drawItemSprites();
    drawProgressBar();
    drawVictory();
    drawArrows();
}

// ═══ Main loop ══════════════════════════════════════════════════════════════
// Fixed timestep: update() runs at a steady 60Hz regardless of refresh rate, so
// the game doesn't run ~2x fast on a 120/144Hz display. draw() runs per frame.
const FIXED_DT = 1000 / 60;
const MAX_STEPS = 5;
let lastTime = 0;
let accumulator = 0;

function gameLoop(now) {
    if (!lastTime) lastTime = now;
    let delta = now - lastTime;
    lastTime = now;
    if (delta > 250) delta = 250;   // clamp after a tab switch to avoid a spiral

    accumulator += delta;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
        update();
        accumulator -= FIXED_DT;
        steps++;
    }
    if (steps === MAX_STEPS) accumulator = 0;   // we're behind; drop the backlog

    draw();
    requestAnimationFrame(gameLoop);
}

// ═══ Startup ════════════════════════════════════════════════════════════════
let loadedCount = 0;
let gameLoopStarted = false;

function onCriticalImageSettled() {
    if (gameLoopStarted) return;
    if (++loadedCount < criticalImages.length) return;

    gameLoopStarted = true;

    // Exact (float) frame dimensions straight from the decoded pixels.
    if (spriteImage.naturalWidth > 0) {
        FRAME_WIDTH = spriteImage.naturalWidth / COLS;    // 1600/5 = 320
        FRAME_HEIGHT = spriteImage.naturalHeight / ROWS;  // 1954/11 = 177.63...
    }
    if (grabImage.naturalWidth > 0) {
        GRAB_FRAME_HEIGHT = grabImage.naturalHeight / GRAB_ROWS;   // 1598/9 = 177.55...
    }

    applyRenderScale();
    buildBakedAssets();
    requestAnimationFrame(gameLoop);
}

applyRenderScale();

criticalImages.forEach(img => {
    if (isReady(img)) {
        onCriticalImageSettled();
    } else {
        img.addEventListener('load', onCriticalImageSettled, { once: true });
        img.addEventListener('error', onCriticalImageSettled, { once: true });
    }
});

// ─── Mobile video unlock ────────────────────────────────────────────────────
// Mobile Safari blocks autoplay; show a tap prompt only if playback never began.
bgVideo.play().catch(() => {});

setTimeout(() => {
    if (!bgVideo.paused) return;

    const overlay = document.createElement('div');
    overlay.id = 'tap-overlay';
    const hint = document.createElement('div');
    hint.id = 'tap-hint';
    hint.textContent = '▶  Tap to begin';

    document.body.appendChild(overlay);
    document.body.appendChild(hint);

    overlay.addEventListener('pointerdown', () => {
        bgVideo.play().catch(() => {});
        overlay.remove();
        hint.remove();
    }, { once: true });
}, 1200);

// ═══ Leaderboard & modals ═══════════════════════════════════════════════════
const trophyBtn = document.getElementById('trophy-btn');
const nameModal = document.getElementById('name-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipScoreBtn = document.getElementById('skip-score-btn');
const playerNameInput = document.getElementById('player-name');
const finalStreakSpan = document.getElementById('final-streak');
const leaderboardList = document.getElementById('leaderboard-list');
const submitStatus = document.getElementById('submit-status');

let scoreToSubmit = 0;

function resetGame() {
    // A level-complete timer may still be pending — it would otherwise fire
    // mid-reset and advance the level of a game that no longer exists.
    if (victoryTimeoutId !== null) {
        clearTimeout(victoryTimeoutId);
        victoryTimeoutId = null;
    }
    bgVideo.onended = null;

    currentLevel = 1;
    maxOrdersForLevel = 10;
    totalCorrectOrders = 0;
    currentProgressBarFill = 0;
    currentStreak = 0;
    prefetchedCutscene = null;

    isVictoryState = false;
    isCutscenePlaying = false;
    freezeTimer = 0;

    currentSlot = 0;
    characterX = slotPositions[0];
    targetX = characterX;

    isGrabbing = false;
    currentGrabFrame = 0;
    grabFrameTimer = 0;
    currentFrame = 0;
    frameTimer = 0;

    for (let i = 0; i < ITEM_COUNT; i++) {
        ITEMS[i].playing = false;
        ITEMS[i].frame = 0;
        ITEMS[i].timer = 0;
    }

    canvas.style.display = 'block';
    if (trophyBtn) trophyBtn.style.display = 'block';

    bgVideo.loop = true;
    bgVideo.src = BG_LEVEL1;
    bgVideo.load();
    bgVideo.play().catch(() => {});

    activeOrders.length = 0;
    nextCustomerIndex = 0;
    pushNewOrder(-1);
}

/* Feedback under the submit button. Without this a failed submission is
   invisible to the player — the button just re-enables and nothing happens. */
function setSubmitStatus(message, kind) {
    if (!submitStatus) return;
    submitStatus.textContent = message || '';
    submitStatus.className = 'modal-status' + (kind ? ' ' + kind : '');
    submitStatus.hidden = !message;
}

function showNameEntryModal(streak) {
    scoreToSubmit = streak;
    setSubmitStatus('', null);
    finalStreakSpan.textContent = streak;
    nameModal.style.display = 'flex';
    isModalOpen = true;
    playerNameInput.value = '';
    playerNameInput.focus();
    resetGame();
}

function showLeaderboardModal(fresh) {
    leaderboardModal.style.display = 'flex';
    isModalOpen = true;
    fetchLeaderboard(fresh);
}

function closeModals() {
    nameModal.style.display = 'none';
    leaderboardModal.style.display = 'none';
    isModalOpen = false;
}

trophyBtn.addEventListener('click', () => {
    if (!isModalOpen) showLeaderboardModal();
});

closeLeaderboardBtn.addEventListener('click', closeModals);

playAgainBtn.addEventListener('click', () => {
    closeModals();
    resetGame();
});

skipScoreBtn.addEventListener('click', closeModals);

submitScoreBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim().substring(0, 7);
    if (!name) {
        setSubmitStatus('Enter a name first!', 'error');
        playerNameInput.focus();
        return;
    }

    submitScoreBtn.disabled = true;
    submitScoreBtn.textContent = 'Submitting...';
    setSubmitStatus('', null);

    try {
        const response = await fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score: scoreToSubmit })
        });

        if (response.ok) {
            nameModal.style.display = 'none';
            // Skip the edge cache here: the board is opening to show a score
            // that was submitted a moment ago, and a cached copy would not
            // have it yet.
            showLeaderboardModal(true);
            return;
        }

        // Prefer the server's own wording when it sends a reason; fall back to
        // a plain message when the body isn't JSON (404 page, gateway error).
        let reason = '';
        try {
            const data = await response.json();
            if (data && typeof data.error === 'string') reason = data.error;
        } catch (_) { /* non-JSON error body */ }

        if (response.status === 429) {
            setSubmitStatus(reason || 'Too many tries — wait a minute.', 'error');
        } else if (response.status === 400) {
            setSubmitStatus(reason || 'That score was rejected.', 'error');
        } else {
            setSubmitStatus('Leaderboard is offline — score not saved.', 'error');
        }
        console.error('Failed to submit score:', response.status, reason);
    } catch (e) {
        console.error(e);
        setSubmitStatus('No connection — score not saved.', 'error');
    } finally {
        submitScoreBtn.disabled = false;
        submitScoreBtn.textContent = 'Submit Score';
    }
});

async function fetchLeaderboard(fresh) {
    leaderboardList.textContent = 'Loading scores...';
    try {
        // Ordinary views ride the 10s edge cache; a just-submitted score needs
        // a unique URL to go past it.
        const url = fresh ? '/api/get-scores?t=' + Date.now() : '/api/get-scores';
        const response = await fetch(url);

        // A dead backend and an empty board are different things; saying
        // "Be the first!" while the API is down just misleads the player.
        if (!response.ok) {
            leaderboardList.textContent = 'Leaderboard is offline. Try again later.';
            return;
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.scores) || data.scores.length === 0) {
            leaderboardList.textContent = 'No scores yet! Be the first!';
            return;
        }

        // Build with textContent — player names are untrusted input and must
        // never reach innerHTML.
        const frag = document.createDocumentFragment();
        data.scores.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-entry';

            const who = document.createElement('span');
            who.textContent = `#${index + 1} ${entry.name}`;

            const points = document.createElement('span');
            points.textContent = entry.score;

            row.append(who, points);
            frag.appendChild(row);
        });

        leaderboardList.textContent = '';
        leaderboardList.appendChild(frag);
    } catch (e) {
        console.error(e);
        leaderboardList.textContent = 'Error loading scores.';
    }
}

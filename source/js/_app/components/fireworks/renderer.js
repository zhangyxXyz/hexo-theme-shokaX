/*! Adapted from mouse-firework 0.3.0.
MIT License

Copyright (c) 2024 D-Sketon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// One shared frame for every animation, including simultaneous bursts.
let pending = new Map();
let nextId = 0;
let frame = null;
let clearCanvas = () => {};
const schedule = (callback) => {
    const id = ++nextId;
    pending.set(id, callback);
    if (frame === null) frame = requestAnimationFrame(flush);
    return id;
};
const unschedule = (id) => {
    pending.delete(id);
    if (!pending.size && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
    }
};
const flush = () => {
    frame = null;
    clearCanvas();
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach(callback => callback());
};
class Timeline {
    constructor() {
        this.queue = [];
    }
    add(options) {
        this.queue.push(new Anime(options));
        return this;
    }
    play() {
        let completedCount = 0;
        const totalCount = this.queue.length;
        if (totalCount === 0) {
            this.complete?.();
            return;
        }
        this.queue.forEach((anime) => {
            const originalComplete = anime.complete;
            anime.complete = () => {
                originalComplete?.();
                completedCount++;
                if (completedCount === totalCount) {
                    this.complete?.();
                }
            };
        });
        this.queue.forEach((instance) => instance.play());
    }
}

const defaultOptions = {
    targets: undefined,
    duration: Infinity,
    easing: "linear",
    update: undefined, // Update callback
    complete: undefined, // Complete callback
};

var penner = () => {
    // Based on jQuery UI's implementation of easing equations from Robert Penner (http://www.robertpenner.com/easing)
    const eases = {
        linear: () => (t) => t,
    };
    const functionEasings = {
        Sine: () => (t) => 1 - Math.cos((t * Math.PI) / 2),
        Expo: () => (t) => t ? Math.pow(2, 10 * t - 10) : 0,
        Circ: () => (t) => 1 - Math.sqrt(1 - t * t),
        Back: () => (t) => t * t * (3 * t - 2),
        Bounce: () => (t) => {
            let pow2, b = 4;
            while (t < ((pow2 = Math.pow(2, --b)) - 1) / 11) { }
            return (1 / Math.pow(4, 3 - b) - 7.5625 * Math.pow((pow2 * 3 - 2) / 22 - t, 2));
        },
    };
    ["Quad", "Cubic", "Quart", "Quint"].forEach((name, i) => {
        functionEasings[name] = () => (t) => Math.pow(t, i + 2);
    });
    Object.keys(functionEasings).forEach((name) => {
        const easeIn = functionEasings[name];
        eases["easeIn" + name] = easeIn;
        eases["easeOut" + name] = () => (t) => 1 - easeIn()(1 - t);
        eases["easeInOut" + name] = () => (t) => t < 0.5 ? easeIn()(t * 2) / 2 : 1 - easeIn()(t * -2 + 2) / 2;
        eases["easeOutIn" + name] = () => (t) => t < 0.5 ? (1 - easeIn()(1 - t * 2)) / 2 : (easeIn()(t * 2 - 1) + 1) / 2;
    });
    return eases;
};

const pennerFn = penner();
const change = (target, origin, elapsed, value, key, final = false) => {
    target[key] = final ? value : (value - origin) * elapsed + origin;
};
var engine = (anime) => {
    // Animation start time
    const start = Date.now();
    // Animation end time
    const end = start + anime.duration;
    const targetList = !anime.targets
        ? []
        : Array.isArray(anime.targets)
            ? anime.targets
            : [anime.targets];
    const cloneTargets = targetList.map((target) => {
        const cloneTarget = {};
        for (const propKey in anime.dest) {
            cloneTarget[propKey] = target[propKey];
        }
        return cloneTarget;
    });
    // Change all properties of target
    const changeAll = (elapsed, current, final = false) => {
        targetList.forEach((target, index) => {
            Object.keys(anime.dest).forEach((key) => {
                const origin = parseFloat(cloneTargets[index][key]);
                let dest = anime.dest[key];
                // Object type
                if (typeof dest === "object") {
                    if (!Array.isArray(dest)) {
                        // Support nest mode {value: 1, duration: 500, easing: 'linear'}
                        const { value, duration, easing = anime.easing } = dest;
                        const elapsed = pennerFn[easing]()((current - start) / duration);
                        if (current <= start + duration) {
                            change(target, origin, elapsed, value, key);
                        }
                        else if (final) {
                            change(target, origin, elapsed, value, key, final);
                        }
                    }
                }
                else {
                    // Function mode
                    if (typeof dest === "function") {
                        dest = dest(target, index);
                    }
                    change(target, origin, elapsed, dest, key, final);
                }
            });
        });
    };
    let animationId = null;
    // Control animation rAF
    const step = () => {
        const current = Date.now();
        if (current > end) {
            // Data correction
            changeAll(1, current, true);
            anime.isPlay = false;
            animationId = null;
            anime.complete?.();
        }
        else {
            if (current >= start) {
                changeAll(pennerFn[anime.easing]()((current - start) / anime.duration), current);
                anime.update?.(targetList);
            }
            animationId = schedule(step);
        }
    };
    const stop = () => {
        if (animationId !== null) {
            unschedule(animationId);
            animationId = null;
            anime.isPlay = false;
        }
    };
    animationId = schedule(step);
    return stop;
};

class Anime {
    constructor(options = defaultOptions) {
        options = { ...defaultOptions, ...options };
        const { targets, duration, easing, update, complete, ...dest } = options;
        this.targets = targets;
        this.duration = duration;
        this.easing = easing;
        this.update = update;
        this.complete = complete;
        this.dest = dest ? dest : {};
        this.tl = null;
        this.isPlay = false;
    }
    timeline() {
        if (!this.tl) {
            this.tl = new Timeline();
        }
        return this.tl;
    }
    play() {
        if (!this.isPlay) {
            this.isPlay = true;
            this.stopFn = engine(this);
        }
    }
    stop() {
        if (this.stopFn) {
            this.stopFn();
            this.stopFn = undefined;
            this.isPlay = false;
        }
    }
}

const anime = (options) => new Anime(options);
anime.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sample = (raw) => {
    return Array.isArray(raw) ? anime.random(raw[0], raw[1]) : raw;
};
const hasAncestor = (node, selector) => {
    return !!node.closest?.(selector);
};
const setEndPos = (p, particle) => {
    const index = particle.move.indexOf("emit");
    if (index >= 0) {
        const { emitRadius = [50, 180] } = particle.moveOptions[index] || {};
        const angle = (anime.random(0, 360) * Math.PI) / 180;
        const radius = (anime.random(0, 1) ? 1 : -1) * sample(emitRadius);
        p.target.x = p.x + radius * Math.cos(angle);
        p.target.y = p.y + radius * Math.sin(angle);
    }
};
const setEndRotation = (p, particle) => {
    const index = particle.move.indexOf("rotate");
    if (index >= 0) {
        const { angle = [-180, 180] } = particle.moveOptions[index] || {};
        p.target.rotation = sample(angle);
    }
};
const formatAlpha = (alpha) => (Array.isArray(alpha) ? alpha : [alpha, alpha]).map((a) => a * 100);

class BaseEntity {
    constructor(ctx, x, y, color, options) {
        this.target = {};
        this.ctx = ctx;
        this.x = x;
        this.y = y;
        this.color = color;
        if (this.color.startsWith("var(")) {
            const [, key] = this.color.match(/var\((--[^)]+)\)/) || [];
            if (key) {
                this.color =
                    getComputedStyle(document.documentElement)
                        .getPropertyValue(key)
                        .trim() || this.color;
            }
        }
        this.radius = options.radius;
        this.alpha = options.alpha;
        this.lineWidth = options.lineWidth;
        this.rotation = 0;
    }
    draw() {
        const { ctx, x, y } = this;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation * (Math.PI / 180));
        ctx.globalAlpha = this.alpha;
        this.paint();
        if (this.lineWidth) {
            ctx.lineWidth = this.lineWidth;
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
        else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

class Circle extends BaseEntity {
    paint() {
        const { ctx } = this;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.closePath();
    }
}

class Polygon extends BaseEntity {
    constructor(ctx, x, y, color, options) {
        super(ctx, x, y, color, options);
        this.sides = sample(options.sides);
    }
    paint() {
        const { ctx, sides, radius } = this;
        ctx.beginPath();
        ctx.moveTo(radius * Math.cos(0), radius * Math.sin(0));
        for (let i = 1; i <= sides; i++) {
            const angle = (i * 2 * Math.PI) / sides;
            ctx.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
        }
        ctx.closePath();
    }
}

class Star extends BaseEntity {
    constructor(ctx, x, y, color, options) {
        super(ctx, x, y, color, options);
        this.spikes = sample(options.spikes);
    }
    paint() {
        const { ctx, spikes, radius } = this;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const length = i % 2 === 0 ? radius : radius * 0.5;
            const px = Math.cos(angle) * length;
            const py = Math.sin(angle) * length;
            ctx.lineTo(px, py);
        }
        ctx.closePath();
    }
}

const ENTITY_MAP = {
    circle: Circle,
    polygon: Polygon,
    star: Star,
};
const registerEntity = (name, entity) => {
    ENTITY_MAP[name] = entity;
};
const entityFactory = (ctx, x, y, particle) => {
    const shapeType = ENTITY_MAP[particle.shape];
    const { shapeOptions, colors, number } = particle;
    let { radius = 0, alpha = 1, lineWidth = 0 } = shapeOptions || {};
    return Array.from({ length: sample(number) }, () => {
        if (!shapeType) {
            throw new Error(`Entity type "${particle.shape}" is not registered.`);
        }
        const shape = new shapeType(ctx, x, y, colors[anime.random(0, colors.length - 1)], {
            ...shapeOptions,
            radius: sample(radius),
            alpha: sample(formatAlpha(alpha)) / 100,
            lineWidth: sample(lineWidth),
        });
        setEndPos(shape, particle);
        setEndRotation(shape, particle);
        return shape;
    });
};

const getAlphaAnim = (options) => {
    const { alpha = 0, alphaEasing = "linear", alphaDuration = [600, 800], } = options;
    return {
        value: sample(formatAlpha(alpha)) / 100,
        easing: alphaEasing,
        duration: sample(alphaDuration),
    };
};
const setParticleMovement = (particle) => {
    const { move, moveOptions } = particle;
    const dist = {};
    move.forEach((m, i) => {
        const options = moveOptions[i] || {};
        if (m === "emit") {
            const { radius = 0.1, alphaChange = false } = options;
            dist.x = (p) => p.target.x;
            dist.y = (p) => p.target.y;
            dist.radius = sample(radius);
            if (alphaChange) {
                dist.alpha = getAlphaAnim(options);
            }
        }
        else if (m === "diffuse") {
            const { diffuseRadius = [80, 160], lineWidth = 0 } = options;
            dist.radius = sample(diffuseRadius);
            dist.lineWidth = sample(lineWidth);
            dist.alpha = getAlphaAnim(options);
        }
        else if (m === "rotate") {
            dist.rotation = (p) => p.target.rotation;
        }
    });
    return dist;
};

let cleanup;
export default function firework(options, attachLayer) {
    cleanup?.();
    let canvas = null, ctx = null, detachLayer;
    let batches = [];
    let lastTrigger = -Infinity;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clear = () => {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    clearCanvas = clear;
    const resize = () => {
        if (!canvas) return;
        const { clientWidth: width, clientHeight: height } = document.documentElement;
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const stopBatch = batch => batch.queue.forEach(animation => animation.stop());
    const reset = () => {
        batches.forEach(stopBatch);
        batches = [];
        lastTrigger = -Infinity;
        clear();
    };
    const visibility = () => { if (document.hidden) reset(); };
    const activate = event => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || document.hidden || reduced.matches) return;
        if (options.excludeElements?.some(selector => event.target.closest?.(selector))) return;
        const now = performance.now();
        if (now - lastTrigger < 150) return;
        lastTrigger = now;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999999';
            ctx = canvas.getContext('2d');
            if (!ctx) { canvas = null; return; }
            document.body.appendChild(canvas);
            resize();
            detachLayer = attachLayer?.(canvas);
        }
        if (batches.length >= 3) stopBatch(batches.shift());
        const timeline = anime().timeline();
        timeline.complete = () => { batches = batches.filter(batch => batch !== timeline); };
        for (const raw of options.particles || []) {
            const particle = { ...raw, move: Array.isArray(raw.move) ? raw.move : [raw.move],
                moveOptions: raw.moveOptions ? (Array.isArray(raw.moveOptions) ? raw.moveOptions : [raw.moveOptions]) : [] };
            timeline.add({ targets: entityFactory(ctx, event.clientX, event.clientY, particle),
                duration: sample(particle.duration), easing: particle.easing || 'linear',
                update: targets => targets.forEach(target => target.draw()), ...setParticleMovement(particle) });
        }
        batches.push(timeline);
        timeline.play();
    };
    document.addEventListener('click', activate, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pagehide', reset);
    reduced.addEventListener('change', reset);
    cleanup = () => {
        reset();
        detachLayer?.();
        canvas?.remove();
        document.removeEventListener('click', activate);
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pagehide', reset);
        reduced.removeEventListener('change', reset);
    };
    return cleanup;
}

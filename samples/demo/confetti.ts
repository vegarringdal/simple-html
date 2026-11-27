/**
 * Confetti for a "Try it" box of the user guide whose tasks are all done (tryIt.ts): paper bits shot up
 * from an element, falling and turning, gone after a few seconds. `big`: the last box of the guide too -
 * more of them, also from the two bottom corners of the window.
 *
 * A canvas over the page that takes no clicks - a popover, so it is over an open modal dialog as well -
 * removed when the last bit is gone. Nothing for a reader
 * who asks the system for less motion (prefers-reduced-motion), or where there is no 2d canvas.
 */

/** the same in light and dark: bright, they are over the page for a moment */
const COLOURS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#facc15'];

/** how long the bits fall, in ms; they fade out in the last part */
const DURATION = 3200;
const FADE = 900;

interface Bit {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** turned, and how fast */
    angle: number;
    spin: number;
    /** the flutter: the bit's width follows a cosine of this */
    wobble: number;
    wobbleSpeed: number;
    size: number;
    colour: string;
    round: boolean;
}

/** a burst of `count` bits from x, y (css pixels): up and out, by `angle` (radians, 0 is up) give or take `spread` */
function burst(x: number, y: number, count: number, angle: number, spread: number, speed: number): Bit[] {
    return Array.from({ length: count }, () => {
        const direction = angle + (Math.random() - 0.5) * spread;
        const velocity = speed * (0.55 + Math.random() * 0.6);
        return {
            x,
            y,
            vx: Math.sin(direction) * velocity,
            vy: -Math.cos(direction) * velocity,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.4,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.08 + Math.random() * 0.12,
            size: 6 + Math.random() * 6,
            colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
            round: Math.random() < 0.3
        };
    });
}

/** no animation wanted: the system asks for less motion */
function reducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shoots confetti from the middle of `from`
 * @returns false when there was none: less motion asked for, or no canvas
 */
export function confetti(from: HTMLElement, big = false): boolean {
    if (reducedMotion()) {
        return false;
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        return false;
    }
    canvas.className = 'demo-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    // in the top layer, so it is over a modal dialog too: the task done may be one that opens one
    canvas.popover = 'manual';
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    document.body.appendChild(canvas);
    try {
        canvas.showPopover();
    } catch {
        // no popover: under a modal dialog, over the rest
    }

    const box = from.getBoundingClientRect();
    const bits = burst(box.left + box.width / 2, box.top + box.height / 2, big ? 160 : 110, 0, 1.9, 15);
    if (big) {
        bits.push(...burst(0, height, 110, 0.55, 0.6, 24), ...burst(width, height, 110, -0.55, 0.6, 24));
    }

    const started = performance.now();
    let last = started;
    const frame = (now: number) => {
        // the steps of a frame at 60 per second, so a slow screen does not slow the fall
        const steps = Math.min((now - last) / (1000 / 60), 3);
        last = now;
        const age = now - started;
        context.clearRect(0, 0, width, height);
        context.globalAlpha = age > DURATION - FADE ? Math.max(0, (DURATION - age) / FADE) : 1;
        for (const bit of bits) {
            bit.vx *= 0.985 ** steps;
            bit.vy = bit.vy * 0.985 ** steps + 0.32 * steps;
            bit.x += bit.vx * steps;
            bit.y += bit.vy * steps;
            bit.angle += bit.spin * steps;
            bit.wobble += bit.wobbleSpeed * steps;
            context.save();
            context.translate(bit.x, bit.y);
            context.rotate(bit.angle);
            context.scale(Math.cos(bit.wobble), 1);
            context.fillStyle = bit.colour;
            if (bit.round) {
                context.beginPath();
                context.arc(0, 0, bit.size / 2.6, 0, Math.PI * 2);
                context.fill();
            } else {
                context.fillRect(-bit.size / 2, -bit.size / 4, bit.size, bit.size / 2);
            }
            context.restore();
        }
        if (age < DURATION) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    };
    requestAnimationFrame(frame);
    return true;
}

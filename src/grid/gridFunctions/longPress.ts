/**
 * ms a finger is held still before it is a long press: the context menu opens, as a right click
 * opens it. As long as Android's default long press (500ms, ViewConfiguration)
 */
export const LONG_PRESS = 500;

/**
 * px a finger may move and still be a press (a tap or a long press). A finger that moves further is a
 * swipe: no long press, and the grid scrolls (touchScroll.ts)
 */
export const TOUCH_SLOP = 10;

/**
 * What a long press is doing, see addLongPress:
 * - `pending`: a finger is down and held still, the timer runs
 * - `ours`: the timer fired, the context menu event was dispatched and a handler canceled it (it
 *   opened a menu). The finger is still down
 * - `native`: the browser sent its own contextmenu event first (Android) while the timer ran
 * - `none`: no finger, or a finger that moved, was let go, or opened nothing
 */
type PressState = 'none' | 'pending' | 'ours' | 'native';

/**
 * A long press of a finger opens the context menu of what it is on: held still ({@link TOUCH_SLOP}) for
 * {@link LONG_PRESS} ms, a `contextmenu` event is dispatched on the element the finger went down on, at
 * the finger's point. It is a PointerEvent with `pointerType: 'touch'` and `button: 2`, bubbles and can
 * be canceled - as Chrome sends one for a long press on Android. So every `contextmenu` listener in
 * `root` works with a finger as it is: the grid's menus (the header labels, the filter row, the column
 * numbers, the cells) and any of your own.
 *
 * Safari on iOS sends no `contextmenu` for a long press; Chrome on Android does. So there is one menu,
 * not two:
 * - the browser's own `contextmenu` while the timer runs (it came first): the timer stops, the
 *   browser's event opens the menu
 * - the browser's own after ours, while the finger is still down: canceled and stopped, in the
 *   capture phase, before any handler of `root` sees it
 *
 * The finger let go after a long press that opened a menu (a handler canceled the event, as the
 * grid's do) is no tap: its `touchend` is canceled, so the browser sends no mouse events and no
 * `click` for it - the row is not selected, the cell does not take the focus (no keyboard), the menu
 * just opened is not closed by a click outside it. A long press on an element without a menu is left
 * as it is: the browser sends its click.
 *
 * Not a long press: a second finger (a pinch is the browser's), a finger that moves more than
 * {@link TOUCH_SLOP} px, the browser taking the pointer (`pointercancel`: it scrolls the page), the
 * mouse and the pen (the pen has a barrel button). An element that stops the `pointerdown` (the
 * fill handle) has no long press.
 *
 * Delegated: the listeners are on `root`, every element in it has the long press, also one rendered
 * later. The grid calls it for its element (createDom.ts). An element outside the grid with a context
 * menu - in a popover of its own - needs one line: `addLongPress(element, signal)`.
 * @param signal removes the listeners
 */
export function addLongPress(root: HTMLElement, signal?: AbortSignal) {
    let state: PressState = 'none';
    let timer: ReturnType<typeof setTimeout> | undefined;
    // the finger: where it went down and what it went down on
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let target: Element | null = null;
    // true while our own event is dispatched: the events in it are ours, also one a handler sends on
    // (the label cell hands contextmenu on to its label, rebuildHeaderColumns.ts)
    let dispatching = false;

    const reset = () => {
        clearTimeout(timer);
        timer = undefined;
        state = 'none';
        pointerId = -1;
        target = null;
    };

    const fire = () => {
        timer = undefined;
        if (!target?.isConnected) {
            reset();
            return;
        }
        const menuEvent = new PointerEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: startX,
            clientY: startY,
            button: 2,
            pointerId,
            pointerType: 'touch',
            isPrimary: true
        });
        dispatching = true;
        let opened = false;
        try {
            // false: a handler canceled it, it opened its menu
            opened = !target.dispatchEvent(menuEvent);
        } finally {
            dispatching = false;
        }
        if (opened) {
            state = 'ours';
        } else {
            reset();
        }
    };

    root.addEventListener(
        'pointerdown',
        (event) => {
            // every press starts again: a long press left in `ours` (its touchend never came) ends too
            reset();
            // the mouse and the pen, and a second finger: a pinch is the browser's
            if (event.pointerType !== 'touch' || !event.isPrimary) {
                return;
            }
            state = 'pending';
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            target = event.target instanceof Element ? event.target : null;
            timer = setTimeout(fire, LONG_PRESS);
        },
        { signal }
    );

    root.addEventListener(
        'pointermove',
        (event) => {
            if (
                state === 'pending' &&
                event.pointerId === pointerId &&
                Math.hypot(event.clientX - startX, event.clientY - startY) > TOUCH_SLOP
            ) {
                // a swipe
                reset();
            }
        },
        { signal }
    );

    // let go: the timer stops. A long press that opened a menu waits for the touchend, below
    const letGo = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
            return;
        }
        if (state === 'pending' || event.type === 'pointercancel') {
            reset();
        }
    };
    root.addEventListener('pointerup', letGo, { signal });
    root.addEventListener('pointercancel', letGo, { signal });

    // the touch events come after the pointer events of the same finger (Pointer Events: the
    // compatibility of touch events). Canceled, the touchend has no mouse events and no click
    root.addEventListener(
        'touchend',
        (event) => {
            if (state === 'ours' || state === 'native') {
                if (event.touches.length === 0) {
                    event.preventDefault();
                    reset();
                }
            }
        },
        { passive: false, signal }
    );
    root.addEventListener('touchcancel', () => reset(), { signal });

    // the browser's own contextmenu of a long press (Android), see the top
    root.addEventListener(
        'contextmenu',
        (event) => {
            if (dispatching) {
                return;
            }
            if (state === 'pending') {
                clearTimeout(timer);
                timer = undefined;
                state = 'native';
            } else if (state === 'ours') {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        { capture: true, signal }
    );

    signal?.addEventListener('abort', () => clearTimeout(timer));
}

import type { Grid } from '../grid';
import type { CellPoint } from './cellRanges';
import { focusedCell, pointOf } from './rangeSelection';

/**
 * The last press of a pointer in the grid - the mouse, a pen, a finger - for what comes after it:
 *
 * - **A finger's tap.** A finger has no Shift and no Ctrl: a tap on a row number or a column number
 *   toggles it, as Ctrl+click does (renderRowSelector.ts, columnNumbers.ts) - the first tap selects,
 *   more taps add or remove, as in a phone's own lists. The mouse and the pen are not changed: a plain
 *   click replaces. Which pointer made a click: `click` is a PointerEvent in Chrome 92, Firefox 129 and
 *   Safari 18.2 (iOS 18.2) and later (MDN browser-compat-data,
 *   `api.Element.click_event.type_pointerevent`), its `pointerType` is `'touch'` for a finger -
 *   `'mouse'`, `'pen'`, and `''` for a click a key or code made. Before that it is a MouseEvent without
 *   one: the pointer of the last press is taken, the press the click belongs to.
 * - **The active cell of a menu** (the row menu's Select ›): the cell with the focus when the menu
 *   was asked for. A right click moves the focus to the cell clicked first - its mousedown does, before
 *   the contextmenu event - so for a menu a pointer opened it is the cell that had the focus when the
 *   pointer went down. A long press moves no focus.
 */
export interface LastPress {
    /** the press's pointerType: `'mouse'`, `'pen'`, `'touch'` */
    pointerType: string;
    /** the body cell that had the focus when the pointer went down, null for none */
    active: CellPoint | null;
}

/**
 * true when a click on the grid came from a finger: a tap, see {@link LastPress}
 */
export function isFingerClick(ctx: Grid, event: MouseEvent): boolean {
    if (event instanceof PointerEvent) {
        return event.pointerType === 'touch';
    }
    return ctx.lastPress?.pointerType === 'touch';
}

/**
 * The active cell for a menu that is opening, see {@link LastPress}: the cell with the focus now when
 * the last input was a key (Shift+F10, the menu key) or no pointer has pressed in the grid yet, else
 * the one that had it when the pointer went down. null for none
 */
export function activeCellOfMenu(ctx: Grid): CellPoint | null {
    if (ctx.keyboardUsed || !ctx.lastPress) {
        const focused = focusedCell(ctx);
        return focused ? pointOf(focused.cell) : null;
    }
    return ctx.lastPress.active;
}

/**
 * Remembers every press in the grid as `ctx.lastPress`. In the capture phase: before the mousedown
 * after it moves the focus, and an element that stops the pointerdown (the fill handle) still tells
 * it. For createDom, removed with the scroll listeners
 */
export function trackPresses(ctx: Grid) {
    ctx.element.addEventListener(
        'pointerdown',
        (event) => {
            const focused = focusedCell(ctx);
            ctx.lastPress = { pointerType: event.pointerType, active: focused ? pointOf(focused.cell) : null };
        },
        { capture: true, signal: ctx.scrollListenersAbort?.signal }
    );
}

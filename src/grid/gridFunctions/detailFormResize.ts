import { html, type TemplateResult } from 'lit-html';
import type { Grid } from '../grid';
import type { DetailForm } from '../gridConfig';
import { detailFormId, detailFormLimits, detailFormRoom, detailFormWidth, renderDetailForm } from './detailForm';
import { followPointer, isPrimaryPress } from './followPointer';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { getMiddleColumnsNeeded } from './rebuildRowColumns';
import { updateMainElementSizes } from './updateMainElementSizes';

/**
 * The left edge of the detail form (detailForm.ts) at the right of the rows: a splitter that sets the
 * form's width - the state's `detailForm.width` - between its least and most width.
 *
 * - **A pointer** - a mouse, a pen, a finger (`touch-action: none`) - drags it: the form is as wide as
 *   the drag makes it, the header, the rows, their scrollbars and the totals row follow at once (once a
 *   frame, see resizeDetailForm). Let go, the width is the state's. pointercancel gives the form the
 *   width it had.
 * - **The keyboard**: it is a stop of Tab (WAI-ARIA window splitter: `role="separator"`, focusable, with
 *   `aria-valuenow` / `aria-valuemin` / `aria-valuemax` - the width in px). ArrowLeft makes the form
 *   STEP px wider (the edge goes left), ArrowRight narrower.
 * - **The limits** (resizeLimits): `minWidth` (at least 150), and the least of `maxWidth` and the room
 *   at the right of the rows (detailFormRoom: the rows keep their room) - a drag does not put the form
 *   under the rows.
 *
 * Only an expanded form at the right of the rows has it: under the rows (the css hides it there) and
 * collapsed (not rendered) it has none.
 */

/** the class of the splitter */
export const RESIZE_CLASS = 'simple-html-grid-detail-form-resize';

/** the class of the splitter while it is dragged */
const DRAGGED_CLASS = 'simple-html-grid-detail-form-resize-dragged';

/** what an arrow key moves the edge by, in px */
export const STEP = 10;

/**
 * The least and the most width a drag or a key gives the form, in px: its limits (detailFormLimits),
 * the most not more than the room at the right of the rows - not less than the least
 */
export function resizeLimits(ctx: Grid, form: DetailForm): { min: number; max: number } {
    const { min, max } = detailFormLimits(form);
    return { min, max: Math.max(Math.min(max, detailFormRoom(ctx)), min) };
}

/**
 * The splitter, for the form's render: its width now as its value, the limits as its least and most
 */
export function detailFormResizeHandle(ctx: Grid, form: DetailForm): TemplateResult {
    const { min, max } = resizeLimits(ctx, form);
    return html`<div
        class=${RESIZE_CLASS}
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-label=${gridText(ctx, 'detailForm.resize')}
        aria-controls=${detailFormId(ctx, 'form')}
        aria-valuenow=${detailFormWidth(form)}
        aria-valuemin=${min}
        aria-valuemax=${max}
        @pointerdown=${(event: PointerEvent) => startResize(ctx, event)}
        @keydown=${(event: KeyboardEvent) => resizeKey(ctx, event)}
    ></div>`;
}

/**
 * Gives the form a width - the state's `detailForm.width`, undefined: none (the default) - and lays the
 * grid out again without a rebuild: the sizes of the header, the rows, the scrollbars and the form
 * (updateMainElementSizes), the scrolling columns for their new room (horizontalScrollHandler), the
 * splitter's value. A rebuild only when the scrolling columns get more room than their elements cover
 * (getMiddleColumnsNeeded): it makes more of them
 */
export function resizeDetailForm(ctx: Grid, width: number | undefined) {
    const form = ctx.gridInterface.__getGridConfig().detailForm;
    if (form.width === width) {
        return;
    }
    if (width === undefined) {
        delete form.width;
    } else {
        form.width = width;
    }
    updateMainElementSizes(ctx);
    if (getMiddleColumnsNeeded(ctx) > ctx.containerMiddleColumnCache.length) {
        ctx.rebuild();
        return;
    }
    // where the rows are scrolled to sideways, as the resize of a column reads it (rebuildHeaderColumns)
    const scrollLeft = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle').scrollLeft;
    horizontalScrollHandler(ctx, scrollLeft);
    renderDetailForm(ctx);
}

/**
 * A press on the splitter: a drag of the form's edge, see followPointer. The width is laid out once a
 * frame while the pointer moves, and when it is let go
 */
function startResize(ctx: Grid, down: PointerEvent) {
    if (!isPrimaryPress(down)) {
        return;
    }
    const handle = down.currentTarget as HTMLElement;
    const form = ctx.gridInterface.__getGridConfig().detailForm;
    // the state's, given back when the drag does not finish
    const original = form.width;
    const start = detailFormWidth(form);
    const { min, max } = resizeLimits(ctx, form);
    let width = start;
    let frame = 0;
    // a press that did not move changes nothing, the state keeps no width it did not have
    const layOut = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (width !== detailFormWidth(form)) {
            resizeDetailForm(ctx, width);
        }
    };

    handle.setPointerCapture(down.pointerId);
    handle.classList.add(DRAGGED_CLASS);
    followPointer(handle, down, {
        // the edge follows the pointer: left is wider
        move: (event) => {
            width = Math.round(Math.min(Math.max(start - (event.clientX - down.clientX), min), max));
            if (!frame) {
                frame = requestAnimationFrame(layOut);
            }
        },
        up: () => {
            handle.classList.remove(DRAGGED_CLASS);
            layOut();
        },
        // the drag did not finish: the width it had
        cancel: () => {
            cancelAnimationFrame(frame);
            frame = 0;
            handle.classList.remove(DRAGGED_CLASS);
            resizeDetailForm(ctx, original);
        }
    });
}

/**
 * The keys of the splitter: ArrowLeft wider, ArrowRight narrower - STEP px, within resizeLimits
 */
function resizeKey(ctx: Grid, event: KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: STEP, ArrowRight: -STEP };
    if (event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(steps, event.key)) {
        return;
    }
    event.preventDefault();
    const form = ctx.gridInterface.__getGridConfig().detailForm;
    const { min, max } = resizeLimits(ctx, form);
    const width = Math.min(Math.max(detailFormWidth(form) + steps[event.key], min), max);
    // at a limit: nothing changes
    if (width !== detailFormWidth(form)) {
        resizeDetailForm(ctx, width);
    }
}

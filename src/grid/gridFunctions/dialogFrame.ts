import { html } from 'lit-html';
import { asPx } from './asPx';
import { followPointer, isPrimaryPress } from './followPointer';
import { hideTooltip } from './tooltip';

/**
 * The frame of the grid's dialogs - the filter editor (renderFilterEditor.ts) and the column settings
 * (columnSettings.ts): a modal `<dialog>` shown with showModal(), centered on the window when it opens,
 * moved by its title bar and resized from every edge and corner, with the mouse, a finger or a pen.
 * Their look is the same css: `.simple-html-grid.filter-editor-content`, its title bar, body and footer.
 */

/**
 * the resize handles, and which edges each one moves
 */
const RESIZE_HANDLES = [
    { name: 'n', north: true, south: false, west: false, east: false },
    { name: 's', north: false, south: true, west: false, east: false },
    { name: 'w', north: false, south: false, west: true, east: false },
    { name: 'e', north: false, south: false, west: false, east: true },
    { name: 'nw', north: true, south: false, west: true, east: false },
    { name: 'ne', north: true, south: false, west: false, east: true },
    { name: 'sw', north: false, south: true, west: true, east: false },
    { name: 'se', north: false, south: true, west: false, east: true }
] as const;

type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/**
 * Shows a dialog that was rendered closed: showModal(), the focus on the dialog itself, centered on the
 * window.
 *
 * Rendered before it is shown: showModal() moves the focus into what is there. The focus goes to the
 * dialog itself (it has `autofocus` and `tabindex="-1"`), Tab goes on into it: showModal() does that for a
 * dialog with autofocus by the HTML spec now, Chrome 131 still gives it to the first button (the ✕).
 *
 * The css only gives a default size - the height follows the content - left/top are set here so the
 * dialog can be dragged and resized without fighting the browser's centering (inset: 0, margin: auto).
 * Centered on the window, once it is shown and has its size
 */
export function showDialog(dialog: HTMLDialogElement) {
    dialog.showModal();
    dialog.focus();
    dialog.style.left = asPx(Math.max(0, Math.round((window.innerWidth - dialog.offsetWidth) / 2)));
    dialog.style.top = asPx(Math.max(0, Math.round((window.innerHeight - dialog.offsetHeight) / 2)));
}

/**
 * Keeps a dialog in the window as what is in it grows - a part of the grid config dialog turned on: the
 * height follows the content up to the window's (max-height), the top stays where it was, so its bottom
 * and its buttons would go out of the window. Its top is moved up as far as it takes, not above the
 * window's. After a render of what is in it
 */
export function keepDialogInView(dialog: HTMLElement) {
    const rect = dialog.getBoundingClientRect();
    if (rect.bottom > window.innerHeight && rect.top > 0) {
        dialog.style.top = asPx(Math.max(0, Math.round(window.innerHeight - rect.height)));
    }
}

/**
 * grab areas for resizing, one per edge and one per corner: css `resize` only gives the bottom right
 * corner, so these are wired up by hand. At the end of the dialog's template
 */
export function resizeHandles(dialog: HTMLElement) {
    return RESIZE_HANDLES.map(
        (handle) =>
            html`<div
                class="simple-html-resize-handle handle-${handle.name}"
                @pointerdown=${(event: PointerEvent) => resizeDialog(dialog, handle, event)}
            ></div>`
    );
}

/**
 * Drags a handle of the dialog (the titlebar, a resize handle) from its pointerdown until the pointer
 * is let go: `move` gets how far the pointer has moved from where it went down. Pointer events, so a
 * mouse, a finger and a pen all work (followPointer). The pointer is captured on the handle: its
 * events keep coming to it when the pointer leaves it, and the window. The handles have
 * `touch-action: none` in the css, or a finger would scroll the page instead.
 */
function dragHandle(down: PointerEvent, move: (dx: number, dy: number) => void) {
    const handle = down.currentTarget;
    // the main button (left mouse button, a finger, the pen tip), one pointer at a time
    if (!(handle instanceof HTMLElement) || !isPrimaryPress(down)) {
        return;
    }
    // no text selection while dragging
    down.preventDefault();
    hideTooltip();

    handle.setPointerCapture(down.pointerId);
    followPointer(handle, down, {
        move: (event) => move(event.clientX - down.clientX, event.clientY - down.clientY),
        up: () => {},
        // the browser took the pointer: the dialog stays where it got to
        cancel: () => {}
    });
}

/**
 * resize from any edge or corner.
 *
 * Each handle says which edges it moves: dragging a west or north edge has to move
 * left/top as well as the size, otherwise the opposite edge would walk across the screen.
 */
function resizeDialog(dialog: HTMLElement, edge: ResizeHandle, event: PointerEvent) {
    const rect = dialog.getBoundingClientRect();
    const style = window.getComputedStyle(dialog);
    const minWidth = Number.parseInt(style.minWidth, 10) || 200;
    const minHeight = Number.parseInt(style.minHeight, 10) || 120;

    dragHandle(event, (dx, dy) => {
        if (edge.east) {
            dialog.style.width = asPx(Math.max(minWidth, rect.width + dx));
        }
        if (edge.west) {
            // clamp the width first, so the left edge stops instead of pushing past it
            const width = Math.max(minWidth, rect.width - dx);
            dialog.style.width = asPx(width);
            dialog.style.left = asPx(Math.round(rect.left + (rect.width - width)));
        }
        if (edge.south) {
            dialog.style.height = asPx(Math.max(minHeight, rect.height + dy));
        }
        if (edge.north) {
            const height = Math.max(minHeight, rect.height - dy);
            dialog.style.height = asPx(height);
            dialog.style.top = asPx(Math.round(rect.top + (rect.height - height)));
        }
    });
}

/**
 * drag the dialog around by its titlebar, kept inside the window. For the titlebar's pointerdown
 */
export function moveDialog(dialog: HTMLElement, event: PointerEvent) {
    // let the close button in the titlebar do its own thing
    if (event.target instanceof Element && event.target.closest('.filter-editor-close')) {
        return;
    }
    const rect = dialog.getBoundingClientRect();

    dragHandle(event, (dx, dy) => {
        // keep a bit of the dialog on screen so it can always be grabbed again
        const left = Math.min(Math.max(rect.left + dx, 20 - rect.width), window.innerWidth - 40);
        const top = Math.min(Math.max(rect.top + dy, 0), window.innerHeight - 30);
        dialog.style.left = asPx(Math.round(left));
        dialog.style.top = asPx(Math.round(top));
    });
}

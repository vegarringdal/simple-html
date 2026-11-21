/**
 * What `followPointer()` calls while it follows a pointer.
 */
export type PointerHandlers = {
    /** the pointer moved */
    move: (event: PointerEvent) => void;
    /** the pointer was let go: mouse button up, finger or pen lifted */
    up: (event: PointerEvent) => void;
    /**
     * the browser took the pointer (pointercancel): a system gesture, the pen left the screen, the
     * device went away ... The gesture did not finish, undo what it did so far
     */
    cancel: () => void;
};

/**
 * true for a press that may start a drag or a resize: the primary pointer (the mouse, the first
 * finger, the pen) with its main button (left mouse button, finger or pen tip down). A right
 * click, a second finger or the pen's barrel button do nothing.
 */
export function isPrimaryPress(event: PointerEvent) {
    return event.isPrimary && event.button === 0;
}

/**
 * Follows one pointer - mouse, pen or finger - from its pointerdown until it is let go. Used by the
 * column drag/drop (dragEvent.ts) and the column resize handle (rebuildHeaderColumns.ts).
 *
 * - The listeners are on the document and only take the events of this pointer (`pointerId`): a
 *   second finger is another pointer. A pointer captured by `source` (`setPointerCapture`) sends
 *   its events to `source`, they bubble to the document. If a rebuild removes `source` during the
 *   gesture, the events still arrive and the gesture still ends.
 * - Capturing is left to the caller: a captured pointer sends the `click` after pointerup to
 *   `source`, not to the element under it. The drag/drop captures once the drag starts, so a click
 *   on the remove icon of a group chip still reaches the icon.
 * - While the pointer is captured, `event.target` is `source`, wherever the pointer is. On touch
 *   the browser captures the pointer to the element it went down on anyway. Ask
 *   `document.elementFromPoint()` what is under the pointer.
 * - A finger: the grid scrolls on touchmove (addScrollEventListeners.ts, on the grid element). The
 *   touchmove events of a finger followed here stop at `source`: the finger drags or resizes, the
 *   grid does not scroll under it.
 *
 * Returns a function that stops following before the pointer is let go.
 */
export function followPointer(source: HTMLElement, down: PointerEvent, handlers: PointerHandlers) {
    const gesture = new AbortController();
    const options = { signal: gesture.signal };
    const stop = () => gesture.abort();

    document.addEventListener(
        'pointermove',
        (event) => {
            if (event.pointerId === down.pointerId) {
                handlers.move(event);
            }
        },
        options
    );

    document.addEventListener(
        'pointerup',
        (event) => {
            if (event.pointerId === down.pointerId) {
                stop();
                handlers.up(event);
            }
        },
        options
    );

    document.addEventListener(
        'pointercancel',
        (event) => {
            if (event.pointerId === down.pointerId) {
                stop();
                handlers.cancel();
            }
        },
        options
    );

    if (down.pointerType === 'touch') {
        // a touch event goes to the element the finger went down on, inside source
        source.addEventListener('touchmove', (event) => event.stopPropagation(), options);
    }

    return stop;
}

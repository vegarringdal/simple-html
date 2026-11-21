/**
 * The popover api for the tests, loaded before every test file (vitest.config.ts `setupFiles`).
 *
 * happy-dom (the dom of the grid tests, 20.11.0) knows the `popover` attribute but has no
 * `showPopover()` / `hidePopover()`, and no top layer. The grid's menus are popovers and call them.
 * This stub only keeps whether a popover is shown, and throws where a browser throws for the mistakes
 * a test should catch: no popover attribute, or not in the document yet. Light dismiss, the `toggle`
 * events and the top layer are not here: the grid's menus are `popover="manual"` and use none of them.
 *
 * Nothing is changed in a test environment that has the api, or no dom at all (the node tests).
 */

const shown = new WeakSet<Element>();

/**
 * true when `element` was shown with showPopover() and is still in the document: removing a popover
 * hides it, in a browser too
 */
export function isPopoverShown(element: Element | null): boolean {
    return !!element && element.isConnected && shown.has(element);
}

// typeof, not `in`: the dom types say every HTMLElement has it, `in` would narrow the prototype to never
if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover !== 'function') {
    HTMLElement.prototype.showPopover = function (this: HTMLElement) {
        if (this.popover === null) {
            throw new DOMException('showPopover(): the element has no popover attribute', 'NotSupportedError');
        }
        if (!this.isConnected) {
            throw new DOMException('showPopover(): the element is not in the document', 'InvalidStateError');
        }
        shown.add(this);
    };
    HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
        shown.delete(this);
    };
}

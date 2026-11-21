import { vi } from 'vitest';
import type { GridElement } from '../gridElement';

/**
 * Helpers for the interaction tests (menus, header filters, drag/drop, key navigation).
 * Builds on gridTestHelpers.ts, which mounts the grid.
 */

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * the Grid instance behind a mounted element, the gridFunctions take this as ctx
 */
export function gridOf(element: GridElement) {
    return (element as any).grid;
}

/**
 * first menu entry (context menus, the menu bottom button, filter editor buttons) whose text
 * starts with `text`
 */
export function menuItem(text: string): HTMLElement {
    const items = Array.from(
        document.querySelectorAll('.simple-html-grid-menu-item, .simple-html-label-button-menu-bottom, .grid-button')
    );
    return items.find((el) => el.textContent?.trim().startsWith(text)) as HTMLElement;
}

/**
 * every row menu entry whose text is exactly `text`, in dom order
 * (paste and clear in the row menu are both called "Cell (selected rows)")
 */
export function menuItemsExact(text: string): HTMLElement[] {
    return Array.from(document.querySelectorAll('.simple-html-grid-menu-item')).filter(
        (el) => el.textContent?.replace(/\s+/g, ' ').trim() === text
    ) as HTMLElement[];
}

/**
 * the header filter input of a column, found through the attribute the grid put on its cell
 */
export function headerFilterInput(element: GridElement, attribute: string): HTMLInputElement {
    return Array.from(element.querySelectorAll('input.simple-html-grid-cell-filter-input')).find(
        (input) => (input.parentElement as any)?.$attribute === attribute
    ) as HTMLInputElement;
}

/**
 * types into a header filter the way a user does - value, then change (blur/enter)
 */
export function typeInHeaderFilter(element: GridElement, attribute: string, value: string) {
    const input = headerFilterInput(element, attribute);
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * opens the right click menu on a body cell
 */
export function openRowMenu(element: GridElement, attribute: string, rowIndex = 0) {
    const cell = element.querySelectorAll(`input[data-attribute="${attribute}"]`)[rowIndex] as HTMLElement;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
}

/**
 * opens the right click menu on a header filter
 */
export function openFilterMenu(element: GridElement, attribute: string) {
    headerFilterInput(element, attribute).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100 }));
}

/**
 * header label cell of a column, the element that carries the drag/drop events
 */
export function labelCell(element: GridElement, attribute: string): HTMLElement {
    return Array.from(element.querySelectorAll('.simple-html-grid-col-cell.simple-html-label')).find(
        (cell: any) => cell.$attribute === attribute && cell.getAttribute('type') === 'label'
    ) as HTMLElement;
}

/**
 * A pointer event the way a browser sends it. happy-dom's defaults are not a browser's (pointerId 0,
 * pointerType '', isPrimary false, no bubbling), so they are set here: the mouse, pointer 1, the
 * primary pointer, the left button (`button` -1 on a move, `buttons` the buttons held after it).
 * Change any of it with `init`: `{ pointerType: 'touch' }`, `{ button: 2 }`, `{ isPrimary: false }`.
 */
export function pointerEvent(
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    init: PointerEventInit = {}
): PointerEvent {
    return new PointerEvent(type, {
        bubbles: true,
        cancelable: type !== 'pointercancel',
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
        ...init
    });
}

/**
 * What the browser's hit test finds under the pointer from now on: `document.elementFromPoint()`.
 * happy-dom lays nothing out, its elementFromPoint() is always null - and a drag asks it for the
 * drop target, the target of a captured pointer's events is the dragged cell. Restore it with
 * `mockRestore()` on the result (or vi.restoreAllMocks()).
 */
export function pointerOver(element: Element | null) {
    return vi.spyOn(document, 'elementFromPoint').mockReturnValue(element);
}

/**
 * a touch on `target` (a Touch for the `touches` of a TouchEvent)
 */
export function touchAt(target: Element, clientX: number, clientY: number) {
    return new Touch({ identifier: 1, target, clientX, clientY });
}

/**
 * drag and drop with a mouse, as the browser sends it: pointerdown on the source, then a move far
 * enough to be a drag (dragEvent captures the pointer to the source, so the move and the pointerup
 * go to the source too and bubble to the document). `target` is what is under the pointer.
 */
export function dragAndDrop(source: HTMLElement, target: HTMLElement) {
    const hitTest = pointerOver(target);
    source.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    source.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 10 }));
    source.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10 }));
    hitTest.mockRestore();
}

/**
 * the resize handle of the header column element in slot `slot` of a section (its refID)
 */
export function resizeHandle(element: HTMLElement, slot: number, section: 'left' | 'middle' | 'right' = 'middle'): HTMLElement {
    const handle = section === 'right' ? 'simple-html-grid-col-resize-right' : 'simple-html-grid-col-resize';
    return element.querySelector(
        `.simple-html-grid-header-row-container-pinned-${section} > .simple-html-grid-col[refID="${slot}"] > .${handle}`
    ) as HTMLElement;
}

/**
 * drags the resize handle of the center header column in slot `slot` by `dx` pixels: pointerdown,
 * one move, pointerup. The handle captures the pointer, so all three go to the handle
 */
export function dragResizeHandle(element: HTMLElement, slot: number, dx: number) {
    const handle = resizeHandle(element, slot);
    handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 100 + dx }));
    handle.dispatchEvent(pointerEvent('pointerup', { clientX: 100 + dx }));
}

/**
 * opens the right click menu on a header label, the one with "Pin left", "Hide" ...
 */
export function openLabelMenu(element: GridElement, attribute: string) {
    const label = element.querySelector(`[data-attribute-header="${attribute}"]`) as HTMLElement;
    label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100 }));
}

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
 * drag and drop as dragEvent sees it: mousedown, hold past its 200ms click/drag timer, mouseup
 * on the target (bubbles to the document listener, which reads event.target)
 */
export async function dragAndDrop(source: HTMLElement, target: HTMLElement) {
    source.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
    await sleep(260);
    target.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, clientX: 50, clientY: 10 }));
}

/**
 * drags the resize handle of the center header column in slot `slot` by `dx` pixels
 */
export function dragResizeHandle(element: HTMLElement, slot: number, dx: number) {
    const handle = element.querySelector(
        `.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col[refID="${slot}"] > .simple-html-grid-col-resize`
    ) as HTMLElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + dx }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 100 + dx }));
}

/**
 * opens the right click menu on a header label, the one with "Pin left", "Hide" ...
 */
export function openLabelMenu(element: GridElement, attribute: string) {
    const label = element.querySelector(`[data-attribute-header="${attribute}"]`) as HTMLElement;
    label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100 }));
}

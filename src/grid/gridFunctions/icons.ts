import { html } from 'lit-html';

/**
 * Small icons of the detail form, its tab of the grid config dialog and the column chooser. Each is
 * drawn on a grid of whole px (one unit of the viewBox is a pixel at the size grid.css gives it), so
 * the lines are sharp, filled or stroked with `currentColor` - the css sets the colour, one of the
 * theme's variables. Hidden from a screen reader: what they mean is said by the element they are in.
 */

/**
 * The drag handle: six dots, two columns of three (6 x 10 px). The same in the list of the fields of
 * the Detail form tab (at the right of a field) and in the column chooser (at the left of a field): a
 * row that can be dragged
 */
export const DRAG_HANDLE_ICON = html`<svg
    class="simple-html-grid-drag-handle-icon"
    viewBox="0 0 6 10"
    aria-hidden="true"
    focusable="false"
>
    <path d="M0 0h2v2H0z M4 0h2v2H4z M0 4h2v2H0z M4 4h2v2H4z M0 8h2v2H0z M4 8h2v2H4z" />
</svg>`;

/** A pencil, the point down left (10 x 10 px): rename the column, in the column chooser */
export const PENCIL_ICON = html`<svg class="simple-html-grid-pencil-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M1 9l.6-2.6L6.4 1.6 8.4 3.6 3.6 8.4z M7.1.9L8 0l2 2-.9.9z" />
</svg>`;

/** A magnifying glass (10 x 10 px), in front of the column chooser's search */
export const SEARCH_ICON = html`<svg
    class="simple-html-grid-search-icon"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    aria-hidden="true"
    focusable="false"
>
    <circle cx="4" cy="4" r="3" />
    <path d="M6.3 6.3 9.5 9.5" />
</svg>`;

/**
 * A chevron that points right (8 x 8 px): the button of the detail form's title bar. The css turns it
 * to where the form goes - right to collapse it at the right, left to expand it, down and up under the
 * rows
 */
export const CHEVRON_ICON = html`<svg
    class="simple-html-grid-chevron-icon"
    viewBox="0 0 8 8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
    focusable="false"
>
    <path d="M2.5 1 5.5 4 2.5 7" />
</svg>`;

import { html } from 'lit-html';

/**
 * The chevrons of the date picker: thin strokes in the text colour (currentColor), square ends. The
 * size is set in date.css. Decorative (aria-hidden): the button around one has the name.
 * html and not svg``: the `<svg>` element itself is an html element (see lit-html's svg)
 *
 * @param path the `d` of the path, in a 16 x 16 box
 */
function chevron(path: string) {
    return html`<svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="square"
        aria-hidden="true"
    >
        <path d=${path} />
    </svg>`;
}

/** ‹ the month before */
export const chevronLeft = () => chevron('M10 3.5 5.5 8l4.5 4.5');
/** › the month after */
export const chevronRight = () => chevron('M6 3.5 10.5 8 6 12.5');
/** « the year before */
export const chevronsLeft = () => chevron('M8 3.5 3.5 8 8 12.5M12.5 3.5 8 8l4.5 4.5');
/** » the year after */
export const chevronsRight = () => chevron('M3.5 3.5 8 8l-4.5 4.5M8 3.5l4.5 4.5L8 12.5');
/** down: one hour or minute less */
export const chevronDown = () => chevron('M3.5 6 8 10.5 12.5 6');
/** up: one hour or minute more */
export const chevronUp = () => chevron('M3.5 10 8 5.5l4.5 4.5');

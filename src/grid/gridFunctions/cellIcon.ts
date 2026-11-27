import { html, nothing, svg, type TemplateResult } from 'lit-html';
import { type IconColor, type IconLevel, type IconSetFormat, type IconShape, iconOf } from '../dataBars';
import type { Grid } from '../grid';
import { gridText } from './gridText';

/**
 * The icon of an icon set (`ColumnFormat.icons`, dataBars.ts) in a cell of a number column, and in the
 * preview of the grid config dialog: an svg of 12x12px in the colour of the icon - the theme's
 * `--simple-html-grid-icon-green-color`, `-amber-`, `-red-` - at the left of the cell (`position:
 * 'before'`) or its right, the input's text clear of it (grid.css).
 *
 * For a screen reader the icon is the level of the value in words, *High*, *Middle* or *Low* (the texts
 * `cell.icon.*`): visually hidden text in it, the description of the cell's input (`aria-describedby`)
 * as the marker of a multiline cell is. The svg itself is hidden from it.
 */

/** the shapes, drawn in 12x12 with the fill of the icon's colour */
const SHAPES: Readonly<Record<IconShape, TemplateResult>> = {
    up: svg`<path d="M6 1.5 11 10H1z" />`,
    side: svg`<path d="M2 1.5 10.5 6 2 10.5z" />`,
    down: svg`<path d="M1 2h10L6 10.5z" />`,
    circle: svg`<circle cx="6" cy="6" r="5" />`,
    flag: svg`<path d="M2 1h1.5v10H2zM3.5 1.5h7L8.5 4l2 2.5h-7z" />`,
    check: svg`<path d="M1.2 6.3 2.6 4.9 4.8 7.1 9.4 2.5 10.8 3.9 4.8 9.9z" />`,
    exclamation: svg`<path d="M5 1h2v6.5H5zM5 9h2v2H5z" />`,
    cross: svg`<path d="M2.4 1 6 4.6 9.6 1 11 2.4 7.4 6 11 9.6 9.6 11 6 7.4 2.4 11 1 9.6 4.6 6 1 2.4z" />`
};

/**
 * An icon alone, hidden from a screen reader: the three of a set in the grid config dialog's picker
 */
export function iconSvg(shape: IconShape, color: IconColor): TemplateResult {
    // the <svg> element in an html template (lit makes it an svg element there), its shape an svg one
    return html`<svg class=${`simple-html-grid-cell-icon-svg simple-html-grid-cell-icon-${color}`} viewBox="0 0 12 12" aria-hidden="true" focusable="false">${SHAPES[shape]}</svg>`;
}

/**
 * the class of the input of a cell with an icon: its text stops before the icon, `-before` or `-after`
 */
export function iconInputClass(icons: IconSetFormat): string {
    return `simple-html-grid-cell-with-icon-${icons.position ?? 'before'}`;
}

/**
 * The icon of a level: the svg, the level in words for a screen reader
 * @param id the id of the element, the cell's input is described by it
 * @param top its top in px in a cell taller than a line - on the first line, with the text; undefined in
 * the middle of the cell
 */
export function cellIconTemplate(ctx: Grid, level: IconLevel, icons: IconSetFormat, id: string, top?: number): TemplateResult {
    const { shape, color } = iconOf(level, icons);
    return html`<span
        class=${`simple-html-grid-cell-icon simple-html-grid-cell-icon-${icons.position ?? 'before'} simple-html-grid-cell-icon-${color}`}
        id=${id}
        aria-hidden="true"
        data-level=${level}
        data-shape=${shape}
        style=${top === undefined ? nothing : `top:${top}px;`}
        ><svg class="simple-html-grid-cell-icon-svg" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${SHAPES[shape]}</svg
        ><span class="simple-html-visually-hidden">${gridText(ctx, `cell.icon.${level}`)}</span></span
    >`;
}

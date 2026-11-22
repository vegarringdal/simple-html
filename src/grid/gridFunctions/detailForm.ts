import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { DetailForm, ParsedGridConfig } from '../gridConfig';
import { asPx } from './asPx';
import { cellTextOf } from './cellText';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getColumnLabel } from './getColumnLabel';
import { getGroupingWidth } from './getGroupingWidth';
import { gridText } from './gridText';
import { normalizeLineBreaks, textLines } from './multilineText';
import { tabBackFromDetailForm } from './tabExit';
import { undoRedoAction } from './undoRedoKey';

/**
 * The detail form (`GridConfig.detailForm`, `GridState.detailForm`): a panel inside the grid element
 * with the current row as a form - a label and a value for each field of the state's `fields`, in
 * their order.
 *
 * - **Where**: at the right of the rows, from under the grouping panel down to the footer, `width` px
 *   wide (updateMainElementSizes gives the header, the rows, the scrollbars and the totals row that much
 *   less room, see detailFormSpace). Where the rows would have too little room beside it - less than the
 *   form, or the scrolling columns less than MIN_MIDDLE (a phone, wide pinned columns) - it is under the
 *   rows instead, over the footer, 40 % of the grid's height. The footer stays as wide as the grid.
 * - **The row**: the current row (`datasource.currentEntity`) while it is a data row that is shown -
 *   not a group row, not filtered out. Without one it says "No row".
 * - **The values** as the cells show them (cellTextOf: the display format, a template, a lookup's
 *   label, numberOverride). A text of several lines (multilineText.ts) is a textarea as tall as its
 *   lines: all of it can be read. A checkbox for a boolean cell. A row with a link (ColumnFormat.link)
 *   has the link after the value.
 * - **Editing**, where the cell can be edited (the grid's `readonly`, `__isCellReadonly` - the column's
 *   `readonly` and the `isReadonly` hook - and `allowPasteClearOnly`), the way a cell is: every keystroke
 *   is written to the row with the formatter's `parse` inside `History.typing()` - what is typed in a
 *   field is one step of the undo history, ended when the field loses the focus - and the row validates
 *   it; a field with the focus shows the formatter's `formatForEdit`. The errors are under the field.
 *   Ctrl+Z / Ctrl+Y undo and redo as in a cell, the focus stays. A lookup column is shown, not edited.
 * - **Rendered again** with every render of the rows on screen (triggerScrollEvent: another current
 *   row, a filter, a sort, a rebuild, undo) and after values changed (renderChangedRows). The field the
 *   user types in keeps its text, as editedInput does for a cell.
 * - **For a screen reader** a region named by its title, each value's label tied to it (`for`), errors
 *   by `aria-describedby`. In the order of Tab after the footer (tabExit.ts): the last element of the
 *   grid before the end Tab leaves it from.
 *
 * The state's part is checked and copied here too (assertDetailForm, copyDetailForm).
 */

/** the class of the form's element, made by createDom */
export const DETAIL_FORM_CLASS = 'simple-html-grid-detail-form';

/** the width in px when the state gives none */
export const DETAIL_FORM_WIDTH = 300;

/** the least width in px: a smaller `width` is laid out this wide */
export const DETAIL_FORM_MIN_WIDTH = 150;

/** the share of the grid's height the form has under the rows, in a narrow grid */
const BELOW_SHARE = 0.4;

/**
 * the least room in px the scrolling columns keep beside the form: with less the form goes under the
 * rows. A column or two
 */
const MIN_MIDDLE = 150;

/** the least and most lines a textarea of a multiline value has (its `rows`, where field-sizing is not supported) */
const MIN_LINES = 3;
const MAX_LINES = 30;

/**
 * The detail form a grid starts with when the config gives none: not shown, no fields. A new object
 * each time, the grid keeps it
 */
export function noDetailForm(): DetailForm {
    return { show: false, fields: [] };
}

/**
 * A copy of a detail form, as the state keeps it: `show` a boolean, each field once, `width` only when
 * it is given
 */
export function copyDetailForm(form: DetailForm): DetailForm {
    const copy: DetailForm = { show: form.show === true, fields: [...new Set(form.fields)] };
    if (form.width !== undefined) {
        copy.width = form.width;
    }
    return copy;
}

/**
 * Checks a detail form from a config or a state - plain JavaScript and JSON are not checked by
 * TypeScript: an object with `show` (a boolean), `fields` (an array of field names) and maybe `width`
 * (a number of px, more than 0)
 * @param where the start of the message: `GridConfig.detailForm`, `setState: detailForm`
 * @throws a `TypeError` that says what is wrong
 */
export function assertDetailForm(form: unknown, where: string): asserts form is DetailForm {
    if (typeof form !== 'object' || form === null || Array.isArray(form)) {
        throw new TypeError(`${where} is an object { show, fields, width? }, got ${JSON.stringify(form)}`);
    }
    const { show, fields, width } = form as Record<string, unknown>;
    if (typeof show !== 'boolean') {
        throw new TypeError(`${where}.show is true or false, got ${JSON.stringify(show)}`);
    }
    if (!Array.isArray(fields) || fields.some((field) => typeof field !== 'string')) {
        throw new TypeError(`${where}.fields is an array of field names, got ${JSON.stringify(fields)}`);
    }
    if (width !== undefined && (typeof width !== 'number' || !Number.isFinite(width) || width <= 0)) {
        throw new TypeError(`${where}.width is a number of px, more than 0, got ${JSON.stringify(width)}`);
    }
}

/**
 * The width in px the form is laid out with: the state's `width`, at least DETAIL_FORM_MIN_WIDTH
 */
export function detailFormWidth(form: DetailForm): number {
    return Math.round(Math.max(form.width ?? DETAIL_FORM_WIDTH, DETAIL_FORM_MIN_WIDTH));
}

/**
 * The room the form takes from the rows, in px: at the right (`right`), or under the rows (`below`)
 * where the rows would have too little room beside it - less than the form's width, or the scrolling
 * columns less than MIN_MIDDLE besides the row numbers, the pinned columns and the scrollbar. Both 0
 * when it is not shown. For updateMainElementSizes
 */
export function detailFormSpace(ctx: Grid): { right: number; below: number } {
    const config = ctx.gridInterface.__getGridConfig();
    const form = config.detailForm;
    if (!form.show) {
        return { right: 0, below: 0 };
    }
    const width = detailFormWidth(form);
    const rows = ctx.element.clientWidth - width;
    const pinned =
        config.__selectSizeWidth +
        config.__leftWidth +
        getGroupingWidth(ctx, LEFT_PINNED_COLTYPE) +
        config.__rightWidth +
        config.__scrollbarSize;
    const middle = config.layout.center.length ? MIN_MIDDLE : 0;
    if (rows >= width && rows - pinned >= middle) {
        return { right: width, below: 0 };
    }
    return { right: 0, below: Math.round(ctx.element.clientHeight * BELOW_SHARE) };
}

/**
 * Puts the form where detailFormSpace says, for updateMainElementSizes: at the right from under the
 * grouping panel to the footer, or under the rows over the footer. Hidden when it is not shown
 */
export function placeDetailForm(ctx: Grid, space: { right: number; below: number }) {
    const element = ctx.detailForm;
    if (!element) {
        return;
    }
    const config = ctx.gridInterface.__getGridConfig();
    element.hidden = !space.right && !space.below;
    element.classList.toggle('simple-html-grid-detail-form-below', space.below > 0);
    if (space.right) {
        element.style.top = asPx(config.panelHeight);
        element.style.left = '';
        element.style.width = asPx(space.right);
        element.style.height = '';
    } else {
        element.style.top = '';
        element.style.left = asPx(0);
        element.style.width = '';
        element.style.height = asPx(space.below);
    }
    element.style.right = asPx(0);
    element.style.bottom = asPx(config.footerHeight);
}

/**
 * true when the event's target is in the form: the grid's wheel and swipe leave it to the browser, the
 * form scrolls on its own
 */
export function isInDetailForm(ctx: Grid, target: EventTarget | null): boolean {
    return !!ctx.detailForm && target instanceof Node && ctx.detailForm.contains(target);
}

/**
 * The row the form shows: the current row while it is a data row that is shown, with its index in the
 * displayed rows. null without one
 */
export function detailFormRow(ctx: Grid): { row: Entity; index: number } | null {
    const datasource = ctx.gridInterface.getDatasource();
    const current = datasource.currentEntity;
    if (!current || isGroupRow(current)) {
        return null;
    }
    const index = datasource.getRows().indexOf(current);
    return index === -1 ? null : { row: current as Entity, index };
}

/**
 * The id of an element of the form, unique in the page: a page can have several grids
 */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-detail-${part}`;
}

/**
 * Makes the form's element for createDom: a region named by its title, empty and hidden until
 * updateMainElementSizes places it and renderDetailForm fills it. Shift+Tab on its first field goes back
 * into the grid, see tabBackFromDetailForm
 */
export function createDetailForm(ctx: Grid): HTMLElement {
    const element = document.createElement('div');
    element.className = DETAIL_FORM_CLASS;
    element.hidden = true;
    element.setAttribute('role', 'region');
    element.setAttribute('aria-labelledby', idOf(ctx, 'title'));
    // on the element itself: it goes with it
    element.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.target === element.querySelector('input, textarea, a[href]')) {
            tabBackFromDetailForm(ctx, event);
        }
    });
    ctx.detailForm = element;
    return element;
}

/**
 * the grids whose form is being rendered: a field with the focus that a render takes away gets a blur,
 * and its blur renders the form - not inside the render, lit-html would remove what it is removing
 */
const rendering = new WeakSet<Grid>();

/**
 * Renders the form: its title and the row's fields - "No row" without a row. Nothing while it is not
 * shown. Called with every render of the rows on screen (triggerScrollEvent) and after values changed
 * (renderChangedRows). Nothing when called while it renders: that render shows what is there
 */
export function renderDetailForm(ctx: Grid) {
    // made by createDom: nothing before it
    const element = ctx.detailForm;
    if (!element || rendering.has(ctx)) {
        return;
    }
    rendering.add(ctx);
    try {
        renderForm(ctx, element);
    } finally {
        rendering.delete(ctx);
    }
}

/**
 * The render of renderDetailForm
 */
function renderForm(ctx: Grid, element: HTMLElement) {
    const config = ctx.gridInterface.__getGridConfig();
    if (!config.detailForm.show) {
        render(nothing, element);
        return;
    }
    const shown = detailFormRow(ctx);
    const fields = config.detailForm.fields;
    let content: TemplateResult;
    if (!shown) {
        content = html`<div class="simple-html-grid-detail-form-empty">${gridText(ctx, 'detailForm.noRow')}</div>`;
    } else if (!fields.length) {
        content = html`<div class="simple-html-grid-detail-form-empty">${gridText(ctx, 'detailForm.noFields')}</div>`;
    } else {
        content = html`${fields.map((field, index) => fieldTemplate(ctx, config, shown.row, field, index))}`;
    }
    render(
        html`<div class="simple-html-grid-detail-form-titlebar">
                <span class="simple-html-grid-detail-form-title" id=${idOf(ctx, 'title')}>${gridText(ctx, 'detailForm.title')}</span>
                ${
                    shown
                        ? html`<span class="simple-html-grid-detail-form-row">${gridText(ctx, 'detailForm.row', { row: shown.index + 1 })}</span>`
                        : nothing
                }
            </div>
            <div class="simple-html-grid-detail-form-body simple-html-dialog-scroller">${content}</div>`,
        element
    );
}

/**
 * A field of the form: its label, its value - an input, a textarea for text of several lines, a
 * checkbox - the link of the row, the errors. Editable where the cell is
 * @param index the field's place in the form: its ids
 */
function fieldTemplate(ctx: Grid, config: ParsedGridConfig, row: Entity, field: string, index: number): TemplateResult {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const history = datasource.getDataContainer().__history;
    const id = idOf(ctx, `field-${index}`);
    const errorsId = idOf(ctx, `errors-${index}`);
    const label = getColumnLabel(ctx, field);
    const lookup = gridInterface.__getLookupColumn(field);

    // what the cell shows: its type (dynamicCellTypeColumn can change it per row), its text, multiline
    const cell = cellTextOf(ctx, field)(row);
    // the cell's formatter: formatForEdit and parse are the field's, of the cell's type
    const formatter = gridInterface.__getCellFormatter(field, cell.type, row);
    const readonly =
        !!config.readonly ||
        !!lookup ||
        !!config.columns[field]?.allowPasteClearOnly ||
        gridInterface.__isCellReadonly(row, field);
    const errors = datasource.__getRowErrors(row)?.get(field) ?? [];
    const required = datasource.getField(field).validate.some((rule) => rule.id === 'required');
    const link = cell.type === 'text' && !lookup ? gridInterface.__getCellLink(field, row) : null;

    // the element of the last render: the one the user may be typing in
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const before = ctx.detailForm?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`) ?? null;
    const focused = before !== null && before === root.activeElement;
    const editing = history.editingCell();
    const typedIn = focused && editing?.row === row && editing.field === field;
    // a textarea stays one while it has the focus, also when the line breaks were typed away
    const multiline = cell.multiline || (focused && before instanceof HTMLTextAreaElement);

    // what is typed in it is kept; a field with the focus that can be edited shows the plain value
    const text = typedIn
        ? (before as HTMLInputElement | HTMLTextAreaElement).value
        : focused && !readonly
          ? (formatter.formatForEdit?.(row[field]) ?? cell.text)
          : cell.text;

    /** a keystroke: written to the row, one step of the undo history with the ones before it */
    const write = (event: Event) => {
        if (readonly) {
            return;
        }
        const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
        history.typing(() => {
            row[field] = formatter.parse(multiline ? normalizeLineBreaks(value) : value);
        });
    };
    /** the focus in: the plain value to type over. Out: typing again is a new step, the text formatted */
    const focus = () => renderDetailForm(ctx);
    const blur = () => {
        if (!readonly) {
            history.endTyping();
        }
        renderDetailForm(ctx);
    };
    /** Ctrl+Z / Ctrl+Y: the history's, unless the field has typing of its own to undo - the browser's then */
    const keydown = (event: KeyboardEvent) => {
        const action = undoRedoAction(event);
        if (!action || config.readonly || history.isTyping(row, field)) {
            return;
        }
        if (action === 'undo' ? datasource.undo() : datasource.redo()) {
            event.preventDefault();
        }
    };

    const described = errors.length ? errorsId : nothing;
    const invalid = errors.length ? 'true' : nothing;
    let control: TemplateResult;
    if (cell.type === 'boolean') {
        control = html`<input
            id=${id}
            class="simple-html-grid-detail-form-check"
            type="checkbox"
            .checked=${live(Boolean(row[field]))}
            aria-readonly=${readonly ? 'true' : nothing}
            aria-invalid=${invalid}
            aria-describedby=${described}
            @click=${(event: MouseEvent) => {
                // a readonly checkbox is not changed by a click
                if (readonly) {
                    event.preventDefault();
                }
            }}
            @change=${(event: Event) => {
                if (!readonly) {
                    row[field] = (event.target as HTMLInputElement).checked;
                }
            }}
            @keydown=${keydown}
        />`;
    } else if (multiline) {
        // as many lines as the text has (a browser without field-sizing: content), it grows with the text
        const lines = Math.min(Math.max(textLines(text).length + 1, MIN_LINES), MAX_LINES);
        control = html`<textarea
            id=${id}
            class="simple-html-grid-detail-form-input simple-html-grid-detail-form-text"
            rows=${lines}
            .value=${live(text)}
            .readOnly=${readonly}
            aria-required=${required && !readonly ? 'true' : nothing}
            aria-invalid=${invalid}
            aria-describedby=${described}
            @input=${write}
            @focus=${focus}
            @blur=${blur}
            @keydown=${keydown}
        ></textarea>`;
    } else {
        control = html`<input
            id=${id}
            class="simple-html-grid-detail-form-input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            .value=${live(text)}
            .readOnly=${readonly}
            aria-required=${required && !readonly ? 'true' : nothing}
            aria-invalid=${invalid}
            aria-describedby=${described}
            @input=${write}
            @focus=${focus}
            @blur=${blur}
            @keydown=${keydown}
        />`;
    }

    return html`<div class="simple-html-grid-detail-form-field" data-field=${field}>
        <label class="simple-html-grid-detail-form-label" for=${id}>${label}</label>
        ${control}
        ${
            link
                ? html`<a
                      class="simple-html-grid-detail-form-link"
                      href=${link.href}
                      target=${link.newTab ? '_blank' : nothing}
                      rel=${link.newTab ? 'noopener noreferrer' : nothing}
                      >${link.href}</a
                  >`
                : nothing
        }
        ${
            errors.length
                ? html`<div class="simple-html-grid-detail-form-errors" id=${errorsId}>
                      ${errors.map((message) => html`<div>${message}</div>`)}
                  </div>`
                : nothing
        }
    </div>`;
}

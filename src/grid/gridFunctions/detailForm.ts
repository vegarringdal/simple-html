import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import { colorRuleClasses, colorRuleOf, colorRuleStyle } from '../colorRules';
import type { Grid } from '../grid';
import type { DetailForm, DetailFormFieldOptions, DetailFormSection, ParsedGridConfig } from '../gridConfig';
import { asPx } from './asPx';
import { cellTextOf } from './cellText';
import { detailFormResizeHandle } from './detailFormResize';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getColumnLabel } from './getColumnLabel';
import { getGroupingWidth } from './getGroupingWidth';
import { gridText } from './gridText';
import { CHEVRON_ICON } from './icons';
import { normalizeLineBreaks, textLines } from './multilineText';
import { detailFormStops, tabBackFromDetailForm } from './tabExit';
import { attachTooltips, tooltipsEnabled } from './tooltip';
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
 *   has the link after the value. A value has the colours of its column's colour rule
 *   (ColumnFormat.rules) as its cell has them - not a checkbox.
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
 * - **Collapsed** (`expanded: false`): a strip DETAIL_FORM_COLLAPSED px wide at the right of the rows - as
 *   high under them - with only its title bar. The title is a button (`aria-expanded`, it controls the
 *   body) that expands and collapses it: toggleDetailForm, the state's `expanded`. Where it is - at the
 *   right or under the rows - does not change with it: that is the expanded width's.
 * - **Its width** is between `minWidth` and `maxWidth` (detailFormLimits). Its left edge is a splitter
 *   the user drags, or moves with the arrow keys (detailFormResize.ts).
 *
 * The state's part is checked and copied here too (assertDetailForm, copyDetailForm).
 */

/** the class of the form's element, made by createDom */
export const DETAIL_FORM_CLASS = 'simple-html-grid-detail-form';

/** the width in px when the state gives none */
export const DETAIL_FORM_WIDTH = 300;

/** the least width in px: a smaller `width` (or `minWidth`) is laid out this wide */
export const DETAIL_FORM_MIN_WIDTH = 150;

/**
 * the size in px of a collapsed form: the width of its strip at the right of the rows, the height of its
 * bar under them - its title bar (22px) and its line (2px)
 */
export const DETAIL_FORM_COLLAPSED = 24;

/** the class of a form under the rows, see placeDetailForm */
export const BELOW_CLASS = 'simple-html-grid-detail-form-below';

/** the class of a collapsed form, see placeDetailForm */
const COLLAPSED_CLASS = 'simple-html-grid-detail-form-collapsed';

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
 * true for an entry of `DetailForm.fields` that is a section, not a field name
 */
export function isDetailFormSection(entry: string | DetailFormSection): entry is DetailFormSection {
    return typeof entry === 'object' && entry !== null;
}

/**
 * A copy of a detail form, as the state keeps it: `show` a boolean, each field once and each section copied
 * (copyOptions); `width`, `expanded`, `minWidth`, `maxWidth` and `fieldOptions` (copyFieldOptions) only
 * when they are given
 */
export function copyDetailForm(form: DetailForm): DetailForm {
    const seen = new Set<string>();
    const fields: (string | DetailFormSection)[] = [];
    for (const entry of form.fields) {
        if (isDetailFormSection(entry)) {
            fields.push(copyOptions(entry, SECTION_OPTIONS) as unknown as DetailFormSection);
        } else if (!seen.has(entry)) {
            seen.add(entry);
            fields.push(entry);
        }
    }
    const copy: DetailForm = { show: form.show === true, fields };
    if (form.width !== undefined) {
        copy.width = form.width;
    }
    if (form.expanded !== undefined) {
        copy.expanded = form.expanded === true;
    }
    if (form.minWidth !== undefined) {
        copy.minWidth = form.minWidth;
    }
    if (form.maxWidth !== undefined) {
        copy.maxWidth = form.maxWidth;
    }
    const options = copyFieldOptions(form.fieldOptions);
    if (options) {
        copy.fieldOptions = options;
    }
    return copy;
}

/** the options of a field, in the order a copy has them */
const FIELD_OPTIONS = ['minRows', 'paddingTop', 'paddingBottom'] as const;

/** the options of a section, in the order a copy has them */
const SECTION_OPTIONS = ['section', 'panel', 'collapsed', 'paddingTop', 'paddingBottom'] as const;

/** the options of `names` that are given, in that order */
function copyOptions(given: object, names: readonly string[]): Record<string, unknown> {
    const copy: Record<string, unknown> = {};
    for (const name of names) {
        const value = (given as Record<string, unknown>)[name];
        if (value !== undefined) {
            copy[name] = value;
        }
    }
    return copy;
}

/**
 * A copy of the fields' options: each field's options that are given, a field with none left out.
 * undefined when no field has one
 */
export function copyFieldOptions(
    options: Record<string, DetailFormFieldOptions> | undefined
): Record<string, DetailFormFieldOptions> | undefined {
    const copy: Record<string, DetailFormFieldOptions> = {};
    for (const [field, given] of Object.entries(options ?? {})) {
        const one = copyOptions(given, FIELD_OPTIONS);
        if (Object.keys(one).length) {
            copy[field] = one;
        }
    }
    return Object.keys(copy).length ? copy : undefined;
}

/** true for a number of px, more than 0 */
const isPx = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Checks a detail form from a config or a state - plain JavaScript and JSON are not checked by
 * TypeScript: an object with `show` (a boolean), `fields` (an array of field names and sections,
 * assertOptions) and maybe `width`, `minWidth` and `maxWidth` (numbers of px, more than 0 - the least not
 * more than the most), `expanded` (a boolean) and `fieldOptions` (assertFieldOptions)
 * @param where the start of the message: `GridConfig.detailForm`, `setState: detailForm`
 * @throws a `TypeError` that says what is wrong
 */
export function assertDetailForm(form: unknown, where: string): asserts form is DetailForm {
    if (typeof form !== 'object' || form === null || Array.isArray(form)) {
        throw new TypeError(
            `${where} is an object { show, fields, width?, expanded?, minWidth?, maxWidth?, fieldOptions? }, got ${JSON.stringify(form)}`
        );
    }
    const { show, fields, width, expanded, minWidth, maxWidth } = form as Record<string, unknown>;
    if (typeof show !== 'boolean') {
        throw new TypeError(`${where}.show is true or false, got ${JSON.stringify(show)}`);
    }
    if (!Array.isArray(fields)) {
        throw new TypeError(`${where}.fields is an array of field names and sections, got ${JSON.stringify(fields)}`);
    }
    fields.forEach((entry, index) => {
        if (typeof entry === 'string') {
            return;
        }
        const at = `${where}.fields[${index}]`;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            throw new TypeError(`${at} is a field name or a section { section, panel?, ... }, got ${JSON.stringify(entry)}`);
        }
        if (typeof (entry as Record<string, unknown>).section !== 'string') {
            throw new TypeError(
                `${at}.section is the name of the section, a text, got ${JSON.stringify((entry as Record<string, unknown>).section)}`
            );
        }
        assertOptions(entry, at, SECTION_OPTIONS, 'a section');
    });
    for (const [name, value] of Object.entries({ width, minWidth, maxWidth })) {
        if (value !== undefined && !isPx(value)) {
            throw new TypeError(`${where}.${name} is a number of px, more than 0, got ${JSON.stringify(value)}`);
        }
    }
    if (expanded !== undefined && typeof expanded !== 'boolean') {
        throw new TypeError(`${where}.expanded is true or false, got ${JSON.stringify(expanded)}`);
    }
    if (typeof minWidth === 'number' && typeof maxWidth === 'number' && minWidth > maxWidth) {
        throw new TypeError(`${where}.minWidth (${minWidth}) is more than its maxWidth (${maxWidth})`);
    }
    assertFieldOptions((form as Record<string, unknown>).fieldOptions, `${where}.fieldOptions`);
}

/** what each option of a field or a section is, for the messages */
const OPTION_IS: Record<string, string> = {
    section: 'a text',
    panel: 'true or false',
    collapsed: 'true or false',
    minRows: `a whole number from 1 to ${MAX_LINES}`,
    paddingTop: 'a number of px, 0 or more',
    paddingBottom: 'a number of px, 0 or more'
};

/** true when an option has a value it can have */
function optionFits(name: string, value: unknown): boolean {
    switch (name) {
        case 'section':
            return typeof value === 'string';
        case 'panel':
        case 'collapsed':
            return typeof value === 'boolean';
        case 'minRows':
            return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LINES;
        default:
            // paddingTop, paddingBottom
            return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    }
}

/**
 * Checks the options of a field or a section: only `names`, each with a value it can have (optionFits)
 * @throws a `TypeError` that says which option and what it is
 */
function assertOptions(given: object, at: string, names: readonly string[], what: string) {
    for (const [name, value] of Object.entries(given)) {
        if (value === undefined) {
            continue;
        }
        if (!names.includes(name)) {
            throw new TypeError(`${at}.${name} is no option of ${what}, they are ${names.join(', ')}`);
        }
        if (!optionFits(name, value)) {
            throw new TypeError(`${at}.${name} is ${OPTION_IS[name]}, got ${JSON.stringify(value)}`);
        }
    }
}

/**
 * Checks `DetailForm.fieldOptions`: undefined, or an object of a field's options under its name -
 * `minRows` a whole number from 1 to MAX_LINES, `paddingTop` and `paddingBottom` numbers of px, 0 or more.
 * Nothing else
 * @throws a `TypeError` that says what is wrong
 */
function assertFieldOptions(options: unknown, where: string) {
    if (options === undefined) {
        return;
    }
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
        throw new TypeError(`${where} is an object of a field's options under its name, got ${JSON.stringify(options)}`);
    }
    for (const [field, given] of Object.entries(options)) {
        const at = `${where}.${field}`;
        if (typeof given !== 'object' || given === null || Array.isArray(given)) {
            throw new TypeError(
                `${at} is an object { ${FIELD_OPTIONS.map((name) => `${name}?`).join(', ')} }, got ${JSON.stringify(given)}`
            );
        }
        assertOptions(given, at, FIELD_OPTIONS, 'a field');
    }
}

/**
 * true while the form is expanded: its `expanded` is not `false`
 */
export function isDetailFormExpanded(form: DetailForm): boolean {
    return form.expanded !== false;
}

/**
 * The least and the most width in px the form is laid out with: `minWidth` - at least
 * DETAIL_FORM_MIN_WIDTH - and `maxWidth` (none: Infinity), not less than the least
 */
export function detailFormLimits(form: DetailForm): { min: number; max: number } {
    const min = Math.max(form.minWidth ?? DETAIL_FORM_MIN_WIDTH, DETAIL_FORM_MIN_WIDTH);
    return { min, max: Math.max(form.maxWidth ?? Number.POSITIVE_INFINITY, min) };
}

/**
 * The width in px the form is laid out with when it is expanded: the state's `width` (default
 * DETAIL_FORM_WIDTH) between its least and most width, see detailFormLimits
 */
export function detailFormWidth(form: DetailForm): number {
    const { min, max } = detailFormLimits(form);
    return Math.round(Math.min(Math.max(form.width ?? DETAIL_FORM_WIDTH, min), max));
}

/**
 * The widest the form can be at the right of the rows, in px: the rows keep as much room as the form -
 * half the grid - and the scrolling columns MIN_MIDDLE besides the row numbers, the pinned columns and
 * the scrollbar (that room only while there are scrolling columns)
 */
function roomAtRight(ctx: Grid): number {
    const config = ctx.gridInterface.__getGridConfig();
    const width = ctx.element.clientWidth;
    const pinned =
        config.__selectSizeWidth +
        config.__leftWidth +
        getGroupingWidth(ctx, LEFT_PINNED_COLTYPE) +
        config.__rightWidth +
        config.__scrollbarSize;
    const middle = config.layout.center.length ? MIN_MIDDLE : 0;
    return Math.floor(Math.min(width / 2, width - pinned - middle));
}

/**
 * The room the form takes from the rows, in px: at the right (`right`), or under the rows (`below`)
 * where its width does not fit at the right (roomAtRight: the rows would get less room than the form,
 * or the scrolling columns less than MIN_MIDDLE). Collapsed, it takes DETAIL_FORM_COLLAPSED px where it
 * is. Both 0 when it is not shown. `room`: roomAtRight, the widest a drag of its edge can make it. For
 * updateMainElementSizes
 */
export function detailFormSpace(ctx: Grid): { right: number; below: number; room: number } {
    const form = ctx.gridInterface.__getGridConfig().detailForm;
    if (!form.show) {
        return { right: 0, below: 0, room: 0 };
    }
    const room = roomAtRight(ctx);
    const expanded = isDetailFormExpanded(form);
    if (detailFormWidth(form) <= room) {
        return { right: expanded ? detailFormWidth(form) : DETAIL_FORM_COLLAPSED, below: 0, room };
    }
    const below = expanded ? Math.round(ctx.element.clientHeight * BELOW_SHARE) : DETAIL_FORM_COLLAPSED;
    return { right: 0, below, room };
}

/** the room at the right of each grid's rows at its last layout, see detailFormRoom */
const rooms = new WeakMap<Grid, number>();

/**
 * The widest the form can be at the right of the rows as the last layout found it (placeDetailForm):
 * the most a drag of its edge gives it. 0 before the first layout
 */
export function detailFormRoom(ctx: Grid): number {
    return rooms.get(ctx) ?? 0;
}

/**
 * Puts the form where detailFormSpace says, for updateMainElementSizes: at the right from under the
 * grouping panel to the footer, or under the rows over the footer (BELOW_CLASS). Hidden when it is not
 * shown. A collapsed form has COLLAPSED_CLASS: its title bar is all of it
 */
export function placeDetailForm(ctx: Grid, space: { right: number; below: number; room: number }) {
    const element = ctx.detailForm;
    if (!element) {
        return;
    }
    const config = ctx.gridInterface.__getGridConfig();
    rooms.set(ctx, space.room);
    element.hidden = !space.right && !space.below;
    element.classList.toggle(BELOW_CLASS, space.below > 0);
    element.classList.toggle(COLLAPSED_CLASS, !isDetailFormExpanded(config.detailForm));
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
 * The id of an element of the form, unique in the page: a page can have several grids. `form` is the
 * form's element (the splitter of its edge controls it)
 */
export function detailFormId(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-detail-${part}`;
}

/**
 * Makes the form's element for createDom: a region named by its title, empty and hidden until
 * updateMainElementSizes places it and renderDetailForm fills it. Shift+Tab on its first stop (the
 * button of its title) goes back into the grid, see tabBackFromDetailForm. The tooltip of the button
 * (Collapse / Expand the details) when the pointer rests on it, as the grid's `tooltips` option says
 */
export function createDetailForm(ctx: Grid): HTMLElement {
    const element = document.createElement('div');
    element.className = DETAIL_FORM_CLASS;
    element.id = detailFormId(ctx, 'form');
    element.hidden = true;
    element.setAttribute('role', 'region');
    element.setAttribute('aria-labelledby', detailFormId(ctx, 'title'));
    // on the element itself: it goes with it
    element.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.target === detailFormStops(ctx)[0]) {
            tabBackFromDetailForm(ctx, event);
        }
    });
    attachTooltips(element, () => tooltipsEnabled(ctx));
    ctx.detailForm = element;
    return element;
}

/**
 * Collapses an expanded form, expands a collapsed one: the button of its title bar. The state's
 * `expanded` (setState), so a saved state keeps it
 */
export function toggleDetailForm(ctx: Grid) {
    const gridInterface = ctx.gridInterface;
    const form = gridInterface.getState().detailForm;
    gridInterface.setState({ detailForm: { ...form, expanded: !isDetailFormExpanded(form) } });
}

/**
 * the grids whose form is being rendered: a field with the focus that a render takes away gets a blur,
 * and its blur renders the form - not inside the render, lit-html would remove what it is removing
 */
const rendering = new WeakSet<Grid>();

/**
 * Renders the form: its title bar - the button that collapses and expands it, the row's number - the
 * splitter of its edge and the row's fields - "No row" without a row. Collapsed, the title bar only.
 * Nothing while it is not shown. Called with every render of the rows on screen (triggerScrollEvent),
 * after values changed (renderChangedRows) and while its width is dragged (detailFormResize.ts).
 * Nothing when called while it renders: that render shows what is there
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
 * What the body of an expanded form shows: the row's fields - the ones before the first section, then
 * each section with its fields up to the next - else "No row" or "No fields"
 */
function bodyContent(ctx: Grid, config: ParsedGridConfig, shown: { row: Entity } | null): TemplateResult {
    const fields = config.detailForm.fields;
    if (!shown) {
        return html`<div class="simple-html-grid-detail-form-empty">${gridText(ctx, 'detailForm.noRow')}</div>`;
    }
    if (!fields.length) {
        return html`<div class="simple-html-grid-detail-form-empty">${gridText(ctx, 'detailForm.noFields')}</div>`;
    }
    const options = config.detailForm.fieldOptions ?? {};
    const loose: TemplateResult[] = [];
    const sections: { section: DetailFormSection; index: number; fields: TemplateResult[] }[] = [];
    fields.forEach((entry, index) => {
        if (isDetailFormSection(entry)) {
            sections.push({ section: entry, index, fields: [] });
            return;
        }
        const template = fieldTemplate(ctx, config, shown.row, entry, index, options[entry]);
        (sections.length ? sections[sections.length - 1].fields : loose).push(template);
    });
    return html`${loose}${sections.map((section) => sectionTemplate(ctx, section))}`;
}

/**
 * A section of the form (DetailFormSection): its header - a button that collapses and expands it
 * (`aria-expanded`, it controls the group) - and its fields in a group named by the header, hidden while
 * it is collapsed. A panel has a frame around it. Its room above and under it
 * @param index its place in the form's fields: its ids, and what its button toggles
 */
function sectionTemplate(
    ctx: Grid,
    { section, index, fields }: { section: DetailFormSection; index: number; fields: TemplateResult[] }
): TemplateResult {
    const collapsed = isSectionCollapsed(ctx, index, section);
    const headerId = detailFormId(ctx, `section-${index}`);
    const groupId = detailFormId(ctx, `section-${index}-fields`);
    const room: Record<string, string> = {};
    if (section.paddingTop) {
        room.marginTop = asPx(section.paddingTop);
    }
    if (section.paddingBottom) {
        room.marginBottom = asPx(section.paddingBottom);
    }
    const classes = ['simple-html-grid-detail-form-section'];
    if (section.panel) {
        classes.push('simple-html-grid-detail-form-panel');
    }
    if (collapsed) {
        classes.push('simple-html-grid-detail-form-section-collapsed');
    }
    return html`<div class=${classes.join(' ')} data-section=${index} style=${styleMap(room)}>
        <button
            type="button"
            class="simple-html-grid-detail-form-section-header"
            id=${headerId}
            aria-expanded=${collapsed ? 'false' : 'true'}
            aria-controls=${groupId}
            @click=${() => toggleDetailFormSection(ctx, index)}
        >
            ${CHEVRON_ICON}<span class="simple-html-grid-detail-form-section-title">${section.section}</span>
        </button>
        <div class="simple-html-grid-detail-form-section-fields" role="group" id=${groupId} aria-labelledby=${headerId} ?hidden=${collapsed}>
            ${collapsed ? nothing : fields}
        </div>
    </div>`;
}

/**
 * the sections the user opened or closed with their header, per grid: the section's index and whether it
 * is collapsed now - for the fields and sections they were toggled in. Other ones (the dialog's Apply,
 * setState, resetState with other fields or sections) start again from each section's `collapsed`, its
 * default; a width dragged, the form collapsed and expanded keep them
 */
const toggled = new WeakMap<Grid, { fields: string; collapsed: Map<number, boolean> }>();

/** the toggles of the grid's detail form now: none for other fields than they were made for */
function togglesOf(ctx: Grid): Map<number, boolean> {
    const fields = JSON.stringify(ctx.gridInterface.__getGridConfig().detailForm.fields);
    let entry = toggled.get(ctx);
    if (!entry || entry.fields !== fields) {
        entry = { fields, collapsed: new Map() };
        toggled.set(ctx, entry);
    }
    return entry.collapsed;
}

/**
 * true while a section is collapsed: as the user toggled it with its header, else its `collapsed` - the
 * default it starts with
 * @param index the section's place in the form's fields
 */
export function isSectionCollapsed(ctx: Grid, index: number, section: DetailFormSection): boolean {
    return togglesOf(ctx).get(index) ?? section.collapsed === true;
}

/**
 * Collapses an expanded section of the form, expands a collapsed one: the button of its header. Kept by the
 * grid while it shows this detail form - not in the state: the section's `collapsed` stays its default
 * @param index the section's place in the form's fields
 */
export function toggleDetailFormSection(ctx: Grid, index: number) {
    const entry = ctx.gridInterface.__getGridConfig().detailForm.fields[index];
    if (!entry || !isDetailFormSection(entry)) {
        return;
    }
    togglesOf(ctx).set(index, !isSectionCollapsed(ctx, index, entry));
    renderDetailForm(ctx);
}

/**
 * The render of renderDetailForm
 */
function renderForm(ctx: Grid, element: HTMLElement) {
    const config = ctx.gridInterface.__getGridConfig();
    const form = config.detailForm;
    if (!form.show) {
        render(nothing, element);
        return;
    }
    const expanded = isDetailFormExpanded(form);
    const shown = detailFormRow(ctx);
    // collapsed: the title bar only, nothing in the body to Tab to
    const content = expanded ? bodyContent(ctx, config, shown) : nothing;
    // the same elements expanded and collapsed: the button keeps the focus when it is pressed
    render(
        html`<div class="simple-html-grid-detail-form-titlebar">
                <button
                    type="button"
                    class="simple-html-grid-detail-form-toggle"
                    aria-expanded=${expanded ? 'true' : 'false'}
                    aria-controls=${detailFormId(ctx, 'body')}
                    data-tooltip=${gridText(ctx, expanded ? 'detailForm.collapse' : 'detailForm.expand')}
                    @click=${() => toggleDetailForm(ctx)}
                >
                    ${CHEVRON_ICON}<span class="simple-html-grid-detail-form-title" id=${detailFormId(ctx, 'title')}
                        >${gridText(ctx, 'detailForm.title')}</span
                    >
                </button>
                ${
                    shown && expanded
                        ? html`<span class="simple-html-grid-detail-form-row">${gridText(ctx, 'detailForm.row', { row: shown.index + 1 })}</span>`
                        : nothing
                }
            </div>
            ${expanded ? detailFormResizeHandle(ctx, form) : nothing}
            <div class="simple-html-grid-detail-form-body simple-html-dialog-scroller" id=${detailFormId(ctx, 'body')} ?hidden=${!expanded}>
                ${content}
            </div>`,
        element
    );
}

/**
 * A field of the form: its label, its value - an input, a textarea for text of several lines, a
 * checkbox - the link of the row, the errors. Editable where the cell is
 * @param index the field's place in the form: its ids
 * @param options its options (DetailForm.fieldOptions): the least lines of a textarea, the room above
 * and under it
 */
function fieldTemplate(
    ctx: Grid,
    config: ParsedGridConfig,
    row: Entity,
    field: string,
    index: number,
    options: DetailFormFieldOptions | undefined
): TemplateResult {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const history = datasource.getDataContainer().__history;
    const id = detailFormId(ctx, `field-${index}`);
    const errorsId = detailFormId(ctx, `errors-${index}`);
    const label = getColumnLabel(ctx, field);
    const lookup = gridInterface.__getLookupColumn(field);

    // what the cell shows: its type (dynamicCellTypeColumn can change it per row), its text, multiline
    const cell = cellTextOf(ctx, field)(row);
    // the cell's formatter: formatForEdit and parse are the field's, of the cell's type
    const formatter = gridInterface.__getCellFormatter(field, cell.type, row);
    // the grid's readonly for the row: a readonly grid, or a row the edit permissions lock (GridConfig.edit)
    const readonly =
        !gridInterface.__canChangeRow(row) ||
        !!lookup ||
        !!config.columns[field]?.allowPasteClearOnly ||
        gridInterface.__isCellReadonly(row, field);
    const errors = datasource.__getRowErrors(row)?.get(field) ?? [];
    const required = datasource.getField(field).validate.some((rule) => rule.id === 'required');
    const link = cell.type === 'text' && !lookup ? gridInterface.__getCellLink(field, row) : null;
    // the colours of the column's colour rule that matches the value (ColumnFormat.rules), as the cell has
    // them: on the input or the textarea
    const rule = colorRuleOf(gridInterface, field, row);
    const colors = colorRuleClasses(rule)
        .map((name) => ` ${name}`)
        .join('');
    // a custom colour of the rule: custom properties, set with style.setProperty() (styleMap)
    const colorStyle = styleMap(colorRuleStyle(rule));

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
        // as many lines as the text has (a browser without field-sizing: content), it grows with the text;
        // at least minRows (the field's option), as tall as that with field-sizing too
        const minRows = options?.minRows;
        const lines = Math.min(Math.max(textLines(text).length + 1, minRows ?? MIN_LINES), MAX_LINES);
        control = html`<textarea
            id=${id}
            class=${`simple-html-grid-detail-form-input simple-html-grid-detail-form-text${colors}`}
            style=${styleMap({ ...colorRuleStyle(rule), ...(minRows ? { '--simple-html-grid-detail-form-min-rows': String(minRows) } : {}) })}
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
            class=${`simple-html-grid-detail-form-input${colors}`}
            style=${colorStyle}
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

    const room: Record<string, string> = {};
    if (options?.paddingTop) {
        room.paddingTop = asPx(options.paddingTop);
    }
    if (options?.paddingBottom) {
        room.paddingBottom = asPx(options.paddingBottom);
    }
    return html`<div class="simple-html-grid-detail-form-field" data-field=${field} style=${styleMap(room)}>
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

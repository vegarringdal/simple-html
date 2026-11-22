import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import {
    isInternalField,
    type LinkResult,
    templateFields,
    templateProblem,
    urlTemplateProblem,
    VALUE_PLACEHOLDER
} from '../cellTemplate';
import {
    CHECKED_VALUE,
    type CheckboxFormat,
    type ColumnFormat,
    checkboxProblem,
    checkboxValues,
    formatNumberAs,
    hasDisplayFormat,
    hasValueFormat,
    isCheckedValue,
    UNCHECKED_VALUE
} from '../columnFormat';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { numberOverrideOf, overrideNumberText, zeroText } from './cellText';
import { defaultHeaderOperator, headerFilterType, headerOperators } from './columnFilterOptions';
import { contextMenuAttributes } from './contextMenuAttributes';
import {
    applyDetailForm,
    type DetailFormDraft,
    detailFormDraft,
    detailFormResetButton,
    detailFormTabPanel
} from './detailFormSettings';
import { moveDialog, resizeHandles, showDialog } from './dialogFrame';
import { formatSubmenu, NUMBER_SAMPLE, PERCENT_SAMPLE } from './formatSubmenu';
import { getColumnLabel, getConfigColumnLabel } from './getColumnLabel';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { getLayoutFields } from './getLayoutFields';
import { configTabs, type GridConfigTab, tabId, tabPanelId } from './gridConfigTabs';
import { gridText } from './gridText';
import { defaultFilterPlaceholder, headerFilterPlaceholder } from './headerFilterPlaceholder';
import { HEADER_OPERATOR_TEXTS, setHeaderFilterOperator } from './headerOperatorMenu';
import { removeContextMenu } from './removeContextMenu';
import { closeFilterEditor } from './renderFilterEditor';
import { isTypedCharacter } from './renderRowCell';
import { closeTextEditor } from './textEditor';
import { attachTooltips, hideTooltip, tooltipsEnabled } from './tooltip';

/**
 * The grid config dialog - the column settings: how each column of the layout shows its values, set by
 * the user. A modal `<dialog class="simple-html-grid filter-editor-content column-settings">` on the
 * body, of the filter editor's kind (dialogFrame.ts): its title bar, body and footer have the filter
 * editor's classes and look; moved by the title bar, resized from every edge and corner, Esc closes it,
 * the focus goes back to where it was.
 *
 * Opened by the gear at the right end of the footer (`GridConfig.settingsButton`, rebuildFooter.ts),
 * *Column settings…* in the header menu (`header.settings`) and `gridInterface.openColumnSettings()` -
 * on the Columns tab - and `gridInterface.openDetailFormSettings()` on the Detail form tab.
 *
 * Two tabs under the title bar (gridConfigTabs.ts): **Columns**, the settings of the columns below, and
 * **Detail form** (detailFormSettings.ts), the fields of the detail form (detailForm.ts). The footer is
 * the dialog's: Apply applies both tabs, Cancel drops both; its left end has the resets of the tab shown.
 *
 * - **Left**: the columns of the layout, in their order - a listbox, one stop of Tab, the arrows, Home,
 *   End, PageUp / PageDown and a letter pick one. Each has its label, its type and what it has set:
 *   Format, Text, Link, Checkbox, Blank / 0, Label, Placeholder - or Error.
 * - **Right**, the column picked: its label (`ColumnFormat.label`, empty the column's own). A date, datetime
 *   or number column has its format, a picker that opens the entries of Format › (formatSubmenu.ts - one
 *   list of the formats); a number column Show blank as 0 and Show 0 as blank too (`numberOverride`, one or
 *   the other). A text column the text it shows (a template, `ColumnFormat.text`), Show as link, the
 *   address (`ColumnFormat.link.url`) and Open in a new tab; a checkbox and a lookup column have none. A
 *   text and a number column can be shown as checkboxes (`ColumnFormat.checkbox`): Show as checkbox, the
 *   checked and the unchecked value - while it is on, their template, link, format and blank / 0 are
 *   gone, a checkbox shows no text. A template's ⟨{ }⟩ button puts a field in it at the caret, from a menu
 *   of the fields of the columns and the row. Then, for every column but a checkbox, the header filter:
 *   its placeholder (a text, or Use the column label - `placeholder`, `placeholderLabel`) and its
 *   operator - a picker of the operators it offers, the column's default said under it. Under it the
 *   preview: what the cell shows in the current row (else the first), the link and its address, and why
 *   a row has no link.
 * - **The footer**: Reset column and Reset all go back to the formats the grid starts with (the config's
 *   `ColumnConfig.format`, or `initialState.formats` - the label, the placeholder, blank / 0 and the
 *   checkboxes are in them) and the column's default operator, Cancel closes,
 *   Apply sets the formats of the state (`setState({ formats })`, so `getState()` has them, to save) and
 *   switches the header filters whose operator changed, as Operator › does - and Apply & close. A template that is not
 *   valid - an address of a scheme that is not allowed, one that does not start with its scheme - has its
 *   problem under it at once, the column is marked Error and Apply does nothing until it is fixed.
 *
 * What it edits is a copy of the state's formats and the operators in use (ColumnSettings): the grid
 * changes on Apply only.
 */

/**
 * What the dialog edits, changed in place until Apply
 */
interface ColumnSettings {
    /** the formats by field: a copy of the state's when it opened. A column without one is left out */
    formats: Record<string, ColumnFormat>;
    /**
     * the operator of each column's header filter: the one in use when it opened (getHeaderFilterOperator).
     * A checkbox column is left out, its header filter is a checkbox
     */
    operators: Record<string, FilterOperator>;
    /** the column shown on the right */
    field: string;
    /** the tab shown: the columns' settings, or the detail form's */
    tab: GridConfigTab;
    /** what the Detail form tab edits, see detailFormSettings.ts */
    detailForm: DetailFormDraft;
}

/** a problem of a template, a text of the grid and its values */
interface Problem {
    id: TextId;
    values?: Readonly<Record<string, unknown>>;
}

/** the kind of a column, for its settings: its field's type, or a lookup column */
type ColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'lookup';

/** what the arrows of the list move by, PageUp and PageDown */
const PAGE = 10;

/** the menu entry of the header menu: the dialog on this column */
export function columnSettingsEntry(ctx: Grid, attribute: string): MenuItem {
    return {
        id: 'header.settings',
        label: gridText(ctx, 'header.settings'),
        action: () => openColumnSettings(ctx, attribute)
    };
}

/**
 * Opens the dialog on a column, with the formats of the state. Open already, it starts again from them.
 * Nothing happens for a layout without columns
 * @param field the column it shows first: a field of the layout. Else the first one
 * @param tab the tab it shows, default the Columns tab
 */
export function openColumnSettings(ctx: Grid, field?: string, tab: GridConfigTab = 'columns') {
    // a modal dialog: the editor of a multiline cell would be inert under it, saved as a click outside it does
    closeTextEditor(ctx);
    removeContextMenu(ctx);
    closeFilterEditor(ctx);
    const fields = layoutFields(ctx);
    if (!fields.length) {
        return;
    }
    renderColumnSettings(ctx, {
        formats: ctx.gridInterface.getState().formats,
        operators: Object.fromEntries(
            fields.filter((name) => hasOperator(ctx, name)).map((name) => [name, getHeaderFilterOperator(ctx, name)])
        ),
        field: field !== undefined && fields.includes(field) ? field : fields[0],
        tab,
        detailForm: detailFormDraft(ctx, ctx.gridInterface.getState().detailForm)
    });
}

/**
 * Closes the dialog without applying it, and takes it off the page. Does nothing when it is not open.
 * Used by its buttons, after Esc, and when the grid leaves the page
 */
export function closeColumnSettings(ctx: Grid) {
    const dialog = ctx.columnSettings;
    if (!dialog) {
        return;
    }
    ctx.columnSettings = null;
    // the menus of its pickers are in the dialog
    removeContextMenu(ctx);
    hideTooltip();
    // close() before remove(): closing a modal dialog gives the focus back to the element that had it
    dialog.close();
    dialog.remove();
}

/**
 * true when a column's header filter has an operator: every column but a checkbox one (a lookup column
 * filters on its labels, with the operators of a text)
 */
function hasOperator(ctx: Grid, field: string): boolean {
    return headerFilterType(ctx.gridInterface, field) !== 'boolean';
}

/**
 * The operator a column's header filter starts with, what Reset goes back to: the column's `operator`
 * (config), else the default of its type
 */
function startOperator(ctx: Grid, field: string): FilterOperator {
    return defaultHeaderOperator(ctx.gridInterface.__getGridConfig().columns[field], headerFilterType(ctx.gridInterface, field));
}

/**
 * The kind of a column: its field's type - a lookup column (ColumnConfig.editor) is one of its own, its
 * cells show a label
 */
function kindOf(ctx: Grid, field: string): ColumnKind {
    return ctx.gridInterface.__getLookupColumn(field) ? 'lookup' : ctx.gridInterface.getDatasource().getField(field).type;
}

/**
 * What is wrong with a column's format in the dialog, whatever the row: a template that names a field of
 * the grid's own (`{__...}`), an address that is empty, does not start with its scheme or has one that is
 * not allowed (urlTemplateProblem). Apply does nothing while a column has one
 */
function formatProblems(format: ColumnFormat | undefined): Problem[] {
    const problems: Problem[] = [];
    const internal = format?.text === undefined ? null : templateProblem(format.text);
    if (internal) {
        problems.push({ id: 'columnSettings.problem.internal', values: { field: `{${internal.field}}` } });
    }
    const url = format?.link ? urlTemplateProblem(format.link.url) : null;
    if (url?.problem === 'empty') {
        problems.push({ id: 'columnSettings.problem.urlEmpty' });
    } else if (url?.problem === 'start') {
        problems.push({ id: 'columnSettings.problem.urlStart' });
    } else if (url?.problem === 'protocol') {
        problems.push({ id: 'columnSettings.problem.protocol' });
    } else if (url?.problem === 'internal') {
        problems.push({ id: 'columnSettings.problem.internal', values: { field: `{${url.field}}` } });
    }
    return problems;
}

/**
 * What is wrong with the values of a column's checkboxes, whatever the row (checkboxProblem): the checked
 * value is empty, a value of a number column is no number, the two are the same. Apply does nothing
 * while a column has one
 * @param type the type of the column's field
 */
function checkboxProblems(format: ColumnFormat | undefined, type: ColumnKind): Problem[] {
    if (!format?.checkbox || (type !== 'text' && type !== 'number')) {
        return [];
    }
    const values = checkboxValues(format.checkbox);
    switch (checkboxProblem(format.checkbox, type)) {
        case 'checkedEmpty':
            return [{ id: 'columnSettings.problem.checkedEmpty' }];
        case 'checkedNumber':
            return [{ id: 'columnSettings.problem.notNumber', values: { value: values.checked } }];
        case 'uncheckedNumber':
            return [{ id: 'columnSettings.problem.notNumber', values: { value: values.unchecked } }];
        case 'same':
            return [{ id: 'columnSettings.problem.sameValues' }];
        default:
            return [];
    }
}

/**
 * What the preview finds in a row: a field the templates name that is no column, no field of the
 * datasource and not in the row (a typo, mostly), and why the row has no link - a field of the address
 * empty, no valid address, a scheme that is not allowed. Not for a format with a problem of its own
 * (formatProblems)
 */
function rowProblems(
    ctx: Grid,
    field: string,
    format: ColumnFormat | undefined,
    row: Entity,
    link: LinkResult | null
): Problem[] {
    const problems: Problem[] = [];
    const columns = ctx.gridInterface.__getGridConfig().columns;
    const named = [...templateFields(format?.text ?? ''), ...templateFields(format?.link?.url ?? '')];
    const known = (name: string) =>
        name === VALUE_PLACEHOLDER ||
        name === field ||
        Object.hasOwn(columns, name) ||
        ctx.gridInterface.getDatasource().__getFieldConfig(name) !== undefined ||
        Object.hasOwn(row, name);
    for (const name of new Set(named)) {
        if (!isInternalField(name) && !known(name)) {
            problems.push({ id: 'columnSettings.problem.unknownField', values: { field: `{${name}}` } });
        }
    }
    if (link && 'problem' in link) {
        if (link.problem === 'blank') {
            const blank = link.field === VALUE_PLACEHOLDER ? field : link.field;
            problems.push({ id: 'columnSettings.problem.blank', values: { field: getColumnLabel(ctx, blank) } });
        } else if (link.problem === 'protocol') {
            problems.push({ id: 'columnSettings.problem.protocol' });
        } else {
            problems.push({ id: 'columnSettings.problem.invalid' });
        }
    }
    return problems;
}

/**
 * The row of the preview: the current row, else the first data row shown. null without rows
 */
function previewRow(ctx: Grid): { row: Entity; current: boolean } | null {
    const datasource = ctx.gridInterface.getDatasource();
    const current = datasource.currentEntity;
    if (current && !isGroupRow(current)) {
        return { row: current, current: true };
    }
    const first = datasource.getRows().find((row) => !isGroupRow(row));
    return first ? { row: first, current: false } : null;
}

/**
 * The fields a template can name, for its field menu: the fields of the grid's columns, and those of the
 * row (not the grid's own, `__...`)
 */
function pickableFields(ctx: Grid, row: Entity | undefined): string[] {
    const fields = new Set(Object.keys(ctx.gridInterface.__getGridConfig().columns));
    for (const name of row ? Object.keys(row) : []) {
        if (!isInternalField(name)) {
            fields.add(name);
        }
    }
    return [...fields];
}

/**
 * The fields of the layout, in their order, once each: a column pinned as a copy (Pin left (copy)) is
 * in the layout twice, its settings are one
 */
function layoutFields(ctx: Grid): string[] {
    return [...new Set(getLayoutFields(ctx.gridInterface))];
}

/**
 * the id of an element of the dialog, unique in the page: a page can have several grids
 */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-settings-${part}`;
}

/**
 * The dialog, rendered again from `settings` after every change - in the same dialog: lit keeps the
 * elements, so the dialog stays where the user put it and as big as they made it, the focus and the
 * caret where they are
 */
function renderColumnSettings(ctx: Grid, settings: ColumnSettings) {
    hideTooltip();
    const opening = !ctx.columnSettings;
    const dialog = ctx.columnSettings ?? createDialog(ctx);
    const gridInterface = ctx.gridInterface;
    const text = (id: TextId, values?: Readonly<Record<string, unknown>>) => gridText(ctx, id, values);
    const update = () => renderColumnSettings(ctx, settings);

    const fields = layoutFields(ctx);
    const field = settings.field;
    const kind = kindOf(ctx, field);
    const format = settings.formats[field];
    const at = previewRow(ctx);

    /** sets a column's format in the dialog, none when it shows nothing (`{}`) */
    const setFormat = (name: string, next: ColumnFormat | undefined) => {
        if (next && hasDisplayFormat(next)) {
            settings.formats[name] = next;
        } else {
            delete settings.formats[name];
        }
        update();
    };
    /** changes a part of this column's format */
    const change = (edit: (next: ColumnFormat) => void) => {
        const next = structuredClone(format ?? {});
        edit(next);
        setFormat(field, next);
    };

    const select = (name: string) => {
        settings.field = name;
        update();
        // the option picked in view in the list
        dialog.querySelector(`#${idOf(ctx, `option-${fields.indexOf(name)}`)}`)?.scrollIntoView({ block: 'nearest' });
    };

    // the columns whose format has a problem: Apply does nothing while there is one
    const withProblems = new Set(
        Object.keys(settings.formats).filter(
            (name) =>
                formatProblems(settings.formats[name]).length ||
                (fields.includes(name) && checkboxProblems(settings.formats[name], kindOf(ctx, name)).length)
        )
    );

    /** the label of a column in the dialog: the one typed (the draft's), else the column's own */
    const labelOf = (name: string) => settings.formats[name]?.label || getConfigColumnLabel(ctx, name);

    const apply = () => {
        if (withProblems.size) {
            return false;
        }
        removeContextMenu(ctx);
        gridInterface.setState({ formats: structuredClone(settings.formats) });
        // a header filter whose operator changed: as if it was picked in Operator › - the filter runs again
        // with the value the cell has, the header shows it, filter-operator-change is sent
        for (const [name, operator] of Object.entries(settings.operators)) {
            if (operator !== getHeaderFilterOperator(ctx, name)) {
                setHeaderFilterOperator(ctx, name, operator);
            }
        }
        // the Detail form tab's
        applyDetailForm(ctx, settings.detailForm);
        return true;
    };

    const typeName = (name: string) => text(`columnSettings.type.${kindOf(ctx, name)}`);
    /** what a column has set, for its option in the list: Error alone when it has a problem */
    const badges = (name: string): TextId[] => {
        const set = settings.formats[name];
        if (withProblems.has(name)) {
            return ['columnSettings.badge.problem'];
        }
        const marks: TextId[] = [];
        if (set?.checkbox) {
            marks.push('columnSettings.badge.checkbox');
        }
        if (set?.link) {
            marks.push('columnSettings.badge.link');
        } else if (set?.text !== undefined) {
            marks.push('columnSettings.badge.text');
        }
        if (set && hasValueFormat(set)) {
            marks.push('columnSettings.badge.format');
        }
        if (set?.numberOverride !== undefined) {
            marks.push('columnSettings.badge.numberOverride');
        }
        if (set?.label !== undefined) {
            marks.push('columnSettings.badge.label');
        }
        if (set?.placeholder !== undefined || set?.placeholderLabel) {
            marks.push('columnSettings.badge.placeholder');
        }
        return marks;
    };

    /**
     * The keys of the list (it has the focus, `aria-activedescendant` its option): the arrows, Home and
     * End, PageUp and PageDown, and a letter - the next column whose label starts with it
     */
    const listKeydown = (event: KeyboardEvent) => {
        const index = fields.indexOf(field);
        const last = fields.length - 1;
        const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: PAGE, PageUp: -PAGE };
        let next = -1;
        if (Object.hasOwn(step, event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
            next = Math.min(Math.max(index + step[event.key], 0), last);
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = last;
        } else if (isTypedCharacter(event) && event.key !== ' ') {
            const letter = event.key.toLocaleLowerCase();
            const after = [...fields.slice(index + 1), ...fields.slice(0, index + 1)];
            const found = after.find((name) => labelOf(name).toLocaleLowerCase().startsWith(letter));
            next = found === undefined ? -1 : fields.indexOf(found);
        }
        if (next !== -1) {
            event.preventDefault();
            select(fields[next]);
        }
    };

    /**
     * The button beside a template that puts a field in it: a menu of the fields (their labels, a search),
     * the one picked is put in at the caret as `{field}`, the caret after it
     * @param inputId the id of the template's input
     * @param write puts the new template in the dialog
     */
    const insertButton = (inputId: string, write: (template: string) => void) =>
        html`<button
            type="button"
            class="filter-editor-icon column-settings-insert"
            aria-label=${text('columnSettings.insertField')}
            aria-haspopup="menu"
            data-tooltip=${text('columnSettings.insertField')}
            @click=${(event: MouseEvent) => {
                const input = dialog.querySelector<HTMLInputElement>(`#${inputId}`);
                if (!input) {
                    return;
                }
                contextMenuAttributes(
                    ctx,
                    event.currentTarget as HTMLElement,
                    undefined,
                    (picked) => {
                        // a blurred input keeps where its caret was
                        const start = input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? start;
                        const placeholder = `{${picked}}`;
                        write(`${input.value.slice(0, start)}${placeholder}${input.value.slice(end)}`);
                        input.focus();
                        input.setSelectionRange(start + placeholder.length, start + placeholder.length);
                    },
                    pickableFields(ctx, at?.row)
                );
            }}
        >
            { }
        </button>`;

    /** a template's input: its label, the input and its field button, the hint under it */
    const templateInput = (
        part: string,
        label: 'columnSettings.text' | 'columnSettings.url',
        value: string,
        write: (template: string) => void,
        problems: Problem[]
    ) => {
        const inputId = idOf(ctx, part);
        const hintId = idOf(ctx, `${part}-hint`);
        const problemId = idOf(ctx, `${part}-problem`);
        return html`<div class="column-settings-field">
            <label class="column-settings-label" for=${inputId}>${text(label)}</label>
            <div class="column-settings-input-row">
                <input
                    id=${inputId}
                    class="filter-editor-value column-settings-template"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${text(`${label}.placeholder`)}
                    aria-describedby=${`${hintId} ${problemId}`}
                    aria-invalid=${problems.length ? 'true' : 'false'}
                    .value=${live(value)}
                    @input=${(event: Event) => write((event.target as HTMLInputElement).value)}
                />
                ${insertButton(inputId, write)}
            </div>
            <div class="column-settings-hint" id=${hintId}>${text(`${label}.hint`)}</div>
            <div class="column-settings-problems" id=${problemId} aria-live="polite">
                ${problems.map((problem) => html`<div class="column-settings-problem">${text(problem.id, problem.values)}</div>`)}
            </div>
        </div>`;
    };

    /** a setting that is on or off: a checkbox and its text */
    const checkbox = (label: TextId, checked: boolean, write: (on: boolean) => void) =>
        html`<label class="column-settings-check">
            <input
                type="checkbox"
                .checked=${live(checked)}
                @change=${(event: Event) => write((event.target as HTMLInputElement).checked)}
            /><span>${text(label)}</span>
        </label>`;

    /** a text column: the text it shows, Show as link, the address, Open in a new tab */
    const textSettings = () => {
        const link = format?.link;
        const textProblems = formatProblems(format?.text === undefined ? undefined : { text: format.text });
        const urlProblems = formatProblems(link ? { link } : undefined);
        return html`${templateInput(
            'text',
            'columnSettings.text',
            format?.text ?? '',
            (template) =>
                change((next) => {
                    if (template === '') {
                        delete next.text;
                    } else {
                        next.text = template;
                    }
                }),
            textProblems
        )}
        ${checkbox('columnSettings.link', !!link, (on) =>
            change((next) => {
                if (on) {
                    // a link from the dialog opens in a new tab at first: the grid's page stays
                    next.link = { url: '', newTab: true };
                } else {
                    delete next.link;
                }
            })
        )}
        ${
            link
                ? html`${templateInput(
                      'url',
                      'columnSettings.url',
                      link.url,
                      (url) =>
                          change((next) => {
                              next.link = { ...next.link, url };
                          }),
                      urlProblems
                  )}
                  ${checkbox('columnSettings.newTab', link.newTab === true, (on) =>
                      change((next) => {
                          next.link = { url: next.link?.url ?? '' };
                          if (on) {
                              next.link.newTab = true;
                          }
                      })
                  )}`
                : nothing
        }`;
    };

    /** a date, datetime or number column: its format, a picker of the entries of Format › */
    const formatSettings = () => {
        const picked = format?.date
            ? text(`header.format.date.${format.date}`)
            : format?.number
              ? formatNumberAs(format.number.percent ? PERCENT_SAMPLE : NUMBER_SAMPLE, format.number)
              : text('header.format.default');
        const label = text('columnSettings.format');
        return html`<div class="column-settings-field">
            <span class="column-settings-label">${label}</span>
            <div class="column-settings-input-row">
                <button
                    type="button"
                    class="filter-editor-pick column-settings-format"
                    aria-haspopup="menu"
                    aria-label=${`${label}: ${picked}`}
                    data-tooltip=${text('columnSettings.format.tooltip')}
                    @click=${(event: MouseEvent) => {
                        // the entries of Format ›, on what the dialog edits
                        const entries = formatSubmenu(ctx, field, {
                            current: () => settings.formats[field],
                            set: (next) => setFormat(field, next)
                        }).entries;
                        gridInterface.openMenu(event.currentTarget as HTMLElement, entries);
                    }}
                >
                    <span class="filter-editor-pick-text">${picked}</span>
                </button>
            </div>
        </div>`;
    };

    /**
     * The operator of the column's header filter: a picker of the operators the column offers (Operator ›),
     * the one picked checked; just its name when the column offers one. The column's default under it
     */
    const operatorSettings = () => {
        const operator = settings.operators[field];
        if (!operator) {
            return nothing;
        }
        const name = (each: FilterOperator) => {
            const id = HEADER_OPERATOR_TEXTS[each];
            return id ? text(id) : each;
        };
        const offered = headerOperators(
            ctx.gridInterface.__getGridConfig().columns[field],
            headerFilterType(gridInterface, field)
        );
        const label = text('columnSettings.operator');
        const hintId = idOf(ctx, 'operator-hint');
        const hint = html`<div class="column-settings-hint" id=${hintId}>
            ${text('columnSettings.operator.hint', { operator: name(startOperator(ctx, field)) })}
        </div>`;
        if (offered.length < 2) {
            return html`<div class="column-settings-field">
                <span class="column-settings-label">${label}</span>
                <div class="column-settings-input-row">${name(operator)}</div>
                ${hint}
            </div>`;
        }
        return html`<div class="column-settings-field">
            <span class="column-settings-label">${label}</span>
            <div class="column-settings-input-row">
                <button
                    type="button"
                    class="filter-editor-pick column-settings-operator"
                    aria-haspopup="menu"
                    aria-label=${`${label}: ${name(operator)}`}
                    aria-describedby=${hintId}
                    data-tooltip=${text('columnSettings.operator.tooltip')}
                    @click=${(event: MouseEvent) => {
                        // the items of Operator ›, on what the dialog edits
                        const items = offered.flatMap((each): MenuItem[] => {
                            const id = HEADER_OPERATOR_TEXTS[each];
                            const pick = () => {
                                settings.operators[field] = each;
                                update();
                            };
                            return id
                                ? [{ id, label: text(id), selected: () => settings.operators[field] === each, action: pick }]
                                : [];
                        });
                        gridInterface.openMenu(event.currentTarget as HTMLElement, items);
                    }}
                >
                    <span class="filter-editor-pick-text">${name(operator)}</span>
                </button>
            </div>
            ${hint}
        </div>`;
    };

    /**
     * A text of the column that is not a template - its label, the header filter's placeholder: its label
     * and the input. Empty is none: the column's own, which the input shows as its placeholder
     * @param part the part of the input's id
     * @param shown what the input shows when it is empty
     * @param write puts the text in the dialog, `''` for none
     * @param disabled the input is off: Use the column label
     */
    const textInput = (
        part: string,
        label: TextId,
        value: string,
        shown: string,
        write: (value: string) => void,
        disabled = false
    ) => {
        const inputId = idOf(ctx, part);
        return html`<label class="column-settings-label" for=${inputId}>${text(label)}</label>
            <div class="column-settings-input-row">
                <input
                    id=${inputId}
                    class="filter-editor-value"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${shown}
                    ?disabled=${disabled}
                    .value=${live(value)}
                    @input=${(event: Event) => write((event.target as HTMLInputElement).value)}
                />
            </div>`;
    };

    /** the column's label (`ColumnFormat.label`): empty, the column's own - shown in the input */
    const labelSettings = () =>
        html`<div class="column-settings-field">
            ${textInput('label', 'columnSettings.label', format?.label ?? '', getConfigColumnLabel(ctx, field), (value) =>
                change((next) => {
                    if (value.trim() === '') {
                        delete next.label;
                    } else {
                        next.label = value;
                    }
                })
            )}
        </div>`;

    /**
     * The placeholder of the column's header filter: a text (`ColumnFormat.placeholder`, empty the one it
     * has without - shown in the input), or Use the column label (`placeholderLabel`) - the input is off
     * then, and shows the label. Every column but a checkbox one, as the operator
     */
    const placeholderSettings = () => {
        const operator = settings.operators[field];
        if (!operator) {
            return nothing;
        }
        const useLabel = format?.placeholderLabel === true;
        return html`<div class="column-settings-field">
            ${textInput(
                'placeholder',
                'columnSettings.placeholder',
                useLabel ? '' : (format?.placeholder ?? ''),
                useLabel ? headerFilterPlaceholder(ctx, field, format, operator) : defaultFilterPlaceholder(ctx, field, operator),
                (value) =>
                    change((next) => {
                        if (value.trim() === '') {
                            delete next.placeholder;
                        } else {
                            next.placeholder = value;
                        }
                    }),
                useLabel
            )}
            ${checkbox('columnSettings.placeholderLabel', useLabel, (on) =>
                change((next) => {
                    delete next.placeholder;
                    if (on) {
                        next.placeholderLabel = true;
                    } else {
                        delete next.placeholderLabel;
                    }
                })
            )}
        </div>`;
    };

    /**
     * A number column: Show blank as 0, Show 0 as blank - one or the other (`ColumnFormat.numberOverride`).
     * They start as the column shows them, its own `numberOverride` too: one turned off over the column's
     * own is `'NONE'`, the same as the column's own is none in the format
     */
    const numberOverrideSettings = () => {
        const column = gridInterface.__getGridConfig().columns[field];
        const own = column?.numberOverride;
        const now = numberOverrideOf({ ...column, format });
        const set = (override: 'BLANK_TO_ZERO' | 'ZERO_TO_BLANK' | undefined) =>
            change((next) => {
                if (override === own) {
                    delete next.numberOverride;
                } else {
                    next.numberOverride = override ?? 'NONE';
                }
            });
        return html`${checkbox('columnSettings.blankToZero', now === 'BLANK_TO_ZERO', (on) => set(on ? 'BLANK_TO_ZERO' : undefined))}
        ${checkbox('columnSettings.zeroToBlank', now === 'ZERO_TO_BLANK', (on) => set(on ? 'ZERO_TO_BLANK' : undefined))}`;
    };

    /**
     * A text or number column: Show as checkbox (`ColumnFormat.checkbox`), and while it is on the checked and
     * the unchecked value side by side, a hint and their problems under them. Turned on, the template, the
     * link, the number format and blank / 0 go: a checkbox shows no text - their settings are not shown
     */
    const checkboxSettings = () => {
        const set = format?.checkbox;
        const toggle = checkbox('columnSettings.checkbox', set !== undefined, (on) =>
            change((next) => {
                if (on) {
                    delete next.text;
                    delete next.link;
                    delete next.number;
                    delete next.numberOverride;
                    next.checkbox = { checked: CHECKED_VALUE, unchecked: UNCHECKED_VALUE };
                } else {
                    delete next.checkbox;
                }
            })
        );
        if (!set) {
            return toggle;
        }
        const values = checkboxValues(set);
        const problems = checkboxProblems(format, kind);
        const hintId = idOf(ctx, 'checkbox-hint');
        const problemId = idOf(ctx, 'checkbox-problem');
        /** the input of one of the values */
        const valueInput = (part: keyof CheckboxFormat, label: TextId) => {
            const inputId = idOf(ctx, part);
            return html`<div class="column-settings-field column-settings-value">
                <label class="column-settings-label" for=${inputId}>${text(label)}</label>
                <input
                    id=${inputId}
                    class="filter-editor-value"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    aria-describedby=${`${hintId} ${problemId}`}
                    aria-invalid=${problems.length ? 'true' : 'false'}
                    .value=${live(values[part])}
                    @input=${(event: Event) =>
                        change((next) => {
                            next.checkbox = { ...values, [part]: (event.target as HTMLInputElement).value };
                        })}
                />
            </div>`;
        };
        return html`${toggle}
            <div class="column-settings-field">
                <div class="column-settings-values">
                    ${valueInput('checked', 'columnSettings.checked')} ${valueInput('unchecked', 'columnSettings.unchecked')}
                </div>
                <div class="column-settings-hint" id=${hintId}>${text('columnSettings.checkbox.hint')}</div>
                <div class="column-settings-problems" id=${problemId} aria-live="polite">
                    ${problems.map((problem) => html`<div class="column-settings-problem">${text(problem.id, problem.values)}</div>`)}
                </div>
            </div>`;
    };

    /** what the cell shows in the row of the preview, its link and why it has none */
    const preview = () => {
        if (kind === 'boolean' || kind === 'lookup') {
            return nothing;
        }
        const titleId = idOf(ctx, 'preview');
        const title = at
            ? at.current
                ? 'columnSettings.preview.current'
                : 'columnSettings.preview.first'
            : 'columnSettings.preview.none';
        let content: TemplateResult | typeof nothing = nothing;
        if (at && format?.checkbox) {
            // a checkbox, checked as the cell will be
            content = html`<div class="column-settings-preview-cell">
                <input
                    type="checkbox"
                    class="column-settings-preview-checkbox"
                    disabled
                    aria-label=${labelOf(field)}
                    .checked=${isCheckedValue(at.row[field], format.checkbox)}
                />
            </div>`;
        } else if (at) {
            // the format of the dialog through the grid's own code, as the cell will show it - with the
            // blank / 0 of a number column
            const formatter = gridInterface.__getCellFormatter(field, undefined, at.row, format);
            const column = { ...gridInterface.__getGridConfig().columns[field], format };
            const formatted = formatter.format(at.row[field]);
            const shown =
                kind === 'number'
                    ? overrideNumberText(formatted, numberOverrideOf(column), zeroText(column, formatter))
                    : formatted;
            const link = formatProblems(format).length ? null : gridInterface.__getLinkResult(field, at.row, format);
            const href = link && 'href' in link ? link.href : null;
            const problems = formatProblems(format).length ? [] : rowProblems(ctx, field, format, at.row, link);
            content = html`<div class="column-settings-preview-cell">
                    ${
                        // the link as the cell has it, in a new tab: the dialog stays
                        href
                            ? html`<a class="column-settings-preview-link" href=${href} target="_blank" rel="noopener noreferrer">${shown}</a>`
                            : shown
                    }
                </div>
                ${href ? html`<div class="column-settings-preview-address">${href}</div>` : nothing}
                <div class="column-settings-problems" aria-live="polite">
                    ${problems.map((problem) => html`<div class="column-settings-problem">${text(problem.id, problem.values)}</div>`)}
                </div>`;
        }
        return html`<div class="column-settings-preview" role="group" aria-labelledby=${titleId}>
            <div class="column-settings-preview-title" id=${titleId}>${text(title)}</div>
            ${content}
        </div>`;
    };

    const settingsOf = () => {
        // shown as checkboxes: no text to format
        const checkboxes = format?.checkbox !== undefined;
        switch (kind) {
            case 'text':
                return html`${checkboxSettings()} ${checkboxes ? nothing : textSettings()}`;
            case 'number':
                return html`${checkboxSettings()} ${checkboxes ? nothing : html`${formatSettings()} ${numberOverrideSettings()}`}`;
            case 'date':
            case 'datetime':
                return formatSettings();
            default:
                return html`<div class="column-settings-none">${text(kind === 'lookup' ? 'columnSettings.none.lookup' : 'columnSettings.none.boolean')}</div>`;
        }
    };

    const close = () => closeColumnSettings(ctx);
    // Apply and Apply & close are greyed out while a column has a problem - aria-disabled, not disabled: a
    // disabled button loses the focus and its tooltip
    const blocked = withProblems.size ? 'true' : nothing;
    const start = gridInterface.__getStartFormats();

    render(
        html`<div class="filter-editor-titlebar" @pointerdown=${(event: PointerEvent) => moveDialog(dialog, event)}>
                <span class="filter-editor-title" id=${idOf(ctx, 'title')} data-tooltip=${text('columnSettings.title.tooltip')}
                    >${text('columnSettings.title')}</span
                >
                <button
                    type="button"
                    class="filter-editor-close"
                    aria-label=${text('columnSettings.close.tooltip')}
                    data-tooltip=${text('columnSettings.close.tooltip')}
                    @click=${close}
                >
                    ✕
                </button>
            </div>
            ${configTabs(
                ctx,
                settings.tab,
                (tab) => {
                    settings.tab = tab;
                    update();
                },
                idOf(ctx, 'title')
            )}
            <div
                class="filter-editor-body column-settings-body simple-html-dialog-scroller"
                role="tabpanel"
                id=${tabPanelId(ctx, 'columns')}
                aria-labelledby=${tabId(ctx, 'columns')}
                ?hidden=${settings.tab !== 'columns'}
            >
                <div
                    class="column-settings-list simple-html-dialog-scroller"
                    role="listbox"
                    tabindex="0"
                    aria-label=${text('columnSettings.columns')}
                    aria-activedescendant=${idOf(ctx, `option-${fields.indexOf(field)}`)}
                    @keydown=${listKeydown}
                >
                    ${fields.map((name, index) => {
                        const marks = badges(name);
                        return html`<div
                            class="column-settings-option"
                            role="option"
                            id=${idOf(ctx, `option-${index}`)}
                            data-field=${name}
                            aria-selected=${name === field ? 'true' : 'false'}
                            @click=${() => select(name)}
                        >
                            <span class="column-settings-option-label">${labelOf(name)}</span>
                            <span class="column-settings-option-type">${typeName(name)}</span>
                            ${
                                // the badges together: on a line of their own when the option has no room
                                marks.length
                                    ? html`<span class="column-settings-badges">
                                          ${marks.map(
                                              (mark) =>
                                                  html`<span class=${`column-settings-badge${mark === 'columnSettings.badge.problem' ? ' column-settings-badge-problem' : ''}`}
                                                      >${text(mark)}</span
                                                  >`
                                          )}
                                      </span>`
                                    : nothing
                            }
                        </div>`;
                    })}
                </div>
                <div class="column-settings-panel">
                    <div class="column-settings-heading">
                        <span class="column-settings-heading-label">${labelOf(field)}</span>
                        <span class="column-settings-option-type">${typeName(field)}</span>
                    </div>
                    ${labelSettings()} ${settingsOf()} ${placeholderSettings()} ${operatorSettings()} ${preview()}
                </div>
            </div>
            ${detailFormTabPanel(ctx, dialog, settings.detailForm, settings.tab, update)}
            <div class="filter-editor-footer">
                ${settings.tab === 'detailForm' ? detailFormResetButton(ctx, settings.detailForm, update) : nothing}
                <span class="column-settings-resets" ?hidden=${settings.tab !== 'columns'}>
                    <button
                        type="button"
                        class="simple-html-grid-button"
                        data-tooltip=${text('columnSettings.resetColumn.tooltip')}
                        @click=${() => {
                            if (settings.operators[field]) {
                                settings.operators[field] = startOperator(ctx, field);
                            }
                            setFormat(field, structuredClone(start[field]));
                        }}
                    >
                        ${text('columnSettings.resetColumn')}
                    </button>
                    <button
                        type="button"
                        class="simple-html-grid-button"
                        data-tooltip=${text('columnSettings.resetAll.tooltip')}
                        @click=${() => {
                            settings.formats = structuredClone(start);
                            for (const name of Object.keys(settings.operators)) {
                                settings.operators[name] = startOperator(ctx, name);
                            }
                            update();
                        }}
                    >
                        ${text('columnSettings.resetAll')}
                    </button>
                </span>
                <button type="button" class="simple-html-grid-button" @click=${close}>${text('columnSettings.cancel')}</button>
                <button
                    type="button"
                    class="simple-html-grid-button"
                    aria-disabled=${blocked}
                    data-tooltip=${text('columnSettings.apply.tooltip')}
                    @click=${apply}
                >
                    ${text('columnSettings.apply')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button simple-html-grid-button-primary"
                    aria-disabled=${blocked}
                    @click=${() => {
                        if (apply()) {
                            close();
                        }
                    }}
                >
                    ${text('columnSettings.applyAndClose')}
                </button>
            </div>
            ${resizeHandles(dialog)}`,
        dialog
    );

    if (opening) {
        showDialog(dialog);
        dialog.querySelector(`#${idOf(ctx, `option-${fields.indexOf(field)}`)}`)?.scrollIntoView({ block: 'nearest' });
    }
    // the control that had the focus is gone (the address of a link turned off): the dialog gets it
    if (!dialog.contains(document.activeElement)) {
        dialog.focus({ preventScroll: true });
    }
}

/**
 * Makes the dialog and puts it on the body, closed: renderColumnSettings renders it and shows it
 */
function createDialog(ctx: Grid): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.classList.add('simple-html-grid', 'filter-editor-content', 'column-settings');
    // showModal() moves the focus to the dialog itself (autofocus), Tab goes on into it
    dialog.setAttribute('autofocus', '');
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', idOf(ctx, 'title'));
    if (tooltipsEnabled(ctx)) {
        dialog.classList.add('simple-html-grid-tooltips');
        attachTooltips(dialog);
    }
    // Esc: the browser closes the dialog (cancel, then close). After the buttons, ctx.columnSettings is not
    // this dialog anymore
    dialog.addEventListener('close', () => {
        if (ctx.columnSettings === dialog) {
            closeColumnSettings(ctx);
        }
    });
    document.body.appendChild(dialog);
    ctx.columnSettings = dialog;
    return dialog;
}

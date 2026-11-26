import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import {
    type CalculatedColumn,
    type CompiledColumn,
    calculatedLabel,
    compileCalculatedColumns,
    isCalculatedName,
    readerOf
} from '../calculatedColumns';
import {
    isInternalField,
    type LinkResult,
    templateFields,
    templateProblem,
    urlTemplateProblem,
    VALUE_PLACEHOLDER
} from '../cellTemplate';
import { colorRuleClasses, colorRuleOf, colorRuleStyle, type RuleFieldOf } from '../colorRules';
import {
    CHECKED_VALUE,
    type CheckboxFormat,
    type ColumnFormat,
    checkboxProblem,
    checkboxValues,
    formatTexts,
    hasDisplayFormat,
    hasValueFormat,
    isCheckedValue,
    UNCHECKED_VALUE,
    withTypeFormat
} from '../columnFormat';
import { shownRange } from '../dataBars';
import { canFilterAsShown, filtersAsShown } from '../filterAsShown';
import { type FormulaType, type FormulaValue, formulaProblemText } from '../formula';
import type { Grid } from '../grid';
import type { GridState } from '../gridConfig';
import type { MenuItem } from '../gridMenus';
import { numberOverrideOf, overrideNumberText, zeroText } from './cellText';
import {
    defaultHeaderOperator,
    headerFilterType,
    headerOperators,
    isAlwaysCaseSensitive,
    isClobField
} from './columnFilterOptions';
import { type FillKind, previewFill, valueFillProblems, valueFillSettings } from './columnSettingsBars';
import { colorRuleSettings, colorRulesHaveProblem } from './columnSettingsRules';
import { contextMenuAttributes } from './contextMenuAttributes';
import { setHeaderFilterCaseSensitive } from './contextmenuFilter';
import {
    applyDetailForm,
    type DetailFormDraft,
    detailFormDraft,
    detailFormResetButton,
    detailFormTabPanel,
    setFieldOption
} from './detailFormSettings';
import { keepDialogInView, moveDialog, resizeHandles, showDialog } from './dialogFrame';
import { defaultFilterOnType, isFilterOnType, setFilterOnType } from './filterOnType';
import { formatName, formatSubmenu } from './formatSubmenu';
import { functionButton } from './formulaFunctionMenu';
import { getColumnLabel, getConfigColumnLabel } from './getColumnLabel';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';
import { getLayoutFields } from './getLayoutFields';
import { configTabs, type GridConfigTab, tabId, tabList, tabPanelId } from './gridConfigTabs';
import { applyDefaults, type DefaultsDraft, defaultsDraft, defaultsResetButton, defaultsTabPanel } from './gridDefaultsSettings';
import { gridText } from './gridText';
import { refilterChangedFormats } from './headerFilterFormatter';
import { HEADER_OPERATOR_TEXTS, setHeaderFilterOperator } from './headerOperatorMenu';
import { prettyPrintString } from './prettyPrintString';
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
 * Three tabs under the title bar (gridConfigTabs.ts): **Columns**, the settings of the columns below,
 * **Detail form** (detailFormSettings.ts), the fields of the detail form (detailForm.ts), and **Defaults**
 * (gridDefaultsSettings.ts), the formats by type and the default view. The footer is the dialog's: Apply
 * applies every tab, Cancel drops them all; its left end has the resets of the tab shown. A column
 * without a format of its own shows its type's of the Defaults tab: its picker says `Default: Norwegian`,
 * the preview shows it.
 *
 * - **Left**: the columns of the layout, in their order - a listbox, one stop of Tab, the arrows, Home,
 *   End, PageUp / PageDown and a letter pick one. Each has its label, its type and what it has set:
 *   Format, Text, Link, Checkbox, Blank / 0, Label, Placeholder, Colours - or Error.
 * - **Right**, the column picked, in tabs under its name (ColumnSection: General, Display, Header filter,
 *   Colours - a tab with a problem has a mark), the preview under them: its label (`ColumnFormat.label`,
 *   empty the column's own). A date, datetime
 *   or number column has its format, a picker that opens the entries of Format › (formatSubmenu.ts - one
 *   list of the formats), and under it Filter as shown (`ColumnFormat.filterAsShown`, greyed out for a
 *   format that is no period of time); a number column Show blank as 0 and Show 0 as blank too (`numberOverride`, one or
 *   the other). A text column the text it shows (a template, `ColumnFormat.text`), Show as link, the
 *   address (`ColumnFormat.link.url`) and Open in a new tab; a checkbox and a lookup column have none. A
 *   text and a number column can be shown as checkboxes (`ColumnFormat.checkbox`): Show as checkbox, the
 *   checked and the unchecked value - while it is on, their template, link, format and blank / 0 are
 *   gone, a checkbox shows no text. A template's ⟨{ }⟩ button puts a field in it at the caret, from a menu
 *   of the fields of the columns and the row. The placeholder of its empty cells (a text, or Use the
 *   column label - `placeholderRow`, `placeholderRowLabel`). Then, for every column but a checkbox, the
 *   header filter: its operator - a picker of the operators it offers, the column's default said under it - and Filter as
 *   you type (`GridState.headerFilters[field].filterOnType`, filterOnType.ts). Then its colour rules
 *   (`ColumnFormat.rules`, columnSettingsRules.ts), any column. A number column's data bar, colour scale
 *   and icon set under them (`ColumnFormat.bar`, `scale`, `icons`, columnSettingsBars.ts), with five cells
 *   of the column's range drawn as they will be. Under it the preview: what the cell shows
 *   in the current row (else the first) in the colours of its rule - its bar, scale and icon - the link
 *   and its address, and why a row has no link.
 * - **The footer**: Reset column and Reset all go back to the formats the grid starts with (the config's
 *   `ColumnConfig.format`, or `initialState.formats` - the label, the placeholder, blank / 0 and the
 *   checkboxes are in them) and the column's default operator and filter as you type, Cancel closes,
 *   Apply sets the formats of the state (`setState({ formats })`, so `getState()` has them, to save) -
 *   a header filter whose column reads its text in another way now runs again (refilterChangedFormats) -
 *   switches the header filters whose operator changed, as Operator › does, and their filter as you
 *   type - and Apply & close. A template that is not
 *   valid - an address of a scheme that is not allowed, one that does not start with its scheme - has its
 *   problem under it at once, the column is marked Error and Apply does nothing until it is fixed.
 *
 * - **Calculated columns** (`GridState.calculatedColumns`, calculatedColumns.ts): *Add calculated
 *   column* under the list adds one at the end of the list - `calc_1`, *Calculated 1* - and picks it.
 *   A calculated column has its own settings at the top, in place of the label: its field name (while
 *   it is new; once applied it stays), its label, its formula with the `{ }` button, the type it gives,
 *   its value in the row of the preview and the problems of the formula (at once: Apply waits), and
 *   *Remove calculated column*. Its other settings are those of its type once it is applied with that
 *   type - before, a hint says to apply first. Apply puts a new one at the end of the layout, takes a
 *   removed one out of it (setState: the layout, the sort, the filter ...).
 *
 * What it edits is a copy of the state's formats, the calculated columns, the operators and the filter
 * as you type in use (ColumnSettings): the grid changes on Apply only.
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
    /**
     * the filter as you type of each column's header filter (filterOnType.ts): the one in use when it
     * opened (isFilterOnType). A checkbox column is left out, as for `operators`
     */
    filterOnType: Record<string, boolean>;
    /**
     * Match case of each text column's header filter (isHeaderFilterCaseSensitive): the one in use when it
     * opened. A column that always matches case (`filterCaseSensitive`) is in it, `true` - it can not change
     */
    caseSensitive: Record<string, boolean>;
    /** the column shown on the right */
    field: string;
    /**
     * a narrow dialog (a phone) shows the list of the columns or the settings of one, not both: true while
     * it shows the settings - a column clicked, Enter in the list. Its "‹ Columns" goes back. A wide
     * dialog shows both whatever it is (css, a container query)
     */
    detail: boolean;
    /**
     * the colour rule open in the column's settings, its index: the others are one line each. null: none
     * (closed by the user); undefined: not picked yet - the first with a problem, else the first
     */
    openRule: number | null | undefined;
    /**
     * the column openRule is of: picked another way (Reset, rename, remove, a new calculated column) the
     * rules are another column's, the first open again
     */
    openRuleField: string;
    /**
     * the panel of the Colours tab open on a number column - Colour rules, Data bar, Colour scale, Icons,
     * one at a time; null: none. Kept when another column is picked
     */
    colourPanel: ColourPanel | null;
    /** the tab shown: the columns' settings, or the detail form's */
    tab: GridConfigTab;
    /**
     * the tab of the column's settings shown on the Columns tab, see {@link ColumnSection}. Kept when another
     * column is picked; a column without it shows General
     */
    section: ColumnSection;
    /** what the Detail form tab edits, see detailFormSettings.ts */
    detailForm: DetailFormDraft;
    /** what the Defaults tab edits, see gridDefaultsSettings.ts: the formats by type, the default view */
    defaults: DefaultsDraft;
    /** the calculated columns, by field: a copy of the state's when it opened (GridState.calculatedColumns) */
    calculated: Record<string, CalculatedColumn>;
    /** the calculated columns added in the dialog, in their order: at the end of the layout on Apply */
    added: string[];
    /** the field name typed for an added calculated column that is no name it can have yet, by its field */
    typedNames: Record<string, string>;
    /**
     * the numbers typed for the data bars, colour scales and icon sets (columnSettingsBars.ts), as text by
     * `<field>|<part>`: kept while they are typed - `1,` is on its way to `1,5` - until Apply or a reset
     */
    typedNumbers: Record<string, string>;
}

/** a problem of a template, a text of the grid and its values */
interface Problem {
    id: TextId;
    values?: Readonly<Record<string, unknown>>;
}

/**
 * The tabs of a column's settings on the Columns tab - one long form was too big (the user):
 * - `general`: the label (a calculated column's own settings in its place), Read only and Multiline, the
 *   placeholder
 * - `display`: what the cell shows - the format, the text template and the link, the checkboxes, blank /
 *   0. Not for a checkbox or a lookup column: they have none
 * - `filter`: the header filter's operator and Filter as you type. Not for a checkbox column
 * - `colours`: the colour rules, and a number column's data bar, colour scale and icon set
 *
 * A calculated column waiting for Apply has General only, and no tabs. The preview is under every tab
 */
type ColumnSection = 'general' | 'display' | 'filter' | 'colours';

/** the panels of the Colours tab of a number column: its colour rules, and each kind of the section of bars */
type ColourPanel = 'rules' | FillKind;

/** the kind of a column, for its settings: its field's type, or a lookup column */
type ColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'lookup';

/** the field type of the values of a formula: a date is a date field */
const fieldTypeOf = (type: FormulaType): FieldType => type;

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
        filterOnType: Object.fromEntries(
            fields.filter((name) => hasOperator(ctx, name)).map((name) => [name, isFilterOnType(ctx, name)])
        ),
        caseSensitive: Object.fromEntries(
            fields.filter((name) => takesMatchCase(ctx, name)).map((name) => [name, isHeaderFilterCaseSensitive(ctx, name)])
        ),
        field: field !== undefined && fields.includes(field) ? field : fields[0],
        // opened on a column (its header menu): its settings, also on a phone
        detail: field !== undefined,
        openRule: undefined,
        openRuleField: '',
        colourPanel: 'rules',
        tab,
        section: 'general',
        detailForm: detailFormDraft(ctx, ctx.gridInterface.getState().detailForm),
        defaults: defaultsDraft(ctx),
        calculated: ctx.gridInterface.getState().calculatedColumns,
        added: [],
        typedNames: {},
        typedNumbers: {}
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
    return defaultHeaderOperator(
        ctx.gridInterface.__getGridConfig().columns[field],
        headerFilterType(ctx.gridInterface, field),
        isClobField(ctx.gridInterface, field)
    );
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
    const fields = new Set(
        Object.keys(ctx.gridInterface.__getGridConfig().columns).filter((name) => !ctx.gridInterface.__isGoneCalculated(name))
    );
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

    const datasource = gridInterface.getDatasource();
    const columns = gridInterface.__getGridConfig().columns;
    /** a calculated column of the dialog's draft */
    const isDraftCalculated = (name: string) => Object.hasOwn(settings.calculated, name);
    // the calculated columns of the draft read, with the fields the grid knows (as setState() reads them)
    const names = gridInterface.__calculatedNames();
    const compiled = compileCalculatedColumns(settings.calculated, names.fieldType);
    // the calculated columns of the layout removed in the dialog: no field anymore
    const removedCalculated = new Set(
        layoutFields(ctx).filter((name) => gridInterface.__isCalculated(name) && !isDraftCalculated(name))
    );
    const fields = [...layoutFields(ctx).filter((name) => !removedCalculated.has(name)), ...settings.added];
    if (!fields.includes(settings.field)) {
        settings.field = fields[0];
    }
    const field = settings.field;
    /** the type a calculated column of the draft gives, null while its formula has a problem */
    const draftType = (name: string): FormulaType | null => {
        const each = compiled.get(name);
        return each && 'formula' in each ? each.formula.type : null;
    };
    /**
     * a calculated column whose settings of its type wait for Apply: new, of another type now, or with a
     * problem - the grid has it of another type (or not at all) until then
     */
    const pending = (name: string) =>
        isDraftCalculated(name) &&
        (!gridInterface.__isCalculated(name) || draftType(name) === null || datasource.getField(name).type !== draftType(name));
    /** the kind of a column: a calculated column waiting for Apply has the type of its formula */
    const kindOfColumn = (name: string): ColumnKind => (pending(name) ? (draftType(name) ?? 'text') : kindOf(ctx, name));
    const kind = kindOfColumn(field);
    const format = settings.formats[field];
    /** the format the column shows: its own, with its type's of the Defaults tab when it has none (withTypeFormat) */
    const shownFormat = kind === 'lookup' ? format : withTypeFormat(format, kind, settings.defaults.typeFormats);
    const at = previewRow(ctx);
    /** what a colour rule's condition or formula knows of a field, with the draft's calculated columns */
    const appliedFieldOf = gridInterface.__ruleFieldOf();
    const fieldOf: RuleFieldOf = (name) => {
        if (isDraftCalculated(name)) {
            const type = draftType(name);
            return type ? { type: fieldTypeOf(type), lookup: false } : undefined;
        }
        return gridInterface.__isCalculated(name) ? undefined : appliedFieldOf(name);
    };
    /** the fields a formula can name, for its `{ }` button: the columns, the layout, the calculated columns */
    const formulaFields = [
        ...new Set([...fields, ...Object.keys(columns), ...Object.keys(settings.calculated)].filter((name) => fieldOf(name)))
    ];
    /** the value of a calculated column of the draft in a row, or why it has none; null for another column */
    const draftResult = (name: string, row: Entity) => {
        const each: CompiledColumn | undefined = compiled.get(name);
        return each && 'formula' in each ? each.formula.evaluate(readerOf(row, { has: isDraftCalculated })) : null;
    };
    /** a row as the preview sees it: the values of the draft's calculated columns in it */
    const previewOf = (row: Entity): Entity => {
        if (!Object.keys(settings.calculated).length) {
            return row;
        }
        const values: Record<string, FormulaValue> = {};
        for (const name of Object.keys(settings.calculated)) {
            const result = draftResult(name, row);
            values[name] = result && 'value' in result ? result.value : null;
        }
        return { ...row, ...values };
    };
    /** the problem of a calculated column of the draft: its field name (a new one), its formula */
    const calculatedProblem = (name: string): string | null => {
        const typed = settings.typedNames[name];
        if (typed !== undefined) {
            return isCalculatedName(typed)
                ? text('columnSettings.calculated.problem.taken')
                : text('columnSettings.calculated.problem.name');
        }
        const each = compiled.get(name);
        return each && 'problem' in each
            ? formulaProblemText(each.problem, (id, values) => gridText(ctx, id as TextId, values))
            : null;
    };

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
        if (name !== settings.field) {
            // the rules of another column: the first open again
            settings.openRule = undefined;
        }
        settings.field = name;
        update();
        // the option picked in view in the list
        dialog.querySelector(`#${idOf(ctx, `option-${fields.indexOf(name)}`)}`)?.scrollIntoView({ block: 'nearest' });
    };

    // the columns whose format has a problem: Apply does nothing while there is one
    const withProblems = new Set([
        ...Object.keys(settings.formats).filter(
            (name) =>
                !removedCalculated.has(name) &&
                (formatProblems(settings.formats[name]).length ||
                    (fields.includes(name) && checkboxProblems(settings.formats[name], kindOfColumn(name)).length) ||
                    (fields.includes(name) && colorRulesHaveProblem(settings.formats[name]?.rules, fieldOf)))
        ),
        // a number typed for a bar, a scale or the icons that is no number, a min not below the max ...
        ...fields.filter(
            (name) =>
                !removedCalculated.has(name) && valueFillProblems(name, settings.formats[name], settings.typedNumbers).length > 0
        ),
        ...Object.keys(settings.calculated).filter((name) => calculatedProblem(name) !== null)
    ]);

    /** the label of a column in the dialog: the one typed (the draft's), else the column's own - a calculated column's of the draft */
    const labelOf = (name: string) =>
        settings.formats[name]?.label ||
        (isDraftCalculated(name)
            ? columns[name]?.label || calculatedLabel(settings.calculated[name], name, prettyPrintString)
            : getConfigColumnLabel(ctx, name));

    const apply = () => {
        if (withProblems.size) {
            return false;
        }
        removeContextMenu(ctx);
        const state = gridInterface.getState();
        const before = state.formats;
        // the formats of the calculated columns removed go with them
        const formats = structuredClone(settings.formats);
        for (const name of Object.keys(formats)) {
            if (gridInterface.__isCalculated(name) && !isDraftCalculated(name)) {
                delete formats[name];
            }
        }
        const typeFormatsBefore = state.typeFormats;
        const next: Partial<GridState> = { formats, typeFormats: structuredClone(settings.defaults.typeFormats) };
        if (settings.added.length || JSON.stringify(settings.calculated) !== JSON.stringify(state.calculatedColumns)) {
            // the calculated columns first (setState gives them to the datasource), a new one at the end
            next.calculatedColumns = structuredClone(settings.calculated);
            if (settings.added.length) {
                state.layout.center.push(...settings.added.map((name) => ({ fields: [name], width: 100 })));
                next.layout = state.layout;
            }
        }
        const removed = new Set(Object.keys(state.calculatedColumns).filter((name) => !isDraftCalculated(name)));
        gridInterface.setState(next);
        settings.added = [];
        settings.typedNames = {};
        settings.typedNumbers = {};
        // the detail form of the draft without the removed ones, as setState took them out
        for (const name of removed) {
            settings.detailForm.included.delete(name);
        }
        settings.detailForm.order = settings.detailForm.order.filter((entry) => typeof entry !== 'string' || !removed.has(entry));
        // a column new in the layout: its header filter's operator and filter as you type, as they are
        for (const name of layoutFields(ctx)) {
            if (!Object.hasOwn(settings.operators, name) && hasOperator(ctx, name)) {
                settings.operators[name] = getHeaderFilterOperator(ctx, name);
                settings.filterOnType[name] = isFilterOnType(ctx, name);
            }
            if (!Object.hasOwn(settings.caseSensitive, name) && takesMatchCase(ctx, name)) {
                settings.caseSensitive[name] = isHeaderFilterCaseSensitive(ctx, name);
            }
        }
        // a header filter whose column reads its text in another way now (filter as shown): it runs again
        refilterChangedFormats(ctx, before, typeFormatsBefore);
        // a header filter whose operator changed: as if it was picked in Operator › - the filter runs again
        // with the value the cell has, the header shows it, filter-operator-change is sent
        for (const [name, operator] of Object.entries(settings.operators)) {
            if (operator !== getHeaderFilterOperator(ctx, name)) {
                setHeaderFilterOperator(ctx, name, operator);
            }
        }
        // filter as you type: state, as the toggle of the operator choice sets it
        for (const [name, on] of Object.entries(settings.filterOnType)) {
            if (on !== isFilterOnType(ctx, name)) {
                setFilterOnType(ctx, name, on);
            }
        }
        // Match case: state, as the toggle of the filter menu sets it - the filter runs again with it
        for (const [name, on] of Object.entries(settings.caseSensitive)) {
            if (on !== isHeaderFilterCaseSensitive(ctx, name)) {
                setHeaderFilterCaseSensitive(ctx, name, on);
            }
        }
        // the Detail form tab's, the Defaults tab's default view
        applyDetailForm(ctx, settings.detailForm);
        applyDefaults(ctx, settings.defaults);
        // the dialog stays open: the badges, a calculated column applied
        update();
        return true;
    };

    const typeName = (name: string) => text(`columnSettings.type.${kindOfColumn(name)}`);
    /** what a column has set, for its option in the list: Error alone when it has a problem */
    const badges = (name: string): TextId[] => {
        const set = settings.formats[name];
        if (withProblems.has(name)) {
            return ['columnSettings.badge.problem'];
        }
        const marks: TextId[] = isDraftCalculated(name) ? ['columnSettings.badge.calculated'] : [];
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
        if (set?.placeholderRow !== undefined || set?.placeholderRowLabel) {
            marks.push('columnSettings.badge.placeholder');
        }
        if (set?.multiline) {
            marks.push('columnSettings.badge.multiline');
        }
        if (set?.readonly) {
            marks.push('columnSettings.badge.readonly');
        }
        if (set?.rules?.length) {
            marks.push('columnSettings.badge.rules');
        }
        if (set?.bar) {
            marks.push('columnSettings.badge.bar');
        }
        if (set?.scale) {
            marks.push('columnSettings.badge.scale');
        }
        if (set?.icons) {
            marks.push('columnSettings.badge.icons');
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
        } else if (event.key === 'Enter') {
            // on a phone: the settings of the column, the focus on "‹ Columns"
            event.preventDefault();
            settings.detail = true;
            update();
            dialog.querySelector<HTMLElement>('.column-settings-back')?.focus();
        }
    };

    /**
     * The button beside a template that puts a field in it: a menu of the fields (their labels, a search),
     * the one picked is put in at the caret as `{field}`, the caret after it
     * @param inputId the id of the template's input
     * @param write puts the new template in the dialog
     */
    const insertButton = (inputId: string, write: (template: string) => void, list = pickableFields(ctx, at?.row)) =>
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
                    list
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

    /**
     * the text a cell shows (a template), and with `withLink` Show as link, the address, Open in a new
     * tab: a text column and a number column have both, a date column the text only
     */
    const textSettings = (withLink: boolean) => {
        const link = format?.link;
        const textProblems = formatProblems(format?.text === undefined ? undefined : { text: format.text });
        const urlProblems = formatProblems(link ? { link } : undefined);
        // Text shown is the text of the link: under Show as link, while it is on. A template the column
        // has without a link (the config's: `{value} kg`) stays in view, to be seen and emptied
        const textInput = html`${templateInput(
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
        ${
            // a text column with a template: its filters compare the text shown - Filter as shown
            kind === 'text' && format?.text !== undefined
                ? html`<div class="column-settings-field">
                      ${checkbox('columnSettings.filterAsShown', format.filterAsShown !== false, (on) =>
                          change((next) => {
                              if (on) {
                                  delete next.filterAsShown;
                              } else {
                                  next.filterAsShown = false;
                              }
                          })
                      )}
                      <div class="column-settings-hint">${text('columnSettings.filterAsShown.template.hint')}</div>
                  </div>`
                : nothing
        }`;
        const showText = (withLink && !!link) || format?.text !== undefined;
        return html`${
            withLink
                ? checkbox('columnSettings.link', !!link, (on) =>
                      change((next) => {
                          if (on) {
                              // a link from the dialog opens in a new tab at first: the grid's page stays
                              next.link = { url: '', newTab: true };
                          } else {
                              // its text goes with it, and on a text column how it is filtered: a number
                              // column's Filter as shown is its number format's, it stays
                              delete next.link;
                              delete next.text;
                              if (kind === 'text') {
                                  delete next.filterAsShown;
                              }
                          }
                      })
                  )
                : nothing
        }
        ${showText ? textInput : nothing}
        ${
            withLink && link
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

    /** the texts the dates are written with, how the header filter reads a week, a quarter */
    const texts = formatTexts(gridInterface.__getGridConfig().texts);

    /**
     * Under the format of a date, datetime or number column: Filter as shown (`ColumnFormat.filterAsShown`,
     * filterAsShown.ts) - its header filter takes the text as the cells show it, `2026-W47` the week. On
     * by default: turned off it is `filterAsShown: false` in the format. Off and greyed out for a format
     * that is no period of time (the day of the week, a time of day), the hint says why. Not shown
     * without a date or number format
     */
    const filterAsShownSettings = () => {
        if (!hasValueFormat(shownFormat)) {
            return nothing;
        }
        const can = canFilterAsShown(shownFormat, texts);
        const hintId = idOf(ctx, 'filter-as-shown-hint');
        return html`<div class="column-settings-field">
            <label class="column-settings-check">
                <input
                    type="checkbox"
                    class="column-settings-filter-as-shown"
                    aria-describedby=${hintId}
                    ?disabled=${!can}
                    .checked=${live(filtersAsShown(shownFormat, texts))}
                    @change=${(event: Event) =>
                        change((next) => {
                            if ((event.target as HTMLInputElement).checked) {
                                delete next.filterAsShown;
                            } else {
                                next.filterAsShown = false;
                            }
                        })}
                /><span>${text('columnSettings.filterAsShown')}</span>
            </label>
            <div class="column-settings-hint" id=${hintId}>
                ${text(can ? 'columnSettings.filterAsShown.hint' : 'columnSettings.filterAsShown.off')}
            </div>
        </div>`;
    };

    /** a date, datetime or number column: its format, a picker of the entries of Format › */
    const formatSettings = () => {
        // without one of its own: Default, the format of its type said after it (the Defaults tab)
        const typeName = formatName(ctx, shownFormat);
        const picked =
            formatName(ctx, format) ??
            (typeName ? text('columnSettings.format.ofType', { format: typeName }) : text('header.format.default'));
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
                        const entries = formatSubmenu(
                            ctx,
                            field,
                            {
                                current: () => settings.formats[field],
                                set: (next) => setFormat(field, next)
                            },
                            settings.defaults.typeFormats
                        ).entries;
                        gridInterface.openMenu(event.currentTarget as HTMLElement, entries);
                    }}
                >
                    <span class="filter-editor-pick-text">${picked}</span>
                </button>
            </div>
        </div>
        ${filterAsShownSettings()}`;
    };

    /**
     * Beside the operator: Filter as you type (filterOnType.ts) - the header filter filters after a pause in
     * typing. What it is in use when the dialog opened, Apply sets it as the toggle of the operator choice
     * does
     */
    const filterOnTypeSettings = () => {
        const hintId = idOf(ctx, 'filter-on-type-hint');
        return html`<div class="column-settings-field">
            <label class="column-settings-check">
                <input
                    type="checkbox"
                    class="column-settings-filter-on-type"
                    aria-describedby=${hintId}
                    .checked=${live(settings.filterOnType[field] === true)}
                    @change=${(event: Event) => {
                        settings.filterOnType[field] = (event.target as HTMLInputElement).checked;
                        update();
                    }}
                /><span>${text('columnSettings.filterOnType')}</span>
            </label>
            <div class="column-settings-hint" id=${hintId}>${text('columnSettings.filterOnType.hint')}</div>
        </div>`;
    };

    /**
     * Under Filter as you type, on a text column: Match case - `Ann` does not find `ANN`. Checked and
     * greyed out when the column always matches case (`filterCaseSensitive`), its hint says so. Apply sets
     * it as the filter menu's toggle does; the header shows Aa beside the operator while it is on
     */
    const matchCaseSettings = () => {
        if (!Object.hasOwn(settings.caseSensitive, field)) {
            return nothing;
        }
        // locked: the field's caseSensitive, set by the application's code - not the column's config
        const locked = gridInterface.getDatasource().getField(field).caseSensitive;
        const always = isAlwaysCaseSensitive(
            gridInterface.__getGridConfig().columns[field],
            headerFilterType(gridInterface, field),
            locked
        );
        const hintId = idOf(ctx, 'match-case-hint');
        return html`<div class="column-settings-field">
            <label class="column-settings-check">
                <input
                    type="checkbox"
                    class="column-settings-match-case"
                    aria-describedby=${hintId}
                    .checked=${live(settings.caseSensitive[field] === true)}
                    ?disabled=${always}
                    @change=${(event: Event) => {
                        settings.caseSensitive[field] = (event.target as HTMLInputElement).checked;
                        update();
                    }}
                /><span>${text('columnSettings.matchCase')}</span>
            </label>
            <div class="column-settings-hint" id=${hintId}>
                ${text(
                    locked
                        ? 'columnSettings.matchCase.locked'
                        : always
                          ? 'columnSettings.matchCase.always'
                          : 'columnSettings.matchCase.hint'
                )}
            </div>
        </div>`;
    };

    /**
     * The operator of the column's header filter: a picker of the operators the column offers (Operator ›),
     * the one picked checked; just its name when the column offers one. The column's default under it,
     * Filter as you type after it
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
            headerFilterType(gridInterface, field),
            isClobField(gridInterface, field)
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
                </div>
                ${filterOnTypeSettings()} ${matchCaseSettings()}`;
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
        </div>
        ${filterOnTypeSettings()} ${matchCaseSettings()}`;
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
     * The placeholder of the column's empty cells (the user: the placeholder "was supposed to be for row"):
     * a text (`ColumnFormat.placeholderRow`, empty the column's own `placeholderRow` - shown in the input), or
     * Use the column label (`placeholderRowLabel`) - the input is off then, and shows the label. Every
     * column but a checkbox one: a column of checkboxes has no empty text to show
     */
    const placeholderSettings = () => {
        if (kind === 'boolean' || format?.checkbox) {
            return nothing;
        }
        const useLabel = format?.placeholderRowLabel === true;
        const own = gridInterface.__getGridConfig().columns[field]?.placeholderRow ?? '';
        return html`<div class="column-settings-field">
            ${textInput(
                'placeholder',
                'columnSettings.placeholder',
                useLabel ? '' : (format?.placeholderRow ?? ''),
                // the draft's label before it is applied
                useLabel ? format?.label || getConfigColumnLabel(ctx, field) : own,
                (value) =>
                    change((next) => {
                        if (value.trim() === '') {
                            delete next.placeholderRow;
                        } else {
                            next.placeholderRow = value;
                        }
                    }),
                useLabel
            )}
            ${checkbox('columnSettings.placeholderLabel', useLabel, (on) =>
                change((next) => {
                    delete next.placeholderRow;
                    if (on) {
                        next.placeholderRowLabel = true;
                    } else {
                        delete next.placeholderRowLabel;
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
                    delete next.multiline;
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

    /** the colour rules of the column (ColumnFormat.rules), any column: columnSettingsRules.ts */
    const ruleSettings = () => {
        const rules = format?.rules ?? [];
        // the rule open is of another column, or no longer there (Reset): the first open again
        if (settings.openRuleField !== field || (typeof settings.openRule === 'number' && settings.openRule >= rules.length)) {
            settings.openRule = undefined;
            settings.openRuleField = field;
        }
        return colorRuleSettings(ctx, {
            dialog,
            field,
            rules,
            write: (rules) =>
                change((next) => {
                    if (rules.length) {
                        next.rules = rules;
                    } else {
                        delete next.rules;
                    }
                }),
            idOf: (part) => idOf(ctx, part),
            fieldOf,
            fields: formulaFields,
            row: at ? previewOf(at.row) : undefined,
            insertButton: (inputId, write) => insertButton(inputId, write, formulaFields),
            open: settings.openRule,
            setOpen: (index, render = true) => {
                settings.openRule = index;
                if (render) {
                    update();
                }
            }
        });
    };

    /**
     * The data bar, colour scale and icon set of a number column (ColumnFormat.bar, scale, icons):
     * columnSettingsBars.ts. Not for a column shown as checkboxes, it shows no number
     */
    const hasFills = kind === 'number' && !format?.checkbox;
    const barSettings = (only: FillKind) =>
        valueFillSettings(
            ctx,
            {
                field,
                format,
                change,
                typed: settings.typedNumbers,
                idOf: (part) => idOf(ctx, part),
                formatNumber: (value) => gridInterface.__getCellFormatter(field, undefined, undefined, shownFormat).format(value),
                shown: shownRange(datasource, field)
            },
            only
        );

    /**
     * The Colours tab. A number column has four panels, one open at a time - Colour rules, Data bar,
     * Colour scale, Icons: each a line saying what it has (2 rules, On, Off) and a red square for a problem
     * in it, a click opens it. So the tab fits a small screen. Another column has its colour rules only
     */
    const colourSettings = () => {
        if (!hasFills) {
            return ruleSettings();
        }
        const open = settings.colourPanel;
        const fillProblems = valueFillProblems(field, format, settings.typedNumbers);
        const rules = format?.rules ?? [];
        const onOff = (on: boolean) => text(on ? 'columnSettings.colours.on' : 'columnSettings.colours.off');
        const panel = (id: ColourPanel, title: TextId, summary: string, problem: boolean, content: () => unknown) => {
            const shown = open === id;
            const bodyId = idOf(ctx, `colours-${id}-body`);
            return html`<div class=${`column-settings-colour-panel${shown ? ' column-settings-colour-panel-open' : ''}`} data-panel=${id}>
                <button
                    type="button"
                    id=${idOf(ctx, `colours-${id}`)}
                    class="column-settings-colour-panel-toggle"
                    aria-expanded=${shown ? 'true' : 'false'}
                    aria-controls=${bodyId}
                    @click=${() => {
                        settings.colourPanel = shown ? null : id;
                        update();
                        dialog.querySelector<HTMLElement>(`#${idOf(ctx, `colours-${id}`)}`)?.focus();
                    }}
                >
                    <span class="column-settings-rule-chevron" aria-hidden="true">${shown ? '▾' : '▸'}</span>
                    <span class="column-settings-colour-panel-title">${text(title)}</span>
                    <span class="column-settings-colour-panel-summary">${summary}</span>
                    ${problem ? html`<span class="column-settings-tab-problem" role="img" aria-label=${text('columnSettings.badge.problem')}></span>` : nothing}
                </button>
                ${shown ? html`<div class="column-settings-colour-panel-body" id=${bodyId}>${content()}</div>` : nothing}
            </div>`;
        };
        const fillPanel = (id: FillKind, title: TextId) =>
            panel(
                id,
                title,
                onOff(format?.[id] !== undefined),
                fillProblems.some((problem) => problem.kinds.includes(id)),
                () => barSettings(id)
            );
        return html`${panel(
            'rules',
            'columnSettings.rules',
            rules.length === 1
                ? text('columnSettings.colours.oneRule')
                : rules.length
                  ? text('columnSettings.colours.rules', { count: rules.length })
                  : text('columnSettings.rules.empty'),
            colorRulesHaveProblem(rules, fieldOf),
            ruleSettings
        )}
        ${fillPanel('bar', 'columnSettings.bars.bar')} ${fillPanel('scale', 'columnSettings.bars.scale')}
        ${fillPanel('icons', 'columnSettings.bars.icons')}`;
    };

    /**
     * A calculated column of the draft (GridState.calculatedColumns): at the top of its settings, in place
     * of the label - its field name (a new one only, until Apply), its label, its formula with the `{ }`
     * button and the type it gives, its value in the row of the preview, its problem, Remove
     */
    const calculatedSettings = () => {
        const column = settings.calculated[field];
        const added = settings.added.includes(field);
        /** the column changed, in the draft */
        const changeColumn = (edit: (next: CalculatedColumn) => void) => {
            const next = { ...column };
            edit(next);
            settings.calculated[field] = next;
            update();
        };
        const rename = (typed: string) => {
            const taken =
                typed !== field &&
                (isDraftCalculated(typed) ||
                    fields.includes(typed) ||
                    (Object.hasOwn(columns, typed) && !gridInterface.__isGoneCalculated(typed)) ||
                    names.isTaken(typed));
            if (!isCalculatedName(typed) || taken) {
                // kept as typed, the problem says why: the column keeps its field until then
                settings.typedNames[field] = typed;
                update();
                return;
            }
            delete settings.typedNames[field];
            settings.calculated = Object.fromEntries(
                Object.entries(settings.calculated).map(([name, each]) => [name === field ? typed : name, each])
            );
            settings.added = settings.added.map((name) => (name === field ? typed : name));
            if (settings.formats[field]) {
                settings.formats[typed] = settings.formats[field];
                delete settings.formats[field];
            }
            settings.field = typed;
            update();
        };
        const remove = () => {
            const index = fields.indexOf(field);
            delete settings.calculated[field];
            delete settings.formats[field];
            delete settings.typedNames[field];
            settings.added = settings.added.filter((name) => name !== field);
            const left = fields.filter((name) => name !== field);
            settings.field = left[Math.min(index, left.length - 1)];
            // back to the list it focuses, also on a phone
            settings.detail = false;
            update();
            dialog.querySelector<HTMLElement>('.column-settings-list')?.focus();
        };
        const result = at ? draftResult(field, at.row) : null;
        const type = draftType(field);
        const shown = (value: FormulaValue) =>
            value === null
                ? text('columnSettings.calculated.blank')
                : datasource.getFormatter(field, type ? fieldTypeOf(type) : 'text').format(value);
        const problem = calculatedProblem(field);
        const formulaId = idOf(ctx, 'calculated-formula');
        const problemId = idOf(ctx, 'calculated-problem');
        return html`<div class="column-settings-field column-settings-calculated" role="group" aria-labelledby=${idOf(ctx, 'calculated-heading')}>
            <span class="column-settings-label" id=${idOf(ctx, 'calculated-heading')}>${text('columnSettings.calculated')}</span>
            ${
                added
                    ? html`${textInput('calculated-name', 'columnSettings.calculated.name', settings.typedNames[field] ?? field, '', rename)}
                          <div class="column-settings-hint">${text('columnSettings.calculated.name.hint')}</div>`
                    : html`<span class="column-settings-label">${text('columnSettings.calculated.name')}</span>
                          <div class="column-settings-input-row column-settings-calculated-name">${field}</div>`
            }
            ${textInput('calculated-label', 'columnSettings.label', column.label ?? '', prettyPrintString(field), (value) =>
                changeColumn((next) => {
                    if (value.trim() === '') {
                        delete next.label;
                    } else {
                        next.label = value;
                    }
                    // the label typed is the one shown: a label of the format would win over it
                    if (settings.formats[field]?.label !== undefined) {
                        const { label: _, ...rest } = settings.formats[field];
                        if (hasDisplayFormat(rest)) {
                            settings.formats[field] = rest;
                        } else {
                            delete settings.formats[field];
                        }
                    }
                })
            )}
            <label class="column-settings-label" for=${formulaId}>${text('columnSettings.calculated.formula')}</label>
            <div class="column-settings-input-row">
                <input
                    id=${formulaId}
                    class="filter-editor-value column-settings-template column-settings-formula"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${text('columnSettings.calculated.formula.placeholder')}
                    aria-describedby=${`${idOf(ctx, 'calculated-hint')} ${problemId}`}
                    aria-invalid=${problem ? 'true' : 'false'}
                    .value=${live(column.formula)}
                    @input=${(event: Event) =>
                        changeColumn((next) => {
                            next.formula = (event.target as HTMLInputElement).value;
                        })}
                />
                ${insertButton(
                    formulaId,
                    (formula) =>
                        changeColumn((next) => {
                            next.formula = formula;
                        }),
                    formulaFields.filter((name) => name !== field)
                )}
                ${functionButton(ctx, dialog, formulaId, (formula) =>
                    changeColumn((next) => {
                        next.formula = formula;
                    })
                )}
            </div>
            <div class="column-settings-hint" id=${idOf(ctx, 'calculated-hint')}>${text('columnSettings.calculated.formula.hint')}</div>
            ${type ? html`<div class="column-settings-calculated-type">${text('columnSettings.calculated.gives', { type: text(`columnSettings.type.${type}`) })}</div>` : nothing}
            ${
                result && 'value' in result
                    ? html`<div class="column-settings-calculated-value">${text('columnSettings.calculated.value', { value: shown(result.value) })}</div>`
                    : nothing
            }
            <div class="column-settings-problems" id=${problemId} aria-live="polite">
                ${problem ? html`<div class="column-settings-problem">${problem}</div>` : nothing}
                ${
                    !problem && result && 'problem' in result
                        ? html`<div class="column-settings-problem">${formulaProblemText(result.problem, (id, values) => gridText(ctx, id as TextId, values))}</div>`
                        : nothing
                }
            </div>
            <div class="column-settings-input-row">
                <button
                    type="button"
                    class="simple-html-grid-button column-settings-calculated-remove"
                    aria-disabled=${fields.length < 2 ? 'true' : nothing}
                    @click=${() => {
                        if (fields.length > 1) {
                            remove();
                        }
                    }}
                >
                    ${text('columnSettings.calculated.remove')}
                </button>
            </div>
            ${pending(field) && type ? html`<div class="column-settings-hint column-settings-calculated-pending">${text('columnSettings.calculated.applyFirst', { type: text(`columnSettings.type.${type}`) })}</div>` : nothing}
        </div>`;
    };

    /** what the cell shows in the row of the preview, its link and why it has none */
    const preview = () => {
        // a checkbox and a lookup column have nothing to preview but the colours of their rules
        if ((kind === 'boolean' || kind === 'lookup') && !format?.rules?.length) {
            return nothing;
        }
        const titleId = idOf(ctx, 'preview');
        const title = at
            ? at.current
                ? 'columnSettings.preview.current'
                : 'columnSettings.preview.first'
            : 'columnSettings.preview.none';
        let content: TemplateResult | typeof nothing = nothing;
        // the row with the values of the draft's calculated columns
        const row = at ? previewOf(at.row) : null;
        // the colours of the rule that matches the row's value (the dialog's rules), as the cell will have them
        const rule = row ? colorRuleOf(gridInterface, field, row, format) : null;
        // a number column's bar, scale colour and icon (ColumnFormat.bar, scale, icons) too
        const fill =
            row && kind === 'number' && !format?.checkbox
                ? previewFill(ctx, row[field], format, rule, shownRange(datasource, field), idOf(ctx, 'preview-icon'))
                : null;
        const colors = `${colorRuleClasses(rule)
            .map((name) => ` ${name}`)
            .join('')}${fill ? `${fill.classes}${fill.iconClass}` : ''}`;
        const style = styleMap({ ...colorRuleStyle(rule), ...(fill?.style ?? {}) });
        const lookupColumn = gridInterface.__getLookupColumn(field);
        if (row && (format?.checkbox || kind === 'boolean')) {
            // a checkbox, checked as the cell will be
            content = html`<div class=${`column-settings-preview-cell${colors}`} style=${style}>
                <input
                    type="checkbox"
                    class="column-settings-preview-checkbox"
                    disabled
                    aria-label=${labelOf(field)}
                    .checked=${format?.checkbox ? isCheckedValue(row[field], format.checkbox) : Boolean(row[field])}
                />
            </div>`;
        } else if (row && lookupColumn) {
            // the label of the value, as the cell shows it
            content = html`<div class=${`column-settings-preview-cell${colors}`} style=${style}>${lookupColumn.formatter.format(row[field])}</div>`;
        } else if (at && row) {
            // the format of the dialog through the grid's own code, as the cell will show it - with the
            // blank / 0 of a number column
            const formatter = gridInterface.__getCellFormatter(field, undefined, at.row, shownFormat);
            const column = { ...gridInterface.__getGridConfig().columns[field], format };
            const formatted = formatter.format(row[field]);
            const shown =
                kind === 'number'
                    ? overrideNumberText(formatted, numberOverrideOf(column), zeroText(shownFormat, formatter))
                    : formatted;
            const link = formatProblems(format).length ? null : gridInterface.__getLinkResult(field, at.row, format);
            const href = link && 'href' in link ? link.href : null;
            const problems = formatProblems(format).length ? [] : rowProblems(ctx, field, format, at.row, link);
            content = html`<div class=${`column-settings-preview-cell${colors}`} style=${style}>
                    ${fill?.icon ?? nothing}${
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

    /**
     * Editing (the user: "for text we should also be able to set if it's multiline or not, and readonly in
     * edit mode"): *Multiline* for a text column that is not shown as checkboxes (`ColumnFormat.multiline`)
     * and *Read only* for every column (`ColumnFormat.readonly`: not edited, also in an editable grid). Each
     * starts as the column has it - the field's `multiline`, the column's `readonly` - and set back to that
     * it is left out of the format
     */
    const editingSettings = () => {
        const own = {
            multiline: gridInterface.getDatasource().getField(field).multiline === true,
            readonly: gridInterface.__getGridConfig().columns[field]?.readonly === true
        };
        const set = (key: 'multiline' | 'readonly', on: boolean) =>
            change((next) => {
                if (on === own[key]) {
                    delete next[key];
                } else {
                    next[key] = on;
                }
            });
        const isMultiline = format?.multiline ?? own.multiline;
        const multiline =
            kind === 'text' && format?.checkbox === undefined
                ? html`${checkbox('columnSettings.multiline', isMultiline, (on) => set('multiline', on))}
                  ${isMultiline ? minRowsSetting() : nothing}`
                : nothing;
        return html`${multiline} ${checkbox('columnSettings.readonly', format?.readonly ?? own.readonly, (on) => set('readonly', on))}`;
    };

    /**
     * Under Multiline, while it is on: *Min lines in the detail form* - the least lines of the field's box in
     * the detail form (`DetailForm.fieldOptions[field].minRows`, 1 to 30). The Detail form tab's draft: the
     * same as its *Min lines* for the field, Apply sets both
     */
    const minRowsSetting = () => {
        const id = idOf(ctx, 'min-rows');
        const hintId = idOf(ctx, 'min-rows-hint');
        const value = settings.detailForm.options[field]?.minRows;
        return html`<div class="column-settings-field">
            <label class="column-settings-label" for=${id}>${text('columnSettings.minRows')}</label>
            <input
                id=${id}
                class="filter-editor-value column-settings-min-rows"
                type="number"
                min="1"
                max="30"
                step="1"
                placeholder="3"
                aria-describedby=${hintId}
                .value=${live(value === undefined ? '' : String(value))}
                @change=${(event: Event) => {
                    setFieldOption(settings.detailForm, field, 'minRows', (event.target as HTMLInputElement).value);
                    update();
                }}
            />
            <div class="column-settings-hint" id=${hintId}>${text('columnSettings.minRows.hint')}</div>
        </div>`;
    };

    const settingsOf = () => {
        // shown as checkboxes: no text to format
        const checkboxes = format?.checkbox !== undefined;
        switch (kind) {
            case 'text':
                return html`${checkboxSettings()} ${checkboxes ? nothing : textSettings(true)}`;
            case 'number':
                return html`${checkboxSettings()} ${
                    checkboxes ? nothing : html`${formatSettings()} ${numberOverrideSettings()} ${textSettings(true)}`
                }`;
            case 'date':
            case 'datetime':
                return html`${formatSettings()} ${textSettings(false)}`;
            default:
                return html`<div class="column-settings-none">${text(kind === 'lookup' ? 'columnSettings.none.lookup' : 'columnSettings.none.boolean')}</div>`;
        }
    };

    /**
     * Add calculated column: a new one at the end of the list - the first `calc_<n>` that is free, labelled
     * *Calculated <n>*, no formula yet (its problem says so) - picked, the focus on its formula
     */
    const addCalculated = () => {
        let number = 1;
        const free = (name: string) =>
            !isDraftCalculated(name) &&
            !fields.includes(name) &&
            !(Object.hasOwn(columns, name) && !gridInterface.__isGoneCalculated(name)) &&
            !names.isTaken(name);
        while (!free(`calc_${number}`)) {
            number++;
        }
        const name = `calc_${number}`;
        settings.calculated[name] = { formula: '', label: text('columnSettings.calculated.defaultLabel', { number }) };
        settings.added.push(name);
        settings.field = name;
        // its settings in view, also on a phone: the formula is typed next
        settings.detail = true;
        update();
        dialog.querySelector<HTMLElement>(`#${idOf(ctx, 'calculated-formula')}`)?.focus();
        dialog.querySelector(`#${idOf(ctx, `option-${fields.length}`)}`)?.scrollIntoView({ block: 'nearest' });
    };

    const close = () => closeColumnSettings(ctx);
    // Apply and Apply & close are greyed out while a column has a problem - aria-disabled, not disabled: a
    // disabled button loses the focus and its tooltip
    const blocked = withProblems.size ? 'true' : nothing;

    // the tabs of the column's settings, see ColumnSection. A checkbox and a lookup column have no Display
    // tab: General says they have no format
    const hasDisplay = kind !== 'boolean' && kind !== 'lookup';
    const sections: ColumnSection[] = pending(field)
        ? ['general']
        : [
              'general',
              ...(hasDisplay ? (['display'] as const) : []),
              ...(settings.operators[field] ? (['filter'] as const) : []),
              'colours'
          ];
    const section = sections.includes(settings.section) ? settings.section : 'general';
    /** a setting of the tab has a problem: Apply waits for it, the tab has a mark */
    const sectionProblem: Record<ColumnSection, boolean> = {
        general: isDraftCalculated(field) && calculatedProblem(field) !== null,
        display: formatProblems(format).length > 0 || checkboxProblems(format, kind).length > 0,
        filter: false,
        colours:
            colorRulesHaveProblem(format?.rules, fieldOf) || valueFillProblems(field, format, settings.typedNumbers).length > 0
    };
    const sectionTabId = (each: ColumnSection) => idOf(ctx, `section-${each}`);
    const sectionPanelId = (each: ColumnSection) => idOf(ctx, `section-panel-${each}`);
    /** the tab list, none for one tab */
    const sectionTabs = () =>
        sections.length > 1
            ? tabList(ctx, {
                  tabs: sections.map((each) => ({
                      tab: each,
                      text: `columnSettings.section.${each}` as TextId,
                      problem: sectionProblem[each]
                  })),
                  current: section,
                  show: (each) => {
                      settings.section = each;
                      update();
                  },
                  label: text('columnSettings.sections', { column: labelOf(field) }),
                  tabId: sectionTabId,
                  panelId: sectionPanelId,
                  className: 'column-settings-sections'
              })
            : nothing;
    /**
     * the panel of a tab: every tab's is rendered, the ones not shown hidden - what they hold keeps its
     * state, and a column without the tab has none
     */
    const sectionPanel = (each: ColumnSection, content: TemplateResult | typeof nothing) =>
        sections.includes(each)
            ? html`<div
                  class="column-settings-section"
                  role=${sections.length > 1 ? 'tabpanel' : nothing}
                  id=${sectionPanelId(each)}
                  aria-labelledby=${sections.length > 1 ? sectionTabId(each) : nothing}
                  ?hidden=${each !== section}
              >
                  ${content}
              </div>`
            : nothing;
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
                class=${`filter-editor-body column-settings-body simple-html-dialog-scroller${settings.detail ? ' column-settings-detail' : ''}`}
                role="tabpanel"
                id=${tabPanelId(ctx, 'columns')}
                aria-labelledby=${tabId(ctx, 'columns')}
                ?hidden=${settings.tab !== 'columns'}
            >
                <div class="column-settings-columns">
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
                            @click=${() => {
                                // on a phone: its settings in place of the list
                                settings.detail = true;
                                select(name);
                            }}
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
                <button
                    type="button"
                    class="simple-html-grid-button column-settings-calculated-add"
                    data-tooltip=${text('columnSettings.calculated.add.tooltip')}
                    @click=${addCalculated}
                >
                    ${text('columnSettings.calculated.add')}
                </button>
                </div>
                <div class="column-settings-panel">
                    <button
                        type="button"
                        class="simple-html-grid-button column-settings-back"
                        @click=${() => {
                            settings.detail = false;
                            update();
                            dialog.querySelector<HTMLElement>('.column-settings-list')?.focus();
                        }}
                    >
                        ${text('columnSettings.back')}
                    </button>
                    <div class="column-settings-heading">
                        <span class="column-settings-heading-label">${labelOf(field)}</span>
                        <span class="column-settings-option-type">${typeName(field)}</span>
                    </div>
                    ${sectionTabs()}
                    ${sectionPanel(
                        'general',
                        html`${isDraftCalculated(field) ? calculatedSettings() : labelSettings()}
                        ${pending(field) ? nothing : html`${isDraftCalculated(field) ? nothing : editingSettings()} ${placeholderSettings()}`}
                        ${pending(field) || hasDisplay ? nothing : settingsOf()}`
                    )}
                    ${sectionPanel('display', hasDisplay ? settingsOf() : nothing)}
                    ${sectionPanel('filter', operatorSettings())}
                    ${sectionPanel('colours', colourSettings())}
                    ${pending(field) ? nothing : preview()}
                </div>
            </div>
            ${detailFormTabPanel(
                ctx,
                dialog,
                settings.detailForm,
                settings.tab,
                update,
                (name) => settings.formats[name]?.multiline ?? gridInterface.getDatasource().getField(name).multiline === true
            )}
            ${defaultsTabPanel(ctx, settings.defaults, settings.tab, update)}
            <div class="filter-editor-footer">
                ${settings.tab === 'detailForm' ? detailFormResetButton(ctx, settings.detailForm, update) : nothing}
                ${settings.tab === 'defaults' ? defaultsResetButton(ctx, settings.defaults, update) : nothing}
                <span class="column-settings-resets" ?hidden=${settings.tab !== 'columns'}>
                    <button
                        type="button"
                        class="simple-html-grid-button"
                        data-tooltip=${text('columnSettings.resetColumn.tooltip')}
                        @click=${() => {
                            if (settings.operators[field]) {
                                settings.operators[field] = startOperator(ctx, field);
                                settings.filterOnType[field] = defaultFilterOnType(ctx, field);
                            }
                            if (Object.hasOwn(settings.caseSensitive, field)) {
                                settings.caseSensitive[field] = startCaseSensitive(ctx, field);
                            }
                            // a calculated column the grid starts with: its formula and label too
                            const startColumn = gridInterface.__getStartCalculated()[field];
                            if (startColumn && isDraftCalculated(field)) {
                                settings.calculated[field] = startColumn;
                            }
                            // the numbers typed for its bar, scale and icons: the format's again
                            for (const key of Object.keys(settings.typedNumbers)) {
                                if (key.startsWith(`${field}|`)) {
                                    delete settings.typedNumbers[key];
                                }
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
                            // the calculated columns the grid starts with: one added or removed in the dialog is not
                            settings.calculated = gridInterface.__getStartCalculated();
                            settings.added = [];
                            settings.typedNames = {};
                            settings.typedNumbers = {};
                            for (const name of Object.keys(settings.operators)) {
                                settings.operators[name] = startOperator(ctx, name);
                                settings.filterOnType[name] = defaultFilterOnType(ctx, name);
                            }
                            for (const name of Object.keys(settings.caseSensitive)) {
                                settings.caseSensitive[name] = startCaseSensitive(ctx, name);
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
    } else {
        // grown - a data bar, a colour rule turned on: its buttons stay in the window
        keepDialogInView(dialog);
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

/**
 * true for a column whose header filter has Match case: a text column (a lookup column too) with an
 * operator - the dialog's checkbox
 */
function takesMatchCase(ctx: Grid, field: string): boolean {
    return hasOperator(ctx, field) && headerFilterType(ctx.gridInterface, field) === 'text';
}

/**
 * Match case as the column starts, as startOperator is the column's operator: on for a column that always
 * matches case (`filterCaseSensitive`, a field's `caseSensitive`), else off - Reset column and Reset all
 */
function startCaseSensitive(ctx: Grid, field: string): boolean {
    return isAlwaysCaseSensitive(
        ctx.gridInterface.__getGridConfig().columns[field],
        headerFilterType(ctx.gridInterface, field),
        ctx.gridInterface.getDatasource().getField(field).caseSensitive
    );
}

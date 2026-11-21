/**
 * The English texts, by id. See TEXTS for what the ids are, the texts guide has the full table.
 *
 * Ids: `area.part`, the area first. A menu entry's id is its id in MENU_IDS, its hint is
 * `<id>.hint`. The tooltip of an element is `<id>.tooltip`. An operator's name ends with the
 * FilterOperator: `filterEditor.operator.EQUAL`. `{name}` in a text is filled in when it is shown.
 */
const DEFAULTS = {
    // the row menu, right click on a cell: MENU_IDS.row
    'row.copy': 'Copy:',
    'row.copy.cell': 'Cell Value',
    'row.copy.column': 'Column',
    'row.copy.column.hint': 'selected rows',
    'row.copy.row': 'Row',
    'row.copy.row.hint': 'selected rows',
    'row.copy.selectedColumns': 'Row',
    'row.copy.selectedColumns.hint': 'selected rows/col',
    'row.copy.range': 'Range',
    'row.filter': 'Filter:',
    'row.filter.replace': 'Replace filter',
    'row.filter.replace.hint': 'all',
    'row.filter.add': 'Add to filter',
    'row.filter.add.hint': 'and',
    'row.view': 'View:',
    'row.view.dimRepeatedValues': 'Use dimmed values',
    'row.view.changedOnly': 'Changed rows only',
    'row.paste': 'Paste:',
    'row.paste.cell': 'Paste cell',
    'row.paste.cell.hint': 'selected rows',
    'row.paste.range': 'Paste range',
    'row.clear': 'Clear:',
    'row.clear.cell': 'Clear cell',
    'row.clear.cell.hint': 'selected rows',
    'row.clear.range': 'Clear range',
    'row.delete': 'Delete:',
    'row.delete.rows': 'Rows',
    'row.delete.rows.hint': 'selected rows',
    'row.delete.undo': 'Undo',
    'row.delete.undo.hint': 'selected rows',
    'row.edit': 'Edit:',
    'row.edit.undo': 'Undo last change',
    'row.edit.undo.hint': 'Ctrl+Z',
    'row.edit.redo': 'Redo',
    'row.edit.redo.hint': 'Ctrl+Y',
    'row.edit.revertCell': 'Undo cell edit',
    'row.edit.revertRow': 'Undo row edits',
    'row.edit.revertRows': 'Undo row edits',
    'row.edit.revertRows.hint': 'selected rows',
    'row.summary': 'Summary:',
    'row.summary.count': 'Count: {count}',
    'row.summary.sum': 'Sum: {sum}',
    'row.summary.max': 'Max: {max}',
    'row.summary.min': 'Min: {min}',
    'row.summary.avg': 'Avg: {avg}',
    'row.size': 'Size:',
    'row.size.fitColumn': 'Fit column to this cell',
    'row.size.fitRow': 'Fit row height',
    'row.size.fitRows': 'Fit row height',
    'row.size.fitRows.hint': 'selected rows',
    'row.size.fitAllRows': 'Fit all rows',
    'row.size.resetRow': 'Reset row height',
    'row.size.resetAllRows': 'Reset all row heights',
    'row.export': 'Export:',
    'row.export.excel': 'Excel, all rows',
    'row.export.excelSelected': 'Excel, selected rows',

    // the header menu, right click on a header label: MENU_IDS.header
    'header.column': 'Column:',
    'header.column.pinLeft': 'Pin left',
    'header.column.pinLeftCopy': 'Pin left (copy)',
    'header.column.pinRight': 'Pin right',
    'header.column.pinRightCopy': 'Pin right (copy)',
    'header.column.unpin': 'Unpin',
    'header.column.hide': 'Hide',
    'header.column.removeSorting': 'Remove sorting',
    'header.column.chooser': 'Column chooser',
    'header.size': 'Size:',
    'header.size.column': 'Fit column width',
    'header.size.all': 'Fit all columns',
    'header.size.resetColumn': 'Reset column width',
    'header.size.resetAll': 'Reset all column widths',
    'header.grouping': 'Grouping:',
    'header.grouping.expandAll': 'Expand all',
    'header.grouping.collapseAll': 'Collapse all',
    'header.grouping.clear': 'Clear all',

    // the filter menu, right click on a header filter: MENU_IDS.filter
    'filter.filter': 'Filter:',
    'filter.filter.clear': 'Clear Filter',
    'filter.filter.clearAll': 'Clear All Filters',
    'filter.filter.isBlank': 'Set "Is Blank"',
    'filter.filter.isNotBlank': 'Set "Is Not Blank"',
    'filter.filter.advanced': 'Advanced Filter',
    'filter.operator': 'Set Operator:',
    'filter.operator.greaterThanOrEqualTo': 'Greater than or equal',
    'filter.operator.lessThanOrEqualTo': 'Less than or equal',
    'filter.operator.equal': 'Equal',
    'filter.operator.notEqualTo': 'Not Equal',
    'filter.operator.contains': 'Contains',
    // its value list, the block 'filter.values'
    'filter.values.search': 'Search:',
    'filter.values.searchPlaceholder': 'type to search',
    'filter.values.availableOnly': 'Filter Available',
    'filter.values.rowsFound': '{count} rows found',
    'filter.values.truncated': 'Showing only first {max} !',
    'filter.values.selectAll': 'Select All',
    'filter.values.blank': 'Blank',
    'filter.values.run': 'Run Search',

    // the column chooser, from the header menu
    'columnChooser.title': 'All Fields:',
    'columnChooser.search': 'search',
    'columnChooser.close': 'Close',

    // the filter editor
    'filterEditor.title': 'Filter Editor',
    'filterEditor.title.tooltip': 'Drag to move the dialog',
    'filterEditor.close.tooltip': 'Close without filtering',
    'filterEditor.operatorAnd': 'AND',
    'filterEditor.operatorAnd.tooltip': 'All conditions in this group must match. Click for OR',
    'filterEditor.operatorOr': 'OR',
    'filterEditor.operatorOr.tooltip': 'Any condition in this group may match. Click for AND',
    'filterEditor.wrapGroup.tooltip': 'Wrap everything in this group inside a new parent group',
    'filterEditor.addSubGroup.tooltip': 'Add a sub group inside this group',
    'filterEditor.addCondition.tooltip': 'Add a condition to this group',
    'filterEditor.deleteGroup.tooltip': 'Delete this group and everything in it',
    'filterEditor.clearAll.tooltip': 'Clear all conditions',
    'filterEditor.label.field': 'Query Field:',
    'filterEditor.label.operator': 'Operator:',
    'filterEditor.label.value': 'Filter value:',
    'filterEditor.pickAttribute': 'Click me to select field',
    'filterEditor.pickAttribute.tooltip': 'Pick which column this condition looks at',
    'filterEditor.pickOperator': 'Click me to select Operator',
    'filterEditor.pickOperator.tooltip': 'Pick how the value is compared, for example equal or greater than',
    'filterEditor.pickValueAttribute': 'Click me to select attribute',
    'filterEditor.pickValueAttribute.tooltip': 'Pick which column to compare against',
    'filterEditor.deleteCondition.tooltip': 'Delete this condition',
    'filterEditor.useValue.tooltip': 'Compare against a typed in value instead of another column',
    'filterEditor.useAttribute.tooltip': 'Compare against another column instead of a typed in value',
    'filterEditor.filterAndClose': 'Filter & Close',
    'filterEditor.filterAndClose.tooltip': 'Apply this filter to the grid and close the dialog',
    'filterEditor.filterOnly': 'Filter Only',
    'filterEditor.filterOnly.tooltip': 'Apply this filter to the grid but keep the dialog open, so you can keep adjusting it',
    'filterEditor.closeButton': 'Close',
    'filterEditor.closeButton.tooltip': 'Close the dialog and leave the current filter as it is',
    // the menus it opens: the fields and the operators
    'filterEditor.fieldMenu': 'Available Fields:',
    'filterEditor.fieldMenu.search': 'search',
    'filterEditor.operatorMenu': 'Operator:',
    // the names of the operators, in the operator menu and on a condition
    'filterEditor.operator.EQUAL': 'Equal',
    'filterEditor.operator.LESS_THAN_OR_EQUAL_TO': 'Less Than Or Equal To',
    'filterEditor.operator.GREATER_THAN_OR_EQUAL_TO': 'Greater Than Or Equal To',
    'filterEditor.operator.LESS_THAN': 'Less Than',
    'filterEditor.operator.GREATER_THAN': 'Greater Than',
    'filterEditor.operator.CONTAINS': 'Contains',
    'filterEditor.operator.NOT_EQUAL_TO': 'Not Equal To',
    'filterEditor.operator.DOES_NOT_CONTAIN': 'Does Not Contain',
    'filterEditor.operator.BEGIN_WITH': 'Begin With',
    'filterEditor.operator.END_WITH': 'End With',
    'filterEditor.operator.IN': 'In',
    'filterEditor.operator.NOT_IN': 'Not In',
    'filterEditor.operator.IS_BLANK': 'Is Blank',
    'filterEditor.operator.IS_NOT_BLANK': 'Is Not Blank',

    // the footer: the row count and the filter as chips
    'footer.rowCount': '{shown}/{total}',
    'footer.clear': '✕ Clear',
    'footer.clear.tooltip': 'Clear filter',
    'footer.filter.tooltip': 'Edit filter',
    'footer.collapsed.one': '{count} filter — click to edit',
    'footer.collapsed.other': '{count} filters — click to edit',
    'footer.and': 'AND',
    'footer.or': 'OR',
    'footer.changedOnly': 'Changed rows only',
    'footer.operator.EQUAL': '=',
    'footer.operator.LESS_THAN_OR_EQUAL_TO': '≤',
    'footer.operator.GREATER_THAN_OR_EQUAL_TO': '≥',
    'footer.operator.LESS_THAN': '<',
    'footer.operator.GREATER_THAN': '>',
    'footer.operator.CONTAINS': 'contains',
    'footer.operator.NOT_EQUAL_TO': '≠',
    'footer.operator.DOES_NOT_CONTAIN': 'does not contain',
    'footer.operator.BEGIN_WITH': 'starts with',
    'footer.operator.END_WITH': 'ends with',
    'footer.operator.IN': 'in',
    'footer.operator.NOT_IN': 'not in',
    'footer.operator.IS_BLANK': 'is blank',
    'footer.operator.IS_NOT_BLANK': 'is not blank',

    // the aggregates of the columns (ColumnConfig.aggregate): the label in front of the value in a group
    // row and in the totals row, and the label of the totals row
    'aggregate.sum': 'Sum',
    'aggregate.avg': 'Avg',
    'aggregate.min': 'Min',
    'aggregate.max': 'Max',
    'aggregate.count': 'Count',
    'aggregate.total': 'Total',

    // the placeholder of an empty header filter, by the field's type - a date filter shows its
    // formatter's format (YYYY-MM-DD), a boolean filter is a checkbox
    'filter.placeholder.text': 'Text',
    'filter.placeholder.number': 'Number',

    // labels for screen readers (aria-label)
    'grid.label': 'Grid',
    'grid.rowSelector': 'row selector',
    'grid.filter': 'Filter {label}',
    'grid.groupToggle': '{name} ({total})',
    'grid.removeGroup': 'Remove the grouping on {title}',

    // the row number of a row: its state (GridConfig.rowStatus), as a tooltip and for a screen reader
    'rowStatus.new': 'New row',
    'rowStatus.edited': 'Edited',
    'rowStatus.deleted': 'Marked for deletion',
    'rowStatus.error': 'Error: {errors}',

    // the marker of an edited cell (GridConfig.editedMarker): its tooltip
    'cell.editedMarker.tooltip': 'Original value: {value}',
    'cell.editedMarker.blank': '(blank)',
    'cell.editedMarker.revert': 'Click to revert',
    // a cell of several lines (FieldConfig.multiline, or a value with a line break): the marker that
    // there is more, for a screen reader, the last line of its tooltip when it has more lines than it
    // shows (GridConfig.multilineTooltipLines), and the hint of the editor over the cell
    'cell.multiline.more': 'More lines, Enter shows all',
    'cell.multiline.moreLines': '… {count} more lines',
    'cell.multiline.hint': 'Ctrl+Enter to save, Esc to cancel',
    'cell.multiline.hintReadonly': 'Esc to close',

    // the date picker: of date cells and date header filters, and a DateInterface of your own
    'datePicker.hours': 'HH',
    'datePicker.minutes': 'MM',
    'datePicker.week': 'W',
    'datePicker.clear': 'Clear',
    'datePicker.now': 'Now',
    'datePicker.use': 'Use',
    // the buttons beside the month and year: their name for a screen reader, and their tooltip
    'datePicker.previousYear': 'Previous year',
    'datePicker.previousMonth': 'Previous month',
    'datePicker.nextMonth': 'Next month',
    'datePicker.nextYear': 'Next year',
    'datePicker.month.january': 'January',
    'datePicker.month.february': 'February',
    'datePicker.month.march': 'March',
    'datePicker.month.april': 'April',
    'datePicker.month.may': 'May',
    'datePicker.month.june': 'June',
    'datePicker.month.july': 'July',
    'datePicker.month.august': 'August',
    'datePicker.month.september': 'September',
    'datePicker.month.october': 'October',
    'datePicker.month.november': 'November',
    'datePicker.month.december': 'December',
    'datePicker.day.sunday': 'Su',
    'datePicker.day.monday': 'Mo',
    'datePicker.day.tuesday': 'Tu',
    'datePicker.day.wednesday': 'We',
    'datePicker.day.thursday': 'Th',
    'datePicker.day.friday': 'Fr',
    'datePicker.day.saturday': 'Sa',

    // made by the datasource, which has no grid: setTexts() only, GridConfig.texts does not change them
    // the messages of the built-in validators
    'validation.required': 'Required',
    'validation.min': 'Must be at least {value}',
    'validation.max': 'Must be at most {value}',
    'validation.minLength': 'Must be at least {value} characters',
    'validation.maxLength': 'Must be at most {value} characters',
    'validation.pattern': 'Not in the expected format',
    // getFilterString(), which upper cases the whole string
    'filterString.and': 'AND',
    'filterString.or': 'OR',
    'filterString.operator.EQUAL': 'equal_to',
    'filterString.operator.LESS_THAN_OR_EQUAL_TO': 'less_or_equal',
    'filterString.operator.GREATER_THAN_OR_EQUAL_TO': 'greater_than_or_equal',
    'filterString.operator.LESS_THAN': 'less_than',
    'filterString.operator.GREATER_THAN': 'greater_than',
    'filterString.operator.CONTAINS': 'contains',
    'filterString.operator.NOT_EQUAL_TO': 'not_equal_to',
    'filterString.operator.DOES_NOT_CONTAIN': 'does_not_contain',
    'filterString.operator.BEGIN_WITH': 'start_with',
    'filterString.operator.END_WITH': 'end_with',
    'filterString.operator.IN': 'IN',
    'filterString.operator.NOT_IN': 'NOT_IN',
    'filterString.operator.IS_BLANK': 'IS_BLANK',
    'filterString.operator.IS_NOT_BLANK': 'IS_NOT_BLANK',
    // the value of the group of blank values in a group row's name
    'grouping.blank': 'blank'
} satisfies Record<string, string>;

/**
 * The id of a text of the grid or the datasource: a key of {@link TEXTS}, e.g. `'row.copy'`.
 *
 * @useDeclaredType
 * @example
 * ```ts
 * import type { TextId } from '@simple-html/grid';
 *
 * const id: TextId = 'filterEditor.title';
 * ```
 */
export type TextId = keyof typeof DEFAULTS;

/**
 * Texts by id, for {@link setTexts} and `GridConfig.texts`: plain JSON, a text for each id to
 * change. An id left out shows the text it had: the one set with `setTexts()`, else the default in
 * {@link TEXTS}.
 *
 * The ids of {@link TEXTS} are suggested by the editor. An id of your own is allowed too: a validator
 * (or a rule's `message`) can give an id, and its text is looked up the same way - see
 * {@link registerValidator}.
 *
 * `{name}` in a text is filled in when it is shown: `'Count: {count}'`. Keep the names of the
 * default text, a name the text does not use is not shown.
 *
 * @sample translation
 * @example
 * ```ts
 * import type { Texts } from '@simple-html/grid';
 *
 * const norwegian: Texts = {
 *     'row.copy': 'Kopier:',
 *     'row.summary.count': 'Antall: {count}',
 *     'validation.required': 'Må fylles ut',
 *     'validation.phoneNO': 'Må være 8 siffer' // an id of your own, returned by a validator
 * };
 * ```
 */
export type Texts = { [id in TextId]?: string } & { [id: string]: string };

/**
 * Every text the grid and the datasource show, by id: the English defaults. Change them with
 * {@link setTexts} (for the page) and `GridConfig.texts` (for one grid); this object stays as it is.
 *
 * The ids are grouped by area, the area first:
 *
 * | ids | where |
 * | --- | --- |
 * | `row.*`, `header.*`, `filter.*` | the right click menus: the ids of {@link MENU_IDS}. A hint (the text in parentheses) is `<id>.hint`. `filter.values.*`: the value list of the filter menu |
 * | `columnChooser.*` | the column chooser |
 * | `filterEditor.*` | the filter editor, its field and operator menus. `filterEditor.operator.<FilterOperator>`: the names of the operators |
 * | `footer.*` | the footer: the row count, the filter chips. `footer.operator.<FilterOperator>`: the short names of the operators (`=`, `contains`) |
 * | `aggregate.*` | the aggregates of the columns: the label in front of a value in the group rows and the totals row (`aggregate.<AggregateFunction>`), and the label of the totals row |
 * | `grid.*` | labels for screen readers |
 * | `rowStatus.*` | the state of a row on its row number: the tooltip, and the text for a screen reader |
 * | `cell.*` | the cells: the marker of an edited cell, a cell of several lines and its editor |
 * | `datePicker.*` | the date picker: the buttons, the names of the months and the days |
 * | `validation.*` | the messages of the built-in validators. Made by the datasource |
 * | `filterString.*` | `datasource.getFilterString()`: AND, OR and the operators. Made by the datasource |
 * | `grouping.blank` | the value in the name of the group of blank values. Made by the datasource |
 *
 * The tooltip of an element is `<id>.tooltip`: `filterEditor.addCondition.tooltip`. `{name}` in a text
 * is filled in when it is shown (`'Count: {count}'`).
 *
 * The texts guide has every id with its text and where it is shown.
 *
 * @sample translation
 * @example
 * ```ts
 * import { setTexts, TEXTS } from '@simple-html/grid';
 *
 * TEXTS['row.summary.count']; // 'Count: {count}'
 *
 * // every id with its English text, e.g. to hand to a translator
 * const english: string = JSON.stringify(TEXTS, null, 2);
 * console.log(english);
 *
 * setTexts({ 'row.summary.count': 'Antall: {count}' });
 * ```
 */
export const TEXTS: Readonly<Record<TextId, string>> = Object.freeze(DEFAULTS);

/**
 * TEXTS, looked up by any id: a validator's message can be an id of its own
 */
const DEFAULTS_BY_ID: Readonly<Record<string, string>> = TEXTS;

/**
 * the texts set with setTexts(), a copy
 */
let pageTexts: Texts = {};

/**
 * Sets the texts of the page: every grid and datasource uses them. An app with one language calls
 * it once, before it makes its grids. A text for one grid only is `GridConfig.texts`, which wins over
 * these.
 *
 * - **It replaces the texts set before**: an id left out shows its default again, `setTexts({})` goes
 *   back to the defaults (English). The object is copied.
 * - **Nothing is rendered again**: a grid shows the new texts after its next rebuild
 *   (`gridInterface.rebuild()`), a menu, the filter editor and the date picker the next time they
 *   open. `getFilterString()` uses them from its next call. A validation message is made when a value
 *   is validated: an error already shown keeps its text until the field is validated again. The name
 *   of the group of blank values changes the next time the rows are grouped.
 * - The texts of the datasource - `validation.*`, `filterString.*`, `grouping.blank` - are set here
 *   only: the datasource has no grid, `GridConfig.texts` does not change them.
 *
 * @param texts a text for each id to change, see {@link TEXTS} for the ids. Plain JSON, it can come
 * from a backend
 * @throws a `TypeError` when `texts` is not an object, or a text is not a string
 *
 * @sample translation
 * @example
 * ```ts
 * import { createGrid, type GridConfig, setTexts } from '@simple-html/grid';
 *
 * declare const config: GridConfig;
 *
 * // once, before the grids are made
 * setTexts({
 *     'row.copy': 'Kopier:',
 *     'row.summary.count': 'Antall: {count}',
 *     'validation.required': 'Må fylles ut'
 * });
 * const gridInterface = createGrid(host, { config, datasource });
 *
 * // later: back to English
 * setTexts({});
 * gridInterface.rebuild();
 * ```
 */
export function setTexts(texts: Texts): void {
    assertTexts(texts, 'setTexts()');
    pageTexts = { ...texts };
}

/**
 * @internal
 * Throws when `texts` is not an object of strings - plain js and JSON can give anything, say so now
 * and not as a missing text later
 * @param where who was given them, for the message: 'setTexts()', 'GridConfig.texts'
 */
export function assertTexts(texts: unknown, where: string): void {
    if (typeof texts !== 'object' || texts === null || Array.isArray(texts)) {
        throw new TypeError(
            `${where} takes an object of texts by id, e.g. { 'row.copy': 'Kopier:' }, got ${JSON.stringify(texts)}`
        );
    }
    for (const [id, text] of Object.entries(texts)) {
        if (typeof text !== 'string') {
            throw new TypeError(`${where}: the text of '${id}' must be a string, got ${JSON.stringify(text)}`);
        }
    }
}

/**
 * @internal
 * The text of an id: from `overrides` (a grid's texts), else from setTexts(), else the default.
 * undefined when none of them has the id - an id of a validator's own that no one gave a text
 */
export function findText(id: string, overrides?: Texts): string | undefined {
    if (overrides && Object.hasOwn(overrides, id)) {
        return overrides[id];
    }
    if (Object.hasOwn(pageTexts, id)) {
        return pageTexts[id];
    }
    return Object.hasOwn(DEFAULTS_BY_ID, id) ? DEFAULTS_BY_ID[id] : undefined;
}

/**
 * @internal
 * The text of an id, with `{name}` filled in from `values`
 * @param overrides the texts that win over the page's: a grid's `GridConfig.texts`
 */
export function getText(id: TextId, overrides?: Texts, values?: Readonly<Record<string, unknown>>): string {
    // every TextId has a default, the ?? is for the type
    const text = findText(id, overrides) ?? id;
    return values ? fillText(text, values) : text;
}

/**
 * @internal
 * Replaces `{name}` in a text with `values[name]` as text. A name `values` does not have is left as
 * it is: `'{max}'` stays `'{max}'`
 */
export function fillText(text: string, values: Readonly<Record<string, unknown>>): string {
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : match));
}

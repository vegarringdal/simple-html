/**
 * The English texts, by id. See TEXTS for what the ids are, the texts guide has the full table.
 *
 * Ids: `area.part`, the area first. A menu entry's id is its id in MENU_IDS, its hint is
 * `<id>.hint`. The tooltip of an element is `<id>.tooltip`. An operator's name ends with the
 * FilterOperator: `filterEditor.operator.EQUAL`. `{name}` in a text is filled in when it is shown. A text
 * that names a key has the text shown on a Mac, `<id>.mac` (`⌘Z`).
 */
const DEFAULTS = {
    // the row menu, right click on a cell: MENU_IDS.row. A submenu's text is its label, without a colon
    'row.copy': 'Copy',
    'row.copy.cell': 'Cell Value',
    'row.copy.column': 'Column',
    'row.copy.column.hint': 'selected rows',
    'row.copy.row': 'Row',
    'row.copy.row.hint': 'selected rows',
    'row.copy.selectedColumns': 'Row',
    'row.copy.selectedColumns.hint': 'selected rows/col',
    'row.copy.range': 'Range',
    'row.filter': 'Filter',
    'row.filter.replace': 'Replace filter',
    'row.filter.replace.hint': 'all',
    'row.filter.add': 'Add to filter',
    'row.filter.add.hint': 'and',
    'row.view': 'View',
    'row.view.dimRepeatedValues': 'Use dimmed values',
    'row.view.changedOnly': 'Changed rows only',
    'row.paste': 'Paste',
    'row.paste.current': 'Paste cell',
    'row.paste.cell': 'Paste cell',
    'row.paste.cell.hint': 'selected rows',
    'row.paste.range': 'Paste range',
    'row.clear': 'Clear',
    'row.clear.current': 'Clear cell',
    'row.clear.cell': 'Clear cell',
    'row.clear.cell.hint': 'selected rows',
    'row.clear.range': 'Clear range',
    'row.delete': 'Delete',
    'row.delete.row': 'Row',
    'row.delete.rows': 'Rows',
    'row.delete.rows.hint': 'selected rows',
    'row.delete.undo': 'Undo',
    'row.delete.undo.hint': 'selected rows',
    // the Undo submenu of the row menu, in an editable grid. A text that names a key has a text for a
    // Mac, `<id>.mac`: its keys as a Mac shows them
    'row.edit': 'Undo / Redo',
    'row.edit.undo': 'Undo last change',
    'row.edit.undo.hint': 'Ctrl+Z',
    'row.edit.undo.hint.mac': '⌘Z',
    'row.edit.redo': 'Redo',
    'row.edit.redo.hint': 'Ctrl+Y',
    'row.edit.redo.hint.mac': '⇧⌘Z',
    'row.edit.revertCell': 'Undo cell edit',
    'row.edit.revertRow': 'Undo row edits',
    'row.edit.revertRows': 'Undo row edits',
    'row.edit.revertRows.hint': 'selected rows',
    'row.size': 'Size',
    'row.size.fitColumn': 'Fit column to this cell',
    'row.size.fitRow': 'Fit row height',
    'row.size.fitRows': 'Fit row height',
    'row.size.fitRows.hint': 'selected rows',
    'row.size.fitAllRows': 'Fit all rows',
    'row.size.resetRow': 'Reset row height',
    'row.size.resetAllRows': 'Reset all row heights',
    'row.export': 'Export',
    'row.export.excel': 'Excel, all rows',
    'row.export.excelSelected': 'Excel, selected rows',
    // Select ›: what Shift and Ctrl do with the mouse, for a finger
    'row.select': 'Select',
    'row.select.row': 'This row',
    'row.select.rowsTo': 'Rows from {row} to here',
    'row.select.allRows': 'All rows',
    'row.select.rangeTo': 'Range from the active cell to here',
    'row.select.addCell': 'Add this cell to the ranges',
    'row.select.clear': 'Clear selection',

    // the header menu, right click on a header label: MENU_IDS.header
    'header.column.pin': 'Pin',
    'header.column.pinLeft': 'Pin left',
    'header.column.pinLeftCopy': 'Pin left (copy)',
    'header.column.pinRight': 'Pin right',
    'header.column.pinRightCopy': 'Pin right (copy)',
    'header.column.unpin': 'Unpin',
    'header.column.hide': 'Hide column',
    'header.column.removeSorting': 'Remove sorting',
    'header.column.chooser': 'Column chooser…',
    'header.size': 'Size',
    'header.size.column': 'Fit column width',
    'header.size.all': 'Fit all columns',
    'header.size.resetColumn': 'Reset column width',
    'header.size.resetAll': 'Reset all column widths',
    'header.aggregate': 'Aggregate',
    'header.aggregate.sum': 'Sum',
    'header.aggregate.avg': 'Average',
    'header.aggregate.min': 'Min',
    'header.aggregate.max': 'Max',
    'header.aggregate.count': 'Count',
    'header.aggregate.totalsRow': 'Totals row',
    'header.grouping': 'Grouping',
    'header.grouping.expandAll': 'Expand all',
    'header.grouping.collapseAll': 'Collapse all',
    'header.grouping.clear': 'Clear all',

    // the filter menu, right click on a header filter: MENU_IDS.filter. Its submenu Filter, then the value list
    'filter.filter': 'Filter',
    'filter.filter.clear': 'Clear Filter',
    'filter.filter.clearAll': 'Clear All Filters',
    'filter.filter.blank': 'Blank',
    'filter.filter.isBlank': 'Is blank',
    'filter.filter.isNotBlank': 'Is not blank',
    'filter.filter.advanced': 'Advanced Filter…',
    'filter.operator': 'Operator',
    'filter.operator.equal': 'Equal',
    'filter.operator.notEqualTo': 'Not Equal',
    'filter.operator.lessThan': 'Less than',
    'filter.operator.lessThanOrEqualTo': 'Less than or equal',
    'filter.operator.greaterThan': 'Greater than',
    'filter.operator.greaterThanOrEqualTo': 'Greater than or equal',
    'filter.operator.between': 'Between',
    'filter.operator.contains': 'Contains',
    'filter.operator.doesNotContain': 'Does not contain',
    'filter.operator.beginWith': 'Begins with',
    'filter.operator.endWith': 'Ends with',
    // the toggle of a text column, in Filter. The hint when the column always matches case
    'filter.matchCase': 'Match case',
    'filter.matchCase.hint': 'always',
    // its value list, the block 'filter.values'
    'filter.values.search': 'Search values',
    'filter.values.searchPlaceholder': 'Search values',
    'filter.values.availableOnly': 'Only values in filtered rows',
    'filter.values.rowsFound': '{count} values',
    'filter.values.rowsFound.one': '{count} value',
    'filter.values.truncated': 'Only the first {max} values are shown',
    'filter.values.selectAll': 'Select all',
    'filter.values.blank': 'Blank',
    'filter.values.run': 'Apply',
    'filter.values.cancel': 'Cancel',
    // the range block of a number or date column, 'filter.range': the input (From and To for Between) and
    // its buttons. Its operators are named by the texts of Operator above, Between shows its text
    'filter.range.value': 'Value',
    'filter.range.from': 'From',
    'filter.range.to': 'To',
    'filter.range.run': 'Apply',
    'filter.range.cancel': 'Cancel',

    // the column menu, right click on a column number (under the header filters): MENU_IDS.column
    'column.copy.column': 'Copy column',
    'column.copy.column.hint': 'all rows',
    'column.copy.selectedColumns': 'Copy selected columns',
    'column.copy.selectedColumns.hint': 'all rows',
    'column.copy.headers': 'Copy header names',
    'column.copy.header': 'Copy header name',
    'column.copy.selectedHeaders': 'Copy selected header names',
    'column.select': 'Select',
    'column.select.column': 'This column',
    'column.select.columnsTo': 'Columns from {column} to here',
    'column.select.all': 'All columns',
    'column.select.clear': 'Clear column selection',

    // the column chooser, from the header menu
    'columnChooser.title': 'All Fields:',
    'columnChooser.search': 'search',
    'columnChooser.close': 'Close',

    // the filter editor
    'filterEditor.title': 'Filter Editor',
    'filterEditor.title.tooltip': 'Drag to move the dialog',
    'filterEditor.close.tooltip': 'Close without filtering',
    'filterEditor.operatorAnd': 'AND',
    'filterEditor.operatorAnd.tooltip': 'All conditions in this group must match',
    'filterEditor.operatorOr': 'OR',
    'filterEditor.operatorOr.tooltip': 'Any condition in this group may match',
    'filterEditor.wrapGroup.tooltip': 'Wrap everything in this group inside a new parent group',
    'filterEditor.addSubGroup': '+ Group',
    'filterEditor.addSubGroup.tooltip': 'Add a sub group inside this group',
    'filterEditor.addCondition': '+ Condition',
    'filterEditor.addCondition.tooltip': 'Add a condition to this group',
    'filterEditor.deleteGroup.tooltip': 'Delete this group and everything in it',
    'filterEditor.clearAll.tooltip': 'Clear all conditions',
    'filterEditor.empty': 'No conditions: every row is shown',
    'filterEditor.label.field': 'Field',
    'filterEditor.label.operator': 'Operator',
    'filterEditor.label.value': 'Value',
    'filterEditor.label.from': 'From',
    'filterEditor.label.to': 'To',
    'filterEditor.pickAttribute': 'Field',
    'filterEditor.pickAttribute.tooltip': 'Pick which column this condition looks at',
    'filterEditor.pickOperator': 'Operator',
    'filterEditor.pickOperator.tooltip': 'Pick how the value is compared, for example equal or greater than',
    'filterEditor.pickValueAttribute': 'Column',
    'filterEditor.pickValueAttribute.tooltip': 'Pick which column to compare against',
    'filterEditor.deleteCondition.tooltip': 'Delete this condition',
    'filterEditor.useValue.tooltip': 'Compare against a typed in value instead of another column',
    'filterEditor.useAttribute.tooltip': 'Compare against another column instead of a typed in value',
    // the toggle of a text condition: its text, its tooltip (its name too), the tooltip when the column always matches case
    'filterEditor.matchCase': 'Aa',
    'filterEditor.matchCase.tooltip': 'Match case',
    'filterEditor.matchCaseAlways.tooltip': 'Match case: always, for this column',
    'filterEditor.undo': 'Undo',
    'filterEditor.undo.tooltip': 'Undo (Ctrl+Z)',
    'filterEditor.undo.tooltip.mac': 'Undo (⌘Z)',
    'filterEditor.redo': 'Redo',
    'filterEditor.redo.tooltip': 'Redo (Ctrl+Y)',
    'filterEditor.redo.tooltip.mac': 'Redo (⇧⌘Z)',
    'filterEditor.filterAndClose': 'Apply & close',
    'filterEditor.filterAndClose.tooltip': 'Apply this filter to the grid and close the dialog',
    'filterEditor.filterOnly': 'Apply',
    'filterEditor.filterOnly.tooltip': 'Apply this filter to the grid but keep the dialog open, so you can keep adjusting it',
    'filterEditor.closeButton': 'Cancel',
    'filterEditor.closeButton.tooltip': 'Close the dialog and leave the current filter as it is',
    // the menus it opens: the fields and the operators
    'filterEditor.fieldMenu': 'Available Fields:',
    'filterEditor.fieldMenu.search': 'Search fields',
    'filterEditor.operatorMenu': 'Operator:',
    // the names of the operators, in the operator menu and on a condition
    'filterEditor.operator.EQUAL': 'Equal',
    'filterEditor.operator.LESS_THAN_OR_EQUAL_TO': 'Less Than Or Equal To',
    'filterEditor.operator.GREATER_THAN_OR_EQUAL_TO': 'Greater Than Or Equal To',
    'filterEditor.operator.LESS_THAN': 'Less Than',
    'filterEditor.operator.GREATER_THAN': 'Greater Than',
    'filterEditor.operator.BETWEEN': 'Between',
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
    // the button in Clear's place while the rows are not filtered: it opens the filter editor
    'footer.noFilter': 'No filter',
    'footer.noFilter.tooltip': 'Open the filter editor',
    'footer.filter.tooltip': 'Edit filter',
    'footer.collapsed.one': '{count} filter — click to edit',
    'footer.collapsed.other': '{count} filters — click to edit',
    'footer.and': 'AND',
    'footer.or': 'OR',
    'footer.changedOnly': 'Changed rows only',
    // between the ends of a BETWEEN on a chip, and the marker of a condition that matches case
    'footer.betweenAnd': 'and',
    'footer.matchCase': 'Aa',
    'footer.matchCase.tooltip': 'Match case',
    // Find's "Filter rows" while it hides rows: the text the rows are filtered with
    'footer.findFilter': 'Find: {text}',
    // the summary of the selected cells, at the footer's right (ranges of more than one cell): its name
    // for a screen reader, the cells with a value, and of the numbers the sum, average, smallest, largest
    'footer.summary': 'Selected cells',
    'footer.summary.count': 'Count: {count}',
    'footer.summary.sum': 'Sum: {sum}',
    'footer.summary.avg': 'Average: {avg}',
    'footer.summary.min': 'Min: {min}',
    'footer.summary.max': 'Max: {max}',
    'footer.operator.EQUAL': '=',
    'footer.operator.LESS_THAN_OR_EQUAL_TO': '≤',
    'footer.operator.GREATER_THAN_OR_EQUAL_TO': '≥',
    'footer.operator.LESS_THAN': '<',
    'footer.operator.GREATER_THAN': '>',
    'footer.operator.BETWEEN': 'between',
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
    // a header filter with BETWEEN: the two ends are typed with .. between them
    'filter.placeholder.between': 'from..to',
    // the operator indicator of a header filter (GridConfig.filterOperatorIndicator): its name for a
    // screen reader, its tooltip - {operator} is the operator as Operator › names it - and the symbol of
    // each operator
    'filter.indicator': 'Operator: {operator}',
    'filter.indicator.tooltip': 'Operator: {operator} (F4)',
    'filter.indicator.EQUAL': '=',
    'filter.indicator.NOT_EQUAL_TO': '≠',
    'filter.indicator.LESS_THAN': '<',
    'filter.indicator.LESS_THAN_OR_EQUAL_TO': '≤',
    'filter.indicator.GREATER_THAN': '>',
    'filter.indicator.GREATER_THAN_OR_EQUAL_TO': '≥',
    'filter.indicator.BETWEEN': 'a..b',
    'filter.indicator.CONTAINS': '*a*',
    'filter.indicator.DOES_NOT_CONTAIN': '!*a*',
    'filter.indicator.BEGIN_WITH': 'a*',
    'filter.indicator.END_WITH': '*a',

    // labels for screen readers (aria-label)
    'grid.label': 'Grid',
    'grid.rowSelector': 'row selector',
    'grid.filter': 'Filter {label}',
    'grid.groupToggle': '{name} ({total})',
    'grid.removeGroup': 'Remove the grouping on {title}',

    // Find (Ctrl+F in the grid): the find bar - its name for a screen reader, the input, the count of the
    // matches and the buttons, with their tooltips. "Filter rows" is a toggle: only the rows with a match
    'find.label': 'Find in the grid',
    'find.placeholder': 'Find',
    'find.count': '{current} of {count}',
    'find.none': 'No matches',
    'find.filterRows': 'Filter rows',
    'find.filterRows.tooltip': 'Show only the rows with a match',
    'find.previous': 'Previous match',
    'find.previous.tooltip': 'Previous match (Shift+Enter)',
    'find.previous.tooltip.mac': 'Previous match (⇧Enter)',
    'find.next': 'Next match',
    'find.next.tooltip': 'Next match (Enter)',
    'find.close': 'Close',
    'find.close.tooltip': 'Close (Esc)',

    // the row number of a row: its state (GridConfig.rowStatus), as a tooltip and for a screen reader
    'rowStatus.new': 'New row',
    'rowStatus.edited': 'Edited',
    'rowStatus.deleted': 'Marked for deletion',
    'rowStatus.error': 'Error: {errors}',
    // a row in conflict (datasource.getConflicts()): the fields the server changed too, as column labels
    // joined with ', '; a row the server removed that has changes here
    'rowStatus.conflict': 'Changed on the server too: {fields}',
    'rowStatus.removedOnServer': 'Removed on the server, it has changes here',

    // the marker of an edited cell (GridConfig.editedMarker): its tooltip
    'cell.editedMarker.tooltip': 'Original value: {value}',
    'cell.editedMarker.blank': '(blank)',
    'cell.editedMarker.revert': 'Click to revert',
    // the marker of a field in conflict: the server's value, and what a click on it does
    'cell.conflictMarker.tooltip': 'Changed on the server to {value} while you edited it',
    'cell.conflictMarker.take': "Click to take the server's value",
    // a cell of several lines (FieldConfig.multiline, or a value with a line break): the marker that
    // there is more, for a screen reader, the last line of its tooltip when it has more lines than it
    // shows (GridConfig.multilineTooltipLines), and the hint of the editor over the cell
    'cell.multiline.more': 'More lines, Enter shows all',
    'cell.multiline.moreLines': '… {count} more lines',
    'cell.multiline.hint': 'Ctrl+Enter to save, Esc to cancel',
    'cell.multiline.hint.mac': '⌘Enter to save, Esc to cancel',
    'cell.multiline.hintReadonly': 'Esc to close',
    // a lookup column (ColumnConfig.editor): the button of the cell, for a screen reader, and the select
    // under the cell - the placeholder of its search, no match, a long list cut off
    'lookup.open': 'Open the list',
    'lookup.search': 'Search',
    'lookup.noMatch': 'No matches',
    'lookup.more': '{shown} of {count} shown, type to search',
    // the hint of the editor of one line over a custom cell (ColumnConfig.renderer)
    'cell.editor.hint': 'Enter to save, Esc to cancel',

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
    'filterString.operator.BETWEEN': 'between',
    'filterString.operator.CONTAINS': 'contains',
    'filterString.operator.NOT_EQUAL_TO': 'not_equal_to',
    'filterString.operator.DOES_NOT_CONTAIN': 'does_not_contain',
    'filterString.operator.BEGIN_WITH': 'start_with',
    'filterString.operator.END_WITH': 'end_with',
    'filterString.operator.IN': 'IN',
    'filterString.operator.NOT_IN': 'NOT_IN',
    'filterString.operator.IS_BLANK': 'IS_BLANK',
    'filterString.operator.IS_NOT_BLANK': 'IS_NOT_BLANK',
    // between the ends of a BETWEEN, and after a condition that matches case
    'filterString.betweenAnd': 'and',
    'filterString.matchCase': 'match_case',
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
 *     'row.copy': 'Kopier',
 *     'footer.summary.count': 'Antall: {count}',
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
 * | `row.*`, `header.*`, `filter.*`, `column.*` | the right click menus: the ids of {@link MENU_IDS}. A hint (the text in parentheses) is `<id>.hint`. `filter.values.*`: the value list of the filter menu, `filter.range.*` its range block |
 * | `columnChooser.*` | the column chooser |
 * | `filterEditor.*` | the filter editor, its field and operator menus. `filterEditor.operator.<FilterOperator>`: the names of the operators |
 * | `footer.*` | the footer: the row count, the filter chips, the "No filter" button. `footer.operator.<FilterOperator>`: the short names of the operators (`=`, `contains`) |
 * | `aggregate.*` | the aggregates of the columns: the label in front of a value in the group rows and the totals row (`aggregate.<AggregateFunction>`), and the label of the totals row |
 * | `grid.*` | labels for screen readers |
 * | `find.*` | the find bar of Ctrl+F: the input, the count of the matches, "Filter rows", the buttons |
 * | `rowStatus.*` | the state of a row on its row number: the tooltip, and the text for a screen reader |
 * | `cell.*` | the cells: the marker of an edited cell, a cell of several lines and its editor |
 * | `lookup.*` | a lookup column (`ColumnConfig.editor`): the button of the cell, the select under it |
 * | `datePicker.*` | the date picker: the buttons, the names of the months and the days |
 * | `validation.*` | the messages of the built-in validators. Made by the datasource |
 * | `filterString.*` | `datasource.getFilterString()`: AND, OR and the operators. Made by the datasource |
 * | `grouping.blank` | the value in the name of the group of blank values. Made by the datasource |
 *
 * The tooltip of an element is `<id>.tooltip`: `filterEditor.addCondition.tooltip`. `{name}` in a text
 * is filled in when it is shown (`'Count: {count}'`). A text that names a key - `row.edit.undo.hint`,
 * `Ctrl+Z` - has a text of its own for a Mac, `<id>.mac` (`⌘Z`): the grid shows that one on a Mac.
 *
 * The texts guide has every id with its text and where it is shown.
 *
 * @sample translation
 * @example
 * ```ts
 * import { setTexts, TEXTS } from '@simple-html/grid';
 *
 * TEXTS['footer.summary.count']; // 'Count: {count}'
 *
 * // every id with its English text, e.g. to hand to a translator
 * const english: string = JSON.stringify(TEXTS, null, 2);
 * console.log(english);
 *
 * setTexts({ 'footer.summary.count': 'Antall: {count}' });
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
 *     'row.copy': 'Kopier',
 *     'footer.summary.count': 'Antall: {count}',
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
            `${where} takes an object of texts by id, e.g. { 'row.copy': 'Kopier' }, got ${JSON.stringify(texts)}`
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

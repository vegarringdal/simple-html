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
    'row.paste.fillDown': 'Fill down',
    'row.paste.fillDown.hint': 'Ctrl+D',
    'row.paste.fillDown.hint.mac': '⌘D',
    'row.paste.newRows': 'As new rows…',
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
    // Format ›: how the column's cells show the value (ColumnConfig.format) - the date formats in a date
    // or datetime column, the number formats in a number column. The hints are examples made from today
    // and from 1234567.891, not texts
    'header.format': 'Format',
    'header.format.default': 'Default',
    'header.format.date.iso': 'ISO',
    'header.format.date.norwegian': 'Norwegian',
    'header.format.date.norwegianShort': 'Norwegian, short year',
    'header.format.date.us': 'US',
    'header.format.date.uk': 'UK',
    'header.format.date.medium': 'Short month name',
    'header.format.date.long': 'Month name',
    'header.format.date.full': 'Day and month name',
    'header.format.date.isoTime': 'ISO with time',
    'header.format.date.isoSeconds': 'ISO with seconds',
    'header.format.date.norwegianTime': 'Norwegian with time',
    'header.format.date.norwegianSeconds': 'Norwegian with seconds',
    'header.format.date.time': 'Time',
    'header.format.date.timeSeconds': 'Time with seconds',
    'header.format.date.weekday': 'Day of week',
    'header.format.date.weekIso': 'Week, ISO',
    'header.format.date.weekUs': 'Week, US',
    'header.format.date.month': 'Month',
    'header.format.date.quarter': 'Quarter',
    'header.format.date.year': 'Year',
    'header.format.date.daysUntil': 'Days until',
    'header.format.number.norwegian': 'Norwegian',
    'header.format.number.english': 'English',
    'header.format.number.swiss': 'Swiss',
    'header.format.number.plain': 'Plain',
    'header.format.decimals': 'Decimals',
    'header.format.decimals.asIs': 'As is',
    'header.format.decimals.0': '0',
    'header.format.decimals.1': '1',
    'header.format.decimals.2': '2',
    'header.format.decimals.3': '3',
    'header.format.decimals.4': '4',
    'header.format.thousands': 'Thousands separator',
    'header.format.thousands.none': 'None',
    'header.format.thousands.space': 'Space',
    'header.format.thousands.comma': 'Comma',
    'header.format.thousands.dot': 'Dot',
    'header.format.thousands.apostrophe': 'Apostrophe',
    'header.format.decimalMark': 'Decimal mark',
    'header.format.decimalMark.dot': 'Dot',
    'header.format.decimalMark.comma': 'Comma',
    'header.format.percent': 'Percent',
    'header.settings': 'Column settings…',
    // the keyboard shortcuts help, its hint the key that opens it anywhere in the grid
    'header.shortcuts': 'Keyboard shortcuts…',
    'header.shortcuts.hint': 'Ctrl+/',
    'header.shortcuts.hint.mac': '⌘/',
    'header.import': 'Import rows…',
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
    // the toggle of a column that is no checkbox, in Filter and at the bottom of the operator choice: the
    // header filter filters while the user types, after a short pause
    'filter.filterOnType': 'Filter as you type',
    // its value list, the block 'filter.values'
    'filter.values.search': 'Search values',
    'filter.values.searchPlaceholder': 'Search values',
    'filter.values.availableOnly': 'Only values in filtered rows',
    // the search box's text as the filter (CONTAINS), not the values found: {text} is the text typed
    'filter.values.textSearch': 'Filter on the text: contains "{text}"',
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
    // the quick dates of a date or datetime column, 'filter.dates': a button each, one click filters
    // (ColumnConfig.datePresets). The name of the group for a screen reader, the name of each - shown in
    // the header filter cell and the footer's chip while it filters - and the tooltip of a button: the
    // days it filters on, {from} and {to} as the field shows a date; {date} today for Overdue
    'filter.dates': 'Quick dates',
    'filter.dates.today': 'Today',
    'filter.dates.yesterday': 'Yesterday',
    'filter.dates.thisWeek': 'This week',
    'filter.dates.lastWeek': 'Last week',
    'filter.dates.thisMonth': 'This month',
    'filter.dates.lastMonth': 'Last month',
    'filter.dates.thisQuarter': 'This quarter',
    'filter.dates.lastQuarter': 'Last quarter',
    'filter.dates.thisYear': 'This year',
    'filter.dates.lastYear': 'Last year',
    'filter.dates.last7Days': 'Last 7 days',
    'filter.dates.last30Days': 'Last 30 days',
    'filter.dates.next7Days': 'Next 7 days',
    'filter.dates.overdue': 'Overdue',
    'filter.dates.range': '{from} – {to}',
    'filter.dates.before': 'Before {date}',

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

    // the column chooser, from the header menu: its search, the tooltip of a field's drag handle, the ✎ of a
    // field and the input it opens - {label} the column's label, as the list shows it
    'columnChooser.title': 'All Fields:',
    'columnChooser.search': 'Search',
    'columnChooser.close': 'Close',
    'columnChooser.drag': 'Drag it into the header to add the column',
    'columnChooser.rename': 'Rename {label}',
    'columnChooser.label': 'Label of {label}',
    'columnChooser.label.hint': 'Enter saves, Esc cancels. Empty: the column has its own label',

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

    // the grid config dialog (the gear in the footer, Column settings… in the header menu): its title
    // bar, the list of the columns - their types and what they have set
    'columnSettings.title': 'Grid config',
    'columnSettings.title.tooltip': 'Drag to move the dialog',
    'columnSettings.close.tooltip': 'Close without applying',
    'columnSettings.columns': 'Columns',
    'columnSettings.back': '‹ Columns',
    'columnSettings.type.text': 'Text',
    'columnSettings.type.number': 'Number',
    'columnSettings.type.boolean': 'Checkbox',
    'columnSettings.type.date': 'Date',
    'columnSettings.type.datetime': 'Date and time',
    'columnSettings.type.lookup': 'Lookup',
    'columnSettings.badge.format': 'Format',
    'columnSettings.badge.text': 'Text',
    'columnSettings.badge.link': 'Link',
    'columnSettings.badge.problem': 'Error',
    'columnSettings.badge.multiline': 'Multiline',
    'columnSettings.badge.readonly': 'Read only',
    // editing: a text column's text of several lines, any column not edited in an editable grid
    'columnSettings.multiline': 'Multiline',
    'columnSettings.minRows': 'Min lines in the detail form',
    'columnSettings.minRows.hint': '1 to 30, the least lines of its box in the detail form - empty: 3',
    'columnSettings.readonly': 'Read only',
    'columnSettings.badge.checkbox': 'Checkbox',
    'columnSettings.badge.numberOverride': 'Blank / 0',
    'columnSettings.badge.label': 'Label',
    'columnSettings.badge.placeholder': 'Placeholder',
    'columnSettings.badge.rules': 'Colours',
    // every column: its label, empty the column's own (the input shows it)
    'columnSettings.label': 'Label',
    // a date, datetime or number column: the picker of its format, the entries of Format ›
    'columnSettings.format': 'Format',
    'columnSettings.format.tooltip': 'How the cells show the value',
    // the format picker of a column without a format of its own, whose type has one (the Defaults tab)
    'columnSettings.format.ofType': 'Default: {format}',
    // under the format of a date or number column: its header filter takes the text as the cells show it.
    // Off and greyed out, with the second hint, for a format that is no period of time
    'columnSettings.filterAsShown': 'Filter as shown',
    'columnSettings.filterAsShown.hint':
        'The header filter takes the text as the cells show it: a week, a month, a year is the whole of it',
    'columnSettings.filterAsShown.off':
        "Not for the day of the week or the time of day: the header filter takes the field's format",
    // a text column: the text it shows and its link. The placeholders and hints show a template as it is
    // written, their {names} are not filled in
    'columnSettings.text': 'Text shown',
    'columnSettings.text.placeholder': '{firstname} {lastname}',
    'columnSettings.text.hint': "Empty: the cell's own text. {value} is the cell's value, {field} the value of another field",
    'columnSettings.link': 'Show as link',
    'columnSettings.url': 'Address',
    'columnSettings.url.placeholder': 'https://example.com/customer/{id}',
    'columnSettings.url.hint': 'Starts with https://, http://, mailto: or tel: - or is one {field} that holds the whole address',
    'columnSettings.newTab': 'Open in a new tab',
    'columnSettings.insertField': 'Insert a field',
    'columnSettings.none.boolean': 'A checkbox column has no format',
    'columnSettings.none.lookup': 'A lookup column shows the label of its value: it has no format',
    // a number column: what a blank and 0 show, one or the other
    'columnSettings.blankToZero': 'Show blank as 0',
    'columnSettings.zeroToBlank': 'Show 0 as blank',
    // a text or a number column shown as checkboxes: the value of a checked cell, the one written unchecked
    'columnSettings.checkbox': 'Show as checkbox',
    'columnSettings.checked': 'Checked value',
    'columnSettings.unchecked': 'Unchecked value',
    'columnSettings.checkbox.hint': 'A click writes the other value. An empty unchecked value empties the cell',
    // every column but a checkbox: the placeholder of its header filter, a text or the column's label
    'columnSettings.placeholder': 'Placeholder',
    'columnSettings.placeholderLabel': 'Use the column label',
    // every column but a checkbox: the operator of its header filter, {operator} the column's default
    'columnSettings.operator': 'Filter operator',
    'columnSettings.operator.tooltip': 'The operator the header filter of the column uses',
    'columnSettings.operator.hint': 'Default: {operator}',
    // every column but a checkbox, beside its operator: the header filter filters while the user types
    'columnSettings.filterOnType': 'Filter as you type',
    'columnSettings.filterOnType.hint': 'After a short pause, no Enter needed',
    'columnSettings.matchCase': 'Match case',
    'columnSettings.matchCase.hint': 'Ann does not find ANN - the header shows Aa beside the operator',
    'columnSettings.matchCase.always': 'Always for this column: filterCaseSensitive in its config',
    // every column: its colour rules (ColumnFormat.rules). A rule's operators have the header filter's
    // names (filter.operator.*, filter.filter.isBlank / isNotBlank), its label and value inputs the filter
    // editor's (filterEditor.label.*). {number} is the rule's place, 1 the first; {value} the value as typed
    'columnSettings.rules': 'Colour rules',
    'columnSettings.rules.hint':
        'The first rule that matches colours the cell. The value is compared as the header filter compares it',
    'columnSettings.rules.empty': 'No rules',
    'columnSettings.rules.add': 'Add rule',
    'columnSettings.rules.rule': 'Rule {number}',
    'columnSettings.rules.checked': 'Checked',
    'columnSettings.rules.date.compare': 'Compare with',
    'columnSettings.rules.date.typed': 'A date or period typed',
    'columnSettings.rules.date.placeholder': 'Date, 2026-W47, 2026-11, 2026 Q4, 2026',
    'columnSettings.rules.week': 'Weeks',
    'columnSettings.rules.week.column': 'As the column: {week}',
    'columnSettings.rules.week.iso': 'ISO - Monday',
    'columnSettings.rules.week.us': 'US - Sunday',
    'columnSettings.rules.textColor': 'Text colour',
    'columnSettings.rules.background': 'Background',
    'columnSettings.rules.bold': 'Bold',
    'columnSettings.rules.none': 'None',
    'columnSettings.rules.color.red': 'Red',
    'columnSettings.rules.color.orange': 'Orange',
    'columnSettings.rules.color.amber': 'Amber',
    'columnSettings.rules.color.yellow': 'Yellow',
    'columnSettings.rules.color.lime': 'Lime',
    'columnSettings.rules.color.green': 'Green',
    'columnSettings.rules.color.teal': 'Teal',
    'columnSettings.rules.color.cyan': 'Cyan',
    'columnSettings.rules.color.blue': 'Blue',
    'columnSettings.rules.color.indigo': 'Indigo',
    'columnSettings.rules.color.purple': 'Purple',
    'columnSettings.rules.color.pink': 'Pink',
    'columnSettings.rules.color.brown': 'Brown',
    'columnSettings.rules.color.grey': 'Grey',
    // the colour picker after the swatches: a custom colour, #rrggbb. {ratio} is the contrast, 3.2
    'columnSettings.rules.custom': 'Custom colour',
    'columnSettings.rules.contrast.rows': 'The text colour has {ratio}:1 to the light rows, under 4.5:1: hard to read',
    'columnSettings.rules.contrast.background': 'The text colour has {ratio}:1 to the background, under 4.5:1: hard to read',
    // the kind of a rule's condition: the cell's value, conditions on fields of the row, a formula
    'columnSettings.rules.kind': 'Condition',
    'columnSettings.rules.kind.value': 'Value',
    'columnSettings.rules.kind.conditions': 'Conditions',
    'columnSettings.rules.kind.formula': 'Formula',
    'columnSettings.rules.combine.AND': 'All of them',
    'columnSettings.rules.combine.OR': 'Any of them',
    'columnSettings.rules.combine.tooltip': 'Whether all the conditions must be true, or one of them',
    'columnSettings.rules.condition': 'Condition {number}',
    'columnSettings.rules.condition.field': 'Field',
    'columnSettings.rules.condition.add': 'Add condition',
    'columnSettings.rules.condition.remove': 'Remove condition',
    'columnSettings.rules.formula.placeholder': '{balance} < 0 AND {status} = "late"',
    'columnSettings.rules.formula.true': 'True in this row: the rule colours the cell',
    'columnSettings.rules.formula.false': 'False in this row',
    'columnSettings.rules.problem.conditions': 'Add a condition',
    'columnSettings.rules.problem.expression': 'Write the formula, true or false',
    'columnSettings.rules.moveUp': 'Move up',
    'columnSettings.rules.moveDown': 'Move down',
    'columnSettings.rules.remove': 'Remove rule',
    'columnSettings.rules.open': 'Edit the rule',
    'columnSettings.rules.sample': 'Abc',
    'columnSettings.rules.unchecked': 'Not checked',
    'columnSettings.rules.close': 'Close the rule',
    'columnSettings.rules.problem.value': 'Write the value to compare with',
    'columnSettings.rules.problem.style': 'Pick a text colour, a background or bold',
    'columnSettings.rules.unread': 'The column does not read {value}: the rule colours no cell',
    // the data bar, colour scale and icon set of a number column (ColumnFormat.bar, scale, icons): the
    // section under the colour rules. The colours of the swatches are columnSettings.rules.color.*; {value}
    // a text typed, {min} and {max} the smallest and the largest number of the rows as the cells show them
    'columnSettings.bars': 'Data bars, scales, icons',
    'columnSettings.bars.hint':
        "By the value's place among the numbers of the rows the filter lets through. A colour rule's background wins over a scale",
    'columnSettings.bars.bar': 'Data bar',
    'columnSettings.bars.color': 'Colour',
    'columnSettings.bars.min': 'Min',
    'columnSettings.bars.mid': 'Midpoint',
    'columnSettings.bars.max': 'Max',
    'columnSettings.bars.automatic': 'Automatic',
    'columnSettings.bars.scale': 'Colour scale',
    'columnSettings.bars.minColor': 'Lowest',
    'columnSettings.bars.midColor': 'Middle',
    'columnSettings.bars.maxColor': 'Highest',
    'columnSettings.bars.icons': 'Icons',
    'columnSettings.bars.set': 'Icon set',
    'columnSettings.bars.set.arrows': 'Arrows',
    'columnSettings.bars.set.traffic': 'Traffic lights',
    'columnSettings.bars.set.flags': 'Flags',
    'columnSettings.bars.set.symbols': 'Symbols',
    'columnSettings.bars.thresholdMiddle': 'Middle from',
    'columnSettings.bars.thresholdHigh': 'High from',
    'columnSettings.bars.unit': 'Thresholds',
    'columnSettings.bars.unit.percent': '% of the range',
    'columnSettings.bars.unit.number': 'Values',
    'columnSettings.bars.position': 'Icon',
    'columnSettings.bars.position.before': 'Before the value',
    'columnSettings.bars.position.after': 'After the value',
    'columnSettings.bars.reverse': 'Reverse: the low values get the high icon',
    'columnSettings.bars.samples': 'Lowest to highest of the rows, {min} to {max}',
    'columnSettings.bars.noNumbers': 'No numbers in the rows: nothing to draw yet',
    'columnSettings.bars.problem.notNumber': '{value} is no number',
    'columnSettings.bars.problem.minMax': 'The min is not below the max',
    'columnSettings.bars.problem.mid': 'The midpoint is not between the min and the max',
    'columnSettings.bars.problem.thresholds': 'The first threshold is above the second',
    'columnSettings.bars.problem.percent': 'In % of the range the thresholds are 0 to 100',
    'columnSettings.badge.bar': 'Bar',
    'columnSettings.badge.scale': 'Scale',
    'columnSettings.badge.icons': 'Icons',
    // a calculated column (GridState.calculatedColumns): its settings at the top of the column's, the
    // button under the list of the columns. {number} the column's number, 1 the first; {type} the name of
    // a type (columnSettings.type.*), {value} the value in the row of the preview
    'columnSettings.calculated': 'Calculated column',
    'columnSettings.calculated.add': 'Add calculated column',
    'columnSettings.calculated.add.tooltip': 'A column computed from the other fields of the row',
    'columnSettings.calculated.defaultLabel': 'Calculated {number}',
    'columnSettings.calculated.name': 'Field name',
    'columnSettings.calculated.name.hint': 'A letter, then letters, digits and _. Not changed once applied',
    'columnSettings.calculated.formula': 'Formula',
    'columnSettings.calculated.formula.placeholder': '{price} * {qty}',
    'columnSettings.calculated.formula.hint':
        'Fields in braces, numbers, "text", + - * / &, = <> != < <= > >=, AND OR NOT, IF ROUND ABS MIN MAX TODAY DAYS YEAR MONTH CONCAT COALESCE ISBLANK LEFT RIGHT MID LEN UPPER LOWER TRIM CONTAINS',
    'columnSettings.calculated.gives': 'Gives: {type}',
    'columnSettings.calculated.value': 'In this row: {value}',
    'columnSettings.calculated.blank': '(blank)',
    'columnSettings.calculated.applyFirst': 'Apply first: then the format and the colour rules of a {type} column',
    'columnSettings.calculated.remove': 'Remove calculated column',
    'columnSettings.calculated.problem.name': 'The field name is a letter, then letters, digits and _ - 64 at most',
    'columnSettings.calculated.problem.taken': 'The field name is a field already: give the column a name of its own',
    'columnSettings.badge.calculated': 'Calculated',
    // the problems of a formula, of a calculated column and of a colour rule. {position} is the character,
    // 1 the first; {part} a part of the formula as written; {what} an operator or a function; {got},
    // {expected} and {type} are the names of types (columnSettings.formula.type.*)
    'columnSettings.formula.type.number': 'a number',
    'columnSettings.formula.type.text': 'a text',
    'columnSettings.formula.type.date': 'a date',
    'columnSettings.formula.type.boolean': 'true / false',
    'columnSettings.formula.problem.empty': 'Write the formula',
    'columnSettings.formula.problem.length': 'The formula is longer than {max} characters',
    'columnSettings.formula.problem.depth': 'The formula nests deeper than {max} levels',
    'columnSettings.formula.problem.size': 'The formula has more than {max} parts',
    'columnSettings.formula.problem.character': '{text} at {position} is no part of a formula',
    'columnSettings.formula.problem.unexpected': '{text} at {position} can not be there',
    'columnSettings.formula.problem.end': 'The formula ends too soon',
    'columnSettings.formula.problem.text': 'The text at {position} has no closing quote',
    'columnSettings.formula.problem.field': 'The field at {position} has no closing brace',
    'columnSettings.formula.problem.function': '{name} is no function: {names}',
    'columnSettings.formula.problem.arguments': '{name} has {count} values: it is written {usage}',
    'columnSettings.formula.problem.name': '{name} at {position} is no function - a field is written in braces',
    'columnSettings.formula.problem.internal': "{field} is the grid's own, not a field",
    'columnSettings.formula.problem.unknownField': 'No field {field}',
    'columnSettings.formula.problem.cycle': '{field} is computed from itself',
    'columnSettings.formula.problem.fieldProblem': '{field} has a problem of its own',
    'columnSettings.formula.problem.number': '{what} takes a number: {part} is {got}',
    'columnSettings.formula.problem.date': '{what} takes a date: {part} is {got}',
    'columnSettings.formula.problem.boolean': '{what} takes true / false: {part} is {got}',
    'columnSettings.formula.problem.same': '{what} takes values of one type: {part} is {got}, {other} is {expected}',
    'columnSettings.formula.problem.order': '{what} compares numbers, texts and dates, not true / false',
    'columnSettings.formula.problem.chain': 'Compare two values at a time ({position}): a < b AND b < c',
    'columnSettings.formula.problem.digits': 'ROUND takes a whole number of digits from -10 to 10, not {part}',
    'columnSettings.formula.problem.result': 'The formula gives {got}, it must give {expected}',
    'columnSettings.formula.problem.divide': 'Divides by 0 in this row: no value',
    'columnSettings.formula.problem.value': '{field} is not {type} in this row: no value',
    'columnSettings.formula.problem.overflow': 'A number too big in this row: no value',
    'columnSettings.formula.problem.long': 'A text of more than {max} characters in this row: no value',
    // the preview: the row it shows, and what is wrong with a template - {field} is the field as written
    // in braces, or the label of the column that is empty
    'columnSettings.preview.current': 'Preview, the current row',
    'columnSettings.preview.first': 'Preview, the first row',
    'columnSettings.preview.none': 'No rows to preview',
    'columnSettings.problem.urlEmpty': 'Write the address',
    'columnSettings.problem.urlStart': 'Start the address with https://, http://, mailto: or tel: - or give one field alone',
    'columnSettings.problem.protocol': 'Not a link the grid opens: only https:, http:, mailto: and tel:',
    'columnSettings.problem.internal': "{field} is the grid's own, not a field",
    'columnSettings.problem.unknownField': 'No field {field} in this row',
    'columnSettings.problem.blank': '{field} is empty in this row: no link, the text only',
    'columnSettings.problem.invalid': 'No valid address in this row: no link, the text only',
    // the values of the checkboxes: {value} is the value as typed
    'columnSettings.problem.checkedEmpty': 'Write the checked value',
    'columnSettings.problem.notNumber': '{value} is no number: a number column writes numbers',
    'columnSettings.problem.sameValues': 'The checked and the unchecked value are the same: a click could not uncheck a cell',
    // the buttons
    'columnSettings.resetColumn': 'Reset column',
    'columnSettings.resetColumn.tooltip': 'The settings the column starts with',
    'columnSettings.resetAll': 'Reset all',
    'columnSettings.resetAll.tooltip': 'The settings every column starts with',
    'columnSettings.cancel': 'Cancel',
    'columnSettings.apply': 'Apply',
    'columnSettings.apply.tooltip': 'Apply to the grid, the dialog stays open',
    'columnSettings.applyAndClose': 'Apply & close',
    // the tabs of the dialog, and its Detail form tab: what the detail form (GridState.detailForm) shows
    'columnSettings.tab.columns': 'Columns',
    'columnSettings.tab.detailForm': 'Detail form',
    'columnSettings.tab.defaults': 'Defaults',
    // the tabs of a column's settings on the Columns tab (ColumnSection in columnSettings.ts), and their list's name
    'columnSettings.section.general': 'General',
    'columnSettings.section.display': 'Display',
    'columnSettings.section.filter': 'Header filter',
    'columnSettings.section.colours': 'Colours',
    'columnSettings.sections': 'Settings of {column}',
    'columnSettings.detailForm.show': 'Show the detail form',
    'columnSettings.detailForm.expanded': 'Expanded',
    'columnSettings.detailForm.expanded.hint':
        'Collapsed, the form is a narrow strip: the button of its title expands it, and collapses it again',
    'columnSettings.detailForm.width': 'Width (px)',
    'columnSettings.detailForm.minWidth': 'Min width (px)',
    'columnSettings.detailForm.maxWidth': 'Max width (px)',
    'columnSettings.detailForm.maxWidth.none': 'None',
    'columnSettings.detailForm.width.hint':
        'At least 150, between the min and the max width - a drag of the left edge of the form changes it too. Where the rows would get too little room beside it, the form is under them',
    'columnSettings.detailForm.fields': 'Fields of the form',
    'columnSettings.detailForm.fields.hint':
        'Space puts a field in the form or takes it out, Alt+↑ and Alt+↓ move it - or drag it by its handle',
    'columnSettings.detailForm.fields.hint.mac':
        'Space puts a field in the form or takes it out, ⌥↑ and ⌥↓ move it - or drag it by its handle',
    'columnSettings.detailForm.drag': 'Drag to move it',
    'columnSettings.detailForm.multiline': 'Several lines',
    'columnSettings.detailForm.hidden': 'Hidden',
    'columnSettings.detailForm.moveUp': 'Move up',
    'columnSettings.detailForm.moveDown': 'Move down',
    'columnSettings.detailForm.field': 'Settings of {field} in the form',
    'columnSettings.detailForm.section': 'Name',
    'columnSettings.detailForm.section.hint':
        'The fields under it in the list, up to the next section, are in it. Its header collapses it',
    'columnSettings.detailForm.open': 'Open at start',
    'columnSettings.detailForm.minRows': 'Min lines',
    'columnSettings.detailForm.paddingTop': 'Space above (px)',
    'columnSettings.detailForm.paddingBottom': 'Space below (px)',
    'columnSettings.detailForm.panel': 'Panel: a frame around it',
    'columnSettings.detailForm.sectionSettings': 'Settings of the section {section}',
    'columnSettings.detailForm.removeSection': 'Remove section',
    'columnSettings.detailForm.addSection': 'Add section',
    'columnSettings.detailForm.newSection': 'Section',
    'columnSettings.detailForm.panelBadge': 'Panel',
    'columnSettings.detailForm.sectionType': 'Section',
    'columnSettings.detailForm.reset': 'Reset form',
    'columnSettings.detailForm.reset.tooltip': 'The detail form the grid starts with',
    // the Defaults tab of the grid config dialog (gridDefaultsSettings.ts): the formats by type
    // (GridState.typeFormats) and the default view
    'columnSettings.defaults.formats': 'Formats by type',
    'columnSettings.defaults.formats.hint': 'A column without a format of its own shows the format of its type',
    'columnSettings.defaults.format.tooltip': 'How every column of this type shows its values',
    'columnSettings.defaults.views': 'Views',
    'columnSettings.defaults.viewsButton': 'Show the views button',
    'columnSettings.defaults.viewsButton.hint': 'At the left end of the footer: save, switch, rename and delete views',
    'columnSettings.defaults.defaultView': 'Default view',
    'columnSettings.defaults.defaultView.hint': 'The view the grid opens with',
    'columnSettings.defaults.noViews': 'No views saved yet: save one from the views button',
    'columnSettings.defaults.reset': 'Reset formats',
    'columnSettings.defaults.reset.tooltip': 'The formats by type the grid starts with',

    // the detail form (GridConfig.detailForm): its title, the row it shows - {row} its number, as the row
    // numbers show it - and what it says without a row or without fields. The tooltips of the button of
    // its title, the name of the splitter of its left edge
    'detailForm.title': 'Details',
    'detailForm.row': 'Row {row}',
    'detailForm.noRow': 'No row',
    'detailForm.noFields': 'No fields: pick them with the gear in the footer, tab Detail form',
    'detailForm.collapse': 'Collapse the details',
    'detailForm.expand': 'Expand the details',
    'detailForm.resize': 'Width of the details',

    // the import dialog (GridConfig.importMenu, gridInterface.openImport()): its title bar, where the rows
    // come from and what is wrong with a file - {size} MB, {rows}, {columns} and {cells} are the limits
    'import.title': 'Import rows',
    'import.title.tooltip': 'Drag to move the dialog',
    'import.close.tooltip': 'Close without importing',
    'import.chooseFile': 'Choose file…',
    'import.hint': 'Drop a CSV or Excel (.xlsx) file here, or paste rows copied from a spreadsheet',
    'import.clipboard': 'Pasted rows',
    'import.reading': 'Reading the file…',
    'import.error.tooLarge':
        'The file is too large to import: at most {size} MB, {rows} rows, {columns} columns and {cells} cells',
    'import.error.xls': 'An Excel 97-2003 file (.xls), or one protected by a password, can not be read: save it as .xlsx or CSV',
    'import.error.broken': 'The file can not be read: it is not CSV or an Excel workbook (.xlsx), or it is damaged',
    'import.error.unsupported': 'This browser can not read Excel files: save the file as CSV',
    'import.error.clipboard': 'No rows on the clipboard: copy them in a spreadsheet, then paste them here',
    // the options: the header, the separator of CSV - {separator} the one found - the sheet of a workbook,
    // the decimal mark when a number field is picked, the order of dates with / when a date field is
    'import.header': 'First row is a header',
    'import.separator': 'Separator',
    'import.separator.auto': 'Found: {separator}',
    'import.separator.comma': 'Comma',
    'import.separator.semicolon': 'Semicolon',
    'import.separator.tab': 'Tab',
    'import.sheet': 'Sheet',
    'import.decimalMark': 'Decimal mark',
    'import.decimalMark.auto': 'As the columns',
    'import.decimalMark.dot': 'Dot: 1,234.5',
    'import.decimalMark.comma': 'Comma: 1 234,5',
    'import.dateOrder': 'Dates with /',
    'import.dateOrder.DMY': 'Day first: 31/12/2026',
    'import.dateOrder.MDY': 'Month first: 12/31/2026',
    // the columns: how they were matched - {field} the label of the first column's field - a column without
    // a header ({number} from 1), the name of its field picker ({column} the column), the picker's Skip
    'import.byName': 'The first row names the columns: they are matched to the fields by name',
    'import.byPosition': 'The columns are matched to the fields by position, from {field}',
    'import.column': 'Column {number}',
    'import.field': 'Field of {column}',
    'import.skip': 'Skip',
    // the rows read and their problems: {row} the row of the file, from 1; {field} the column's label;
    // {text} the value as the file has it
    'import.count': '{rows} rows',
    'import.count.problems': '{rows} rows, {problems} with problems',
    'import.problem': 'Row {row}, {field}: {message}',
    'import.problems.more': '{count} more',
    'import.problem.number': 'Not a number: {text}',
    'import.problem.date': 'Not a date: {text}',
    'import.problem.boolean': 'Not true or false: {text}',
    'import.invalidRows': 'Rows with problems',
    'import.invalidRows.import': 'Import them, marked',
    'import.invalidRows.skip': 'Skip them',
    'import.noFields': 'Pick a field for at least one column',
    'import.noRows': 'No rows to import',
    'import.cancel': 'Cancel',
    'import.import': 'Import {rows} rows',
    // the error of a new row with values that could not be read, on its row number: {problems} the columns
    // and what was wrong
    'import.rowError': 'Not imported: {problems}',

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
    // the gear at the footer's right end: its name and tooltip, it opens the grid config dialog
    'footer.settings': 'Grid config',
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

    // the named views (GridConfig.views): the button at the footer's left end - the view shown, {name}
    // its name, "Standard" when none is (the config's state), "(changed)" when the state changed since -
    // and its menu: the views, the hints of the default view and of a readonly one, the commands
    'views.standard': 'Standard',
    'views.button': 'View: {name}',
    'views.button.modified': 'View: {name} (changed)',
    'views.default.hint': 'default',
    'views.shared.hint': 'shared',
    'views.save': 'Save',
    'views.saveAs': 'Save as new view…',
    'views.revert': 'Revert changes',
    'views.rename': 'Rename…',
    'views.delete': 'Delete',
    'views.setDefault': 'Default view',
    // the name asked for by Save as new view… and Rename…, what is wrong with it, the buttons
    'views.name': 'Name of the view',
    'views.name.empty': 'Give the view a name',
    'views.name.taken': 'Another view has this name',
    'views.name.cancel': 'Cancel',
    'views.name.save': 'Save',
    'views.name.rename': 'Rename',

    // the aggregates of the columns (ColumnConfig.aggregate): the label in front of the value in a group
    // row and in the totals row, and the label of the totals row
    'aggregate.sum': 'Sum',
    'aggregate.avg': 'Avg',
    'aggregate.min': 'Min',
    'aggregate.max': 'Max',
    'aggregate.count': 'Count',
    'aggregate.total': 'Total',

    // the display formats of the columns (ColumnConfig.format): the language of the names of a date
    // format - medium, long, full, the day of the week. Not a text shown: a BCP 47 language tag for
    // Intl.DateTimeFormat, 'nb-NO' shows 'søndag 22. november 2026'. One Intl does not take is English.
    // Then how a week and a quarter are written: {week} has two digits
    'format.locale': 'en-US',
    'format.weekIso': '{year}-W{week}',
    'format.weekUs': '{year}-W{week}',
    'format.quarter': '{year} Q{quarter}',

    // the placeholder of an empty header filter, by the field's type - a date filter shows its
    // formatter's format (YYYY-MM-DD), a boolean filter is a checkbox
    'filter.placeholder.text': 'Text',
    'filter.placeholder.number': 'Number',
    // a header filter with BETWEEN: the two ends are typed with .. between them
    'filter.placeholder.between': 'from..to',
    // a date column shown as the days until the date, filtered as shown: a number of days is typed
    'filter.placeholder.daysUntil': 'Days from today',
    // the operator indicator of a header filter (GridConfig.filterOperatorIndicator): its name for a
    // screen reader, its tooltip - {operator} is the operator as Operator › names it - and the symbol of
    // each operator
    'filter.indicator': 'Operator: {operator}',
    'filter.indicator.case': 'Aa',
    'filter.indicator.matchCase': '{operator}, match case',
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
    // matches and the buttons, with their tooltips. "Match case" (its name, the text it shows, its
    // tooltip) and "Filter rows" (only the rows with a match) are toggles
    'find.label': 'Find in the grid',
    'find.placeholder': 'Find',
    'find.count': '{current} of {count}',
    'find.none': 'No matches',
    'find.matchCase': 'Match case',
    'find.matchCase.text': 'Aa',
    'find.matchCase.tooltip': 'Match case (Alt+C)',
    'find.matchCase.tooltip.mac': 'Match case',
    'find.filterRows': 'Filter rows',
    'find.filterRows.tooltip': 'Show only the rows with a match',
    'find.previous': 'Previous match',
    'find.previous.tooltip': 'Previous match (Shift+Enter)',
    'find.previous.tooltip.mac': 'Previous match (⇧Enter)',
    'find.next': 'Next match',
    'find.next.tooltip': 'Next match (Enter)',
    'find.close': 'Close',
    'find.close.tooltip': 'Close (Esc)',

    // the keyboard shortcuts help (`?` and Ctrl+/ in the grid, Keyboard shortcuts… in the header menu): its
    // title bar, the search over the list, the hint under it and what it says when nothing matches. The
    // names of the keys are texts too, `shortcuts.key.*`: the modifiers have a text for a Mac (⌘ ⌥ ⇧), a
    // letter, a function key (F2) and the arrows are shown as they are. Then each group of keys, its title
    // `shortcuts.group.<group>`, and what each key does
    'shortcuts.title': 'Keyboard shortcuts',
    'shortcuts.title.tooltip': 'Drag to move the dialog',
    'shortcuts.close': 'Close',
    'shortcuts.search': 'Search',
    'shortcuts.none': 'No key matches the search',
    'shortcuts.hint': 'The arrows, Home and End move the caret in a cell. With Alt they move between the cells',
    'shortcuts.hint.mac': 'The arrows, Home and End move the caret in a cell. With ⌥ they move between the cells',
    'shortcuts.key.ctrl': 'Ctrl',
    'shortcuts.key.ctrl.mac': '⌘',
    'shortcuts.key.alt': 'Alt',
    'shortcuts.key.alt.mac': '⌥',
    'shortcuts.key.shift': 'Shift',
    'shortcuts.key.shift.mac': '⇧',
    'shortcuts.key.enter': 'Enter',
    'shortcuts.key.esc': 'Esc',
    'shortcuts.key.tab': 'Tab',
    'shortcuts.key.space': 'Space',
    'shortcuts.key.home': 'Home',
    'shortcuts.key.end': 'End',
    'shortcuts.key.pageUp': 'Page Up',
    'shortcuts.key.pageDown': 'Page Down',
    'shortcuts.key.delete': 'Delete',
    'shortcuts.key.backspace': 'Backspace',
    'shortcuts.key.menu': 'Menu',
    'shortcuts.group.move': 'Moving around',
    'shortcuts.move.tab': 'The next / previous cell',
    'shortcuts.move.sideways': 'The cell to the left / right',
    'shortcuts.move.upDown': 'The cell above / below',
    'shortcuts.move.enter': 'The cell below, from a cell that can be edited',
    'shortcuts.move.row': 'The first / last cell of the row',
    'shortcuts.move.grid': 'The first / last cell of the grid',
    'shortcuts.move.page': 'A page of rows up / down',
    'shortcuts.move.columns': 'A page of columns left / right',
    'shortcuts.move.edge': 'The edge of the data in the column, up / down',
    'shortcuts.group.select': 'Selecting cells',
    'shortcuts.select.cell': 'A range of cells, one cell further each time',
    'shortcuts.select.page': 'The range a page up / down',
    'shortcuts.select.row': 'The range to the first / last cell of the row',
    'shortcuts.select.grid': 'The range to the first / last cell of the grid',
    'shortcuts.select.edge': 'The range to the edge of the data, up / down',
    'shortcuts.select.clear': 'No range of cells any more',
    'shortcuts.group.cell': 'In a cell',
    'shortcuts.cell.editor': 'Open the editor of a cell of several lines, or of a custom cell',
    'shortcuts.cell.save': 'In the editor of several lines: save the text',
    'shortcuts.cell.cancel': 'Close an editor or the list of a lookup cell, nothing saved',
    'shortcuts.cell.list': 'Open the list of a lookup cell',
    'shortcuts.cell.check': 'Check or uncheck a checkbox',
    'shortcuts.cell.link': 'Open the link of a link cell',
    'shortcuts.group.edit': 'Changing values',
    'shortcuts.edit.undo': 'Undo, the focus to the cell it changed',
    'shortcuts.edit.redo': 'Redo',
    'shortcuts.edit.fillDown': 'Fill down: the values of the row above, or of the top row of the range',
    'shortcuts.edit.clear': 'Empty the cells of a range',
    'shortcuts.edit.deleteRows': 'On a row number: mark its row for deletion, or the selected rows',
    'shortcuts.group.clipboard': 'Copy and paste',
    'shortcuts.clipboard.copy': 'Copy the range of cells, or the value of the cell',
    'shortcuts.clipboard.paste': 'Paste cells copied here or in a spreadsheet',
    'shortcuts.clipboard.columns': 'On a column number: copy the selected columns',
    'shortcuts.group.find': 'Find',
    'shortcuts.find.open': 'Open the find bar',
    'shortcuts.find.next': 'The next match',
    'shortcuts.find.previous': 'The previous match',
    'shortcuts.find.matchCase': 'Match case on or off',
    'shortcuts.find.close': 'Close the find bar',
    'shortcuts.group.header': 'Filters, headers and groups',
    'shortcuts.header.filter': 'In a header filter: filter',
    'shortcuts.header.operator': 'In a header filter: choose the operator',
    'shortcuts.header.label': 'From a header filter: up to its column header',
    'shortcuts.header.sort': 'On a column header: sort, again the other way',
    'shortcuts.header.addSort': 'On a column header: add the column to the sort',
    'shortcuts.header.group': 'On a group row: expand or collapse it',
    'shortcuts.group.menus': 'Menus',
    'shortcuts.menus.open': 'The menu of the cell, header, filter or number with the focus',
    'shortcuts.menus.move': 'The next / previous item',
    'shortcuts.menus.use': 'Use the item, or open its submenu',
    'shortcuts.menus.submenu': 'Open / close a submenu',
    'shortcuts.menus.close': 'Close the menu',
    'shortcuts.group.dialogs': 'Dialogs and this help',
    'shortcuts.dialogs.help': 'This help, where the key types nothing',
    'shortcuts.dialogs.helpAnywhere': 'This help, also while typing in a cell',
    'shortcuts.dialogs.close': 'Close a dialog',
    'shortcuts.dialogs.undo': 'In the filter editor: undo / redo',
    'shortcuts.dialogs.tabs': 'In the grid config dialog: the tab before / after',
    'shortcuts.dialogs.moveField': 'The fields of the detail form: move the field up / down',
    'shortcuts.dialogs.toggleField': 'The fields of the detail form: in the form or out',

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
    // the icon of an icon set (ColumnFormat.icons) for a screen reader: the level of the value, after it
    'cell.icon.high': 'High',
    'cell.icon.middle': 'Middle',
    'cell.icon.low': 'Low',
    'cell.multiline.moreLines': '… {count} more lines',
    'cell.multiline.hint': 'Ctrl+Enter to save, Esc to cancel',
    'cell.multiline.hint.mac': '⌘Enter to save, Esc to cancel',
    'cell.multiline.hintReadonly': 'Esc to close',
    // the ✕ at the right of the hint of the multiline editor: saves and closes it - only closes a readonly one
    'cell.multiline.close': 'Save and close',
    'cell.multiline.closeReadonly': 'Close',
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
    // a range picker (IDateConfig.rangepicker): the labels of the days picked, and an end not picked yet
    'datePicker.from': 'From',
    'datePicker.to': 'To',
    'datePicker.rangeOpen': '–',
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
 * | `row.*`, `header.*`, `filter.*`, `column.*` | the right click menus: the ids of {@link MENU_IDS}. A hint (the text in parentheses) is `<id>.hint`. `filter.values.*`: the value list of the filter menu, `filter.range.*` its range block, `filter.dates.*` its quick dates |
 * | `columnChooser.*` | the column chooser |
 * | `filterEditor.*` | the filter editor, its field and operator menus. `filterEditor.operator.<FilterOperator>`: the names of the operators |
 * | `footer.*` | the footer: the row count, the filter chips, the "No filter" button. `footer.operator.<FilterOperator>`: the short names of the operators (`=`, `contains`) |
 * | `views.*` | the named views (`GridConfig.views`): the views button at the footer's left end, its menu and the name asked for by *Save as new view…* and *Rename…* |
 * | `aggregate.*` | the aggregates of the columns: the label in front of a value in the group rows and the totals row (`aggregate.<AggregateFunction>`), and the label of the totals row |
 * | `format.*` | the display formats of the columns (`ColumnConfig.format`): `format.locale` the language of the names of a date, a BCP 47 tag for `Intl.DateTimeFormat` (`'en-US'`; not shown, `'nb-NO'` shows `søndag 22. november 2026`), and how a week and a quarter are written |
 * | `grid.*` | labels for screen readers |
 * | `find.*` | the find bar of Ctrl+F: the input, the count of the matches, "Match case", "Filter rows", the buttons |
 * | `shortcuts.*` | the keyboard shortcuts help: its title, search and hint, the names of the keys (`shortcuts.key.*`), the title of each group of keys (`shortcuts.group.*`) and what each key does |
 * | `rowStatus.*` | the state of a row on its row number: the tooltip, and the text for a screen reader |
 * | `cell.*` | the cells: the marker of an edited cell, a cell of several lines and its editor |
 * | `lookup.*` | a lookup column (`ColumnConfig.editor`): the button of the cell, the select under it |
 * | `datePicker.*` | the date picker: the buttons, the names of the months and the days, From and To of a range picker |
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

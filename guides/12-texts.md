# Texts

Every text the grid shows has an id: the menus, the filter editor, the column chooser, the footer,
the tooltips, the date picker and the labels a screen reader reads - and so do the texts the
datasource makes, the validation messages and `getFilterString()`. `TEXTS` has them all, with their
English text. Change them with `setTexts()` for the page, and with `texts` in the config for one
grid. A translation is a JSON object of texts by id: it can be stored with the config, in a backend.

```sample translation
```

## Translating

```ts
import { setTexts, type Texts } from '@simple-html/grid';

// a text for each id to change, the rest stay English
const norwegian: Texts = {
    'row.copy': 'Kopier:',
    'row.summary.count': 'Antall: {count}',
    'filterEditor.addCondition.tooltip': 'Legg til betingelse',
    'validation.required': 'Må fylles ut'
};

// once, when the page loads: before the datasources and grids are made
setTexts(norwegian);
```

- `TEXTS` is every id with its English text: `JSON.stringify(TEXTS, null, 2)` is a file to hand a
  translator. The ids are [below](#all-ids).
- `Texts` takes some of the ids. Typed `Record<TextId, string>` instead, a translation must have every
  one: the compiler names those missing, also after an update of the grid adds ids. The
  [Translation sample](#sample/translation) does that.
- A translation is plain JSON, it can come from a backend as it is:

```ts
import { setTexts } from '@simple-html/grid';

const response = await fetch('/api/texts/nb');
setTexts(await response.json());
```

`setTexts()` throws a `TypeError` when it gets something that is not an object, or a text that is not
a string - and so does a grid given such `texts`.

## Where a text comes from

A text is looked up in this order, the first that has the id wins:

1. `GridConfig.texts` - the texts of one grid, for a grid that differs from the rest of the page
2. `setTexts()` - the texts of the page
3. `TEXTS` - the English defaults

```ts
import { createGrid, type GridConfig, setTexts } from '@simple-html/grid';

setTexts({ 'row.copy': 'Kopier:', 'row.paste': 'Lim inn:' }); // every grid of the page

const config: GridConfig = {
    layout: { center: [{ fields: ['name'], width: 150 }] },
    texts: { 'row.copy': 'Copy:' } // this grid: Copy: and Lim inn:
};
const gridInterface = createGrid(host, { config, datasource });
```

**The datasource has no grid**: the texts it makes - the validation messages (`validation.*`),
`getFilterString()` (`filterString.*`) and the name of the group of blank values (`grouping.blank`) -
come from `setTexts()` and the defaults only. A grid's `texts` does not change them, also not where
that grid shows them. There is no `texts` option on the datasource: the validation runs in its
`DataContainer`, which datasources can share, and a page has one language.

**Each replaces what was there**: `setTexts()` replaces the texts set before, so an id left out shows
its default again and `setTexts({})` is English. `updateConfig({ texts })` replaces the grid's texts
as a whole, `texts: undefined` removes them. The object given is copied by `setTexts()`.

## Texts with values

A text with `{name}` in it gets a value when it is shown: `'row.summary.count': 'Count: {count}'`
shows `Count: 3`. The tables [below](#all-ids) name the values of each text. Keep the names in a
translation, a value can go anywhere in the text; a name the text has no value for is shown as it is.

```ts
import { setTexts } from '@simple-html/grid';

setTexts({ 'row.summary.count': '{count} rader', 'footer.rowCount': 'Viser {shown} av {total}' });
```

## The ids

The ids are grouped by area, the area first. Within an area:

- **A menu entry's text has the entry's id**, see [Menus](10-menus.md#the-built-in-ids): the text of the
  entry `row.copy.cell` is `row.copy.cell`. The text in parentheses after an entry, its hint, is
  `<id>.hint`. The separators and the value list (`filter.values`, a block) have no text of their own,
  the parts of the value list are `filter.values.*`.
- **A tooltip is `<id>.tooltip`**: `filterEditor.filterOnly` is the button, `filterEditor.filterOnly.tooltip`
  its tooltip. A tooltip of an icon has no text without `.tooltip`.
- **An operator has a name in each place it is shown**, the `FilterOperator` at the end:
  `filterEditor.operator.EQUAL` in the filter editor, `footer.operator.EQUAL` on a chip in the footer
  (symbols, so a chip stays short) and `filterString.operator.EQUAL` in `getFilterString()`. AND and OR
  as well: `filterEditor.operatorAnd`, `footer.and`, `filterString.and`. The filter menu's operators
  are menu entries: `filter.operator.equal`.

### The names of the months and days

The date picker shows the names of the months, and of the days over its columns. Each name is a text
of its own - `datePicker.month.january` to `datePicker.month.december`, `datePicker.day.sunday` to
`datePicker.day.saturday` - not a list in the date picker's config. So a translation is one flat
object of strings for every part of the grid, and `setTexts()` reaches the date pickers of every grid
with the rest. The day names are in javascript's order, Sunday first; `weekStart` picks the first
column.

A `DateInterface` of your own shows the same texts: the page's, or its own in `IDateConfig.texts`.

## Messages of your own

A validator returns the message, or a text id: the built-ins return the `validation.*` ids. Return an
id of your own and give it a text with `setTexts()`, and the message is translated like the
built-ins'. A rule's `message` can be a text id too. An id no text is found for is shown as it is, so
a message written out works as well.

```ts
import { Datasource, registerValidator, setTexts } from '@simple-html/grid';

registerValidator('phoneNO', (value) =>
    typeof value === 'string' && value !== '' && !/^\d{8}$/.test(value) ? 'validation.phoneNO' : null
);

setTexts({
    'validation.phoneNO': 'Må være 8 siffer',
    'age.tooOld': 'For gammel, høyst {value}'
});

const people = new Datasource({
    fields: {
        phone: { validate: ['phoneNO'] },
        age: { type: 'number', validate: [{ id: 'max', value: 150, message: 'age.tooOld' }] }
    }
});
```

See [Validation](05-editing.md#messages).

## When a changed text shows

Nothing is shown again when a text changes, it is read when what shows it is made:

| what | shows a changed text |
| --- | --- |
| the grid: header, rows, footer | after its next rebuild. `updateConfig({ texts })` rebuilds, after `setTexts()` call `gridInterface.rebuild()` |
| a menu, the column chooser, the filter editor, the date picker | the next time it opens (the filter editor also when it is rendered again after an edit) |
| `getFilterString()` | on its next call |
| a validation message | when the value is validated: an edit of the field, or `validate()`. An error already there keeps its text |
| the name of the group of blank values | the next time the rows are grouped: a filter, a sort, `setData()` ... |

So `setTexts()` goes before the datasources and grids are made. To switch the language of a page
that is shown:

```ts
import { setTexts, type Texts } from '@simple-html/grid';

declare const swedish: Texts;

setTexts(swedish);
gridInterface.rebuild(); // every grid of the page
```

## Not texts

- What the config and the data have: the column labels (`columns.<field>.label`, `FieldConfig.label`),
  `placeholderRow` and `placeholderFilter`, the group titles, the values.
- The placeholders of the date formatters, `YYYY-MM-DD` and `DD.MM.YYYY` in an empty date header
  filter: give the column a `placeholderFilter`, or use a formatter of your own with another
  `placeholder` (see [Formatting](08-formatting.md#a-formatter-of-your-own)).
- Symbols and numbers: `✕` closes the filter editor, `✓` marks the dimmed values on, `?` a footer
  chip without a field or operator, `(12)` the count of a value in the
  value list.
- `headerTitle` of a `DateInterface` calendar: your own text.

## All ids

### Row menu

Right click on a cell.

| id | English | shown |
| --- | --- | --- |
| `row.copy` | `Copy:` | section header |
| `row.copy.cell` | `Cell Value` | copies the value of the cell |
| `row.copy.column` | `Column` | copies the column of the selected rows |
| `row.copy.column.hint` | `selected rows` | its hint |
| `row.copy.row` | `Row` | copies the selected rows |
| `row.copy.row.hint` | `selected rows` | its hint |
| `row.copy.selectedColumns` | `Row` | copies the selected columns of the selected rows |
| `row.copy.selectedColumns.hint` | `selected rows/col` | its hint |
| `row.copy.range` | `Range` | copies the last range of cells, see [Selection and clipboard](17-selection-and-clipboard.md) |
| `row.filter` | `Filter:` | section header |
| `row.filter.replace` | `Replace filter` | filters on the value of the cell, replacing the filter |
| `row.filter.replace.hint` | `all` | its hint |
| `row.filter.add` | `Add to filter` | ANDs the value of the cell with the filter |
| `row.filter.add.hint` | `and` | its hint |
| `row.view` | `View:` | section header |
| `row.view.dimRepeatedValues` | `Use dimmed values` | turns `dimRepeatedValues` on and off. A `✓ ` is put in front while it is on |
| `row.view.changedOnly` | `Changed rows only` | turns `datasource.filterChangedOnly()` on and off: the new, edited and deleted rows only. A `✓ ` is put in front while it is on |
| `row.paste` | `Paste:` | section header, an editable cell or ranges of cells |
| `row.paste.cell` | `Paste cell` | pastes into the column of the selected rows |
| `row.paste.cell.hint` | `selected rows` | its hint |
| `row.paste.range` | `Paste range` | pastes the clipboard into the ranges of cells, as Ctrl+V |
| `row.clear` | `Clear:` | section header, an editable cell or ranges of cells |
| `row.clear.cell` | `Clear cell` | empties the column of the selected rows |
| `row.clear.cell.hint` | `selected rows` | its hint |
| `row.clear.range` | `Clear range` | empties the cells of the ranges, as Delete |
| `row.delete` | `Delete:` | section header, an editable grid |
| `row.delete.rows` | `Rows` | marks the selected rows for deletion |
| `row.delete.rows.hint` | `selected rows` | its hint |
| `row.delete.undo` | `Undo` | takes the mark off the selected rows |
| `row.delete.undo.hint` | `selected rows` | its hint |
| `row.edit` | `Edit:` | section header, an editable grid |
| `row.edit.undo` | `Undo last change` | undoes the last step of the undo history |
| `row.edit.undo.hint` | `Ctrl+Z` | its hint, the key |
| `row.edit.redo` | `Redo` | redoes the last step undone |
| `row.edit.redo.hint` | `Ctrl+Y` | its hint, the key |
| `row.edit.revertCell` | `Undo cell edit` | puts the original value of the cell back |
| `row.edit.revertRow` | `Undo row edits` | puts the original values of the row right clicked back |
| `row.edit.revertRows` | `Undo row edits` | puts the original values of the selected rows back |
| `row.edit.revertRows.hint` | `selected rows` | its hint |
| `row.summary` | `Summary:` | section header, a number column |
| `row.summary.count` | `Count: {count}` | `{count}`: the number of selected rows |
| `row.summary.sum` | `Sum: {sum}` | `{sum}`: their sum, formatted |
| `row.summary.max` | `Max: {max}` | `{max}`: the largest value, formatted |
| `row.summary.min` | `Min: {min}` | `{min}`: the smallest value, formatted |
| `row.summary.avg` | `Avg: {avg}` | `{avg}`: the average, formatted |
| `row.size` | `Size:` | section header |
| `row.size.fitColumn` | `Fit column to this cell` | the column as wide as the text of the cell right clicked |
| `row.size.fitRow` | `Fit row height` | the row right clicked as high as its multiline cells need |
| `row.size.fitRows` | `Fit row height` | the selected rows and the rows of the ranges of cells, the same |
| `row.size.fitRows.hint` | `selected rows` | its hint |
| `row.size.fitAllRows` | `Fit all rows` | every row the filter lets through, the same |
| `row.size.resetRow` | `Reset row height` | the row right clicked back to the height of the layout |
| `row.size.resetAllRows` | `Reset all row heights` | every row back to the height of the layout |
| `row.export` | `Export:` | section header |
| `row.export.csv` | `CSV, all rows` | downloads the rows the filter lets through |
| `row.export.csvSelected` | `CSV, selected rows` | downloads the selected rows |

### Header menu

Right click on a header label.

| id | English | shown |
| --- | --- | --- |
| `header.column` | `Column:` | section header |
| `header.column.pinLeft` | `Pin left` | not pinned left |
| `header.column.pinLeftCopy` | `Pin left (copy)` | not pinned left |
| `header.column.pinRight` | `Pin right` | not pinned right |
| `header.column.pinRightCopy` | `Pin right (copy)` | not pinned right |
| `header.column.unpin` | `Unpin` | pinned |
| `header.column.hide` | `Hide` | takes the column out of the layout |
| `header.column.removeSorting` | `Remove sorting` | keeps the sort of the grouped fields |
| `header.column.chooser` | `Column chooser` | opens the column chooser |
| `header.size` | `Size:` | section header |
| `header.size.column` | `Fit column width` | fits the column to its content and its label |
| `header.size.all` | `Fit all columns` | fits every column |
| `header.size.resetColumn` | `Reset column width` | the column back to the width of the config |
| `header.size.resetAll` | `Reset all column widths` | every column back to the width of the config |
| `header.grouping` | `Grouping:` | section header |
| `header.grouping.expandAll` | `Expand all` | expands every group |
| `header.grouping.collapseAll` | `Collapse all` | collapses every group |
| `header.grouping.clear` | `Clear all` | removes the grouping |

### Filter menu

Right click on a header filter.

| id | English | shown |
| --- | --- | --- |
| `filter.filter` | `Filter:` | section header |
| `filter.filter.clear` | `Clear Filter` | removes the column's conditions |
| `filter.filter.clearAll` | `Clear All Filters` | removes the whole filter |
| `filter.filter.isBlank` | `Set "Is Blank"` | replaces the column's conditions with `IS_BLANK` |
| `filter.filter.isNotBlank` | `Set "Is Not Blank"` | replaces the column's conditions with `IS_NOT_BLANK` |
| `filter.filter.advanced` | `Advanced Filter` | opens the filter editor |
| `filter.operator` | `Set Operator:` | section header, not a boolean field |
| `filter.operator.greaterThanOrEqualTo` | `Greater than or equal` | a number or date field |
| `filter.operator.lessThanOrEqualTo` | `Less than or equal` | a number or date field |
| `filter.operator.equal` | `Equal` | not a boolean field |
| `filter.operator.notEqualTo` | `Not Equal` | a text field |
| `filter.operator.contains` | `Contains` | a text field |

### The value list

The part of the filter menu with a checkbox per value, for a text field.

| id | English | shown |
| --- | --- | --- |
| `filter.values.search` | `Search:` | section header |
| `filter.values.searchPlaceholder` | `type to search` | the placeholder of the search box |
| `filter.values.availableOnly` | `Filter Available` | the checkbox that lists only the values the other filters let through |
| `filter.values.rowsFound` | `{count} rows found` | `{count}`: the number of values listed |
| `filter.values.truncated` | `Showing only first {max} !` | `{max}`: the most values listed (100), when there are more |
| `filter.values.selectAll` | `Select All` | the checkbox that checks every value |
| `filter.values.blank` | `Blank` | the value of the empty cells |
| `filter.values.run` | `Run Search` | the button that filters on the checked values |

### Column chooser

| id | English | shown |
| --- | --- | --- |
| `columnChooser.title` | `All Fields:` | section header |
| `columnChooser.search` | `search` | the placeholder of the search box |
| `columnChooser.close` | `Close` | the button that closes it |

### Filter editor

| id | English | shown |
| --- | --- | --- |
| `filterEditor.title` | `Filter Editor` | the title |
| `filterEditor.title.tooltip` | `Drag to move the dialog` | tooltip of the title |
| `filterEditor.close.tooltip` | `Close without filtering` | tooltip of the `✕` in the title bar |
| `filterEditor.operatorAnd` | `AND` | the button of an AND group |
| `filterEditor.operatorAnd.tooltip` | `All conditions in this group must match. Click for OR` | its tooltip |
| `filterEditor.operatorOr` | `OR` | the button of an OR group |
| `filterEditor.operatorOr.tooltip` | `Any condition in this group may match. Click for AND` | its tooltip |
| `filterEditor.wrapGroup.tooltip` | `Wrap everything in this group inside a new parent group` | tooltip of an icon of a group |
| `filterEditor.addSubGroup.tooltip` | `Add a sub group inside this group` | tooltip of an icon of a group |
| `filterEditor.addCondition.tooltip` | `Add a condition to this group` | tooltip of an icon of a group |
| `filterEditor.deleteGroup.tooltip` | `Delete this group and everything in it` | tooltip of the trash icon of a sub group |
| `filterEditor.clearAll.tooltip` | `Clear all conditions` | tooltip of the trash icon of the top group |
| `filterEditor.label.field` | `Query Field:` | label over the field of a condition |
| `filterEditor.label.operator` | `Operator:` | label over the operator |
| `filterEditor.label.value` | `Filter value:` | label over the value |
| `filterEditor.pickAttribute` | `Click me to select field` | a condition without a field |
| `filterEditor.pickAttribute.tooltip` | `Pick which column this condition looks at` | its tooltip |
| `filterEditor.pickOperator` | `Click me to select Operator` | a condition without an operator |
| `filterEditor.pickOperator.tooltip` | `Pick how the value is compared, for example equal or greater than` | its tooltip |
| `filterEditor.pickValueAttribute` | `Click me to select attribute` | compared with a field that is not picked yet |
| `filterEditor.pickValueAttribute.tooltip` | `Pick which column to compare against` | its tooltip |
| `filterEditor.deleteCondition.tooltip` | `Delete this condition` | tooltip of the trash icon of a condition |
| `filterEditor.useValue.tooltip` | `Compare against a typed in value instead of another column` | tooltip of the icon that switches to a value |
| `filterEditor.useAttribute.tooltip` | `Compare against another column instead of a typed in value` | tooltip of the icon that switches to another field |
| `filterEditor.filterAndClose` | `Filter & Close` | button |
| `filterEditor.filterAndClose.tooltip` | `Apply this filter to the grid and close the dialog` | its tooltip |
| `filterEditor.filterOnly` | `Filter Only` | button |
| `filterEditor.filterOnly.tooltip` | `Apply this filter to the grid but keep the dialog open, so you can keep adjusting it` | its tooltip |
| `filterEditor.closeButton` | `Close` | button |
| `filterEditor.closeButton.tooltip` | `Close the dialog and leave the current filter as it is` | its tooltip |
| `filterEditor.fieldMenu` | `Available Fields:` | section header of the menu of fields |
| `filterEditor.fieldMenu.search` | `search` | the placeholder of its search box |
| `filterEditor.operatorMenu` | `Operator:` | section header of the menu of operators |

The names of the operators, in the operator menu and on a condition:

| id | English |
| --- | --- |
| `filterEditor.operator.EQUAL` | `Equal` |
| `filterEditor.operator.LESS_THAN_OR_EQUAL_TO` | `Less Than Or Equal To` |
| `filterEditor.operator.GREATER_THAN_OR_EQUAL_TO` | `Greater Than Or Equal To` |
| `filterEditor.operator.LESS_THAN` | `Less Than` |
| `filterEditor.operator.GREATER_THAN` | `Greater Than` |
| `filterEditor.operator.CONTAINS` | `Contains` |
| `filterEditor.operator.NOT_EQUAL_TO` | `Not Equal To` |
| `filterEditor.operator.DOES_NOT_CONTAIN` | `Does Not Contain` |
| `filterEditor.operator.BEGIN_WITH` | `Begin With` |
| `filterEditor.operator.END_WITH` | `End With` |
| `filterEditor.operator.IN` | `In` |
| `filterEditor.operator.NOT_IN` | `Not In` |
| `filterEditor.operator.IS_BLANK` | `Is Blank` |
| `filterEditor.operator.IS_NOT_BLANK` | `Is Not Blank` |

### Footer

| id | English | shown |
| --- | --- | --- |
| `footer.rowCount` | `{shown}/{total}` | `{shown}`: the rows shown, `{total}`: the rows there are |
| `footer.clear` | `✕ Clear` | the button that removes the filter |
| `footer.clear.tooltip` | `Clear filter` | its tooltip (`title`) |
| `footer.filter.tooltip` | `Edit filter` | tooltip (`title`) of the chips, a click opens the filter editor |
| `footer.collapsed.one` | `{count} filter — click to edit` | `{count}`: the chips do not fit, one condition |
| `footer.collapsed.other` | `{count} filters — click to edit` | `{count}`: the chips do not fit, or there are more than 5 conditions |
| `footer.and` | `AND` | between the chips of an AND group |
| `footer.or` | `OR` | between the chips of an OR group |
| `footer.changedOnly` | `Changed rows only` | the chip in front of the filter's while only the changed rows are shown (`datasource.filterChangedOnly()`) |

The short names of the operators, on a chip:

| id | English |
| --- | --- |
| `footer.operator.EQUAL` | `=` |
| `footer.operator.LESS_THAN_OR_EQUAL_TO` | `≤` |
| `footer.operator.GREATER_THAN_OR_EQUAL_TO` | `≥` |
| `footer.operator.LESS_THAN` | `<` |
| `footer.operator.GREATER_THAN` | `>` |
| `footer.operator.CONTAINS` | `contains` |
| `footer.operator.NOT_EQUAL_TO` | `≠` |
| `footer.operator.DOES_NOT_CONTAIN` | `does not contain` |
| `footer.operator.BEGIN_WITH` | `starts with` |
| `footer.operator.END_WITH` | `ends with` |
| `footer.operator.IN` | `in` |
| `footer.operator.NOT_IN` | `not in` |
| `footer.operator.IS_BLANK` | `is blank` |
| `footer.operator.IS_NOT_BLANK` | `is not blank` |

### Aggregates

The aggregates of the columns (`ColumnConfig.aggregate`), see [Aggregates](18-aggregates.md). A
screen reader reads the label with the value, the column's header with them.

| id | English | shown |
| --- | --- | --- |
| `aggregate.sum` | `Sum` | in front of a sum, in a group row and the totals row: `Sum 1234.5` |
| `aggregate.avg` | `Avg` | in front of an average |
| `aggregate.min` | `Min` | in front of the smallest value |
| `aggregate.max` | `Max` | in front of the largest value |
| `aggregate.count` | `Count` | in front of a count |
| `aggregate.total` | `Total` | the label of the totals row, at its left under the row numbers |

### Header filters

What an empty header filter shows, when its column has no `placeholderFilter` of its own. A date
filter shows its formatter's format (`YYYY-MM-DD`), a boolean filter is a checkbox.

| id | English | shown |
| --- | --- | --- |
| `filter.placeholder.text` | `Text` | an empty header filter of a text field |
| `filter.placeholder.number` | `Number` | an empty header filter of a number field |

### Screen readers

Labels (`aria-label`) that are read out, not shown. The [keyboard and accessibility
guide](14-accessibility.md) has what a screen reader gets.

| id | English | shown |
| --- | --- | --- |
| `grid.label` | `Grid` | the name of the grid. Give each grid its own in its config: `texts: { 'grid.label': 'Orders' }` |
| `grid.rowSelector` | `row selector` | the column header of the row numbers, the top left corner |
| `grid.filter` | `Filter {label}` | a header filter. `{label}`: the column's label |
| `grid.groupToggle` | `{name} ({total})` | the expand/collapse button of a group row, which also says whether it is expanded. `{name}`: the group's name, `Country: Norway`; `{total}`: its number of rows. The row shows `{name} ({total})` |
| `grid.removeGroup` | `Remove the grouping on {title}` | the x on a group chip in the panel above the grid. `{title}`: the title of the grouping |

### Row state and edited cells

The state of a row on its row number (`GridConfig.rowStatus`) and the marker of an edited cell
(`GridConfig.editedMarker`), see [Editing](05-editing.md#showing-the-row-state). The state is the
tooltip's first line and the text a screen reader reads with the row number.

| id | English | shown |
| --- | --- | --- |
| `rowStatus.new` | `New row` | a new row: the tooltip of its row number, and for a screen reader |
| `rowStatus.edited` | `Edited` | an edited row |
| `rowStatus.deleted` | `Marked for deletion` | a row marked for deletion |
| `rowStatus.error` | `Error: {errors}` | a row with an error, for a screen reader (the tooltip has the errors, a line each). `{errors}`: the server's error and the fields' errors, `Age: Must be at least 18`, joined with `, ` |
| `cell.editedMarker.tooltip` | `Original value: {value}` | the tooltip of the marker of an edited cell. `{value}`: the value before the edit, shown with the field's formatter |
| `cell.editedMarker.blank` | `(blank)` | the `{value}` of an original value that is blank |
| `cell.editedMarker.revert` | `Click to revert` | the tooltip's last line, in an editable grid: a click on the marker puts the original value back |

### Multiline cells

A cell of several lines (`FieldConfig.multiline`, or a value with a line break) and the editor that
opens over it, see [Editing](05-editing.md#multiline-text).

| id | English | shown |
| --- | --- | --- |
| `cell.multiline.more` | `More lines, Enter shows all` | for a screen reader: the description of a cell that shows the first of its lines. Hidden on screen, the cell has a marker |
| `cell.multiline.moreLines` | `… {count} more lines` | the last line of the cell's tooltip when its text has more lines than the tooltip shows (`multilineTooltipLines`). `{count}`: how many are not shown, 2 or more - one line more is shown instead |
| `cell.multiline.hint` | `Ctrl+Enter to save, Esc to cancel` | under the textarea of the editor. Cmd+Enter saves too |
| `cell.multiline.hintReadonly` | `Esc to close` | under the textarea of the editor of a readonly cell |

### Date picker

Of a date cell and a date header filter, and a `DateInterface` of your own.

| id | English | shown |
| --- | --- | --- |
| `datePicker.hours` | `HH` | label over the hours |
| `datePicker.minutes` | `MM` | label over the minutes |
| `datePicker.week` | `W` | header of the week numbers |
| `datePicker.clear` | `Clear` | button, empties the date |
| `datePicker.now` | `Now` | button, goes to now |
| `datePicker.use` | `Use` | button, picks the date |

| id | English |
| --- | --- |
| `datePicker.month.january` | `January` |
| `datePicker.month.february` | `February` |
| `datePicker.month.march` | `March` |
| `datePicker.month.april` | `April` |
| `datePicker.month.may` | `May` |
| `datePicker.month.june` | `June` |
| `datePicker.month.july` | `July` |
| `datePicker.month.august` | `August` |
| `datePicker.month.september` | `September` |
| `datePicker.month.october` | `October` |
| `datePicker.month.november` | `November` |
| `datePicker.month.december` | `December` |
| `datePicker.day.sunday` | `Su` |
| `datePicker.day.monday` | `Mo` |
| `datePicker.day.tuesday` | `Tu` |
| `datePicker.day.wednesday` | `We` |
| `datePicker.day.thursday` | `Th` |
| `datePicker.day.friday` | `Fr` |
| `datePicker.day.saturday` | `Sa` |

### Validation messages

Made by the datasource: `setTexts()` only. `{value}` is the rule's `value`, and every option of the
rule can be in a message by its name.

| id | English | rule |
| --- | --- | --- |
| `validation.required` | `Required` | `required` |
| `validation.min` | `Must be at least {value}` | `min`, `{value}` is the rule's value |
| `validation.max` | `Must be at most {value}` | `max` |
| `validation.minLength` | `Must be at least {value} characters` | `minLength` |
| `validation.maxLength` | `Must be at most {value} characters` | `maxLength` |
| `validation.pattern` | `Not in the expected format` | `pattern` |

### getFilterString()

Made by the datasource: `setTexts()` only. The whole string is upper cased:
`'filterString.operator.EQUAL': 'equal_to'` is shown as `<<EQUAL_TO>>`.

| id | English | shown |
| --- | --- | --- |
| `filterString.and` | `AND` | joins the conditions of an AND group |
| `filterString.or` | `OR` | joins the conditions of an OR group |

| id | English |
| --- | --- |
| `filterString.operator.EQUAL` | `equal_to` |
| `filterString.operator.LESS_THAN_OR_EQUAL_TO` | `less_or_equal` |
| `filterString.operator.GREATER_THAN_OR_EQUAL_TO` | `greater_than_or_equal` |
| `filterString.operator.LESS_THAN` | `less_than` |
| `filterString.operator.GREATER_THAN` | `greater_than` |
| `filterString.operator.CONTAINS` | `contains` |
| `filterString.operator.NOT_EQUAL_TO` | `not_equal_to` |
| `filterString.operator.DOES_NOT_CONTAIN` | `does_not_contain` |
| `filterString.operator.BEGIN_WITH` | `start_with` |
| `filterString.operator.END_WITH` | `end_with` |
| `filterString.operator.IN` | `IN` |
| `filterString.operator.NOT_IN` | `NOT_IN` |
| `filterString.operator.IS_BLANK` | `IS_BLANK` |
| `filterString.operator.IS_NOT_BLANK` | `IS_NOT_BLANK` |

### Grouping

Made by the datasource: `setTexts()` only.

| id | English | shown |
| --- | --- | --- |
| `grouping.blank` | `blank` | in `'Country: blank'`, the name of the group of the empty values |

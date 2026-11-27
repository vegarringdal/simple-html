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
    'row.copy': 'Kopier',
    'footer.summary.count': 'Antall: {count}',
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

setTexts({ 'row.copy': 'Kopier', 'row.paste': 'Lim inn' }); // every grid of the page

const config: GridConfig = {
    layout: { center: [{ fields: ['name'], width: 150 }] },
    texts: { 'row.copy': 'Copy' } // this grid: Copy and Lim inn
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

A text with `{name}` in it gets a value when it is shown: `'footer.summary.count': 'Count: {count}'`
shows `Count: 3`. The tables [below](#all-ids) name the values of each text. Keep the names in a
translation, a value can go anywhere in the text; a name the text has no value for is shown as it is.

```ts
import { setTexts } from '@simple-html/grid';

setTexts({ 'footer.summary.count': '{count} celler', 'footer.rowCount': 'Viser {shown} av {total}' });
```

## The ids

The ids are grouped by area, the area first. Within an area:

- **A menu entry's text has the entry's id**, see [Menus](10-menus.md#the-built-in-ids): the text of the
  entry `row.copy.cell` is `row.copy.cell`, the label of the submenu `row.copy` is `row.copy`. The
  text in parentheses after an entry, its hint, is `<id>.hint`. The separators and the blocks - the
  value list (`filter.values`) and the range block (`filter.range`) - have no text of their own, the
  parts of the value list are `filter.values.*`, those of the range block `filter.range.*`.
- **A tooltip is `<id>.tooltip`**: `filterEditor.filterOnly` is the button, `filterEditor.filterOnly.tooltip`
  its tooltip. A tooltip of an icon has no text without `.tooltip`.
- **An operator has a name in each place it is shown**, the `FilterOperator` at the end:
  `filterEditor.operator.EQUAL` in the filter editor, `footer.operator.EQUAL` on a chip in the footer
  (symbols, so a chip stays short) and `filterString.operator.EQUAL` in `getFilterString()`. AND and OR
  as well: `filterEditor.operatorAnd`, `footer.and`, `filterString.and`. The filter menu's operators
  are menu entries: `filter.operator.equal`.
- **A text that names a key has a text for a Mac, `<id>.mac`**: `row.edit.undo.hint` is `Ctrl+Z`,
  `row.edit.undo.hint.mac` is `⌘Z`. The grid shows the `.mac` one on a Mac - and an iPad or iPhone -
  from the platform the browser gives (`navigator.userAgentData.platform`, else `navigator.platform`).
  The grid takes both keys everywhere (Ctrl+Z and Cmd+Z), the texts say what a user there presses.
  Translate both: a `.mac` text left out shows its English default on a Mac. They are
  `row.edit.undo.hint`, `row.edit.redo.hint`, `find.previous.tooltip`, `find.matchCase.tooltip`,
  `cell.multiline.hint`, `filterEditor.undo.tooltip`, `filterEditor.redo.tooltip`,
  `header.shortcuts.hint`, `shortcuts.hint` and the modifiers of the keyboard shortcuts help,
  `shortcuts.key.ctrl`, `shortcuts.key.alt` and `shortcuts.key.shift`.

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
| the grid: header, rows, footer, the find bar | after its next rebuild. `updateConfig({ texts })` rebuilds, after `setTexts()` call `gridInterface.rebuild()` |
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
- The hints of Format › in the header menu: examples of each format, made from today's date and from
  1234567.891 - in the language of `format.locale`.
- Symbols and numbers: `✕` closes the filter editor and the find bar, `↑` and `↓` of the find bar,
  `✓` marks a menu item that is on (an aggregate, the dimmed values, the operator in use), `›` an item
  that opens a submenu, `?` a footer chip without a field or operator, `(12)` the count of a value in
  the value list.
- `headerTitle` of a `DateInterface` calendar: your own text.

## All ids

### Row menu

Right click on a cell or a row number.

| id | English | shown |
| --- | --- | --- |
| `row.copy` | `Copy` | the copy submenu |
| `row.copy.cell` | `Cell Value` | copies the value of the cell |
| `row.copy.column` | `Column` | copies the column of the selected rows |
| `row.copy.column.hint` | `selected rows` | its hint |
| `row.copy.row` | `Row` | copies the selected rows |
| `row.copy.row.hint` | `selected rows` | its hint |
| `row.copy.selectedColumns` | `Row` | copies the selected columns of the selected rows |
| `row.copy.selectedColumns.hint` | `selected rows/col` | its hint |
| `row.copy.range` | `Range` | copies the last range of cells, see [Selection and clipboard](17-selection-and-clipboard.md) |
| `row.filter` | `Filter` | the filter submenu |
| `row.filter.replace` | `Replace filter` | filters on the value of the cell, replacing the filter |
| `row.filter.replace.hint` | `all` | its hint |
| `row.filter.add` | `Add to filter` | ANDs the value of the cell with the filter |
| `row.filter.add.hint` | `and` | its hint |
| `row.view` | `View` | the view submenu |
| `row.view.dimRepeatedValues` | `Use dimmed values` | turns `dimRepeatedValues` on and off, with a ✓ in front while it is on |
| `row.view.changedOnly` | `Changed rows only` | turns `datasource.filterChangedOnly()` on and off: the new, edited and deleted rows only. A ✓ in front while it is on |
| `row.paste` | `Paste` | the paste submenu, an editable grid |
| `row.paste.current` | `Paste cell` | pastes into the cell right clicked |
| `row.paste.cell` | `Paste cell` | pastes into the column of the selected rows |
| `row.paste.cell.hint` | `selected rows` | its hint |
| `row.paste.range` | `Paste range` | pastes the clipboard into the ranges of cells, as Ctrl+V |
| `row.paste.fillDown` | `Fill down` | fills down, as Ctrl+D |
| `row.paste.fillDown.hint` | `Ctrl+D` | its hint, the key |
| `row.paste.fillDown.hint.mac` | `⌘D` | its hint on a Mac |
| `row.paste.newRows` | `As new rows…` | opens the import dialog with the rows on the clipboard (`GridConfig.importMenu`), see [Import dialog](#import-dialog) |
| `row.clear` | `Clear` | the clear submenu, an editable grid |
| `row.clear.current` | `Clear cell` | empties the cell right clicked |
| `row.clear.cell` | `Clear cell` | empties the column of the selected rows |
| `row.clear.cell.hint` | `selected rows` | its hint |
| `row.clear.range` | `Clear range` | empties the cells of the ranges, as Delete |
| `row.delete` | `Delete` | the delete submenu, an editable grid |
| `row.delete.row` | `Row` | marks the row right clicked for deletion |
| `row.delete.rows` | `Rows` | marks the selected rows for deletion |
| `row.delete.rows.hint` | `selected rows` | its hint |
| `row.delete.undo` | `Undo` | takes the mark off the selected rows |
| `row.delete.undo.hint` | `selected rows` | its hint |
| `row.edit` | `Undo / Redo` | the row menu's submenu of undo, redo and the reverts, in an editable grid |
| `row.edit.undo` | `Undo last change` | undoes the last step of the undo history |
| `row.edit.undo.hint` | `Ctrl+Z` | its hint, the key |
| `row.edit.undo.hint.mac` | `⌘Z` | its hint on a Mac |
| `row.edit.redo` | `Redo` | redoes the last step undone |
| `row.edit.redo.hint` | `Ctrl+Y` | its hint, the key. Ctrl+Shift+Z redoes too |
| `row.edit.redo.hint.mac` | `⇧⌘Z` | its hint on a Mac. ⌘Y redoes too |
| `row.edit.revertCell` | `Undo cell edit` | puts the original value of the cell back |
| `row.edit.revertRow` | `Undo row edits` | puts the original values of the row right clicked back |
| `row.edit.revertRows` | `Undo row edits` | puts the original values of the selected rows back |
| `row.edit.revertRows.hint` | `selected rows` | its hint |
| `row.size` | `Size` | the size submenu |
| `row.size.fitColumn` | `Fit column to this cell` | the column as wide as the text of the cell right clicked |
| `row.size.fitRow` | `Fit row height` | the row right clicked as high as its multiline cells need |
| `row.size.fitRows` | `Fit row height` | the selected rows and the rows of the ranges of cells, the same |
| `row.size.fitRows.hint` | `selected rows` | its hint |
| `row.size.fitAllRows` | `Fit all rows` | every row the filter lets through, the same |
| `row.size.resetRow` | `Reset row height` | the row right clicked back to the height of the layout |
| `row.size.resetAllRows` | `Reset all row heights` | every row back to the height of the layout |
| `row.export` | `Export` | the export submenu |
| `row.export.excel` | `Excel, all rows` | downloads the rows the filter lets through as an .xlsx file |
| `row.export.excelSelected` | `Excel, selected rows` | downloads the selected rows as an .xlsx file |
| `row.select` | `Select` | the select submenu: what Shift and Ctrl do with the mouse, for a finger |
| `row.select.row` | `This row` | the row in or out of the selection, with a ✓ in front while it is selected |
| `row.select.rowsTo` | `Rows from {row} to here` | selects the rows from the anchor to this row, `{row}`: the anchor's row number |
| `row.select.allRows` | `All rows` | selects every row |
| `row.select.rangeTo` | `Range from the active cell to here` | a range of cells from the active cell to this cell, as Shift+click |
| `row.select.addCell` | `Add this cell to the ranges` | a range of this cell added, as Ctrl+click |
| `row.select.clear` | `Clear selection` | no row selected, no range of cells |

### Header menu

Right click on a header label.

| id | English | shown |
| --- | --- | --- |
| `header.column.pin` | `Pin` | the pin submenu |
| `header.column.pinLeft` | `Pin left` | not pinned left |
| `header.column.pinLeftCopy` | `Pin left (copy)` | not pinned left |
| `header.column.pinRight` | `Pin right` | not pinned right |
| `header.column.pinRightCopy` | `Pin right (copy)` | not pinned right |
| `header.column.unpin` | `Unpin` | pinned |
| `header.column.hide` | `Hide column` | takes the column out of the layout |
| `header.column.removeSorting` | `Remove sorting` | keeps the sort of the grouped fields |
| `header.column.chooser` | `Column chooser…` | opens the column chooser |
| `header.size` | `Size` | the size submenu |
| `header.size.column` | `Fit column width` | fits the column to its content and its label |
| `header.size.all` | `Fit all columns` | fits every column |
| `header.size.resetColumn` | `Reset column width` | the column back to the width of the config |
| `header.size.resetAll` | `Reset all column widths` | every column back to the width of the config |
| `header.format` | `Format` | the format submenu: how the column's cells show the value, see [Display formats](08-formatting.md#display-formats) |
| `header.format.default` | `Default` | no display format: the field's formatter |
| `header.format.date.iso` | `ISO` | a date column: `2026-11-22` |
| `header.format.date.norwegian` | `Norwegian` | `22.11.2026` |
| `header.format.date.norwegianShort` | `Norwegian, short year` | `22.11.26` |
| `header.format.date.us` | `US` | `11/22/2026` |
| `header.format.date.uk` | `UK` | `22/11/2026` |
| `header.format.date.medium` | `Short month name` | `Nov 22, 2026`, in the language of `format.locale` |
| `header.format.date.long` | `Month name` | `November 22, 2026` |
| `header.format.date.full` | `Day and month name` | `Sunday, November 22, 2026` |
| `header.format.date.isoTime` | `ISO with time` | a datetime column: `2026-11-22 13:45` |
| `header.format.date.isoSeconds` | `ISO with seconds` | `2026-11-22 13:45:12` |
| `header.format.date.norwegianTime` | `Norwegian with time` | `22.11.2026 13:45` |
| `header.format.date.norwegianSeconds` | `Norwegian with seconds` | `22.11.2026 13:45:12` |
| `header.format.date.time` | `Time` | `13:45` |
| `header.format.date.timeSeconds` | `Time with seconds` | `13:45:12` |
| `header.format.date.weekday` | `Day of week` | `Sunday` |
| `header.format.date.weekIso` | `Week, ISO` | `2026-W47`, written as `format.weekIso` says |
| `header.format.date.weekUs` | `Week, US` | `2026-W48` |
| `header.format.date.month` | `Month` | `2026-11` |
| `header.format.date.quarter` | `Quarter` | `2026 Q4` |
| `header.format.date.year` | `Year` | `2026` |
| `header.format.date.daysUntil` | `Days until` | the days from today: `3`, `-1` |
| `header.format.number.norwegian` | `Norwegian` | a number column: `1 234 567,891` |
| `header.format.number.english` | `English` | `1,234,567.891` |
| `header.format.number.swiss` | `Swiss` | `1'234'567.891` |
| `header.format.number.plain` | `Plain` | `1234567.891` |
| `header.format.decimals` | `Decimals` | the decimals submenu |
| `header.format.decimals.asIs` | `As is` | the decimals the number has |
| `header.format.decimals.0` | `0` | no decimals |
| `header.format.decimals.1` | `1` | one decimal |
| `header.format.decimals.2` | `2` | two decimals |
| `header.format.decimals.3` | `3` | three decimals |
| `header.format.decimals.4` | `4` | four decimals |
| `header.format.thousands` | `Thousands separator` | the thousands separator submenu |
| `header.format.thousands.none` | `None` | no thousands separator |
| `header.format.thousands.space` | `Space` | `1 234` |
| `header.format.thousands.comma` | `Comma` | `1,234` |
| `header.format.thousands.dot` | `Dot` | `1.234` |
| `header.format.thousands.apostrophe` | `Apostrophe` | `1'234` |
| `header.format.decimalMark` | `Decimal mark` | the decimal mark submenu |
| `header.format.decimalMark.dot` | `Dot` | `1.5` |
| `header.format.decimalMark.comma` | `Comma` | `1,5` |
| `header.format.percent` | `Percent` | turns percent on or off: 0.256 is `25.6 %` |
| `header.settings` | `Column settings…` | opens the grid config dialog on the column, see [Grid config dialog](#grid-config-dialog) |
| `header.shortcuts` | `Keyboard shortcuts…` | opens the keyboard shortcuts help, see [Keyboard shortcuts help](#keyboard-shortcuts-help) |
| `header.shortcuts.hint` | `Ctrl+/` | its hint: the key that opens the help anywhere in the grid |
| `header.shortcuts.hint.mac` | `⌘/` | its hint on a Mac |
| `header.import` | `Import rows…` | opens the import dialog (`GridConfig.importMenu`), see [Import dialog](#import-dialog) |
| `header.aggregate` | `Aggregate` | the aggregate submenu |
| `header.aggregate.sum` | `Sum` | turns the column's sum on or off |
| `header.aggregate.avg` | `Average` | turns its average on or off |
| `header.aggregate.min` | `Min` | turns its smallest value on or off |
| `header.aggregate.max` | `Max` | turns its largest value on or off |
| `header.aggregate.count` | `Count` | turns its count on or off |
| `header.aggregate.totalsRow` | `Totals row` | shows or hides the totals row |
| `header.grouping` | `Grouping` | the grouping submenu |
| `header.grouping.expandAll` | `Expand all` | expands every group |
| `header.grouping.collapseAll` | `Collapse all` | collapses every group |
| `header.grouping.clear` | `Clear all` | removes the grouping |

### Filter menu

Right click on a header filter.

| id | English | shown |
| --- | --- | --- |
| `filter.filter` | `Filter` | the filter submenu, first in the menu: the operator, match case, blank, clear and the filter editor |
| `filter.filter.clear` | `Clear Filter` | removes the column's conditions |
| `filter.filter.clearAll` | `Clear All Filters` | removes the whole filter |
| `filter.filter.blank` | `Blank` | the blank submenu, in the filter submenu |
| `filter.filter.isBlank` | `Is blank` | replaces the column's conditions with `IS_BLANK` |
| `filter.filter.isNotBlank` | `Is not blank` | replaces the column's conditions with `IS_NOT_BLANK` |
| `filter.filter.advanced` | `Advanced Filter…` | opens the filter editor |
| `filter.operator` | `Operator` | the operator submenu, in the filter submenu, not a boolean field. The column's operators (`filterOperators`). Also the name of the row of operators of the range block |
| `filter.operator.equal` | `Equal` | not a boolean field |
| `filter.operator.notEqualTo` | `Not Equal` | not a boolean field |
| `filter.operator.lessThan` | `Less than` | a number or date field |
| `filter.operator.lessThanOrEqualTo` | `Less than or equal` | a number or date field |
| `filter.operator.greaterThan` | `Greater than` | a number or date field |
| `filter.operator.greaterThanOrEqualTo` | `Greater than or equal` | a number or date field |
| `filter.operator.between` | `Between` | a number or date field, typed as `from..to` |
| `filter.operator.contains` | `Contains` | a text field |
| `filter.operator.doesNotContain` | `Does not contain` | a text field |
| `filter.operator.beginWith` | `Begins with` | a text field |
| `filter.operator.endWith` | `Ends with` | a text field |
| `filter.matchCase` | `Match case` | the toggle of a text column in the filter submenu, a ✓ while it is on |
| `filter.matchCase.hint` | `always` | its hint, on a column that always matches case (`filterCaseSensitive`, a field's `caseSensitive`) |
| `filter.filterOnType` | `Filter as you type` | the toggle of filter as you type, a ✓ while it is on: in the filter submenu and at the bottom of the operator choice, not a boolean field |

### The value list

The part of the filter menu with a checkbox per value - the text its cells show - for a text field
and a lookup column.

| id | English | shown |
| --- | --- | --- |
| `filter.values.search` | `Search values` | the name of the search box, for a screen reader |
| `filter.values.searchPlaceholder` | `Search values` | the placeholder of the search box |
| `filter.values.availableOnly` | `Only values in filtered rows` | the checkbox that lists only the values the other filters let through |
| `filter.values.textSearch` | `Filter on the text: contains "{text}"` | the checkbox under the search box that filters on the text typed (`CONTAINS`), not the values found; `{text}` is the text |
| `filter.values.rowsFound` | `{count} values` | under the search box, `{count}`: the number of values listed |
| `filter.values.rowsFound.one` | `{count} value` | the same, when one value is listed |
| `filter.values.truncated` | `Only the first {max} values are shown` | instead, `{max}`: the most values listed (100), when there are more |
| `filter.values.selectAll` | `Select all` | the checkbox over the values that checks every value - or none, when every value is checked |
| `filter.values.blank` | `Blank` | the value of the empty cells |
| `filter.values.run` | `Apply` | the button that filters on the checked values |
| `filter.values.cancel` | `Cancel` | the button that closes the menu without filtering |

### The range block

The part of the filter menu of a number, date or datetime column with its operators as buttons and
an input - From and To for Between. The buttons show the symbols `=`, `≠`, `<`, `≤`, `>`, `≥` - no
texts - and the text `filter.operator.between`. Each is named by the text of its entry in Operator ›
(`filter.operator.equal` ...), for a screen reader and as its tooltip; the row of them by
`filter.operator`. An empty input shows the placeholder of an empty header filter: the date format, or
`filter.placeholder.number`.

| id | English | shown |
| --- | --- | --- |
| `filter.range.value` | `Value` | the name of the input, for a screen reader |
| `filter.range.from` | `From` | the label of the first input, with Between |
| `filter.range.to` | `To` | the label of the second input, with Between |
| `filter.range.run` | `Apply` | the button that filters, as typing in the header filter |
| `filter.range.cancel` | `Cancel` | the button that closes the menu without filtering |

### The quick dates

The part of the filter menu of a date or datetime column under the range block: a button for each
quick date (`ColumnConfig.datePresets`). A quick date's name is shown on its button, in the header
filter cell while it filters - typed there, it is that quick date - and on the footer's chip
(`Order date = This month`). The tooltip of a button is its days, written as the field shows a date:
`{from}` and `{to}`, the day alone when they are one.

| id | English | shown |
| --- | --- | --- |
| `filter.dates` | `Quick dates` | the name of the buttons together, for a screen reader |
| `filter.dates.today` | `Today` | today |
| `filter.dates.yesterday` | `Yesterday` | yesterday |
| `filter.dates.thisWeek` | `This week` | the week of today, from the date picker's first day of the week (Monday) |
| `filter.dates.lastWeek` | `Last week` | the week before |
| `filter.dates.thisMonth` | `This month` | this month |
| `filter.dates.lastMonth` | `Last month` | the month before |
| `filter.dates.thisQuarter` | `This quarter` | this quarter |
| `filter.dates.lastQuarter` | `Last quarter` | the quarter before |
| `filter.dates.thisYear` | `This year` | this year |
| `filter.dates.lastYear` | `Last year` | last year |
| `filter.dates.last7Days` | `Last 7 days` | today and the 6 days before |
| `filter.dates.last30Days` | `Last 30 days` | today and the 29 days before |
| `filter.dates.next7Days` | `Next 7 days` | today and the 6 days after |
| `filter.dates.overdue` | `Overdue` | every day before today - only on a column that lists it in `datePresets` |
| `filter.dates.range` | `{from} – {to}` | the tooltip of a button: its first and last day (a datetime's first and last second) |
| `filter.dates.before` | `Before {date}` | the tooltip of Overdue, `{date}` today |

### Column menu

Right click on a column number, the row of numbers under the header filters.

| id | English | shown |
| --- | --- | --- |
| `column.copy.column` | `Copy column` | copies the column right clicked, every displayed row |
| `column.copy.column.hint` | `all rows` | its hint |
| `column.copy.selectedColumns` | `Copy selected columns` | copies the selected columns, every displayed row |
| `column.copy.selectedColumns.hint` | `all rows` | its hint |
| `column.copy.headers` | `Copy header names` | copies the label of every column |
| `column.copy.header` | `Copy header name` | copies the label of the column right clicked |
| `column.copy.selectedHeaders` | `Copy selected header names` | copies the labels of the selected columns |
| `column.select` | `Select` | the select submenu: what Shift and Ctrl do on a column number, for a finger |
| `column.select.column` | `This column` | the column in or out of the selection, with a ✓ in front while it is selected |
| `column.select.columnsTo` | `Columns from {column} to here` | selects the columns from the anchor to this one, `{column}`: the anchor's number |
| `column.select.all` | `All columns` | selects every column |
| `column.select.clear` | `Clear column selection` | selects no column |

### Column chooser

`{label}` is the column's label, as the list shows it - in `columnChooser.label` the column's own label
(what an empty input gives it).

| id | English | shown |
| --- | --- | --- |
| `columnChooser.title` | `All Fields:` | section header |
| `columnChooser.search` | `Search` | the placeholder of the search box, its name for a screen reader |
| `columnChooser.close` | `Close` | the button that closes it |
| `columnChooser.drag` | `Drag it into the header to add the column` | the tooltip of a field's drag handle |
| `columnChooser.rename` | `Rename {label}` | the ✎ of a field: its name and tooltip |
| `columnChooser.label` | `Label of {label}` | the input the ✎ opens: its name for a screen reader |
| `columnChooser.label.hint` | `Enter saves, Esc cancels. Empty: the column has its own label` | its tooltip |

### Filter editor

| id | English | shown |
| --- | --- | --- |
| `filterEditor.title` | `Filter Editor` | the title |
| `filterEditor.title.tooltip` | `Drag to move the dialog` | tooltip of the title |
| `filterEditor.close.tooltip` | `Close without filtering` | tooltip and name of the `✕` in the title bar |
| `filterEditor.operatorAnd` | `AND` | the button that makes a group AND, filled while it is |
| `filterEditor.operatorAnd.tooltip` | `All conditions in this group must match` | its tooltip |
| `filterEditor.operatorOr` | `OR` | the button that makes a group OR, filled while it is |
| `filterEditor.operatorOr.tooltip` | `Any condition in this group may match` | its tooltip |
| `filterEditor.wrapGroup.tooltip` | `Wrap everything in this group inside a new parent group` | tooltip and name of the bracket icon of a group |
| `filterEditor.addSubGroup` | `+ Group` | the button of a group that adds a sub group |
| `filterEditor.addSubGroup.tooltip` | `Add a sub group inside this group` | its tooltip |
| `filterEditor.addCondition` | `+ Condition` | the button of a group that adds a condition |
| `filterEditor.addCondition.tooltip` | `Add a condition to this group` | its tooltip |
| `filterEditor.deleteGroup.tooltip` | `Delete this group and everything in it` | tooltip and name of the trash icon of a sub group |
| `filterEditor.clearAll.tooltip` | `Clear all conditions` | tooltip and name of the trash icon of the top group |
| `filterEditor.empty` | `No conditions: every row is shown` | in the top group while it has nothing in it |
| `filterEditor.label.field` | `Field` | the name of the field picker of a condition, for a screen reader: `Field: Country` |
| `filterEditor.label.operator` | `Operator` | the name of the operator picker |
| `filterEditor.label.value` | `Value` | the name and the placeholder of the value input, the name of the column picker that replaces it |
| `filterEditor.label.from` | `From` | the name and the placeholder of the first value input of a `BETWEEN` |
| `filterEditor.label.to` | `To` | of its second value input |
| `filterEditor.pickAttribute` | `Field` | in the field picker of a condition without a field |
| `filterEditor.pickAttribute.tooltip` | `Pick which column this condition looks at` | its tooltip |
| `filterEditor.pickOperator` | `Operator` | in the operator picker of a condition without an operator |
| `filterEditor.pickOperator.tooltip` | `Pick how the value is compared, for example equal or greater than` | its tooltip |
| `filterEditor.pickValueAttribute` | `Column` | in the column picker, compared with a field that is not picked yet |
| `filterEditor.pickValueAttribute.tooltip` | `Pick which column to compare against` | its tooltip |
| `filterEditor.deleteCondition.tooltip` | `Delete this condition` | tooltip and name of the trash icon of a condition |
| `filterEditor.useValue.tooltip` | `Compare against a typed in value instead of another column` | tooltip and name of the icon that switches to a value |
| `filterEditor.useAttribute.tooltip` | `Compare against another column instead of a typed in value` | tooltip and name of the icon that switches to another field |
| `filterEditor.matchCase` | `Aa` | the toggle of a condition on a text field, filled while the condition matches case |
| `filterEditor.matchCase.tooltip` | `Match case` | its tooltip and name |
| `filterEditor.matchCaseAlways.tooltip` | `Match case: always, for this column` | its tooltip and name on a column that always matches case (`filterCaseSensitive`, a field's `caseSensitive`): on, greyed out |
| `filterEditor.undo` | `Undo` | the name of the undo icon in the footer: takes the last edit back |
| `filterEditor.undo.tooltip` | `Undo (Ctrl+Z)` | its tooltip, with the key |
| `filterEditor.undo.tooltip.mac` | `Undo (⌘Z)` | its tooltip on a Mac |
| `filterEditor.redo` | `Redo` | the name of the redo icon: does the edit undone again |
| `filterEditor.redo.tooltip` | `Redo (Ctrl+Y)` | its tooltip, with the key. Ctrl+Shift+Z redoes too |
| `filterEditor.redo.tooltip.mac` | `Redo (⇧⌘Z)` | its tooltip on a Mac. ⌘Y redoes too |
| `filterEditor.filterAndClose` | `Apply & close` | button, the primary one |
| `filterEditor.filterAndClose.tooltip` | `Apply this filter to the grid and close the dialog` | its tooltip |
| `filterEditor.filterOnly` | `Apply` | button |
| `filterEditor.filterOnly.tooltip` | `Apply this filter to the grid but keep the dialog open, so you can keep adjusting it` | its tooltip |
| `filterEditor.closeButton` | `Cancel` | button |
| `filterEditor.closeButton.tooltip` | `Close the dialog and leave the current filter as it is` | its tooltip |
| `filterEditor.fieldMenu` | `Available Fields:` | section header of the menu of fields |
| `filterEditor.fieldMenu.search` | `Search fields` | the placeholder and the name of its search box |
| `filterEditor.operatorMenu` | `Operator:` | section header of the menu of operators |

The names of the operators, in the operator menu and on a condition:

| id | English |
| --- | --- |
| `filterEditor.operator.EQUAL` | `Equal` |
| `filterEditor.operator.LESS_THAN_OR_EQUAL_TO` | `Less Than Or Equal To` |
| `filterEditor.operator.GREATER_THAN_OR_EQUAL_TO` | `Greater Than Or Equal To` |
| `filterEditor.operator.LESS_THAN` | `Less Than` |
| `filterEditor.operator.GREATER_THAN` | `Greater Than` |
| `filterEditor.operator.BETWEEN` | `Between` |
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
| `footer.noFilter` | `No filter` | the button in Clear's place while the rows are not filtered: a click opens the filter editor |
| `footer.noFilter.tooltip` | `Open the filter editor` | its tooltip (`title`) |
| `footer.filter.tooltip` | `Edit filter` | tooltip (`title`) of the chips, a click opens the filter editor |
| `footer.collapsed.one` | `{count} filter — click to edit` | `{count}`: the chips do not fit, one condition |
| `footer.collapsed.other` | `{count} filters — click to edit` | `{count}`: the chips do not fit, or there are more than 5 conditions |
| `footer.and` | `AND` | between the chips of an AND group |
| `footer.or` | `OR` | between the chips of an OR group |
| `footer.changedOnly` | `Changed rows only` | the chip in front of the filter's while only the changed rows are shown (`datasource.filterChangedOnly()`) |
| `footer.betweenAnd` | `and` | between the two values of a `BETWEEN` chip: `Age between 10 and 20` |
| `footer.matchCase` | `Aa` | the marker after the value of a condition that matches case |
| `footer.matchCase.tooltip` | `Match case` | its tooltip (`title`) |
| `footer.findFilter` | `Find: {text}` | the chip while Find's *Filter rows* hides rows. `{text}`: the text the rows are filtered with |
| `footer.summary` | `Selected cells` | the name of the summary of the selected cells at the footer's right, for a screen reader |
| `footer.summary.count` | `Count: {count}` | the cells of the ranges with a value, any type |
| `footer.summary.sum` | `Sum: {sum}` | the sum of the numbers of the number fields in the ranges |
| `footer.summary.avg` | `Average: {avg}` | their average |
| `footer.summary.min` | `Min: {min}` | the smallest |
| `footer.summary.max` | `Max: {max}` | the largest |
| `footer.settings` | `Grid config` | the name and tooltip (`title`) of the gear at the footer's right end (`GridConfig.settingsButton`): it opens the grid config dialog |

The short names of the operators, on a chip:

| id | English |
| --- | --- |
| `footer.operator.EQUAL` | `=` |
| `footer.operator.LESS_THAN_OR_EQUAL_TO` | `≤` |
| `footer.operator.GREATER_THAN_OR_EQUAL_TO` | `≥` |
| `footer.operator.LESS_THAN` | `<` |
| `footer.operator.GREATER_THAN` | `>` |
| `footer.operator.BETWEEN` | `between` |
| `footer.operator.CONTAINS` | `contains` |
| `footer.operator.NOT_EQUAL_TO` | `≠` |
| `footer.operator.DOES_NOT_CONTAIN` | `does not contain` |
| `footer.operator.BEGIN_WITH` | `starts with` |
| `footer.operator.END_WITH` | `ends with` |
| `footer.operator.IN` | `in` |
| `footer.operator.NOT_IN` | `not in` |
| `footer.operator.IS_BLANK` | `is blank` |
| `footer.operator.IS_NOT_BLANK` | `is not blank` |

### Views

The named views (`GridConfig.views`): the views button at the footer's left end, its menu, and the
name asked for by *Save as new view…* and *Rename…*, see [Views](03-state.md#views).

| id | English | shown |
| --- | --- | --- |
| `views.standard` | `Standard` | the name of no view: the config's state - on the button, and first in the menu |
| `views.button` | `View: {name}` | the name (`aria-label`) and tooltip of the button, `{name}`: the view shown |
| `views.button.modified` | `View: {name} (changed)` | the same while the state changed since the view was applied or saved: the `*` after the name on the button |
| `views.default.hint` | `default` | the hint after the view the grid starts in (`GridView.default`), Standard when no view is |
| `views.shared.hint` | `shared` | the hint after a readonly view (`GridView.readonly`) |
| `views.save` | `Save` | saves the state over the view shown |
| `views.saveAs` | `Save as new view…` | saves the state as a new view, asks for its name |
| `views.revert` | `Revert changes` | applies the view shown again: what changed since is taken back |
| `views.rename` | `Rename…` | asks for another name for the view shown |
| `views.delete` | `Delete` | deletes the view shown |
| `views.setDefault` | `Default view` | a toggle with a ✓: the view shown is the one the grid starts in |
| `views.name` | `Name of the view` | the label of the input of the name |
| `views.name.empty` | `Give the view a name` | under the input while it is empty, or only spaces |
| `views.name.taken` | `Another view has this name` | under the input while another view has the name (in any case) |
| `views.name.cancel` | `Cancel` | closes it, nothing saved |
| `views.name.save` | `Save` | saves the new view (*Save as new view…*) |
| `views.name.rename` | `Rename` | gives the view the name (*Rename…*) |

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

### Display formats

The display formats of the columns (`ColumnConfig.format`, Format › in the header menu), see
[Display formats](08-formatting.md#display-formats). `format.locale` is not shown: it is the language
of the names in a date - the months and the days of `medium`, `long`, `full` and `weekday` - a BCP 47
language tag for `Intl.DateTimeFormat`. `'nb-NO'` shows `søndag 22. november 2026`. A tag Intl does
not take (`'nb_NO'`) shows English. The others write a week and a quarter: `{week}` has two digits.

| id | English | shown |
| --- | --- | --- |
| `format.locale` | `en-US` | not shown: the language of the names, `nb-NO` for Norwegian |
| `format.weekIso` | `{year}-W{week}` | a week, ISO: `2026-W47`. Norwegian, say: `uke {week} {year}` |
| `format.weekUs` | `{year}-W{week}` | a week, US: `2026-W48` |
| `format.quarter` | `{year} Q{quarter}` | a quarter: `2026 Q4`. Norwegian, say: `{quarter}. kvartal {year}` |

### Grid config dialog

The grid config dialog: the gear in the footer, *Column settings…* in the header menu,
`gridInterface.openColumnSettings()` and `openDetailFormSettings()` - see
[The grid config dialog](08-formatting.md#the-grid-config-dialog). Its Columns tab, then its Detail form
tab.
Its format picker shows the texts of Format › (`header.format.*`). The placeholders and the hints of
the templates show a template as it is written: their `{value}`, `{field}`, `{id}` are not filled in,
keep the braces - `{value}` is the cell's own value in a template, keep it as it is. In the problems
`{field}` is filled in: the placeholder as it was written, `{firstnme}`, or the label of a column.

| id | English | shown |
| --- | --- | --- |
| `columnSettings.title` | `Grid config` | the title of the dialog, its name for a screen reader, and the name of its tabs |
| `columnSettings.title.tooltip` | `Drag to move the dialog` | the title's tooltip |
| `columnSettings.close.tooltip` | `Close without applying` | the ✕: its name and tooltip |
| `columnSettings.columns` | `Columns` | the name of the list of the columns, for a screen reader |
| `columnSettings.insertFunction` | `Insert a function` | the ƒ beside a formula: a menu of the functions |
| `formula.functions.logic` | `Logic` | a submenu of the function menu |
| `formula.functions.numbers` | `Numbers` | a submenu of the function menu |
| `formula.functions.dates` | `Dates` | a submenu of the function menu |
| `formula.functions.text` | `Text` | a submenu of the function menu |
| `formula.function.IF` | `IF(condition, a, b)` | the function in the menu, as it is written |
| `formula.function.IF.tooltip` | `a when the condition is true, else b - a and b of one type` | what it does: the entry's tooltip |
| `formula.function.COALESCE` | `COALESCE(a, b, …)` | the function in the menu, as it is written |
| `formula.function.COALESCE.tooltip` | `the first value that is not blank: COALESCE(x, 0) is 0 for a blank x` | what it does: the entry's tooltip |
| `formula.function.ISBLANK` | `ISBLANK(x)` | the function in the menu, as it is written |
| `formula.function.ISBLANK.tooltip` | `true when x is blank` | what it does: the entry's tooltip |
| `formula.function.ROUND` | `ROUND(x, n)` | the function in the menu, as it is written |
| `formula.function.ROUND.tooltip` | `x rounded to n decimals, halves away from 0 - a negative n rounds to tens, hundreds` | what it does: the entry's tooltip |
| `formula.function.ABS` | `ABS(x)` | the function in the menu, as it is written |
| `formula.function.ABS.tooltip` | `x without its sign` | what it does: the entry's tooltip |
| `formula.function.MIN` | `MIN(a, b, …)` | the function in the menu, as it is written |
| `formula.function.MIN.tooltip` | `the least of numbers or dates, a blank skipped` | what it does: the entry's tooltip |
| `formula.function.MAX` | `MAX(a, b, …)` | the function in the menu, as it is written |
| `formula.function.MAX.tooltip` | `the greatest of numbers or dates, a blank skipped` | what it does: the entry's tooltip |
| `formula.function.TODAY` | `TODAY()` | the function in the menu, as it is written |
| `formula.function.TODAY.tooltip` | `today, at 00:00` | what it does: the entry's tooltip |
| `formula.function.DAYS` | `DAYS(from, to)` | the function in the menu, as it is written |
| `formula.function.DAYS.tooltip` | `the days from one date to another: negative when to is before` | what it does: the entry's tooltip |
| `formula.function.YEAR` | `YEAR(date)` | the function in the menu, as it is written |
| `formula.function.YEAR.tooltip` | `the year of a date` | what it does: the entry's tooltip |
| `formula.function.MONTH` | `MONTH(date)` | the function in the menu, as it is written |
| `formula.function.MONTH.tooltip` | `the month of a date, 1 to 12` | what it does: the entry's tooltip |
| `formula.function.CONCAT` | `CONCAT(a, b, …)` | the function in the menu, as it is written |
| `formula.function.CONCAT.tooltip` | `the values as one text, as & joins them` | what it does: the entry's tooltip |
| `formula.function.LEFT` | `LEFT(text, n)` | the function in the menu, as it is written |
| `formula.function.LEFT.tooltip` | `the first n characters` | what it does: the entry's tooltip |
| `formula.function.RIGHT` | `RIGHT(text, n)` | the function in the menu, as it is written |
| `formula.function.RIGHT.tooltip` | `the last n characters` | what it does: the entry's tooltip |
| `formula.function.MID` | `MID(text, start, n)` | the function in the menu, as it is written |
| `formula.function.MID.tooltip` | `n characters from the start-th, the first is 1` | what it does: the entry's tooltip |
| `formula.function.SUBSTRING` | `SUBSTRING(text, start, n)` | the function in the menu, as it is written |
| `formula.function.SUBSTRING.tooltip` | `the same as MID: n characters from the start-th` | what it does: the entry's tooltip |
| `formula.function.LEN` | `LEN(text)` | the function in the menu, as it is written |
| `formula.function.LEN.tooltip` | `how many characters - 0 for a blank` | what it does: the entry's tooltip |
| `formula.function.UPPER` | `UPPER(text)` | the function in the menu, as it is written |
| `formula.function.UPPER.tooltip` | `the text in upper case` | what it does: the entry's tooltip |
| `formula.function.LOWER` | `LOWER(text)` | the function in the menu, as it is written |
| `formula.function.LOWER.tooltip` | `the text in lower case` | what it does: the entry's tooltip |
| `formula.function.TRIM` | `TRIM(text)` | the function in the menu, as it is written |
| `formula.function.TRIM.tooltip` | `the text without the spaces around it` | what it does: the entry's tooltip |
| `formula.function.CONTAINS` | `CONTAINS(text, part)` | the function in the menu, as it is written |
| `formula.function.CONTAINS.tooltip` | `true when the text has the part, in any case` | what it does: the entry's tooltip |
| `columnSettings.back` | `‹ Columns` | back to the list of the columns, where they take turns with a column's settings: a narrow dialog (a phone) |
| `columnSettings.type.text` | `Text` | the type of a text column, in the list and over its settings |
| `columnSettings.type.number` | `Number` | a number column |
| `columnSettings.type.boolean` | `Checkbox` | a boolean column |
| `columnSettings.type.date` | `Date` | a date column |
| `columnSettings.type.datetime` | `Date and time` | a datetime column |
| `columnSettings.type.lookup` | `Lookup` | a lookup column (`ColumnConfig.editor`) |
| `columnSettings.badge.format` | `Format` | in the list: the column has a date or number format |
| `columnSettings.badge.text` | `Text` | the column has a template of its text |
| `columnSettings.badge.link` | `Link` | the column is a link |
| `columnSettings.badge.problem` | `Error` | a template or a checkbox value of the column has a problem: Apply waits for it |
| `columnSettings.badge.multiline` | `Multiline` | in the list of the columns: a text column made multiline |
| `columnSettings.badge.readonly` | `Read only` | in the list of the columns: a column made read only |
| `columnSettings.multiline` | `Multiline` | the checkbox of a text column: its cells are text of several lines (`ColumnFormat.multiline`) |
| `columnSettings.minRows` | `Min lines in the detail form` | under Multiline while it is on: `DetailForm.fieldOptions[field].minRows` |
| `columnSettings.minRows.hint` | `1 to 30, the least lines of its box in the detail form - empty: 3` | under it |
| `columnSettings.readonly` | `Read only` | the checkbox of every column: its cells are not edited, also in an editable grid (`ColumnFormat.readonly`) |
| `columnSettings.validation` | `Validation` | the heading of the column's validation rules, read only - only a column whose field has rules (`FieldConfig.validate`, `ColumnConfig.validate`). A rule is its own `message`, else the built-in's message (`validation.*`), else its id |
| `columnSettings.validation.hint` | `Set by the application: checked on every edit, not changed here` | under them |
| `columnSettings.validation.pattern` | `Must match {value}` | a `pattern` rule without a message: `{value}` is its regular expression |
| `columnSettings.validation.unique` | `Unique` | a `unique` rule |
| `columnSettings.validation.uniqueWith` | `Unique together with {with}` | a `unique` rule with `with`: the labels of the columns |
| `columnSettings.validation.ignoreCase` | `{rule}, in any case` | a `unique` rule with `ignoreCase`: `{rule}` is one of the two above |
| `columnSettings.badge.checkbox` | `Checkbox` | the column is shown as checkboxes |
| `columnSettings.badge.numberOverride` | `Blank / 0` | the column shows a blank as 0, or 0 as blank (or neither, over its `numberOverride`) |
| `columnSettings.badge.label` | `Label` | the column has a label of the user's |
| `columnSettings.badge.placeholder` | `Placeholder` | the column's empty cells have a placeholder of the user's |
| `columnSettings.badge.rules` | `Colours` | the column has colour rules |
| `columnSettings.label` | `Label` | the label of the input of the column's label, every column: empty is the column's own, the input shows it |
| `columnSettings.format` | `Format` | the label of the format picker of a date or number column |
| `columnSettings.format.tooltip` | `How the cells show the value` | its tooltip |
| `columnSettings.format.ofType` | `Default: {format}` | the format picker of a column without a format of its own whose type has one (the Defaults tab): `{format}` the type's format |
| `columnSettings.filterAsShown` | `Filter as shown` | the checkbox under the format of a date or number column: the header filter takes the text as the cells show it |
| `columnSettings.filterAsShown.template.hint` | `The filters compare the text the cells show, the template filled in - off: the value of the field` | under Filter as shown of a text column with a template |
| `columnSettings.filterAsShown.hint` | `The header filter takes the text as the cells show it: a week, a month, a year is the whole of it` | under it |
| `columnSettings.filterAsShown.off` | `Not for the day of the week or the time of day: the header filter takes the field's format` | under it instead, greyed out: a format that is no period of time |
| `columnSettings.text` | `Text shown` | the label of a text column's template of its text |
| `columnSettings.text.placeholder` | `{firstname} {lastname}` | its placeholder, a template as it is written |
| `columnSettings.text.hint` | `Empty: the cell's own text. {value} is the cell's value, {field} the value of another field` | under it |
| `columnSettings.link` | `Show as link` | the checkbox that makes the column a link |
| `columnSettings.url` | `Address` | the label of the address |
| `columnSettings.url.placeholder` | `https://example.com/customer/{id}` | its placeholder |
| `columnSettings.url.hint` | `Starts with https://, http://, mailto: or tel: - or is one {field} that holds the whole address` | under it |
| `columnSettings.newTab` | `Open in a new tab` | the checkbox of `newTab` |
| `columnSettings.insertField` | `Insert a field` | the `{ }` button beside a template: its name and tooltip |
| `columnSettings.none.boolean` | `A checkbox column has no format` | the settings of a boolean column, under its label |
| `columnSettings.none.lookup` | `A lookup column shows the label of its value: it has no format` | the settings of a lookup column |
| `columnSettings.blankToZero` | `Show blank as 0` | the checkbox of a number column: a blank cell shows `0` |
| `columnSettings.zeroToBlank` | `Show 0 as blank` | a number column: 0 shows as an empty cell |
| `columnSettings.checkbox` | `Show as checkbox` | a text or number column: its cells are checkboxes |
| `columnSettings.checked` | `Checked value` | the label of the value of a checked cell |
| `columnSettings.unchecked` | `Unchecked value` | the label of the value written when a cell is unchecked |
| `columnSettings.checkbox.hint` | `A click writes the other value. An empty unchecked value empties the cell` | under the two values: a cell is checked when its value is the checked value |
| `columnSettings.placeholder` | `Placeholder` | the label of the placeholder of the column's empty cells, every column but a checkbox: empty is the column's own (`placeholderRow`), the input shows it |
| `columnSettings.placeholderLabel` | `Use the column label` | the checkbox: the placeholder of the empty cells is the column's label |
| `columnSettings.operator` | `Filter operator` | the label of the operator picker, every column but a checkbox |
| `columnSettings.operator.tooltip` | `The operator the header filter of the column uses` | its tooltip |
| `columnSettings.operator.hint` | `Default: {operator}` | under it: the operator the column starts with, its name |
| `columnSettings.filterOnType` | `Filter as you type` | the checkbox after the operator, every column but a checkbox |
| `columnSettings.filterOnType.hint` | `After a short pause, no Enter needed` | under it |
| `columnSettings.matchCase` | `Match case` | the dialog's checkbox of a text column's header filter |
| `columnSettings.matchCase.hint` | `Ann does not find ANN - the header shows Aa beside the operator` | under it |
| `columnSettings.matchCase.always` | `Always for this column: filterCaseSensitive in its config` | under it when the column always matches case |
| `columnSettings.matchCase.locked` | `Always for this column: set by the application` | under it when the field's case is locked (`FieldConfig.caseSensitive`) |
| `columnSettings.rules` | `Colour rules` | the heading of the column's colour rules, every column, and their name for a screen reader. A rule's operator picker has the header filter's names of the operators (`filter.operator.*`, `filter.filter.isBlank`, `filter.filter.isNotBlank`), its label and the value inputs the filter editor's (`filterEditor.label.*`) |
| `columnSettings.rules.hint` | `The first rule that matches colours the cell. The value is compared as the header filter compares it` | under it |
| `columnSettings.rules.empty` | `No rules` | a column without rules |
| `columnSettings.rules.add` | `Add rule` | the button that adds a rule at the end |
| `columnSettings.rules.rule` | `Rule {number}` | the name of a rule for a screen reader, `{number}` its place: 1 is the first |
| `columnSettings.rules.checked` | `Checked` | the value of a rule of a boolean column: a checkbox |
| `columnSettings.rules.date.compare` | `Compare with` | a rule on a date: the picker of what it compares with, its name |
| `columnSettings.rules.date.typed` | `A date or period typed` | in it: the value typed - else a quick date (`filter.dates.*`) |
| `columnSettings.rules.date.placeholder` | `Date, 2026-W47, 2026-11, 2026 Q4, 2026` | the placeholder of a date rule's value |
| `columnSettings.rules.week` | `Weeks` | the picker of the weeks of a rule on a date (`week`), its name |
| `columnSettings.rules.week.column` | `As the column: {week}` | no `week`: the column's - `{week}` the name of the one it takes |
| `columnSettings.rules.week.iso` | `ISO - Monday` | `week: 'iso'` |
| `columnSettings.rules.week.us` | `US - Sunday` | `week: 'us'` |
| `columnSettings.rules.textColor` | `Text colour` | the label of a rule's text colours, a row of swatches |
| `columnSettings.rules.background` | `Background` | the label of its backgrounds |
| `columnSettings.rules.bold` | `Bold` | the checkbox: the text is bold |
| `columnSettings.rules.none` | `None` | the first swatch: no text colour, no background - the name and tooltip |
| `columnSettings.rules.color.red` | `Red` | a swatch of the palette: its name and tooltip |
| `columnSettings.rules.color.orange` | `Orange` | |
| `columnSettings.rules.color.amber` | `Amber` | |
| `columnSettings.rules.color.yellow` | `Yellow` | |
| `columnSettings.rules.color.lime` | `Lime` | |
| `columnSettings.rules.color.green` | `Green` | |
| `columnSettings.rules.color.teal` | `Teal` | |
| `columnSettings.rules.color.cyan` | `Cyan` | |
| `columnSettings.rules.color.blue` | `Blue` | |
| `columnSettings.rules.color.indigo` | `Indigo` | |
| `columnSettings.rules.color.purple` | `Purple` | |
| `columnSettings.rules.color.pink` | `Pink` | |
| `columnSettings.rules.color.brown` | `Brown` | |
| `columnSettings.rules.color.grey` | `Grey` | |
| `columnSettings.rules.custom` | `Custom colour` | the colour picker after the swatches, a custom colour (`#rrggbb`): its name and tooltip |
| `columnSettings.rules.contrast.rows` | `The text colour has {ratio}:1 to the light rows, under 4.5:1: hard to read` | a custom text colour that is hard to read on the light rows, `{ratio}` its contrast (`3.2`). Apply is not held back |
| `columnSettings.rules.contrast.background` | `The text colour has {ratio}:1 to the background, under 4.5:1: hard to read` | the same on the rule's custom background |
| `columnSettings.rules.kind` | `Condition` | the label of the kind of a rule's condition, three radio buttons |
| `columnSettings.rules.kind.value` | `Value` | the kind: the cell's value, an operator and a value |
| `columnSettings.rules.kind.conditions` | `Conditions` | the kind: conditions on fields of the row |
| `columnSettings.rules.kind.formula` | `Formula` | the kind: a formula that is true or false - also the name of its input |
| `columnSettings.rules.combine.AND` | `All of them` | the picker over two conditions or more: all must be true (`combine: 'AND'`) |
| `columnSettings.rules.combine.OR` | `Any of them` | one is enough (`combine: 'OR'`) |
| `columnSettings.rules.combine.tooltip` | `Whether all the conditions must be true, or one of them` | its tooltip |
| `columnSettings.rules.condition` | `Condition {number}` | the name of a condition for a screen reader, `{number}` its place: 1 is the first |
| `columnSettings.rules.condition.field` | `Field` | the picker of a condition's field: its tooltip, and its name before the field |
| `columnSettings.rules.condition.add` | `Add condition` | the button under the conditions |
| `columnSettings.rules.condition.remove` | `Remove condition` | the ✕ of a condition |
| `columnSettings.rules.formula.placeholder` | `{balance} < 0 AND {status} = "late"` | the placeholder of a rule's formula, a formula as it is written |
| `columnSettings.rules.formula.true` | `True in this row: the rule colours the cell` | under the formula: what it is in the row of the preview |
| `columnSettings.rules.formula.false` | `False in this row` | |
| `columnSettings.rules.problem.conditions` | `Add a condition` | a rule of the kind Conditions without one |
| `columnSettings.rules.problem.expression` | `Write the formula, true or false` | a rule of the kind Formula without a formula |
| `columnSettings.rules.moveUp` | `Move up` | the button that moves a rule before the one above it: its name and tooltip |
| `columnSettings.rules.moveDown` | `Move down` | after the one under it |
| `columnSettings.rules.remove` | `Remove rule` | the ✕ of a rule |
| `columnSettings.colours.rules` | `{count} rules` | the line of the Colour rules panel of a number column: how many it has |
| `columnSettings.colours.oneRule` | `1 rule` | the line of the Colour rules panel with one rule |
| `columnSettings.colours.on` | `On` | the line of the Data bar, Colour scale or Icons panel: it is set |
| `columnSettings.colours.off` | `Off` | the line of the Data bar, Colour scale or Icons panel: it is not set |
| `columnSettings.rules.open` | `Edit the rule` | the tooltip of a closed rule's line: a click opens it |
| `columnSettings.rules.close` | `Close the rule` | the ▾ of the open rule: one line again |
| `columnSettings.rules.sample` | `Abc` | the sample in a closed rule's colours |
| `columnSettings.rules.unchecked` | `Not checked` | a closed rule on a checkbox column whose box is not checked |
| `columnSettings.rules.problem.value` | `Write the value to compare with` | a rule's operator compares, its value is empty (a Between: both) |
| `columnSettings.rules.problem.style` | `Pick a text colour, a background or bold` | a rule that colours nothing |
| `columnSettings.rules.unread` | `The column does not read {value}: the rule colours no cell` | `{value}`: a value the field's formatter does not read - a date of another format. Apply is not held back |
| `columnSettings.bars` | `Data bars, scales, icons` | the heading of a number column's data bar, colour scale and icon set, and their name for a screen reader. The swatches have the names of the rules' colours (`columnSettings.rules.color.*`) |
| `columnSettings.bars.hint` | `By the value's place among the numbers of the rows the filter lets through. A colour rule's background wins over a scale` | under it |
| `columnSettings.bars.bar` | `Data bar` | the checkbox that turns the bar on, and the name of its group |
| `columnSettings.bars.color` | `Colour` | the label of the bar's swatches |
| `columnSettings.bars.min` | `Min` | the label of the low end's number, of the bar and of the scale |
| `columnSettings.bars.mid` | `Midpoint` | the scale's midpoint |
| `columnSettings.bars.max` | `Max` | the high end's |
| `columnSettings.bars.automatic` | `Automatic` | the placeholder of an empty Min, Midpoint, Max: from the rows |
| `columnSettings.bars.scale` | `Colour scale` | the checkbox that turns the scale on, and the name of its group |
| `columnSettings.bars.minColor` | `Lowest` | the label of the swatches of the lowest value's colour |
| `columnSettings.bars.midColor` | `Middle` | the midpoint's colour, *None* for two colours |
| `columnSettings.bars.maxColor` | `Highest` | the highest value's |
| `columnSettings.bars.icons` | `Icons` | the checkbox that turns the icons on, and the name of their group |
| `columnSettings.bars.set` | `Icon set` | the label of the choice of the icons |
| `columnSettings.bars.set.arrows` | `Arrows` | the names of the sets: their radio buttons' names and tooltips, the buttons show the icons |
| `columnSettings.bars.set.traffic` | `Traffic lights` | |
| `columnSettings.bars.set.flags` | `Flags` | |
| `columnSettings.bars.set.symbols` | `Symbols` | |
| `columnSettings.bars.thresholdMiddle` | `Middle from` | the first threshold: from it the middle icon |
| `columnSettings.bars.thresholdHigh` | `High from` | the second: from it the high icon |
| `columnSettings.bars.unit` | `Thresholds` | the label of the choice of what the thresholds are |
| `columnSettings.bars.unit.percent` | `% of the range` | percent of the range from the smallest number of the rows to the largest |
| `columnSettings.bars.unit.number` | `Values` | values of the column |
| `columnSettings.bars.position` | `Icon` | the label of the choice of where the icon is |
| `columnSettings.bars.position.before` | `Before the value` | at the cell's left |
| `columnSettings.bars.position.after` | `After the value` | at its right |
| `columnSettings.bars.reverse` | `Reverse: the low values get the high icon` | the checkbox of `reverse` |
| `columnSettings.bars.samples` | `Lowest to highest of the rows, {min} to {max}` | the title of the five cells of the preview, `{min}` and `{max}` as the cells show them |
| `columnSettings.bars.noNumbers` | `No numbers in the rows: nothing to draw yet` | in place of them, when no row has a number |
| `columnSettings.bars.problem.notNumber` | `{value} is no number` | a Min, Max, Midpoint or threshold typed that is no number - `.` or `,` is the decimal mark, no thousands separator. Apply waits |
| `columnSettings.bars.problem.minMax` | `The min is not below the max` | a bar's or a scale's |
| `columnSettings.bars.problem.mid` | `The midpoint is not between the min and the max` | |
| `columnSettings.bars.problem.thresholds` | `The first threshold is above the second` | |
| `columnSettings.bars.problem.percent` | `In % of the range the thresholds are 0 to 100` | |
| `columnSettings.badge.bar` | `Bar` | in the list of the columns: the column has a data bar |
| `columnSettings.badge.scale` | `Scale` | a colour scale |
| `columnSettings.badge.icons` | `Icons` | an icon set |
| `columnSettings.calculated` | `Calculated column` | the heading of a calculated column's settings, at the top of its settings |
| `columnSettings.calculated.add` | `Add calculated column` | the button under the list of the columns |
| `columnSettings.calculated.add.tooltip` | `A column computed from the other fields of the row` | its tooltip |
| `columnSettings.calculated.defaultLabel` | `Calculated {number}` | the label of a calculated column added, `{number}` the one of its field `calc_<number>` |
| `columnSettings.calculated.name` | `Field name` | the label of its field name - an input while it is new, its name after |
| `columnSettings.calculated.name.hint` | `A letter, then letters, digits, _ and #. Not changed once applied` | under the input |
| `columnSettings.calculated.formula` | `Formula` | the label of its formula |
| `columnSettings.calculated.formula.placeholder` | `{price} * {qty}` | its placeholder, a formula as it is written |
| `columnSettings.calculated.formula.hint` | `Fields in braces, numbers, "text", + - * / &, = <> != < <= > >=, AND OR NOT, IF ROUND ABS MIN MAX TODAY DAYS YEAR MONTH CONCAT COALESCE ISBLANK LEFT RIGHT MID SUBSTRING LEN UPPER LOWER TRIM CONTAINS` | under it: the language. The keywords and the names of the functions are the language's, keep them |
| `columnSettings.calculated.gives` | `Gives: {type}` | the type of its values, `{type}` the name of a type (`columnSettings.type.*`) |
| `columnSettings.calculated.value` | `In this row: {value}` | its value in the row of the preview |
| `columnSettings.calculated.blank` | `(blank)` | the value when it is blank |
| `columnSettings.calculated.applyFirst` | `Apply first: then the format and the colour rules of a {type} column` | a calculated column new, or of another type now: its other settings after Apply |
| `columnSettings.calculated.remove` | `Remove calculated column` | the button: it leaves the draft, and on Apply the layout |
| `columnSettings.calculated.problem.name` | `The field name is a letter, then letters, digits, _ and # - 64 at most` | a field name typed that a calculated column can not have |
| `columnSettings.calculated.problem.taken` | `The field name is a field already: give the column a name of its own` | the name typed is a field of the datasource, of the rows or of another column |
| `columnSettings.badge.calculated` | `Calculated` | in the list of the columns: a calculated column |
| `columnSettings.formula.type.number` | `a number` | the name of a type in a problem of a formula (`{got}`, `{expected}`, `{type}`) |
| `columnSettings.formula.type.text` | `a text` | |
| `columnSettings.formula.type.date` | `a date` | |
| `columnSettings.formula.type.boolean` | `true / false` | |
| `columnSettings.formula.problem.empty` | `Write the formula` | the problems of a formula - of a calculated column and of a rule of the kind Formula |
| `columnSettings.formula.problem.length` | `The formula is longer than {max} characters` | over the limit, 1000 |
| `columnSettings.formula.problem.depth` | `The formula nests deeper than {max} levels` | brackets, functions, a minus or NOT in front, 32 |
| `columnSettings.formula.problem.size` | `The formula has more than {max} parts` | 500 |
| `columnSettings.formula.problem.character` | `{text} at {position} is no part of a formula` | a character no part of the language: `$`, `;`. `{position}`: the character, 1 the first |
| `columnSettings.formula.problem.bigNumber` | `The number at {position} is too large` | a number of more digits than a number holds, over 1.8 × 10³⁰⁸ |
| `columnSettings.formula.problem.unexpected` | `{text} at {position} can not be there` | `1 2`, a `)` too many |
| `columnSettings.formula.problem.end` | `The formula ends too soon` | `1 +`, `ROUND(1` |
| `columnSettings.formula.problem.text` | `The text at {position} has no closing quote` | |
| `columnSettings.formula.problem.field` | `The field at {position} has no closing brace` | a `{` without its `}`, and `{}` |
| `columnSettings.formula.problem.function` | `{name} is no function: {names}` | `{names}`: the functions of the language |
| `columnSettings.formula.problem.arguments` | `{name} has {count} values: it is written {usage}` | `{usage}`: how it is written, `ROUND(x, n)` |
| `columnSettings.formula.problem.name` | `{name} at {position} is no function - a field is written in braces` | a word that is no keyword and has no `(` after it |
| `columnSettings.formula.problem.internal` | `{field} is the grid's own, not a field` | `{field}`: a field that starts with `__` |
| `columnSettings.formula.problem.unknownField` | `No field {field}` | a field that is no column, no field of the datasource, no calculated column |
| `columnSettings.formula.problem.cycle` | `{field} is computed from itself` | a calculated column read by its own formula, straight or through another |
| `columnSettings.formula.problem.fieldProblem` | `{field} has a problem of its own` | a calculated column read whose formula has a problem |
| `columnSettings.formula.problem.clobField` | `{field} is a long text: a formula can not read it` | a field with `clobType` (`FieldConfig.clobType`), filtered with LIKE only |
| `columnSettings.formula.problem.number` | `{what} takes a number: {part} is {got}` | `{what}`: an operator or a function, `{part}`: the part as written, `{got}`: its type |
| `columnSettings.formula.problem.date` | `{what} takes a date: {part} is {got}` | |
| `columnSettings.formula.problem.boolean` | `{what} takes true / false: {part} is {got}` | |
| `columnSettings.formula.problem.same` | `{what} takes values of one type: {part} is {got}, {other} is {expected}` | `=`, IF, COALESCE ... on two types |
| `columnSettings.formula.problem.order` | `{what} compares numbers, texts and dates, not true / false` | `<` on true / false |
| `columnSettings.formula.problem.chain` | `Compare two values at a time ({position}): a < b AND b < c` | `a < b < c` |
| `columnSettings.formula.problem.digits` | `ROUND takes a whole number of digits from -10 to 10, not {part}` | |
| `columnSettings.formula.problem.result` | `The formula gives {got}, it must give {expected}` | a rule's formula that is not true / false, a column's `type` that is not its formula's |
| `columnSettings.formula.problem.divide` | `Divides by 0 in this row: no value` | the preview: the formula in the row of the preview. The cell is empty |
| `columnSettings.formula.problem.value` | `{field} is not {type} in this row: no value` | a value that is not of its field's type, a text in a number field |
| `columnSettings.formula.problem.overflow` | `A number too big in this row: no value` | |
| `columnSettings.formula.problem.long` | `A text of more than {max} characters in this row: no value` | `&`, CONCAT: 10000 at most |
| `columnSettings.preview.current` | `Preview, the current row` | the title of the preview of the current row |
| `columnSettings.preview.first` | `Preview, the first row` | of the first row, without a current row |
| `columnSettings.preview.none` | `No rows to preview` | without rows |
| `columnSettings.problem.urlEmpty` | `Write the address` | Show as link is on, the address is empty |
| `columnSettings.problem.urlStart` | `Start the address with https://, http://, mailto: or tel: - or give one field alone` | the address does not start with its scheme |
| `columnSettings.problem.protocol` | `Not a link the grid opens: only https:, http:, mailto: and tel:` | the address, or the one a field holds, has another scheme: `javascript:`, `data:` ... |
| `columnSettings.problem.internal` | `{field} is the grid's own, not a field` | `{field}`: a placeholder that starts with `__` |
| `columnSettings.problem.unknownField` | `No field {field} in this row` | `{field}`: a placeholder that is no column, no field and not in the row of the preview |
| `columnSettings.problem.blank` | `{field} is empty in this row: no link, the text only` | `{field}`: the label of the column of the address that is empty |
| `columnSettings.problem.invalid` | `No valid address in this row: no link, the text only` | what the row fills in is no address |
| `columnSettings.problem.checkedEmpty` | `Write the checked value` | the checked value of a column's checkboxes is empty |
| `columnSettings.problem.notNumber` | `{value} is no number: a number column writes numbers` | `{value}`: a checked or unchecked value of a number column, as typed |
| `columnSettings.problem.sameValues` | `The checked and the unchecked value are the same: a click could not uncheck a cell` | the two values are the same |
| `columnSettings.resetColumn` | `Reset column` | the button: the column's settings as the grid starts with them |
| `columnSettings.resetColumn.tooltip` | `The settings the column starts with` | its tooltip |
| `columnSettings.resetAll` | `Reset all` | the button: every column's |
| `columnSettings.resetAll.tooltip` | `The settings every column starts with` | its tooltip |
| `columnSettings.cancel` | `Cancel` | closes the dialog without applying |
| `columnSettings.apply` | `Apply` | sets the formats of the grid's state, the dialog stays open |
| `columnSettings.apply.tooltip` | `Apply to the grid, the dialog stays open` | its tooltip |
| `columnSettings.applyAndClose` | `Apply & close` | applies and closes |
| `columnSettings.tab.columns` | `Columns` | the tab of the columns' settings |
| `columnSettings.tab.detailForm` | `Detail form` | the tab of the detail form |
| `columnSettings.tab.defaults` | `Defaults` | the tab of the settings of the grid: the formats by type, the default view |
| `columnSettings.section.general` | `General` | the tab of a column's label, read only, multiline and placeholder |
| `columnSettings.section.display` | `Display` | the tab of what a column's cells show: format, text, link, checkboxes, blank / 0 |
| `columnSettings.section.filter` | `Header filter` | the tab of a column's header filter operator and filter as you type |
| `columnSettings.section.colours` | `Colours` | the tab of a column's colour rules, data bar, colour scale and icon set |
| `columnSettings.sections` | `Settings of {column}` | the name of a column's tabs, for a screen reader. `{column}`: its label |
| `columnSettings.detailForm.show` | `Show the detail form` | the checkbox that shows it |
| `columnSettings.detailForm.expanded` | `Expanded` | the checkbox that expands it, off: collapsed (`DetailForm.expanded`) |
| `columnSettings.detailForm.expanded.hint` | `Collapsed, the form is a narrow strip: the button of its title expands it, and collapses it again` | under it |
| `columnSettings.detailForm.width` | `Width (px)` | the label of its width |
| `columnSettings.detailForm.minWidth` | `Min width (px)` | the label of its least width (`minWidth`) |
| `columnSettings.detailForm.maxWidth` | `Max width (px)` | the label of its most width (`maxWidth`) |
| `columnSettings.detailForm.maxWidth.none` | `None` | the placeholder of an empty most width |
| `columnSettings.detailForm.width.hint` | `At least 150, between the min and the max width - a drag of the left edge of the form changes it too. Where the rows would get too little room beside it, the form is under them` | under the widths |
| `columnSettings.detailForm.fields` | `Fields of the form` | the name of the list of the fields |
| `columnSettings.detailForm.fields.hint` | `Space puts a field in the form or takes it out, Alt+↑ and Alt+↓ move it - or drag it by its handle` | under the list: its keys |
| `columnSettings.detailForm.fields.hint.mac` | `Space puts a field in the form or takes it out, ⌥↑ and ⌥↓ move it - or drag it by its handle` | the same on a Mac |
| `columnSettings.detailForm.drag` | `Drag to move it` | the tooltip of the drag handle at the right of a field |
| `columnSettings.detailForm.multiline` | `Several lines` | in the list: a field of several lines (`FieldConfig.multiline`) |
| `columnSettings.detailForm.hidden` | `Hidden` | in the list: a column that is not in the layout |
| `columnSettings.detailForm.moveUp` | `Move up` | the button: the field picked one up, in the form too |
| `columnSettings.detailForm.moveDown` | `Move down` | one down |
| `columnSettings.detailForm.field` | `Settings of {field} in the form` | the heading of the settings of the field picked, under the list |
| `columnSettings.detailForm.minRows` | `Min lines` | the least lines of a field of several lines (`minRows`) |
| `columnSettings.detailForm.paddingTop` | `Space above (px)` | room above the field (`paddingTop`) |
| `columnSettings.detailForm.paddingBottom` | `Space below (px)` | room under it (`paddingBottom`) |
| `columnSettings.detailForm.addSection` | `Add section` | the button under the list: a section under the row picked |
| `columnSettings.detailForm.newSection` | `Section` | the name of a section added |
| `columnSettings.detailForm.sectionType` | `Section` | in the list: the type of a section's row |
| `columnSettings.detailForm.panelBadge` | `Panel` | in the list: a section that is a panel |
| `columnSettings.detailForm.sectionSettings` | `Settings of the section {section}` | the heading of the settings of the section picked |
| `columnSettings.detailForm.section` | `Name` | the label of its name |
| `columnSettings.detailForm.section.hint` | `The fields under it in the list, up to the next section, are in it. Its header collapses it` | under it |
| `columnSettings.detailForm.panel` | `Panel: a frame around it` | the checkbox of `panel` |
| `columnSettings.detailForm.open` | `Open at start` | the checkbox of a section's default: off is `collapsed` |
| `columnSettings.detailForm.removeSection` | `Remove section` | the button: the section out of the form, its fields stay |
| `columnSettings.detailForm.reset` | `Reset form` | the button at the footer's left on the Detail form tab: the detail form the grid starts with |
| `columnSettings.detailForm.reset.tooltip` | `The detail form the grid starts with` | its tooltip |
| `columnSettings.defaults.formats` | `Formats by type` | the Defaults tab: the heading over the formats of a date, a datetime and a number column (`GridState.typeFormats`) |
| `columnSettings.defaults.formats.hint` | `A column without a format of its own shows the format of its type` | its hint |
| `columnSettings.defaults.format.tooltip` | `How every column of this type shows its values` | the tooltip of each type's format picker |
| `columnSettings.defaults.views` | `Views` | the heading over the default view |
| `columnSettings.defaults.viewsButton` | `Show the views button` | the Defaults tab: the views button at the footer's left end on or off (`GridConfig.viewsButton`) |
| `columnSettings.defaults.viewsButton.hint` | `At the left end of the footer: save, switch, rename and delete views` | its hint |
| `columnSettings.defaults.defaultView` | `Default view` | the picker of the view the grid opens with: Standard or a view |
| `columnSettings.defaults.defaultView.hint` | `The view the grid opens with` | its hint |
| `columnSettings.defaults.noViews` | `No views saved yet: save one from the views button` | its hint without views, the picker greyed out |
| `columnSettings.defaults.reset` | `Reset formats` | the button at the footer's left on the Defaults tab |
| `columnSettings.defaults.reset.tooltip` | `The formats by type the grid starts with` | its tooltip |

### Detail form

The detail form at the right of the rows (`GridConfig.detailForm`), see
[The detail form](02-grid-config.md#the-detail-form). `{row}` is the number of the row it shows, as the
row numbers show it.

| id | English | shown |
| --- | --- | --- |
| `detailForm.title` | `Details` | its title, its name for a screen reader |
| `detailForm.row` | `Row {row}` | after the title: the row it shows |
| `detailForm.noRow` | `No row` | without a current row, or one the filter hides |
| `detailForm.noFields` | `No fields: pick them with the gear in the footer, tab Detail form` | shown without fields |
| `detailForm.collapse` | `Collapse the details` | the tooltip of the button of its title while it is expanded |
| `detailForm.expand` | `Expand the details` | the same while it is collapsed |
| `detailForm.resize` | `Width of the details` | the splitter of its left edge: its name for a screen reader |

### Import dialog

The import dialog (`gridInterface.openImport()`, the menus' entries with `GridConfig.importMenu`), see
[Import](24-import.md). `{size}`, `{rows}`, `{columns}` and `{cells}` in the error of a file too large are
the limits (`IMPORT_LIMITS`); `{row}` is the row of the file, from 1; `{field}` the label of a column;
`{text}` a value as the file has it.

| id | English | shown |
| --- | --- | --- |
| `import.title` | `Import rows` | its title, its name for a screen reader |
| `import.title.tooltip` | `Drag to move the dialog` | the title's tooltip |
| `import.close.tooltip` | `Close without importing` | the ✕: its tooltip and its name |
| `import.chooseFile` | `Choose file…` | the button that opens the file picker |
| `import.hint` | `Drop a CSV or Excel (.xlsx) file here, or paste rows copied from a spreadsheet` | the drop zone |
| `import.clipboard` | `Pasted rows` | where the rows came from, for pasted rows (a file has its name) |
| `import.reading` | `Reading the file…` | while a file is read |
| `import.error.tooLarge` | `The file is too large to import: at most {size} MB, {rows} rows, {columns} columns and {cells} cells` | a file over a limit |
| `import.error.xls` | `An Excel 97-2003 file (.xls), or one protected by a password, can not be read: save it as .xlsx or CSV` | an .xls file |
| `import.error.broken` | `The file can not be read: it is not CSV or an Excel workbook (.xlsx), or it is damaged` | a file that is neither, or damaged |
| `import.error.unsupported` | `This browser can not read Excel files: save the file as CSV` | an .xlsx file in a browser without `DecompressionStream` |
| `import.error.clipboard` | `No rows on the clipboard: copy them in a spreadsheet, then paste them here` | *As new rows…* without rows on the clipboard, or a clipboard the browser does not give |
| `import.header` | `First row is a header` | the option: the first row names the columns |
| `import.separator` | `Separator` | the option of a CSV file |
| `import.separator.auto` | `Found: {separator}` | the separator found, `{separator}` its name below |
| `import.separator.comma` | `Comma` | a separator |
| `import.separator.semicolon` | `Semicolon` | a separator |
| `import.separator.tab` | `Tab` | a separator |
| `import.sheet` | `Sheet` | the option of a workbook of more sheets |
| `import.decimalMark` | `Decimal mark` | the option when a number field is picked |
| `import.decimalMark.auto` | `As the columns` | each number column's own decimal mark |
| `import.decimalMark.dot` | `Dot: 1,234.5` | a decimal mark |
| `import.decimalMark.comma` | `Comma: 1 234,5` | a decimal mark |
| `import.dateOrder` | `Dates with /` | the option when a date field is picked |
| `import.dateOrder.DMY` | `Day first: 31/12/2026` | an order |
| `import.dateOrder.MDY` | `Month first: 12/31/2026` | an order |
| `import.byName` | `The first row names the columns: they are matched to the fields by name` | over the table, with a header that names fields |
| `import.byPosition` | `The columns are matched to the fields by position, from {field}` | over the table, without |
| `import.column` | `Column {number}` | a column without a header, `{number}` from 1 |
| `import.field` | `Field of {column}` | the name of a column's field picker for a screen reader |
| `import.skip` | `Skip` | the picker's entry for a column not imported |
| `import.count` | `{rows} rows` | the rows to import |
| `import.count.problems` | `{rows} rows, {problems} with problems` | the same, with the rows that have problems |
| `import.problem` | `Row {row}, {field}: {message}` | a problem in the list |
| `import.problems.more` | `{count} more` | after the problems listed |
| `import.problem.number` | `Not a number: {text}` | a value of a number field that is not read |
| `import.problem.date` | `Not a date: {text}` | the same for a date field |
| `import.problem.boolean` | `Not true or false: {text}` | the same for a checkbox |
| `import.invalidRows` | `Rows with problems` | the option of the rows with problems |
| `import.invalidRows.import` | `Import them, marked` | they are imported |
| `import.invalidRows.skip` | `Skip them` | they are not |
| `import.noFields` | `Pick a field for at least one column` | no column has a field |
| `import.noRows` | `No rows to import` | an empty sheet |
| `import.cancel` | `Cancel` | the button that closes it |
| `import.import` | `Import {rows} rows` | the button that imports |
| `import.rowError` | `Not imported: {problems}` | the row error of a new row with values that were not read, on its row number |

### Header filters

What an empty header filter shows, when its column has no `placeholderFilter` of its own. A date
filter shows its formatter's format (`YYYY-MM-DD`) - filtered as shown, an example of its display format
(`2026-W47`, see [Filtering](06-filtering.md#filter-as-shown)) - a boolean filter is a checkbox.

| id | English | shown |
| --- | --- | --- |
| `filter.placeholder.text` | `Text` | an empty header filter of a text field |
| `filter.placeholder.number` | `Number` | an empty header filter of a number field |
| `filter.placeholder.between` | `from..to` | an empty header filter whose operator is `BETWEEN`, any type |
| `filter.placeholder.daysUntil` | `Days from today` | an empty header filter of a date column shown as `daysUntil`, filtered as shown - a number of days is typed |

The operator indicator in a header filter cell (`filterOperatorIndicator`, see
[Filtering](06-filtering.md#the-operator-in-the-cell)): the symbol of the operator the filter uses,
its name for a screen reader and its tooltip. `{operator}` is the operator as Filter › Operator ›
names it (`filter.operator.*`). A symbol is short: the indicator is about two characters wide, a
longer one is cut off.

| id | English | shown |
| --- | --- | --- |
| `filter.indicator` | `Operator: {operator}` | the indicator's name for a screen reader, and the description of the header filter's input; the tooltip of one that can not be clicked (a column with one operator) |
| `filter.indicator.case` | `Aa` | in the header, before the operator of a header filter that matches case |
| `filter.indicator.matchCase` | `{operator}, match case` | the operator's name in `filter.indicator` when it matches case |
| `filter.indicator.tooltip` | `Operator: {operator} (F4)` | the tooltip of the indicator: a click, or F4 in the filter, opens the operator choice |
| `filter.indicator.EQUAL` | `=` | Equal |
| `filter.indicator.NOT_EQUAL_TO` | `≠` | Not Equal |
| `filter.indicator.LESS_THAN` | `<` | Less than, a number or date field |
| `filter.indicator.LESS_THAN_OR_EQUAL_TO` | `≤` | Less than or equal, a number or date field |
| `filter.indicator.GREATER_THAN` | `>` | Greater than, a number or date field |
| `filter.indicator.GREATER_THAN_OR_EQUAL_TO` | `≥` | Greater than or equal, a number or date field - the operator a number or date filter starts with |
| `filter.indicator.BETWEEN` | `a..b` | Between, a number or date field - typed as `from..to` |
| `filter.indicator.CONTAINS` | `*a*` | Contains, a text field - as the wildcards a text filter takes |
| `filter.indicator.DOES_NOT_CONTAIN` | `!*a*` | Does not contain, a text field |
| `filter.indicator.BEGIN_WITH` | `a*` | Begins with, a text field |
| `filter.indicator.END_WITH` | `*a` | Ends with, a text field |

### Find

The find bar of Ctrl+F in the grid, see [Find](19-find.md).

| id | English | shown |
| --- | --- | --- |
| `find.label` | `Find in the grid` | the name of the find bar (a search region) for a screen reader |
| `find.placeholder` | `Find` | the placeholder of its input, and the input's name for a screen reader |
| `find.count` | `{current} of {count}` | the count of the matches. `{current}`: the number of the current match, `{count}`: how many cells match |
| `find.none` | `No matches` | the count when no cell matches the text |
| `find.matchCase` | `Match case` | the `Aa` button, a toggle: its name for a screen reader |
| `find.matchCase.text` | `Aa` | what the button shows |
| `find.matchCase.tooltip` | `Match case (Alt+C)` | its tooltip |
| `find.matchCase.tooltip.mac` | `Match case` | its tooltip on a Mac: Option+C types `ç` there, it is no key of the bar |
| `find.filterRows` | `Filter rows` | the funnel button, a toggle: its name for a screen reader |
| `find.filterRows.tooltip` | `Show only the rows with a match` | its tooltip |
| `find.previous` | `Previous match` | the `↑` button: its name for a screen reader |
| `find.previous.tooltip` | `Previous match (Shift+Enter)` | its tooltip |
| `find.previous.tooltip.mac` | `Previous match (⇧Enter)` | its tooltip on a Mac |
| `find.next` | `Next match` | the `↓` button |
| `find.next.tooltip` | `Next match (Enter)` | its tooltip |
| `find.close` | `Close` | the `✕` button, closes the find bar |
| `find.close.tooltip` | `Close (Esc)` | its tooltip |

### Keyboard shortcuts help

The keyboard shortcuts help - `?` and Ctrl+/ in the grid, *Keyboard shortcuts…* in the header menu - see
[The keyboard shortcuts help](14-accessibility.md#the-keyboard-shortcuts-help). Its title bar, its search
and the hint under it, then the names of the keys: a key with a name of its own has a text, a letter, a
function key (F2) and the arrows are shown as they are. The modifiers have a text for a Mac. Then each
group of keys: its title, and what each of its keys does.

| id | English | shown |
| --- | --- | --- |
| `shortcuts.title` | `Keyboard shortcuts` | its title, its name for a screen reader |
| `shortcuts.title.tooltip` | `Drag to move the dialog` | the tooltip of its title |
| `shortcuts.close` | `Close` | the `✕` button: its name for a screen reader and its tooltip |
| `shortcuts.search` | `Search` | the placeholder of the search, and its name for a screen reader |
| `shortcuts.none` | `No key matches the search` | under the search when no key has what is typed in it, a status |
| `shortcuts.hint` | `The arrows, Home and End move the caret in a cell. With Alt they move between the cells` | under the search, its description for a screen reader |
| `shortcuts.hint.mac` | `The arrows, Home and End move the caret in a cell. With ⌥ they move between the cells` | the same on a Mac |
| `shortcuts.key.ctrl` | `Ctrl` | the key Ctrl - the grid takes Cmd for it too |
| `shortcuts.key.ctrl.mac` | `⌘` | the key Ctrl on a Mac: Cmd |
| `shortcuts.key.alt` | `Alt` | the key Alt |
| `shortcuts.key.alt.mac` | `⌥` | the key Alt on a Mac: Option |
| `shortcuts.key.shift` | `Shift` | the key Shift |
| `shortcuts.key.shift.mac` | `⇧` | the key Shift on a Mac |
| `shortcuts.key.enter` | `Enter` | the key Enter |
| `shortcuts.key.esc` | `Esc` | the key Esc |
| `shortcuts.key.tab` | `Tab` | the key Tab |
| `shortcuts.key.space` | `Space` | the space bar |
| `shortcuts.key.home` | `Home` | the key Home |
| `shortcuts.key.end` | `End` | the key End |
| `shortcuts.key.pageUp` | `Page Up` | the key PageUp |
| `shortcuts.key.pageDown` | `Page Down` | the key PageDown |
| `shortcuts.key.delete` | `Delete` | the key Delete |
| `shortcuts.key.backspace` | `Backspace` | the key Backspace |
| `shortcuts.key.menu` | `Menu` | the key the menu key |
| `shortcuts.group.move` | `Moving around` | the title of a group of keys, the caption of its table |
| `shortcuts.move.tab` | `The next / previous cell` | what Tab / Shift+Tab do |
| `shortcuts.move.sideways` | `The cell to the left / right` | what Alt+ArrowLeft / Alt+ArrowRight do |
| `shortcuts.move.upDown` | `The cell above / below` | what Alt+ArrowUp / Alt+ArrowDown do |
| `shortcuts.move.enter` | `The cell below, from a cell that can be edited` | what Enter does |
| `shortcuts.move.row` | `The first / last cell of the row` | what Alt+Home / Alt+End do |
| `shortcuts.move.grid` | `The first / last cell of the grid` | what Ctrl+Home / Ctrl+End do |
| `shortcuts.move.page` | `A page of rows up / down` | what PageUp / PageDown do |
| `shortcuts.move.columns` | `A page of columns left / right` | what Alt+PageUp / Alt+PageDown do |
| `shortcuts.move.edge` | `The edge of the data in the column, up / down` | what Ctrl+ArrowUp / Ctrl+ArrowDown do |
| `shortcuts.group.select` | `Selecting cells` | the title of a group of keys, the caption of its table |
| `shortcuts.select.cell` | `A range of cells, one cell further each time` | what Alt+Shift+Arrows does |
| `shortcuts.select.page` | `The range a page up / down` | what Shift+PageUp / Shift+PageDown do |
| `shortcuts.select.row` | `The range to the first / last cell of the row` | what Alt+Shift+Home / Alt+Shift+End do |
| `shortcuts.select.grid` | `The range to the first / last cell of the grid` | what Ctrl+Shift+Home / Ctrl+Shift+End do |
| `shortcuts.select.edge` | `The range to the edge of the data, up / down` | what Ctrl+Shift+ArrowUp / Ctrl+Shift+ArrowDown do |
| `shortcuts.select.clear` | `No range of cells any more` | what Esc does |
| `shortcuts.group.cell` | `In a cell` | the title of a group of keys, the caption of its table |
| `shortcuts.cell.editor` | `Open the editor of a cell of several lines, or of a custom cell` | what Enter / F2 do |
| `shortcuts.cell.save` | `In the editor of several lines: save the text` | what Ctrl+Enter does |
| `shortcuts.cell.cancel` | `Close an editor or the list of a lookup cell, nothing saved` | what Esc does |
| `shortcuts.cell.list` | `Open the list of a lookup cell` | what Alt+ArrowDown / F4 do |
| `shortcuts.cell.check` | `Check or uncheck a checkbox` | what Space does |
| `shortcuts.cell.link` | `Open the link of a link cell` | what Alt+Enter does |
| `shortcuts.group.edit` | `Changing values` | the title of a group of keys, the caption of its table |
| `shortcuts.edit.undo` | `Undo, the focus to the cell it changed` | what Ctrl+Z does |
| `shortcuts.edit.redo` | `Redo` | what Ctrl+Y / Ctrl+Shift+Z do |
| `shortcuts.edit.fillDown` | `Fill down: the values of the row above, or of the top row of the range` | what Ctrl+D does |
| `shortcuts.edit.clear` | `Empty the cells of a range` | what Delete / Backspace do |
| `shortcuts.edit.deleteRows` | `On a row number: mark its row for deletion, or the selected rows` | what Delete / Backspace do |
| `shortcuts.group.clipboard` | `Copy and paste` | the title of a group of keys, the caption of its table |
| `shortcuts.clipboard.copy` | `Copy the range of cells, or the value of the cell` | what Ctrl+C does |
| `shortcuts.clipboard.paste` | `Paste cells copied here or in a spreadsheet` | what Ctrl+V does |
| `shortcuts.clipboard.columns` | `On a column number: copy the selected columns` | what Ctrl+C does |
| `shortcuts.group.find` | `Find` | the title of a group of keys, the caption of its table |
| `shortcuts.find.open` | `Open the find bar` | what Ctrl+F does |
| `shortcuts.find.next` | `The next match` | what Enter / F3 do |
| `shortcuts.find.previous` | `The previous match` | what Shift+Enter / Shift+F3 do |
| `shortcuts.find.matchCase` | `Match case on or off` | what Alt+C does |
| `shortcuts.find.close` | `Close the find bar` | what Esc does |
| `shortcuts.group.header` | `Filters, headers and groups` | the title of a group of keys, the caption of its table |
| `shortcuts.header.filter` | `In a header filter: filter` | what Enter does |
| `shortcuts.header.operator` | `In a header filter: choose the operator` | what F4 does |
| `shortcuts.header.label` | `From a header filter: up to its column header` | what Alt+ArrowUp does |
| `shortcuts.header.sort` | `On a column header: sort, again the other way` | what Enter / Space do |
| `shortcuts.header.addSort` | `On a column header: add the column to the sort` | what Shift+Enter / Shift+Space do |
| `shortcuts.header.group` | `On a group row: expand or collapse it` | what Enter / Space do |
| `shortcuts.group.menus` | `Menus` | the title of a group of keys, the caption of its table |
| `shortcuts.menus.open` | `The menu of the cell, header, filter or number with the focus` | what Shift+F10 / the menu key do |
| `shortcuts.menus.move` | `The next / previous item` | what ArrowDown / ArrowUp do |
| `shortcuts.menus.use` | `Use the item, or open its submenu` | what Enter / Space do |
| `shortcuts.menus.submenu` | `Open / close a submenu` | what ArrowRight / ArrowLeft do |
| `shortcuts.menus.close` | `Close the menu` | what Esc does |
| `shortcuts.group.dialogs` | `Dialogs and this help` | the title of a group of keys, the caption of its table |
| `shortcuts.dialogs.help` | `This help, where the key types nothing` | what ? does |
| `shortcuts.dialogs.helpAnywhere` | `This help, also while typing in a cell` | what Ctrl+/ does |
| `shortcuts.dialogs.close` | `Close a dialog` | what Esc does |
| `shortcuts.dialogs.undo` | `In the filter editor: undo / redo` | what Ctrl+Z / Ctrl+Y do |
| `shortcuts.dialogs.tabs` | `In the grid config dialog: the tab before / after` | what ArrowLeft / ArrowRight do |
| `shortcuts.dialogs.moveField` | `The fields of the detail form: move the field up / down` | what Alt+ArrowUp / Alt+ArrowDown do |
| `shortcuts.dialogs.toggleField` | `The fields of the detail form: in the form or out` | what Space does |

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
| `rowStatus.conflict` | `Changed on the server too: {fields}` | a row with fields in conflict (`datasource.getConflicts()`): the tooltip of its row number, and for a screen reader. `{fields}`: their column labels, joined with `, ` |
| `rowStatus.removedOnServer` | `Removed on the server, it has changes here` | a row the server removed (`upsert(rows, { removeMissing: true })`) that has changes here |
| `rowStatus.error` | `Error: {errors}` | a row with an error, for a screen reader (the tooltip has the errors, a line each). `{errors}`: the server's error and the fields' errors, `Age: Must be at least 18`, joined with `, ` |
| `cell.editedMarker.tooltip` | `Original value: {value}` | the tooltip of the marker of an edited cell. `{value}`: the value before the edit, shown with the field's formatter |
| `cell.editedMarker.blank` | `(blank)` | the `{value}` of an original value that is blank |
| `cell.editedMarker.revert` | `Click to revert` | the tooltip's last line, in an editable grid: a click on the marker puts the original value back |
| `cell.conflictMarker.tooltip` | `Changed on the server to {value} while you edited it` | the tooltip of the marker of a field in conflict. `{value}`: the server's value, shown with the field's formatter |
| `cell.conflictMarker.take` | `Click to take the server's value` | its last line, in an editable grid: a click on the marker takes the server's value |

### Multiline cells

A cell of several lines (`FieldConfig.multiline`, or a value with a line break) and the editor that
opens over it, see [Editing](05-editing.md#multiline-text).

| id | English | shown |
| --- | --- | --- |
| `cell.icon.high` | `High` | for a screen reader: the icon of an icon set (`ColumnFormat.icons`) of a value from the second threshold, said after the value. Hidden on screen, the cell has the icon |
| `cell.icon.middle` | `Middle` | from the first threshold |
| `cell.icon.low` | `Low` | below it |
| `cell.multiline.more` | `More lines, Enter shows all` | for a screen reader: the description of a cell that shows the first of its lines. Hidden on screen, the cell has a marker |
| `cell.multiline.moreLines` | `… {count} more lines` | the last line of the cell's tooltip when its text has more lines than the tooltip shows (`multilineTooltipLines`). `{count}`: how many are not shown, 2 or more - one line more is shown instead |
| `cell.multiline.hint` | `Ctrl+Enter to save, Esc to cancel` | under the textarea of the editor. Cmd+Enter saves too |
| `cell.multiline.hint.mac` | `⌘Enter to save, Esc to cancel` | the same on a Mac |
| `cell.multiline.hintReadonly` | `Esc to close` | under the textarea of the editor of a readonly cell |
| `cell.multiline.close` | `Save and close` | the ✕ at the right of the editor's hint: its name and tooltip - it saves and closes, as a click beside the editor |
| `cell.multiline.closeReadonly` | `Close` | the same ✕ in the editor of a readonly cell |

### Lookup columns

A column whose value is picked from a list (`ColumnConfig.editor`), see
[Lookups](20-lookups.md). The dropdown grid has the texts of a grid, the labels of its columns are
its config's.

| id | English | shown |
| --- | --- | --- |
| `lookup.open` | `Open the list` | for a screen reader: the name of the button at the right of the cell |
| `lookup.search` | `Search` | the placeholder of the search field of the select |
| `lookup.noMatch` | `No matches` | under the search of the select when no label has the text |
| `lookup.more` | `{shown} of {count} shown, type to search` | under the list of the select when it has more options than it shows. `{shown}`: the options shown (500), `{count}`: the options the search finds |

### Custom cells

A cell drawn by a renderer of your own (`ColumnConfig.renderer`), see [Custom cells](21-custom-cells.md#editing).

| id | English | shown |
| --- | --- | --- |
| `cell.editor.hint` | `Enter to save, Esc to cancel` | under the input of the editor of one line that opens over the cell. A cell of several lines gets the multiline editor and its texts |

### Date picker

Of a date cell, a date header filter and the filter menu's range block, and a `DateInterface` of your
own. The range picker shows its From and To as the day, the month's name and the year: `22 November
2026`.

| id | English | shown |
| --- | --- | --- |
| `datePicker.hours` | `HH` | label in front of the hours, and their name for a screen reader |
| `datePicker.minutes` | `MM` | label in front of the minutes, and their name for a screen reader |
| `datePicker.week` | `W` | header of the week numbers |
| `datePicker.clear` | `Clear` | button, empties the date |
| `datePicker.now` | `Now` | button, goes to now |
| `datePicker.use` | `Use` | button, picks the date (the range of a range picker) |
| `datePicker.from` | `From` | a range picker (a date header filter with Between, From and To of the filter menu): the label over the first day picked |
| `datePicker.to` | `To` | a range picker: the label over the last day picked |
| `datePicker.rangeOpen` | `–` | a range picker: under From or To while that day is not picked, an open end |
| `datePicker.previousYear` | `Previous year` | the « button left of the month: its name for a screen reader and its tooltip |
| `datePicker.previousMonth` | `Previous month` | the ‹ button left of the month |
| `datePicker.nextMonth` | `Next month` | the › button right of the month |
| `datePicker.nextYear` | `Next year` | the » button right of the month |

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
| `validation.integer` | `Must be a whole number` | `integer` |
| `validation.decimals` | `Must have at most {value} decimals` | `decimals` |
| `validation.oneOf` | `Must be one of {value}` | `oneOf`: the list, `Norway, Sweden` |
| `validation.email` | `Not an email address` | `email` |
| `validation.unique` | `Another row has the same value` | `unique` |
| `validation.uniqueWith` | `Another row has the same value and {with}` | `unique` with `with`: `{with}` is the labels of those fields, `Year, Month` |

### getFilterString()

Made by the datasource: `setTexts()` only. The whole string is upper cased - the values of a condition
that matches case excepted: `'filterString.operator.EQUAL': 'equal_to'` is shown as `<<EQUAL_TO>>`.

| id | English | shown |
| --- | --- | --- |
| `filterString.and` | `AND` | joins the conditions of an AND group |
| `filterString.or` | `OR` | joins the conditions of an OR group |
| `filterString.betweenAnd` | `and` | between the two values of a `BETWEEN`: `'10' <<AND>> '20'` |
| `filterString.matchCase` | `match_case` | after a condition that matches case: `[NAME] <<EQUAL_TO>> 'Ann' <<MATCH_CASE>>` |

| id | English |
| --- | --- |
| `filterString.operator.EQUAL` | `equal_to` |
| `filterString.operator.LESS_THAN_OR_EQUAL_TO` | `less_or_equal` |
| `filterString.operator.GREATER_THAN_OR_EQUAL_TO` | `greater_than_or_equal` |
| `filterString.operator.LESS_THAN` | `less_than` |
| `filterString.operator.GREATER_THAN` | `greater_than` |
| `filterString.operator.BETWEEN` | `between` |
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

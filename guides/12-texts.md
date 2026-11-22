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
  `row.edit.undo.hint`, `row.edit.redo.hint`, `find.previous.tooltip`, `cell.multiline.hint`,
  `filterEditor.undo.tooltip` and `filterEditor.redo.tooltip`.

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
| `filter.matchCase.hint` | `always` | its hint, on a column that always matches case (`filterCaseSensitive`) |

### The value list

The part of the filter menu with a checkbox per value - the text its cells show - for a text field
and a lookup column.

| id | English | shown |
| --- | --- | --- |
| `filter.values.search` | `Search values` | the name of the search box, for a screen reader |
| `filter.values.searchPlaceholder` | `Search values` | the placeholder of the search box |
| `filter.values.availableOnly` | `Only values in filtered rows` | the checkbox that lists only the values the other filters let through |
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
| `filterEditor.matchCaseAlways.tooltip` | `Match case: always, for this column` | its tooltip and name on a column that always matches case (`filterCaseSensitive`): on, greyed out |
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
| `columnSettings.type.text` | `Text` | the type of a text column, in the list and over its settings |
| `columnSettings.type.number` | `Number` | a number column |
| `columnSettings.type.boolean` | `Checkbox` | a boolean column |
| `columnSettings.type.date` | `Date` | a date column |
| `columnSettings.type.datetime` | `Date and time` | a datetime column |
| `columnSettings.type.lookup` | `Lookup` | a lookup column (`ColumnConfig.editor`) |
| `columnSettings.badge.format` | `Format` | in the list: the column has a date or number format |
| `columnSettings.badge.text` | `Text` | the column has a template of its text |
| `columnSettings.badge.link` | `Link` | the column is a link |
| `columnSettings.badge.problem` | `Error` | a template of the column has a problem: Apply waits for it |
| `columnSettings.format` | `Format` | the label of the format picker of a date or number column |
| `columnSettings.format.tooltip` | `How the cells show the value` | its tooltip |
| `columnSettings.text` | `Text shown` | the label of a text column's template of its text |
| `columnSettings.text.placeholder` | `{firstname} {lastname}` | its placeholder, a template as it is written |
| `columnSettings.text.hint` | `Empty: the cell's own text. {value} is the cell's value, {field} the value of another field` | under it |
| `columnSettings.link` | `Show as link` | the checkbox that makes the column a link |
| `columnSettings.url` | `Address` | the label of the address |
| `columnSettings.url.placeholder` | `https://example.com/customer/{id}` | its placeholder |
| `columnSettings.url.hint` | `Starts with https://, http://, mailto: or tel: - or is one {field} that holds the whole address` | under it |
| `columnSettings.newTab` | `Open in a new tab` | the checkbox of `newTab` |
| `columnSettings.insertField` | `Insert a field` | the `{ }` button beside a template: its name and tooltip |
| `columnSettings.none.boolean` | `A checkbox column has no settings` | the settings of a boolean column |
| `columnSettings.none.lookup` | `A lookup column shows the label of its value: it has no format` | the settings of a lookup column |
| `columnSettings.operator` | `Filter operator` | the label of the operator picker, every column but a checkbox |
| `columnSettings.operator.tooltip` | `The operator the header filter of the column uses` | its tooltip |
| `columnSettings.operator.hint` | `Default: {operator}` | under it: the operator the column starts with, its name |
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
| `columnSettings.detailForm.show` | `Show the detail form` | the checkbox that shows it |
| `columnSettings.detailForm.width` | `Width (px)` | the label of its width |
| `columnSettings.detailForm.width.hint` | `Where the rows would get too little room beside it, the form is under them` | under it |
| `columnSettings.detailForm.fields` | `Fields of the form` | the name of the list of the fields |
| `columnSettings.detailForm.fields.hint` | `Space puts a field in the form or takes it out, Alt+↑ and Alt+↓ move it` | under the list: its keys |
| `columnSettings.detailForm.fields.hint.mac` | `Space puts a field in the form or takes it out, ⌥↑ and ⌥↓ move it` | the same on a Mac |
| `columnSettings.detailForm.multiline` | `Several lines` | in the list: a field of several lines (`FieldConfig.multiline`) |
| `columnSettings.detailForm.hidden` | `Hidden` | in the list: a column that is not in the layout |
| `columnSettings.detailForm.moveUp` | `Move up` | the button: the field picked one up, in the form too |
| `columnSettings.detailForm.moveDown` | `Move down` | one down |
| `columnSettings.detailForm.reset` | `Reset form` | the button at the footer's left on the Detail form tab: the detail form the grid starts with |
| `columnSettings.detailForm.reset.tooltip` | `The detail form the grid starts with` | its tooltip |

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

### Header filters

What an empty header filter shows, when its column has no `placeholderFilter` of its own. A date
filter shows its formatter's format (`YYYY-MM-DD`), a boolean filter is a checkbox.

| id | English | shown |
| --- | --- | --- |
| `filter.placeholder.text` | `Text` | an empty header filter of a text field |
| `filter.placeholder.number` | `Number` | an empty header filter of a number field |
| `filter.placeholder.between` | `from..to` | an empty header filter whose operator is `BETWEEN`, any type |

The operator indicator in a header filter cell (`filterOperatorIndicator`, see
[Filtering](06-filtering.md#the-operator-in-the-cell)): the symbol of the operator the filter uses,
its name for a screen reader and its tooltip. `{operator}` is the operator as Filter › Operator ›
names it (`filter.operator.*`). A symbol is short: the indicator is about two characters wide, a
longer one is cut off.

| id | English | shown |
| --- | --- | --- |
| `filter.indicator` | `Operator: {operator}` | the indicator's name for a screen reader, and the description of the header filter's input; the tooltip of one that can not be clicked (a column with one operator) |
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
| `find.filterRows` | `Filter rows` | the funnel button, a toggle: its name for a screen reader |
| `find.filterRows.tooltip` | `Show only the rows with a match` | its tooltip |
| `find.previous` | `Previous match` | the `↑` button: its name for a screen reader |
| `find.previous.tooltip` | `Previous match (Shift+Enter)` | its tooltip |
| `find.previous.tooltip.mac` | `Previous match (⇧Enter)` | its tooltip on a Mac |
| `find.next` | `Next match` | the `↓` button |
| `find.next.tooltip` | `Next match (Enter)` | its tooltip |
| `find.close` | `Close` | the `✕` button, closes the find bar |
| `find.close.tooltip` | `Close (Esc)` | its tooltip |

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
| `cell.multiline.more` | `More lines, Enter shows all` | for a screen reader: the description of a cell that shows the first of its lines. Hidden on screen, the cell has a marker |
| `cell.multiline.moreLines` | `… {count} more lines` | the last line of the cell's tooltip when its text has more lines than the tooltip shows (`multilineTooltipLines`). `{count}`: how many are not shown, 2 or more - one line more is shown instead |
| `cell.multiline.hint` | `Ctrl+Enter to save, Esc to cancel` | under the textarea of the editor. Cmd+Enter saves too |
| `cell.multiline.hint.mac` | `⌘Enter to save, Esc to cancel` | the same on a Mac |
| `cell.multiline.hintReadonly` | `Esc to close` | under the textarea of the editor of a readonly cell |

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

Of a date cell and a date header filter, and a `DateInterface` of your own.

| id | English | shown |
| --- | --- | --- |
| `datePicker.hours` | `HH` | label in front of the hours, and their name for a screen reader |
| `datePicker.minutes` | `MM` | label in front of the minutes, and their name for a screen reader |
| `datePicker.week` | `W` | header of the week numbers |
| `datePicker.clear` | `Clear` | button, empties the date |
| `datePicker.now` | `Now` | button, goes to now |
| `datePicker.use` | `Use` | button, picks the date |
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

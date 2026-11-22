# Filtering

The datasource has one filter: a condition, or a group of conditions and groups. The user builds it
in the grid - with the header filters, the menus and the filter editor - and you set it from code.
Everything works on the same filter, `datasource.getFilter()`.

## Header filters

The row under the header labels has a filter cell per column. The user types a value and presses
Enter, or leaves the cell, and the grid filters on it:

| field type | the cell | the operator it starts with |
| --- | --- | --- |
| text | an input | `EQUAL`: the whole text, ignoring case |
| number | an input | `GREATER_THAN_OR_EQUAL_TO` |
| date, datetime | an input, and a date picker on click | `GREATER_THAN_OR_EQUAL_TO` |
| boolean | a checkbox: no filter, then checked (`true`), then unchecked (`false`), then no filter again | `EQUAL` |

- **A text filter matches the whole text** (`EQUAL`, ignoring case): `ann` finds `Ann` and `ANN`, but
  not `Anna`. `*` and `%` are wildcards: `ann*` starts with ann, `*ann*` has ann in it. With
  [Match case](#match-case) on, `Ann` does not find `ANN`.
- A number or date is typed as the field's formatter shows it (`12,5` works too, the date in the
  format of the placeholder) and parsed with the formatter.
- **`BETWEEN`** (Filter › Operator › Between, number and date columns, or Between in the
  [range block](#the-range-block)) takes both ends in the one input, with `..` between them: `10..20` is 10 to 20, both included; `10..` is 10 or more, `..20` 20
  or less; `10` alone is 10 to 10 (a date: that day). Each end is parsed with the formatter, as a
  single value is: `2026-01-01..2026-03-31`. The placeholder says `from..to`, and the cell shows the
  value that way (`10..20`). The date picker of a date cell picks one day: from and to that day.
- The `operator` option of a column sets the operator its header filter starts with, see
  [below](#a-contains-search); `filterOperators` the ones it offers, see
  [The operators a column offers](#the-operators-a-column-offers).
- The cell shows the operator it uses as a small symbol beside the input, a click on it changes it, see
  [The operator in the cell](#the-operator-in-the-cell).
- Emptying the cell removes the column's condition.

### A contains search

For a search anywhere in the text, give the column `operator: 'CONTAINS'` in `columns`. Each column
has its own, the text columns without one keep `EQUAL`:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        name: { operator: 'CONTAINS' }, // `ann` finds Ann, Anna and Joanna
        city: { operator: 'BEGIN_WITH' } // `osl` finds Oslo
        // company: EQUAL, the default
    },
    layout: {
        center: [
            { fields: ['name'], width: 150 },
            { fields: ['city'], width: 120 },
            { fields: ['company'], width: 150 }
        ]
    }
};
```

The user can also pick the operator of a column in the header filter's menu (Filter › Operator ›,
below), and type `*ann*` in any text header filter.

A header filter only replaces the conditions on its own column, at the top of the filter. The rest
of the filter is kept, and the column's condition is ANDed with it.

### Match case

A text compares ignoring case by default: `oslo` finds `Oslo` and `OSLO`. A condition with
`caseSensitive: true` compares upper and lower case as they are, see [the filter format](#the-filter-format).
In the grid:

- **Match case** in a text column's header filter menu (Filter › Match case, a ✓ while it is on): the
  column's header filter gives its conditions `caseSensitive: true` - the value typed, and the
  [value list](#the-value-list), which then lists texts that differ in case (`Oslo`, `OSLO`) apart.
  Turning it on or off runs the header filter again with the value its cell has, as picking an operator
  does. It is state: `headerFilters[field].caseSensitive`. A lookup column has it too: the label is
  matched with its case, and the `IN` of the values found has `caseSensitive: true`.
- **`filterCaseSensitive: true`** on a column: its conditions always match case - the header filter,
  the value list, the row menu's "Filter:" and the filter editor. Its Match case is shown on, greyed
  out, with the hint *(always)*; the filter editor's toggle too. For a text column (and a lookup column),
  `true` on another type throws a `TypeError` when the grid is made.
- **Aa** in the filter editor, on each condition of a text field: pressed (filled) while it matches
  case, see [the filter editor](#the-filter-editor).
- The footer shows **Aa** after the value of a chip that matches case, `getFilterString()` keeps the
  case of its value and adds `<<MATCH_CASE>>`.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        sku: { filterCaseSensitive: true, operator: 'BEGIN_WITH' } // `AB` does not find `ab-100`
    },
    layout: { center: [{ fields: ['sku'], width: 120 }] }
};
```

### The operators a column offers

Each type has its operators, `operatorsFor(type)` - see [Operators](#operators). The header filter
menu's Operator › offers the ones its input takes (not `IN` / `NOT_IN`, the value list's, nor
`IS_BLANK` / `IS_NOT_BLANK`, the Blank submenu's), the filter editor's operator picker all of them.

`filterOperators` on a column offers fewer, in the type's order:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // a search only: no Equal or Ends with, no Not blank, no value list (it needs IN)
        name: { filterOperators: ['CONTAINS', 'BEGIN_WITH', 'IS_BLANK'] },
        // an exact number or a range, BETWEEN to start with
        age: { filterOperators: ['EQUAL', 'BETWEEN', 'IS_BLANK', 'IS_NOT_BLANK'], operator: 'BETWEEN' }
    },
    layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['age'], width: 80 }] }
};
```

- Operator › offers those its input takes; Blank › its Is blank / Is not blank when it has them (and is
  left out with neither); the value list needs `IN`, and uses `NOT_IN` for the unchecked values only
  when it has `NOT_IN` too (else always an `IN` of the checked ones). The filter editor's picker offers
  them for the field.
- The header filter starts with its `operator`, else the type's default (`EQUAL`, or
  `GREATER_THAN_OR_EQUAL_TO` for a number or date) when the list has it, else its first operator the
  header filter takes. An operator of the state that the list does not have is passed by.
- A `TypeError` when the grid is made or `updateConfig()` is given the column: an operator the type does
  not have (`CONTAINS` on a number), an empty list, a list without an operator for the header filter's
  input, an `operator` that is not in it. A lookup column filters as text in its header: its list is
  of text operators.
- It is what the user can pick, not a rule of the filter: `datasource.filter()` and a state from
  `setState()` can have any condition, and the row menu's "Filter:" is `EQUAL` (`IS_BLANK` for an empty
  cell) whatever the column offers.

What each header cell shows is part of the [state](03-state.md#header-filters-in-the-state):
`getState().headerFilters`.

```sample filtering
```

### The operator in the cell

Each header filter shows the operator it uses, as a small symbol in its cell: on the right of a text
filter (and of a [lookup column](20-lookups.md)'s, it filters as text), clear of its text; on the left
of a number or date filter, where it reads as the condition does: `≥ 2026-01-01`. The input's padding
keeps the text typed clear of it. A boolean column has none, its filter is a checkbox.

| symbol | operator | | symbol | operator |
| --- | --- | --- | --- | --- |
| `=` | Equal | | `*a*` | Contains |
| `≠` | Not Equal | | `!*a*` | Does not contain |
| `<` `≤` | Less than (or equal) | | `a*` | Begins with |
| `>` `≥` | Greater than (or equal) | | `*a` | Ends with |
| `a..b` | Between | | | |

The text symbols are the wildcards a text filter takes: `*a*` is what `*ann*` typed with Equal finds.
The tooltip names the operator (`Operator: Contains (F4)`), and so does the input's description for a
screen reader.

- **A click** on it - a tap on a phone - opens the **operator choice** right under it: the operators of
  [Filter › Operator ›](#the-header-filter-menu) (the column's `filterOperators`, else its type's), the
  one in use with a ✓. Picking one does exactly what Operator › does: the operator is state
  (`headerFilters[field].operator`), the filter runs again with the value in the cell, the grid sends
  `filter-operator-change`. A text typed and not filtered yet is filtered first, as a right click does.
- **F4** in the header filter opens the choice from the keyboard, the focus on its first item: the
  [menu keys](10-menus.md#the-keyboard) move in it, Enter picks - the focus goes back to the filter -
  and Esc closes it. The symbol is no stop of Tab: Tab goes from filter to filter as before.
- A right click or a long press on it opens the filter menu, as on the input.
- **A column with one operator** (`filterOperators: ['CONTAINS', 'IN']`) shows its symbol, but it can
  not be clicked: there is nothing to choose.
- **A narrow column** - under 60px - shows none: the input keeps its room. F4 opens the choice there
  too, under the cell.
- **`filterOperatorIndicator: false`** in the config shows none at all, and F4 opens nothing: the
  operator is picked in the filter menu only. The dropdown grid of a [lookup](20-lookups.md) has it
  off, a picker has no menus.

The symbols, the name and the tooltip are texts: `filter.indicator.<FilterOperator>`, `filter.indicator`
and `filter.indicator.tooltip`, see [Texts](12-texts.md#header-filters). The choice is made of
Operator ›'s items: the `menus.filter` hook changes the filter menu, not the choice - offer fewer
operators with `filterOperators`, it is what both show.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    filterOperatorIndicator: false, // plain inputs, the operator in the filter menu only
    layout: { center: [{ fields: ['name'], width: 150 }] }
};
```

### The header filter menu

Right click a header filter for its menu: the submenu **Filter ›**, then the main tool, in the menu
itself: the **value list** for text fields and [lookup columns](20-lookups.md), the
**range block** for number, date and datetime fields - a boolean column has neither, its header
filter is a checkbox. In Filter ›:

- **Operator ›** picks the operator the column's header filter uses, the one in use has a ✓: for text
  Equal, Not Equal, Contains, Does not contain, Begins with and Ends with; for numbers and dates Equal,
  Not Equal, Less than, Less than or equal, Greater than, Greater than or equal and Between - or the
  ones of the column's `filterOperators`. A boolean column has none. The filter runs again with it, and
  the grid sends a `filter-operator-change` event. The operator picked is state
  (`headerFilters[field].operator`). The symbol in the cell opens the same choice, see
  [The operator in the cell](#the-operator-in-the-cell).
- **Match case** (text columns) turns matching case on and off, see [Match case](#match-case)
- **Blank ›** **Is blank** / **Is not blank** replace the column's conditions with `IS_BLANK` /
  `IS_NOT_BLANK`
- **Clear Filter** removes the conditions on this column, **Clear All Filters** the whole filter
- **Advanced Filter…** opens the [filter editor](#the-filter-editor)

From the keyboard: Shift+F10 (or the menu key) on the header filter opens the menu with the focus on
Filter ›, ArrowRight goes into it; Tab goes from Filter › into the value list or the range block,
Shift+Tab back.

```sample filter-operator-header
```

### The value list

The value list is the part of the filter menu of a text column, and of a lookup column, with a
checkbox per value, as in a spreadsheet:

- It lists **what the cells show**: the text of the field's formatter, the label of a
  [lookup column](20-lookups.md) (`Norway`, not `NO`) - for the rows the *other* columns' filters let
  through, in the order of the texts (`localeCompare`), with the number of rows of each on its right.
  Over the list: how many values it has.
- Values shown the same are **one entry**, their rows counted together: two values a formatter shows
  as `1234`, two codes with one label. So are texts that differ in case only (`Oslo`, `OSLO`): `IN`
  compares ignoring case, it can not filter them apart. The entry shows the text of the first row. With
  [Match case](#match-case) on they are entries of their own, and Apply's `IN` matches case.
- **"Blank"** (in italics), first, is every empty value - `null`, `''` and also `0` (see
  [0 is blank](#0-is-blank)) - and a value whose cell shows no text. `false` is a value of its own.
- It lists the first 100 texts, and then says so. The counts are only shown when every value is
  listed.
- **Only values in filtered rows**, when other columns filter rows: uncheck it to list the values of
  every row.
- The search box narrows the list to the texts with the search text in them, ignoring case (`*` and
  `%` are left out); Blank, which has no text, is not listed then.
- **Select all**, the header of the list, is checked when every value is, mixed when some are: a
  click checks every value, or none when every value is checked.
- **Apply** filters the column on the **values** behind the checked texts - a filter as any other:
  the footer, `getFilterString()`, the filter editor and the state have it. An `IN` condition with
  them, or a `NOT_IN` with the values of the unchecked ones when there are fewer of those: the values
  past the first 100 stay then. Blank is `'NULL'` in the list. After a search it is an `IN` of the
  values the search found and are checked - of the first 100: type more to narrow it. Nothing
  checked, or nothing unchecked: no condition from the list. It replaces the column's conditions,
  as the header filter does, and empties the header filter cell. Enter in the search box or on a
  checkbox does the same. **Cancel** (or Esc, or a click outside) closes the menu, the filter stays
  as it was: nothing is filtered while you check and uncheck.
- The keyboard: Tab goes from the menu's items into the search box, the checkboxes and the buttons;
  ArrowDown / ArrowUp move between the search box and the checkboxes, Space checks one.

### The range block

The range block is the part of the filter menu of a number, date or datetime column - where a text
column has the value list - to filter on a range in one go: an operator and a value, without picking
Operator › first and then typing in the header filter.

```text
[ = ][ ≠ ][ < ][ ≤ ][ > ][ ≥ ][ Between ]       [ = ][ ≠ ][ < ][ ≤ ][ > ][ ≥ ][ Between ]
[ 30                                  ]       From [ 2026-01-01                    ]
                     [Cancel] [Apply]         To   [ 2026-03-31                    ]
                                                                  [Cancel] [Apply]
```

- **The operators** are those of Operator ›, in the same order - `=`, `≠`, `<`, `≤`, `>`, `≥` and
  Between - or the ones of the column's `filterOperators`. The one picked is filled. Each is named for
  a screen reader by its text in Operator › ("Greater than"), which is its tooltip too.
- **One input**, two for **Between**: **From** and **To**. Either can be left empty, an open end: From
  10 alone is 10 or more, To 20 alone 20 or less. A value is typed as in the header filter, parsed with
  the field's formatter; the placeholder says how (`YYYY-MM-DD`, `Number`). A date column has no date
  picker in the block: the date is typed - a click on the header filter itself still opens the picker.
- It opens with what the header filter has: its operator, its value - a `BETWEEN`'s ends in From and
  To. Picking Between takes the value as From; another operator after Between the first end as the
  value.
- **Apply** - or Enter in an input, or on an operator - does what the header filter does when the
  operator is picked in Operator › and the value typed in the cell (`10..20` for Between): the
  operator, when it changed, is state (`headerFilters[field].operator`) and the grid sends
  `filter-operator-change`; the value replaces the column's conditions, as typing does, and the cell
  shows it (`10..20`). The state, the footer's chip, `getFilterString()` and the filter editor have
  what typing gives. An empty input is no filter on the column, as an empty cell. **Cancel** (or Esc,
  or a click outside) closes the menu, the filter stays as it was: nothing is filtered while you pick
  and type.
- The keyboard: Tab goes from the menu's items into the block, Shift+Tab back. The operators are a
  radio group, one stop of Tab: ArrowLeft / ArrowRight (or ArrowUp / ArrowDown) pick another one. Then
  the input (From, To), Cancel and Apply. An operator clicked with the mouse puts the focus in the
  input: a click, the value, Enter.

It is a block of the menu, `filter.range`: a `menus.filter` hook can hide it, move it or put a block
of its own in its place, see [Menus](10-menus.md#the-built-in-ids).

### Filters from the row menu

Right click a cell for the row menu. Its "Filter:" part filters on the value of that cell:

- **Replace filter (all)** replaces the whole filter with `field = value`, and empties the header
  filters
- **Add to filter (and)** ANDs `field = value` with the filter there is

An empty cell gives `IS_BLANK` instead of `= value`. On a column with `filterCaseSensitive` the
condition matches case.

## The filter editor

The filter editor is a dialog where the user builds any filter: conditions and AND/OR groups,
nested. It opens from the header filter menu (Filter › Advanced Filter…), from a click on the filter
in the footer - or on **No filter** there while the rows are not filtered - and from code:

```ts
document.getElementById('advanced-filter')!.addEventListener('click', () => gridInterface.openFilterEditor());
```

It starts with the filter there is. A condition is one row: a field (every field the grid knows),
an operator and a value - or another field to compare with, the arrows switch between the two - then
the trash can. The field and the operator are pickers: a button that opens a menu under it, the
field's with a search box. A group is a line down the left of what is in it, its header on top:
**AND** / **OR** (the one in use filled), **+ Condition**, **+ Group**, then wrap it in a new group
and delete it. "Apply & close" and "Apply" apply it, "Cancel" leaves the filter as it was. A condition
with no field or operator picked, or no value, is left out when it is applied: an empty value input is
no value. Applying it empties the header filter cells of the columns whose conditions it changed; a
header filter whose conditions are as they were keeps its text.

- **The operators of the field**: the picker offers the operators of the field's type (see
  [Operators](#operators)) - or of its column's `filterOperators` - and a text's while no field is
  picked. A lookup column's field has the operators of its type: the editor edits the values (`NO`),
  not the labels. Picking a field whose type does not have the operator picked takes the operator
  away: pick one again. A condition with an operator its type does not offer - from a filter saved
  with v5, from code - shows it, and keeps it when it is applied.
- **Aa**, Match case, after the value of a condition on a text field (not Is Blank / Is Not Blank):
  pressed (filled) while the condition matches case, a click turns it on or off. It gives the condition
  `caseSensitive: true`. On a column with `filterCaseSensitive` it is pressed and greyed out.
- **Between** has two value inputs, *From* and *To*, each read with the field's formatter (a date opens
  the date picker under it): one left empty is an open end. It compares with its values, so it has no
  switch to another field. Picking Between takes the value there was as its start; another operator
  picked after it takes the start as its value.

Every control is a button or an input, Tab goes through them in the order they are shown: the `✕`,
then each group's header and its conditions, then Undo, Redo, Cancel, Apply, Apply & close. A
picker opened from the keyboard has the focus in its menu - the field picker in its search box: type,
then ArrowDown to the fields or Enter for the first one - and gives it back to the picker when it
closes. The icons and the pickers have names for a screen reader: `Field: Country`, `Delete this
condition`. The dialog is as high as what is in it, up to the window, then the groups scroll; a
nested group is indented, its rows as wide as what is left, and a row wraps when the dialog is
narrow.

It is a modal `<dialog>`, over everything on the page: the grid behind it can not be used while it is
open. The focus moves to the dialog when it opens, and goes back to where it was when it closes. Esc
closes it - or the field, operator or date picker open in it, then Esc again closes the editor. Drag
it by its title bar, resize it from any edge or corner: with the mouse, a finger or a pen. It keeps
its place and size while it is open, and opens in the middle of the window again. The dialog is
`<dialog class="simple-html-grid filter-editor-content">`, the grey layer behind it its `::backdrop`.

Its texts - the buttons, the labels, the names of the operators, the tooltips - are `filterEditor.*`,
those of the header filter menu and its value list `filter.*`: see [Texts](12-texts.md#filter-editor).

### Undo and redo in the filter editor

The editor keeps an undo history of what is done in it: **↶ Undo** and **↷ Redo**, the icons at the
left end of the footer, and the keys **Ctrl+Z** (Cmd+Z) to undo, **Ctrl+Y** and **Ctrl+Shift+Z**
(Cmd+Y, Cmd+Shift+Z) to redo, with the focus anywhere in the dialog. The icons are greyed out
(`aria-disabled`) while there is nothing to undo or redo; their tooltips say the keys, `⌘Z` and `⇧⌘Z`
on a Mac.

- **A step** is one edit: a condition or a group added, deleted or wrapped, AND / OR, a field, an
  operator or a column picked, value / column switched, clear all, a date picked - and **what is typed
  in one value**, from the first key since the input got the focus until the focus leaves it (or Enter).
  An edit that changes nothing (a click on the AND in use) is no step, nor is a value typed back to what
  it was. A new step empties redo; up to 100 steps are kept.
- **While the user types in a value, Ctrl+Z is the input's own**: the browser undoes the typing. Once it
  is undone back to where it started, Ctrl+Z undoes the editor's edit before it; Ctrl+Y stays the
  input's until the focus leaves it, the browser redoes the typing. Everywhere else in the dialog the keys
  are the editor's - also with nothing to undo: the browser's own undo is the page's, Ctrl+Z on a button
  would undo the typing in a value input. In the field menu's search box the keys are its own while it
  has text; elsewhere in a picker's menu they undo the editor's edit and close the menu.
- **The focus**: after Ctrl+Z or Ctrl+Y it goes to the control the edit was made with - the picker, the
  input, the trash can of the condition deleted - or to the dialog when that is not there any more (a
  condition deleted again by a redo). A click on Undo or Redo keeps the focus on the button.
- **Apply keeps the history**: the dialog stays open, an edit applied can be undone and applied again.
  Undo changes what the editor shows, not the filter of the grid, until Apply. Each time the editor
  opens it starts with an empty history. It is the editor's own: the grid's undo (`datasource.undo()`,
  Ctrl+Z in a cell) does not see it, and the editor's keys do not reach the grid behind it.

## The footer

The footer shows the number of rows shown (`datasource.length()`, group rows included) and the
number of rows there are (`12/500`), and the
filter as a row of chips: field, operator, value, with the groups in brackets. "✕ Clear" removes the
whole filter, a click on the chips opens the filter editor. A `BETWEEN` is `Age between 10 and 20`
(an open end: `Age ≥ 10`), a condition that matches case has **Aa** after its value. The labels are the column labels, the
rest are texts (`footer.*`, the operators `footer.operator.*`), see [Texts](12-texts.md#footer). The
values of a lookup column are shown as its cells show them, by their labels (`Country in Norway`);
the filter editor shows the values (`NO`), they are what it edits.

While only the changed rows are shown (below), a chip *Changed rows only* comes first, ANDed with the
filter's chips. "✕ Clear" turns it off too. While Find's *Filter rows* hides rows (below), a chip
*Find: denma* with its text comes next; "✕ Clear" turns it off and leaves the find bar open.

Without any of them the footer has a button **No filter** in Clear's place: a click (Enter, Space)
opens the filter editor, so a filter can be built without going through the menus - also with the
header filters hidden (`hideFilter`), where the filter menu can not be opened. The count is at the
top of the footer either way, the button or Clear and the chips on the line under it: nothing moves
when a filter comes or goes. It is one button that changes: the focus stays on it, and goes back to it
when the editor it opened closes. A footer of no height (`footerHeight: 0`) has none. Its texts are
`footer.noFilter` and `footer.noFilter.tooltip`.

The summary of the selected cells is at the footer's right, on the line of the filter (see
[Selection and clipboard](17-selection-and-clipboard.md#the-summary-in-the-footer)). On a narrow
grid the chips collapse to one box when they would reach under it, and the summary is cut where the
filter's line ends, its tooltip has all of it.

## Find: Filter rows

Find (Ctrl+F in the grid) has a toggle *Filter rows* in its bar: only the rows with a cell that shows
the text are shown - the text as the cells show it, formatted, so the rows shown are the rows of the
marked cells. Like *Changed rows only* it is on top of the filter (AND) and not part of it:
`getFilter()`, the filter editor and the state do not have it. It filters the rows again when the
text changes and whenever the rows are filtered; closing the find bar turns it off. See
[Find](19-find.md#filter-rows).

```ts
gridInterface.find('denma', { filterRows: true }); // only the rows with a cell that shows "denma"
gridInterface.closeFind(); // every row again
```

## Changed rows only

`datasource.filterChangedOnly(true)` shows only the new, edited and deleted rows of the rows the
filter lets through - the row menu's *View: Changed rows only* in the grid. It is not a condition of
the filter but on top of it (AND): `getFilter()`, the filter editor and the state do not have it, and
setting the filter leaves it on. See [Editing](05-editing.md#changed-rows-only).

```ts
datasource.filterChangedOnly(true);
datasource.isChangedOnly(); // true
datasource.filterChangedOnly(false);
```

## Filters from code

```ts
import { and, or, where } from '@simple-html/grid';

datasource.filter(where('balance', 'GREATER_THAN', 2500)); // set a filter and run it

// country = 'Norway' AND (age < 30 OR age > 60)
datasource.filter(
    and(where('country', 'EQUAL', 'Norway'), or(where('age', 'LESS_THAN', 30), where('age', 'GREATER_THAN', 60)))
);

datasource.filter(); // run the filter that is set again, e.g. after rows were edited
datasource.filter(null); // no filter: every row

datasource.setFilter(where('age', 'GREATER_THAN', 18)); // set it without running it
datasource.getFilter(); // the filter that is set, null when there is none
```

- `filter(expression)` replaces the filter, also the header filters' conditions. The header cells
  keep showing their text: to change both, use `gridInterface.setState({ filter, headerFilters })`,
  see [State](03-state.md#header-filters-in-the-state).
- `setData()` runs the filter on the new rows. `{ refilter: false }` shows them all, the filter stays
  set, see [Datasource](04-datasource.md#data-in-setdata).
- The grid shows the result by itself, it follows the datasource's events.

## The filter format

A filter is a `FilterExpression`: a condition or a group. It is plain data, so it can be stored and
compared like any object, and stored as JSON - and sent to a backend, which makes the `WHERE` of a SQL
query of it with `toSqlWhere()`, see [SQL](22-sql.md).

```ts
import type { FilterCondition, FilterExpression, FilterGroup } from '@simple-html/grid';

const condition: FilterCondition = { field: 'age', operator: 'GREATER_THAN', value: 18 };

const group: FilterGroup = {
    group: 'OR', // 'AND': every child must match. 'OR': one is enough
    children: [
        { field: 'country', operator: 'EQUAL', value: 'Norway' },
        { field: 'country', operator: 'EQUAL', value: 'Sweden' }
    ]
};

const filter: FilterExpression = { group: 'AND', children: [condition, group] };
datasource.filter(filter);
```

`where(field, operator, value?, { caseSensitive? })`, `and(...children)` and `or(...children)` build
the same objects. `where('email', 'IS_BLANK')` leaves `value` out, `caseSensitive` is only there when
it is `true`:

```ts
import { where } from '@simple-html/grid';

where('name', 'EQUAL', 'Ann', { caseSensitive: true }); // { field: 'name', operator: 'EQUAL', value: 'Ann', caseSensitive: true }
where('age', 'BETWEEN', [18, 30]); // { field: 'age', operator: 'BETWEEN', value: [18, 30] }
where('age', 'BETWEEN', [18, null]); // 18 or more
```

`where()` throws a `TypeError` for a `BETWEEN` whose value is not `[from, to]`.

A condition has no type of its own. It is compared as the type of its field in the datasource's
`fields` (`text` when the field is not listed). A number value always compares as a number, and a
`Date` value as a date.

**Compare with another field** of the same row with `valueField`. It wins over `value`:

```ts
// rows changed after they were approved
datasource.filter({ field: 'changed', operator: 'GREATER_THAN', valueField: 'approved' });
```

**Ignored**: these filter nothing out, and `getFilterString()`, `getFilterTree()` and the footer leave
them out:

- a condition without `field` or `operator`
- a condition without the value it needs: a blank `value` - null, undefined, `''` or an invalid
  `Date` - and no `valueField`, for every operator but `IS_BLANK`, `IS_NOT_BLANK`, `IN` and `NOT_IN`.
  `{ field: 'name', operator: 'EQUAL', value: '' }` does not find the empty names: use `IS_BLANK`
- a `BETWEEN` whose value is not `[from, to]`, or whose two ends are blank (a `valueField` is not used
  by `BETWEEN`)
- an empty group. It is kept as it is (`filter(and())` keeps every row); use `filter(null)` for no
  filter

`IN` / `NOT_IN` without a list (or with `[]`) are not ignored: `IN` matches no row, `NOT_IN` every row.

## Operators

The field's type (the datasource's `fields`, `text` when the field is not listed) decides how a
condition compares the row's value - *row* below - with its value. This is the exact rule set: a
backend that filters the same rows (a SQL `WHERE` made from the filter) has to follow it. The SQL in
the tables is a sketch of the meaning, `col` the column and `:v` the value: case, collation and how a
database compares texts are the backend's. `toSqlWhere()` of `@simple-html/grid/sql` writes that `WHERE`
for PostgreSQL, Oracle, SQLite and SQL Server, its values as parameters, see [SQL](22-sql.md).

Two rules come first:

- **The type of the value wins over the field's**: a number value compares as a number and a `Date`
  value as a date, also on a text field or a field that is not listed. `where('code', 'GREATER_THAN',
  6)` on a text field compares numbers.
- **A condition without a value is ignored**, see [the filter format](#the-filter-format): a blank
  value never means "is blank", that is `IS_BLANK`.

### The operators of each type

`operatorsFor(type)` gives them, in this order. The grid offers these, and only these, in the header
filter menu and the filter editor; a column's `filterOperators` can offer fewer.

| type | operators |
| --- | --- |
| text | `EQUAL`, `NOT_EQUAL_TO`, `CONTAINS`, `DOES_NOT_CONTAIN`, `BEGIN_WITH`, `END_WITH`, `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK` |
| number, date, datetime | `EQUAL`, `NOT_EQUAL_TO`, `LESS_THAN`, `LESS_THAN_OR_EQUAL_TO`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL_TO`, `BETWEEN`, `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK` |
| boolean | `EQUAL`, `NOT_EQUAL_TO`, `IS_BLANK`, `IS_NOT_BLANK` |

```ts
import { operatorsFor } from '@simple-html/grid';

operatorsFor('number').includes('CONTAINS'); // false
operatorsFor(datasource.getField('name').type); // the operators of the name field
```

### Text

*row* is the row value as text: null and undefined are `''`, anything else `String(value)` (`5` is
`'5'`). Both texts are compared in lower case (`toLowerCase()`), or as they are with
`caseSensitive: true`. `*` and `%` in the value stand for any text - none too, line breaks too, as
`%` in SQL `LIKE`; there is no escape, and `_` is no wildcard. The rest of the value is taken as it is.
A text of several lines is one text: `BEGIN_WITH` is the start of the whole value, not of a line.

In the SQL, `t` is `LOWER(COALESCE(col, ''))` and `v` the value in lower case with its `*` and `%`
as `%` (and the `_` and `\` of `LIKE` escaped, they are no wildcards here):

| operator | matches | SQL, ignoring case |
| --- | --- | --- |
| `EQUAL` | the whole text. With a wildcard: the pattern, the whole text | `t = 'v'`, with a wildcard `t LIKE 'v'` |
| `NOT_EQUAL_TO` | not `EQUAL`: a blank row matches | `NOT (t = 'v')` |
| `CONTAINS` | the value somewhere in it | `t LIKE '%v%'` |
| `DOES_NOT_CONTAIN` | not `CONTAINS`: a blank row matches | `NOT (t LIKE '%v%')` |
| `BEGIN_WITH` | starts with the value | `t LIKE 'v%'` |
| `END_WITH` | ends with the value | `t LIKE '%v'` |
| `IN` | one of a list, see [below](#in-and-not_in) | `UPPER(col) IN (...)`, and `'NULL'` as `col IS NULL OR col = ''` |
| `NOT_IN` | not `IN`: none of the list | `NOT (...)` of `IN` |
| `IS_BLANK` | null, undefined, `''` (and the number 0, in plain js data) | `col IS NULL OR col = ''` |
| `IS_NOT_BLANK` | not `IS_BLANK` | `col IS NOT NULL AND col <> ''` |

With `caseSensitive: true` leave out the `LOWER()` / `UPPER()`: compare the texts as they are.

### Number

*row* is `Number(row value)`; a blank (null, undefined, `''`) and what is no number is **0**. The value
is `Number(value)`, what is no number 0 too.

| operator | matches | SQL |
| --- | --- | --- |
| `EQUAL` / `NOT_EQUAL_TO` | the same number / not | `COALESCE(col, 0) = :v` / `<>` |
| `LESS_THAN`, `LESS_THAN_OR_EQUAL_TO`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL_TO` | smaller, smaller or the same, larger, larger or the same | `COALESCE(col, 0) < :v` ... |
| `BETWEEN` | from `value[0]` to `value[1]`, both included | `COALESCE(col, 0) BETWEEN :from AND :to` |
| `IN` / `NOT_IN` | one of a list, compared as the formatter shows the number | |
| `IS_BLANK` | null, undefined, `''` or 0 | `col IS NULL OR col = 0` |
| `IS_NOT_BLANK` | not `IS_BLANK` | `col IS NOT NULL AND col <> 0` |

So `where('age', 'LESS_THAN', 5)` matches the rows without an age, and `EQUAL 0` matches them too.

### Date and datetime

*row* and the value are compared as timestamps: a `date` field on the day (the time of both is left
out), a `datetime` field to the second (the milliseconds are left out). A value of text (a `Date` after
JSON, ISO text) is read as a date. **A blank row date** - null, undefined, `''`, an invalid date - is
not on, before or after any date: of the comparisons it only matches `NOT_EQUAL_TO`.

| operator | matches | SQL, a `date` field |
| --- | --- | --- |
| `EQUAL` | the same day (`date`) or second (`datetime`) | `CAST(col AS DATE) = :v` |
| `NOT_EQUAL_TO` | not `EQUAL`: a blank row date matches | `col IS NULL OR CAST(col AS DATE) <> :v` |
| `LESS_THAN` ... `GREATER_THAN_OR_EQUAL_TO` | earlier, earlier or the same, later, later or the same. Never a blank | `CAST(col AS DATE) < :v` ... |
| `BETWEEN` | a `date`: from the start of `from`'s day to the end of `to`'s day. A `datetime`: from `from` to `to`, to the second. Never a blank | `CAST(col AS DATE) BETWEEN :from AND :to` |
| `IN` / `NOT_IN` | one of a list, compared as the formatter shows the date (`2026-01-31`) | |
| `IS_BLANK` | null, undefined, `''`, an invalid date (and 0) | `col IS NULL` |
| `IS_NOT_BLANK` | not `IS_BLANK` | `col IS NOT NULL` |

### Boolean

*row* is the value, a blank (null, undefined, `''`, 0) is **false**: the cell shows it unchecked. The
value is `true` or `false`, compared with `===`.

| operator | matches | SQL |
| --- | --- | --- |
| `EQUAL true` | `true` | `col = TRUE` |
| `EQUAL false` | `false` and the blanks | `col = FALSE OR col IS NULL` |
| `NOT_EQUAL_TO` | not `EQUAL`: `NOT_EQUAL_TO true` is `false` and the blanks | `NOT (...)` of `EQUAL` |
| `IS_BLANK` | null, undefined, `''` (and 0). `false` is a value | `col IS NULL` |
| `IS_NOT_BLANK` | not `IS_BLANK`: `true` and `false` | `col IS NOT NULL` |

### BETWEEN

`value` is `[from, to]`, both ends included. It is `GREATER_THAN_OR_EQUAL_TO from` and
`LESS_THAN_OR_EQUAL_TO to`, each with the rules of the type - a blank number is 0, a blank date is in
no range.

- **A blank end is open**: `[10, null]` is `GREATER_THAN_OR_EQUAL_TO 10`, `[null, 20]` is
  `LESS_THAN_OR_EQUAL_TO 20`. Blank is null, undefined, `''` or an invalid date - 0 is an end. Both ends
  blank: the condition is ignored.
- **`from` after `to`** (`[20, 10]`) matches no row, as `BETWEEN 20 AND 10` in SQL: the range is
  empty. The ends are not swapped - that would hide a typo.
- A `valueField` is not used: the ends are the value.

### IN and NOT_IN

`value` is a list, or a text with one value per line. Each value of the list and the row value are
compared as text, in upper case (`toUpperCase()`) - as they are with `caseSensitive: true` on a text
field. No wildcards.

- **A blank row value** - null, undefined, `''` and 0 in a text field - is the text `'NULL'`: `'NULL'`
  in the list matches the blanks. A row whose text is `null` (in any case; `NULL` with `caseSensitive`)
  is matched by it too. With `caseSensitive` write the blank as `'NULL'`, in upper case.
- **A number or date field** compares the text its formatter shows: the row value and a number in the
  list are formatted (`[2]` finds the 2 a formatter shows as `2.00`), a text in the list is taken as
  the text shown (`'2.00'`). There a 0 is `'0'`, not `'NULL'`. `caseSensitive` is not used.
- No list, or `[]`: `IN` matches no row, `NOT_IN` every row.

```ts
import { where } from '@simple-html/grid';

where('country', 'IN', ['Norway', 'Sweden']); // ignoring case
where('country', 'IN', ['Norway', 'NULL']); // or blank
where('code', 'NOT_IN', ['AB', 'ab'], { caseSensitive: true }); // as they are
```

### Case

`caseSensitive: true` is for the conditions that compare text: a text field (also one that is not
listed) with a value that is no number and no `Date`, and `IN` / `NOT_IN` on a text field. It is not
used on a number, date, datetime or boolean field, nor by `IS_BLANK` / `IS_NOT_BLANK`; only `true` turns
it on. Without it the texts are compared in lower case (`IN`: upper case), as JavaScript does - a
backend's case-insensitive collation may differ for a few letters (`ß`, the Turkish `İ`).

### Operators a type does not offer

The datasource still filters on an operator the field's type does not offer - a filter saved with
v5, a filter of code - the way v5 did. The grid does not offer them, the filter editor shows one and
keeps it. They are legacy; a backend can treat them as these:

| type | operator | is |
| --- | --- | --- |
| number, date, datetime | `CONTAINS`, `BEGIN_WITH` (and an operator of plain js that is none) | `GREATER_THAN_OR_EQUAL_TO` |
| number, date, datetime | `END_WITH` | `LESS_THAN_OR_EQUAL_TO` |
| number, date, datetime | `DOES_NOT_CONTAIN` | `LESS_THAN` |
| text | `LESS_THAN` ... `GREATER_THAN_OR_EQUAL_TO`, `BETWEEN` | the two texts compared as JavaScript does (code unit by code unit), in lower case or as they are with `caseSensitive`. No wildcards |
| boolean | any other operator | `EQUAL` |
| boolean | `IN` / `NOT_IN` | the text `TRUE` / `FALSE` / `NULL` |

### 0 is blank

A row value of `0` counts as blank, on purpose: in ERP style data 0 and empty mean the same.
`IS_BLANK` matches 0 and `IS_NOT_BLANK` leaves it out, in every field that holds the number 0, and
the value list puts 0 under "Blank". The text `'0'` is not blank. `IN` on a number field compares
the formatted text, so there 0 is `'0'`, not `'NULL'`. The `required` validation rule takes 0 as
missing too, see [Validation](05-editing.md#the-built-in-rules).

The other way round, a blank compares as the empty value of its type: a blank number as 0
(`LESS_THAN 5` matches it), a blank boolean as `false` (`EQUAL false` matches it), a blank text as
`''`. A blank date is no date at all. So, per type:

| type | blank (`IS_BLANK`) | a blank row value compares as |
| --- | --- | --- |
| text | null, undefined, `''` | `''` |
| number | null, undefined, `''`, 0 | 0 |
| date, datetime | null, undefined, `''`, an invalid date | no date: only `NOT_EQUAL_TO` matches it |
| boolean | null, undefined, `''` - `false` is a value | `false` |

## The filter as text

`getFilterString()` gives the filter as one line of text, `getFilterTree()` as a tree for your own
rendering. Both leave out what the filter ignores, and use the fields' labels unless you pass a
function for them:

```ts
import { and, Datasource, or, where } from '@simple-html/grid';

const people = new Datasource({ fields: { age: { type: 'number', label: 'Age' } } });
people.filter(and(where('country', 'EQUAL', 'Norway'), or(where('age', 'LESS_THAN', 20), where('age', 'GREATER_THAN', 60))));

people.getFilterString();
// ([COUNTRY] <<EQUAL_TO>> 'NORWAY' AND ([AGE] <<LESS_THAN>> '20' OR [AGE] <<GREATER_THAN>> '60'))

people.getFilterString((field) => (field === 'country' ? 'Land' : field));
// ([LAND] <<EQUAL_TO>> 'NORWAY' AND ([AGE] <<LESS_THAN>> '20' OR [AGE] <<GREATER_THAN>> '60'))

people.getFilterTree();
// { kind: 'group', group: 'AND', children: [
//     { kind: 'condition', label: 'country', operator: 'EQUAL', value: 'Norway', hasValue: true, caseSensitive: false },
//     { kind: 'group', group: 'OR', children: [ ...the two age conditions ] }
// ] }
```

- `getFilterString()` is `''` and `getFilterTree()` is `null` when no filter is set, or nothing of
  it is left.
- A condition that matches case keeps the case of its value in `getFilterString()` and ends with
  `<<MATCH_CASE>>`: `[NAME] <<EQUAL_TO>> 'Ann' <<MATCH_CASE>>`; in the tree it has `caseSensitive: true`
  (only where it is used: a number condition with it is `false`).
- A `BETWEEN` is `[AGE] <<BETWEEN>> '10' <<AND>> '20'`, an open end `''`. In the tree `value` is the
  start and `valueTo` the end, `''` for an open end.
- The values are formatted with the field's formatter, the values of `IN` / `NOT_IN` are shown as
  they are. The tree's root is always a group, also for a single condition.
- `getFilterTree(label, formatterOf)` takes a formatter for the values of a field too, the `IN` /
  `NOT_IN` values included (`'NULL'` stays): `formatterOf(field)` gives one, or `undefined` for the
  field's own.
- The grid's footer uses `getFilterTree()` with the column labels, and the formatter of its lookup
  columns: a chip shows `Country in Norway` where the filter has `IN ['NO']`.
- The operators and AND / OR of `getFilterString()` are texts, `filterString.*`: change them with
  `setTexts()`, see [Texts](12-texts.md#getfilterstring). `getFilterTree()` has the operators as they
  are (`'EQUAL'`), for your own rendering.

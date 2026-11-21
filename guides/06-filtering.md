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
  not `Anna`. `*` and `%` are wildcards: `ann*` starts with ann, `*ann*` has ann in it.
- A number or date is typed as the field's formatter shows it (`12,5` works too, the date in the
  format of the placeholder) and parsed with the formatter.
- The `operator` option of a column sets the operator its header filter starts with, see
  [below](#a-contains-search).
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

What each header cell shows is part of the [state](03-state.md#header-filters-in-the-state):
`getState().headerFilters`.

```sample filtering
```

### The header filter menu

Right click a header filter for its menu: the submenu **Filter ›**, then the **value list** (for
text fields), the main tool, in the menu itself. In Filter ›:

- **Operator ›** picks the operator the column's header filter uses, the one in use has a ✓: Equal,
  Not Equal and Contains for text, Greater than or equal, Less than or equal and Equal for numbers
  and dates. The filter runs again with it, and the grid sends a `filter-operator-change` event. The
  operator picked is state (`headerFilters[field].operator`).
- **Blank ›** **Is blank** / **Is not blank** replace the column's conditions with `IS_BLANK` /
  `IS_NOT_BLANK`
- **Clear Filter** removes the conditions on this column, **Clear All Filters** the whole filter
- **Advanced Filter…** opens the [filter editor](#the-filter-editor)

From the keyboard: Shift+F10 (or the menu key) on the header filter opens the menu with the focus on
Filter ›, ArrowRight goes into it; Tab goes from Filter › into the value list.

```sample filter-operator-header
```

### The value list

The value list is the part of a text column's filter menu with a checkbox per value, as in a
spreadsheet:

- It lists the values of the rows the *other* columns' filters let through, text in upper case,
  with the number of rows of each on its right. "Blank" (in italics) is every empty value: `null`,
  `''`, and also `0` and `false`. Over the list: how many values it has.
- It lists at most 100 values, and then says so. The counts are only shown when every value is
  listed.
- **Only values in filtered rows**, when other columns filter rows: uncheck it to list the values of
  every row.
- The search box narrows the list. With search text, Apply also adds a `CONTAINS` condition for it.
- **Select all**, the header of the list, is checked when every value is, mixed when some are: a
  click checks every value, or none when every value is checked.
- **Apply** filters the column on the checked values: an `IN` condition with them, or a `NOT_IN`
  with the unchecked ones when there are fewer of those. Enter in the search box or on a checkbox
  does the same. **Cancel** (or Esc, or a click outside) closes the menu, the filter stays as it
  was: nothing is filtered while you check and uncheck.
- The keyboard: Tab goes from the menu's items into the search box, the checkboxes and the buttons;
  ArrowDown / ArrowUp move between the search box and the checkboxes, Space checks one.

### Filters from the row menu

Right click a cell for the row menu. Its "Filter:" part filters on the value of that cell:

- **Replace filter (all)** replaces the whole filter with `field = value`, and empties the header
  filters
- **Add to filter (and)** ANDs `field = value` with the filter there is

An empty cell gives `IS_BLANK` instead of `= value`.

## The filter editor

The filter editor is a dialog where the user builds any filter: conditions and AND/OR groups,
nested. It opens from the header filter menu (Filter › Advanced Filter…), from a click on the filter
in the footer, and from code:

```ts
document.getElementById('advanced-filter')!.addEventListener('click', () => gridInterface.openFilterEditor());
```

It starts with the filter there is. A condition is one row: a field (every field the grid knows),
an operator (all of them, see [below](#operators)) and a value - or another field to compare with,
the arrows switch between the two - then the trash can. The field and the operator are pickers: a
button that opens a menu under it, the field's with a search box. A group is a line down the left of
what is in it, its header on top: **AND** / **OR** (the one in use filled), **+ Condition**,
**+ Group**, then wrap it in a new group and delete it. "Apply & close" and "Apply" apply it,
"Cancel" leaves the filter as it was. A condition with no field or operator picked is left out when
it is applied. Applying it empties the header filter cells.

Every control is a button or an input, Tab goes through them in the order they are shown: the `✕`,
then each group's header and its conditions, then Cancel, Apply, Apply & close. A picker opened from
the keyboard has the focus in its menu - the field picker in its search box: type, then ArrowDown to
the fields or Enter for the first one - and gives it back to the picker when it closes. The icons and
the pickers have names for a screen reader: `Field: Country`, `Delete this condition`. The dialog is
as high as what is in it, up to the window, then the groups scroll; a nested group is indented, its
rows as wide as what is left, and a row wraps when the dialog is narrow.

It is a modal `<dialog>`, over everything on the page: the grid behind it can not be used while it is
open. The focus moves to the dialog when it opens, and goes back to where it was when it closes. Esc
closes it - or the field, operator or date picker open in it, then Esc again closes the editor. Drag
it by its title bar, resize it from any edge or corner: with the mouse, a finger or a pen. It keeps
its place and size while it is open, and opens in the middle of the window again. The dialog is
`<dialog class="simple-html-grid filter-editor-content">`, the grey layer behind it its `::backdrop`.

Its texts - the buttons, the labels, the names of the operators, the tooltips - are `filterEditor.*`,
those of the header filter menu and its value list `filter.*`: see [Texts](12-texts.md#filter-editor).

## The footer

The footer shows the number of rows shown (`datasource.length()`, group rows included) and the
number of rows there are (`12/500`), and the
filter as a row of chips: field, operator, value, with the groups in brackets. "✕ Clear" removes the
whole filter, a click on the chips opens the filter editor. The labels are the column labels, the
rest are texts (`footer.*`, the operators `footer.operator.*`), see [Texts](12-texts.md#footer).

While only the changed rows are shown (below), a chip *Changed rows only* comes first, ANDed with the
filter's chips. "✕ Clear" turns it off too. While Find's *Filter rows* hides rows (below), a chip
*Find: denma* with its text comes next; "✕ Clear" turns it off and leaves the find bar open.

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
compared like any object, and stored as JSON.

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

`where(field, operator, value?)`, `and(...children)` and `or(...children)` build the same objects.
`where('email', 'IS_BLANK')` leaves `value` out.

A condition has no type of its own. It is compared as the type of its field in the datasource's
`fields` (`text` when the field is not listed). A number value always compares as a number, and a
`Date` value as a date.

**Compare with another field** of the same row with `valueField`. It wins over `value`:

```ts
// rows changed after they were approved
datasource.filter({ field: 'changed', operator: 'GREATER_THAN', valueField: 'approved' });
```

**Ignored**: a condition without `field` or `operator`, a condition on a date field without a value,
and an empty group filter nothing out. An empty group is kept as it is (`filter(and())` keeps every
row); use `filter(null)` for no filter.

## Operators

The field's type decides how a condition compares the row's value with its value.

| operator | text | number | date, datetime |
| --- | --- | --- | --- |
| `EQUAL` | the whole text, ignoring case. `*` and `%` are wildcards | the same number | the same day (`date`) or second (`datetime`) |
| `NOT_EQUAL_TO` | not `EQUAL` | not `EQUAL` | not `EQUAL`. A blank row date matches |
| `LESS_THAN` | before, compared as lower case text | smaller | earlier |
| `LESS_THAN_OR_EQUAL_TO` | `LESS_THAN` or `EQUAL` | smaller or the same | earlier or the same |
| `GREATER_THAN` | after, compared as lower case text | larger | later |
| `GREATER_THAN_OR_EQUAL_TO` | `GREATER_THAN` or `EQUAL` | larger or the same | later or the same |
| `CONTAINS` | has the value in it, ignoring case | as `GREATER_THAN_OR_EQUAL_TO` | as `GREATER_THAN_OR_EQUAL_TO` |
| `DOES_NOT_CONTAIN` | does not have the value in it | as `LESS_THAN` | as `LESS_THAN` |
| `BEGIN_WITH` | starts with the value | as `GREATER_THAN_OR_EQUAL_TO` | as `GREATER_THAN_OR_EQUAL_TO` |
| `END_WITH` | ends with the value | as `LESS_THAN_OR_EQUAL_TO` | as `LESS_THAN_OR_EQUAL_TO` |
| `IN` | one of a list, ignoring case | one of a list, as the formatter shows the number | one of a list, as the formatter shows the date |
| `NOT_IN` | not `IN` | not `IN` | not `IN` |
| `IS_BLANK` | `null`, `undefined`, `''` or `0` | `null`, `undefined`, `''` or `0` | `null`, `undefined`, `''` or an invalid date |
| `IS_NOT_BLANK` | not `IS_BLANK` | not `IS_BLANK` | not `IS_BLANK` |

- A **boolean** field compares every operator as `EQUAL`, apart from `IN`, `NOT_IN`, `IS_BLANK` and
  `IS_NOT_BLANK`. The value must be `true` or `false`.
- `IN` / `NOT_IN` take a list as `value`: `where('country', 'IN', ['Norway', 'Sweden'])`. Text with
  one value per line works too. `'NULL'` in the list matches an empty value.
- A **blank row date** is not before, after or on any date: of the comparisons it only matches
  `NOT_EQUAL_TO`.
- A **blank number** compares as 0: `where('age', 'LESS_THAN', 5)` also matches the rows without an
  age.

### 0 is blank

A row value of `0` counts as blank, on purpose: in ERP style data 0 and empty mean the same.
`IS_BLANK` matches 0 and `IS_NOT_BLANK` leaves it out, in every field that holds the number 0, and
the value list puts 0 under "Blank". The text `'0'` is not blank. `IN` on a number field compares
the formatted text, so there 0 is `'0'`, not `'NULL'`. The `required` validation rule takes 0 as
missing too, see [Validation](05-editing.md#the-built-in-rules).

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
//     { kind: 'condition', label: 'country', operator: 'EQUAL', value: 'Norway', hasValue: true },
//     { kind: 'group', group: 'OR', children: [ ...the two age conditions ] }
// ] }
```

- `getFilterString()` is `''` and `getFilterTree()` is `null` when no filter is set, or nothing of
  it is left.
- The values are formatted with the field's formatter. The tree's root is always a group, also for
  a single condition.
- The grid's footer uses `getFilterTree()` with the column labels.
- The operators and AND / OR of `getFilterString()` are texts, `filterString.*`: change them with
  `setTexts()`, see [Texts](12-texts.md#getfilterstring). `getFilterTree()` has the operators as they
  are (`'EQUAL'`), for your own rendering.

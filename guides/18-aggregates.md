# Aggregates

A column can be summed up: its sum, average, smallest or largest number, or the number of values it
has - one of them, or several. The grid shows them in the column's place in every group row - over the
rows of the group - and in a totals row under the rows, over every row the filter lets through. The
user turns them on and off in the header menu (right click a column label), and they are part of the
grid's state. The datasource computes the
values, so they are there without a grid too: `datasource.aggregate()`.

```sample aggregates
```

## In the config

`aggregate` is an option of a column, plain JSON like the rest of the config:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        balance: { aggregate: ['sum', 'avg'] }, // two functions: two lines
        age: { aggregate: 'avg' },
        email: { aggregate: 'count' }
    },
    layout: {
        center: [
            { fields: ['company'], width: 160 },
            { fields: ['email'], width: 200 },
            { fields: ['age'], width: 80 },
            { fields: ['balance'], width: 120 }
        ]
    },
    totalsRow: true, // off by default
    initialState: { grouping: [{ attribute: 'country', title: 'Country' }] }
};
```

| function | the value | of no values |
| --- | --- | --- |
| `'sum'` | the sum of the numbers | `0` |
| `'avg'` | the average of the numbers | blank |
| `'min'` | the smallest number | blank |
| `'max'` | the largest number | blank |
| `'count'` | how many values are not blank, of any type | `0` |

- **`sum`, `avg`, `min` and `max` are for `number` fields**, the type the datasource's `fields` give
  them. On another field the grid throws a `TypeError` when it is made, or when `updateConfig()` is
  given the column - a config from JSON could otherwise show nothing without a word. They take the
  numbers: a blank (`null`, `undefined`, `''`) and what is no number (text, even `'12'`, `NaN`) are
  left out, of the average too. `0` is a number.
- **`count`** counts the values that are not blank, in any field: `0` and `false` are values.
- **Rows marked for deletion count** until they are saved (`clearMarkedForDeletion()`, or
  `acceptChanges()` after the server took them): they are rows of the grid until then, as in the
  footer's count and the export.
- **One function or several**: `aggregate: 'sum'` or `aggregate: ['sum', 'avg']`. Each is a line of
  its own, always in the order sum, avg, min, max, count. A field shown in two columns of the layout
  has the same functions in both.

The two options of the grid:

| option | default | what it does |
| --- | --- | --- |
| `groupAggregates` | `true` | the aggregates in the group rows. `false` shows the name of the group only |
| `totalsRow` | `false` | the totals row under the rows |

## From the header menu

Right click a column label: the **Aggregate:** section has *Sum*, *Average*, *Min*, *Max* - on a number
column - and *Count*, each a toggle with a ✓ when it is on, and *Totals row*, a toggle of the totals row.
What the user turns on is part of the grid's state:

```ts
gridInterface.getState().aggregates; // { balance: ['sum', 'avg'], email: ['count'] }
gridInterface.getState().totalsRow; // true

// the same from code - every field listed gets these, the others none
gridInterface.setState({ aggregates: { balance: ['sum'] }, totalsRow: false });

// back to the config's: columns.<field>.aggregate and totalsRow
gridInterface.resetState();
```

`setState()` checks the functions as the config's are checked: a function that is none, or `sum` on a
field that is not a number, throws a `TypeError` and changes nothing. `updateConfig()` changes the
totals row only when it is given `totalsRow`, so a toggle the user made stays. The ids are
`header.aggregate.*`, see [Menus](10-menus.md).

## How they are shown

Each value is a line in its column: the label at the left - `Sum`, the texts `aggregate.sum`,
`aggregate.avg`, `aggregate.min`, `aggregate.max` and `aggregate.count`, see
[Texts](12-texts.md#aggregates). Translate them like the other texts, or make them shorter:
`setTexts({ 'aggregate.sum': 'Σ' })`.

- **The field's formatter formats the value**: a `balance` field with a formatter of two decimals
  shows its sum with two decimals. A column's display format (`ColumnConfig.format`, the header menu's
  Format ›) does too: `{ number: { decimals: 2, thousands: ' ', decimal: ',' } }` shows the sum as
  `1 234 565,39`, see [Display formats](08-formatting.md#display-formats). Nothing is rounded before that - an average of whole numbers is
  `34.666666666666664` until the formatter makes it `34.7`. A formatter that shows whole numbers as
  they are and the rest with one decimal suits a field of whole numbers, see the sample. `count` is
  shown as a whole number.
- **The label at the left, the value at the right** of the column, so the labels line up and so do
  the numbers. In a narrow column the label gives way first; a value still too long ends in `...`.
- **The sum does not drift** over many rows: it is added up with a compensated sum, 100 000 times
  `0.1` is `10000`, not `10000.000000018848`. What is left is what a number in javascript is:
  `0.1 + 0.2` is `0.30000000000000004` - the formatter shows it.
- **A line per function**: a column's lines are its fields' functions one under the other, from the
  top. In a column of stacked fields (`fields: ['debit', 'credit']`) the label says which field it is:
  `Sum Debit`, `Sum Credit`.

## In the group rows

A group row with aggregates has the group's name on a line of its own, and the aggregates on the lines
under it, each in its column, over every row of the group: the rows of its sub groups, and of
collapsed groups too. A collapsed group shows the same values as an expanded one. So a group row is
1 + n lines high, n the most lines a column needs - a column with sum and avg makes it three lines.
The name's line is a row high (`cellHeight`), each line of aggregates a line of text
(`multilineLineHeight`, 15px by default), as the lines of a [multiline cell](05-editing.md#multiline-text): with the
defaults a group row with sum and avg is `22 + 2 × 15` = 52px. The name never covers a value, and it is in
the header's bold - the values are in the weight of the cells. Without aggregates (or
`groupAggregates: false`) a group row is one line.

## The totals row

`totalsRow: true` shows a row under the rows: "Total" under the row numbers (the text
`aggregate.total`) and each aggregate in its column, over every row the filter lets through - when
grouped, the rows of collapsed groups too. It follows the columns when the middle scrolls sideways,
and the pinned columns stay where they are, as in the rows. It is as many lines high as the column with
the most functions needs.

The horizontal scrollbar is between the rows and the totals row. The totals row takes its own room:
the rows get less, the footer stays as it is.

The totals row is not part of an export: `getCsv()` and `downloadCsv()` give the rows, a spreadsheet
sums them up itself, and a line of totals would be read back as a row.

## When they change

The values follow the rows:

- **An edit**, in the grid or from code (`row.balance = 10`), `undo()`, `redo()`, `upsert()`,
  `resetData()` ...: the group rows on screen and the totals row show the new values in the next
  animation frame, with the cells - the datasource's `rows-changed` event.
- **The filter**: the totals and the groups are over the rows it lets through.
- **Sorting** changes no value, **grouping** makes new group rows.
- A value set on your own object, not on the row the datasource hands out (`getDataRows()` ...), is
  not seen: neither the grid nor the datasource knows it changed. Set it on the row.

## From code

`datasource.aggregate(field, fn, rows?)` gives the value the grid shows, without a grid too:

```ts
import { isGroupRow } from '@simple-html/grid';

datasource.aggregate('balance', 'sum'); // the rows the filter lets through
datasource.aggregate('age', 'avg'); // null when no row has an age

// a group's rows: the rows of its sub groups and of collapsed groups included
for (const row of datasource.getRows()) {
    if (isGroupRow(row)) {
        console.log(row.__groupName, datasource.aggregate('balance', 'sum', row));
    }
}

// rows of your own, the selected ones say - formatted as the field shows its values
const sum = datasource.aggregate('balance', 'sum', datasource.getSelectedRows());
datasource.getFormatter('balance').format(sum);
```

The value of the filtered rows and of a group row is kept until a value of its field changes or
other rows are filtered, so the grid can ask on every rebuild and every render of a group row: an
edit of another field changes nothing. Computing it again reads the field of every row: measured in
Chrome, 4ms for 100 000 rows, about 18ms once they are grouped. A list of rows you give is computed
on each call.

## Theming and screen readers

The totals row has colours of its own, `--simple-html-grid-totals-bg-color` and
`--simple-html-grid-totals-font-color`; the label in front of a value is
`--simple-html-grid-aggregate-label-color`. The group rows keep their colours. See
[Theming](13-theming.md#the-variables-of-the-grid).

For a screen reader the aggregates of a field are one cell of its column, named with all its lines
(`Sum 12 500, Avg 1 250`) and read with the column's header; the group's name is the cell of the first
column. The totals row is the last row of the grid with "Total" as its row header. See
[Accessibility](14-accessibility.md).

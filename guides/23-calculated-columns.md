# Calculated columns

A calculated column is a column whose value a formula computes from the other fields of its row: the
total of an order (`{price} * {qty}`), the days it is late (`DAYS({due}, TODAY())`), a label from a
condition (`IF({qty} >= 10, "bulk", "single")`). It is read only, and otherwise a column like any other:
in the layout, pinned, moved, resized and hidden; sorted, filtered, grouped and summed; formatted and
coloured; in the detail form, copied, exported and found.

The developer starts the grid with some in the config, the user adds, changes and removes them in the
grid config dialog. They are part of the state (`GridState.calculatedColumns`): saved with
`getState()`, given back with `setState()`.

```sample calculated-columns
```

## A calculated column in the config

`GridConfig.calculatedColumns` has them by field name. Put the field in the `layout` as any field, and
give it `columns` options - a label, an aggregate, a display format, colour rules - as any column:

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';

const datasource = new Datasource({ key: 'id', fields: { price: 'number', qty: 'number', due: 'date' } });

const config: GridConfig = {
    calculatedColumns: {
        total: { formula: '{price} * {qty}', label: 'Total' },
        daysLate: { formula: 'MAX(0, DAYS({due}, TODAY()))', label: 'Days late', type: 'number' },
        size: { formula: 'IF({qty} >= 10, "bulk", "single")' }
    },
    columns: {
        total: { aggregate: 'sum', format: { number: { decimals: 2 } } },
        daysLate: { format: { rules: [{ operator: 'GREATER_THAN', value: '0', background: 'red' }] } }
    },
    layout: {
        center: [
            { fields: ['price'], width: 80 },
            { fields: ['qty'], width: 60 },
            { fields: ['total'], width: 100 },
            { fields: ['daysLate'], width: 80 },
            { fields: ['size'], width: 80 }
        ]
    }
};
createGrid(host, { config, datasource });
```

| part | |
| --- | --- |
| the key | its field name: a letter, then letters, digits and `_`, 64 at most - `total`, `days_late`. Not a field of the datasource (`fields`) or of the rows, not one of the grid's own (`__...`), not a name every object has (`constructor`, `toString` ...) |
| `formula` | the formula, see [The formulas](#the-formulas). At most 1000 characters |
| `label` | its label, default the field name made readable (`days_late` is *Days Late*). `ColumnConfig.label` and the user's label (`ColumnFormat.label`) win over it, as over a field's label |
| `type` | the type of its values: `'number'`, `'text'`, `'date'` or `'boolean'`. Left out, the type the formula gives; given, it must be that one - a saved state keeps saying what it holds |

The type is the formula's: `{price} * {qty}` is a number, `IF(...)` the type of its two values, a
comparison true / false. A `number` column sorts and filters as numbers and can be summed, a `date`
column has the date formats, a `boolean` column shows checkboxes.

A formula with a problem - a syntax error, a field the grid does not know, a type that does not fit -
throws a `TypeError` when the grid is made, or `setState()` or `updateConfig()` is given it, before
anything changes: `GridConfig: calculatedColumns.total.formula: * takes a number: {name} is a text`.
So does a name it can not have, a format that does not fit its type (a date format on a number column),
and more than 50 calculated columns.

## The formulas

A formula is text: fields in braces, numbers, texts in quotes, operators and a few functions.

```text
{price} * {qty}
ROUND({price} * {qty} * 1.25, 2)
IF({status} = "done", 0, MAX(0, DAYS({due}, TODAY())))
{firstname} & " " & {lastname}
COALESCE({discount}, 0)
```

| part | |
| --- | --- |
| `{field}` | the value of a field of the row: a field of the datasource, a column of the grid, another calculated column. As in the [templates](08-formatting.md#templates-and-links): any characters but braces, `{first name}` too |
| `12`, `0.25`, `.5` | a number, with a `.` for the decimals |
| `"late"`, `'late'` | a text; the quote doubled inside it: `"say ""hi"""` |
| `TRUE`, `FALSE` | true and false |
| `+ - * /` | numbers. A minus in front: `-{qty}` |
| `&` | joins values as text: `{name} & " (" & {id} & ")"` |
| `= <> < <= > >=` | compares two values of one type: true or false. One at a time: `a < b < c` is a problem, write `a < b AND b < c` |
| `!=`, `==` | the same as `<>` and `=`: `{shipped} != {ordered}` compares two columns |
| `AND`, `OR`, `NOT` | true / false: `{qty} > 10 AND NOT {paid}` |
| `( )` | brackets |

The keywords and the functions are in any case (`and`, `If`). Spaces and line breaks between the parts
do not matter. Precedence, the first binding the loosest: `OR`, `AND`, `NOT`, the comparisons, `&`,
`+ -`, `* /`, a minus in front.

### The functions

| function | gives |
| --- | --- |
| `IF(condition, a, b)` | a when the condition is true, else b - a and b of one type. Only the one taken is computed: `IF({qty} = 0, 0, {price} / {qty})` |
| `ROUND(x, n)` | x rounded to n decimals, halves away from 0 (`ROUND(2.5)` is 3, `ROUND(-2.5)` -3). n left out is 0, a negative n rounds to tens, hundreds: `ROUND(1250, -2)` is 1300. n a whole number from -10 to 10 |
| `ABS(x)` | x without its sign |
| `MIN(a, b, …)`, `MAX(a, b, …)` | the least / the greatest of numbers, or of dates. A blank is skipped: `MAX(0, {balance})` |
| `TODAY()` | today, at 00:00 - the day the value is read |
| `DAYS(from, to)` | the days from the day of `from` to the day of `to`, a whole number: `DAYS({due}, TODAY())` is how many days late, negative before the due date. The time of day is left out, a day of summer time counts as one |
| `YEAR(d)`, `MONTH(d)` | the year, the month (1 to 12) of a date |
| `CONCAT(a, b, …)` | the values as one text, as `&` joins them |
| `COALESCE(a, b, …)` | the first value that is not blank - all of one type: `COALESCE({qty}, 0)` |
| `ISBLANK(x)` | true when x is blank |
| `LEFT(text, n)`, `RIGHT(text, n)` | the first / the last n characters: `LEFT({zip}, 2)` |
| `MID(text, start, n)`, `SUBSTRING(text, start, n)` | n characters from the start-th, the first is 1: `MID("2026-11-24", 6, 2)` is `11` |
| `LEN(text)` | how many characters - 0 for a blank |
| `UPPER(text)`, `LOWER(text)` | the text in upper / lower case |
| `TRIM(text)` | the text without the spaces around it |
| `CONTAINS(text, part)` | true when the text has the part, in any case: `CONTAINS({note}, "urgent")` |

The functions of text take a value of any type, as `&` does: a number as it is written, a date as
`YYYY-MM-DD` - `LEFT({born}, 4)` is the year as text. A count or a position that is not a whole number is
cut to one (`LEFT(x, 2.9)` is 2 characters), a negative one is 0, a start before 1 is 1. A letter made of
two UTF-16 units (an emoji) is one character.

### Types

Every part of a formula has its type before it runs - number, text, date or true / false - so a formula
that can not work is a problem at once, not a wrong value in some rows:

- A field has its type in the datasource (`fields`): a `datetime` is a date, a field that is not listed
  is a text. **List a number field as a number** to compute with it: `{age} * 2` on a field not listed
  is the problem *\* takes a number: {age} is a text*.
- `+ - * /`, ROUND, ABS take numbers; DAYS, YEAR, MONTH dates; AND, OR, NOT, IF's condition true / false.
- `=`, `<>`, the comparisons, IF's two values, COALESCE, MIN and MAX take values of one type.
- `&`, CONCAT and the functions of text take any: a number as it is written (`12.5`), a date as `YYYY-MM-DD`, true / false as
  `true` / `false`.

### Blanks

A field that is empty - null, undefined, `''`, an invalid date - is blank.

- **In a sum or a function of numbers or dates, a blank is a blank out**: `{price} * {qty}` is blank
  without a qty, `DAYS({due}, TODAY())` without a due date. To count a blank as 0:
  `{price} * COALESCE({qty}, 0)`.
- **A comparison with a blank is false**; `=` is true for two blanks and `<>` the other way round, so
  `{note} = ""` asks whether the note is blank. AND, OR, NOT and IF take a blank as false.
- `&`, CONCAT and the functions of text take a blank as `''` (`LEN` of a blank is 0, `LEFT` of one is
  blank); MIN and MAX skip it.
- 0 is a number, not a blank: `ISBLANK(0)` is false (the header filter takes 0 as blank, see
  [0 is blank](06-filtering.md#0-is-blank)).

### Comparisons and numbers

- **A text compares without its case**: `{status} = "late"` is true for `Late` and `LATE`. An accent
  counts: `"é" = "e"` is false.
- **A date compares its day**: `{due} < TODAY()` is true for a due date of yesterday, whatever its time.
- **A number computed keeps 15 significant digits**, as a spreadsheet: `0.1 + 0.2` is 0.3, and
  `406.09 * 10` 4060.9 - not the noise of binary numbers. Show it with a display format
  (`format: { number: { decimals: 2 } }`).

### A row where it can not be computed

A division by 0, a value that is not of its field's type (a text in a number field), a number too big,
a text of more than 10 000 characters: that row has no value, its cell is empty - nothing is thrown
while the grid renders. The grid config dialog's preview says why for the current row.

## How the values are provided

The rows are your objects in the datasource's proxy (see [Datasource](04-datasource.md)). The grid gives
the datasource a calculated field for each calculated column, and **the proxy answers a read of it with
its value, computed then**. Nothing is stored on a row:

- **It is never an edit.** A row is not edited or dirty by it, `getChanges()` does not have it, and so
  it is not sent to a server. `JSON.stringify(row)` and `Object.keys(row)` show your fields only.
  Setting it (`row.total = 5`) does nothing.
- **It is always the value of the row as it is**: after an edit of a field it reads, undo and redo,
  `upsert()` and live data, `resetData()` - there is nothing to compute again. The cells of a changed
  row are rendered again, the totals row follows.
- **Everything that reads a field reads it**: `datasource.filter()`, `sort()`, `group()`,
  `aggregate()`, `getField()` (its type and label); the cells, copy, the CSV and Excel exports, Find,
  the detail form.
- **The filter and the sort are not run again by an edit**, as for any field: the rows stay where they
  are until the next filter or sort.
- A formula runs on every read: it is read and checked once, then each read walks its parts - cheap.
  An aggregate of a calculated column is kept until a field it reads changes (or the day, with TODAY()).

The calculated fields are the datasource's container's: a second datasource on the same container
reads them too, and may not list one of their names in its `fields`. `gridInterface.destroy()` takes
the grid's calculated fields back.

## In the state

`GridState.calculatedColumns` has them by field name, as plain JSON:

```ts
import type { GridState } from '@simple-html/grid';

const calculatedColumns: GridState['calculatedColumns'] = {
    total: { formula: '{price} * {qty}', label: 'Total' },
    daysLate: { formula: 'DAYS({due}, TODAY())' }
};
gridInterface.setState({
    calculatedColumns,
    layout: { center: [{ fields: ['price', 'qty'], width: 80 }, { fields: ['total'], width: 90 }, { fields: ['daysLate'], width: 80 }] }
});
```

- It starts as `GridConfig.calculatedColumns` (or `initialState.calculatedColumns`), and `resetState()`
  goes back to it. `updateConfig({ calculatedColumns })` shows new ones at once and makes them what
  `resetState()` goes back to.
- `setState({ calculatedColumns })` replaces all of them - start from `getState().calculatedColumns` to
  change one. The rows are filtered, sorted and grouped again with their values.
- **A calculated column left out is taken out**: of the layout, the sort, the grouping, the filter (its
  conditions), the header filters, the detail form, and its format and aggregates go - it is no field
  anymore. The column chooser does not list it.
- **A saved state runs nothing**: a formula is text read by the grid's own small language, see
  [Security](#security).

## In the grid config dialog

The Columns tab of the [grid config dialog](08-formatting.md#the-grid-config-dialog) (the gear in the
footer):

- **Add calculated column**, under the list of the columns, adds one at the end of the list - `calc_1`,
  labelled *Calculated 1* - and picks it; the focus is in its formula.
- A calculated column has its settings at the top, in place of the label: **Field name** (an input
  while it is new; once applied it stays), **Label**, **Formula** with the `{ }` button that puts a field
  in at the caret (the columns and the calculated columns, by their labels, with a search), the type it
  gives (*Gives: Number*), its value in the row of the preview, and its problem - at once, the column is
  marked *Error* and Apply waits. A problem of the row (a division by 0) is said, it holds nothing back.
- **Remove calculated column** takes it out of the dialog; Apply takes it out of the state and the
  layout. A colour rule that reads one removed is a problem until it is changed.
- Its other settings - format, filter, colour rules - are those of its type, once it is applied with
  that type: before that, a hint says to apply first.
- **Apply** puts a new one at the end of the layout (center, 100px). *Reset column* gives a calculated
  column of the config its formula back, *Reset all* the calculated columns the grid starts with.

## Colour rules on several fields, and formulas

The [colour rules](08-formatting.md#colour-rules) of a column can look at the whole row: a rule of the
kind *Conditions* tests fields of the row - a calculated column too - all of them or any; one of the
kind *Formula* is a formula of this language that is true or false:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    calculatedColumns: { daysLate: { formula: 'DAYS({due}, TODAY())' } },
    columns: {
        customer: {
            format: {
                rules: [
                    {
                        conditions: [
                            { field: 'daysLate', operator: 'GREATER_THAN', value: '7' },
                            { field: 'balance', operator: 'GREATER_THAN', value: '0' }
                        ],
                        background: 'red'
                    },
                    { expression: '{status} = "waiting" AND {qty} >= 10', background: '#c4b5fd' }
                ]
            }
        }
    },
    layout: { center: [{ fields: ['customer'], width: 150 }, { fields: ['daysLate'], width: 80 }] }
};
```

## In a backend filter (SQL)

A calculated column is computed in the browser: the database has no column of it. Send the calculated
columns with the filter, and [`toSqlWhere({ calculated })`](22-sql.md#calculated-columns) writes each
formula as SQL - a filter on `total` compares `"price" * "qty"` - giving the values the grid computes, on
PostgreSQL, Oracle, SQLite and SQL Server:

```ts
// in the browser
const body = JSON.stringify({
    filter: gridInterface.getServerFilter({ calculated: 'keep' }),
    calculated: gridInterface.getState().calculatedColumns
});
```

Not yet: a formula with dates (a date field, TODAY, DAYS, YEAR, MONTH). The SQL guide has what differs.

## Security

A formula is part of the state, and a state can come from storage, a server or another user: it is
taken as hostile input.

- **No code runs.** The grid reads a formula with a tokenizer and a parser of its own into parts of a
  fixed set of kinds, checks it and runs it by a switch on the kind of each part: never `eval`,
  `new Function`, a timer of text, or a regular expression or css or html made from it.
- **Only its own names.** A function is one of the twelve above, looked up in a `Map`: `constructor`,
  `toString`, `__proto__` are no functions. There is no `.` or `[ ]`: nothing reaches an object.
- **Only fields.** A field is one the grid knows - of the datasource, a column, a calculated column -
  never one of the grid's own (`{__KEY}`, `{__proto__}`), and it is read as an own property of the row:
  nothing of a prototype.
- **Limits.** At most 1000 characters and 500 parts, nested at most 32 deep; a text it makes at most
  10 000 characters; a number finite. The language has no loops, and a calculated column computed from
  itself (straight or through others) is a problem: nothing can run long or recurse.
- **Data, never markup.** What a formula gives is a number, a text, a date or true / false, shown as
  text (an input's value, `textContent`): `"<img src=x onerror=alert(1)>"` shows as those characters.
- **The exports**: a text that starts with `=`, `+`, `-`, `@`, a tab or a line break is a formula to a
  spreadsheet that opens a CSV file - `getCsv()` puts a `'` in front of it by default
  (`escapeFormulas`, see [Formulas (CSV injection)](15-export.md#formulas-csv-injection)), a calculated
  value as any. The Excel export writes text as text, never as a formula. The clipboard does not escape
  it: a copy is pasted by the user, see [Selection and clipboard](17-selection-and-clipboard.md).
- **A field name** of a calculated column is a strict pattern (a letter, then letters, digits and `_`),
  never the name of a field of the rows or of every object.
- **The colours** of a colour rule are a name of the palette or `#` and six hex digits - nothing else
  reaches css, and a custom colour is set as the value of a css custom property.
- A state with anything else throws a `TypeError` in `setState()`, before anything changes.

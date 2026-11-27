# Filtering

A filter shows only the rows you want to see. The quickest way is to type in the filter row under the
column headers. For more, right-click a filter box for its menu, or build any filter in the filter
editor. The footer always shows what the rows are filtered by.

```tryit filtering
```

## Filter on a value

1. Click the filter box under a column header.
2. Type a value.
3. Press **Enter**, or leave the box with **Tab** or a click. The rows are filtered.

Filters on several columns work together: a row must match all of them. To remove a column's filter,
empty its box and press **Enter**.

How the value is compared depends on the column:

- **Text**: the whole text, upper or lower case alike. `ann` finds `Ann` and `ANN`, but not `Anna`.
  Use a [wildcard](#use-wildcards) or the operator *Contains* to search inside the text.
- **Number**: the number or more (`≥`). `30` shows 30 and up.
- **Date**: that day or later (`≥`). Type the date as the placeholder in the box shows it, or click
  the box and pick a day in the calendar, then **Use**. **Clear** removes the filter.

## Change the operator

The small symbol in the filter box is the operator: how the value is compared.

| Symbol | Operator | | Symbol | Operator |
| --- | --- | --- | --- | --- |
| `=` | Equal | | `*a*` | Contains |
| `≠` | Not Equal | | `!*a*` | Does not contain |
| `<` `≤` | Less than (or equal) | | `a*` | Begins with |
| `>` `≥` | Greater than (or equal) | | `*a` | Ends with |
| `a..b` | Between | | | |

To change it, click the symbol (or press **F4** in the filter box) and pick one. You can also
right-click the filter box and pick **Filter › Operator ›**. The filter runs again with the new
operator. Text columns have the text operators, number and date columns the others.

## Filter as you type

Normally a filter runs when you press **Enter**. With **Filter as you type** it runs by itself after a
short pause. Turn it on or off per column, at the bottom of the operator list (click the symbol), or in
the filter menu under **Filter ›**. A ✓ shows it is on. A number or date filter waits until what you
typed is a whole number or date.

## Use wildcards

In a text filter:

- `*` or `%` stands for any text, also none: `ann*` begins with "ann", `*ann*` has "ann" in it.
- `_` stands for exactly one character: `p_mp` finds `pump` and `pimp`.
- `\` before `*`, `%`, `_` or `\` makes it a plain character: `50\%*` finds `50% off` but not `500`.

## Match case

A text filter ignores upper and lower case. To match the case exactly, right-click the filter box
and pick **Filter › Match case** (a ✓ shows it is on), or pick **Match case** at the bottom of the
operator list. The box then shows **Aa** before the operator: `Ann` no longer finds `ANN`. Your app
can make a column always match case - a code column, `AB-1` is not `ab-1`; **Match case** is then greyed
out with the hint *always*, and in the grid config dialog its hint says *set by the application*.

Some long text columns (notes, descriptions) can only be filtered on their text: Equal, Not equal,
Contains, Does not contain, Begins with, Ends with and Blank. Their filter menu has no list of values, and a
calculated column can not use them.

## Find blank values

Right-click the filter box and pick **Filter › Blank › Is blank** or **Is not blank**. In a number
column, 0 counts as blank too.

## Filter as the cells show it

A date or number column can show its values in a format of its own (see
[Formatting](06-formatting.md)): a week, a month, `1 234,5`. Type the filter the same way the cells
show it, and the grid filters on the whole period:

- `2026-W47` in a column shown as weeks is that week, Monday to Sunday.
- `2026-11` is November, `2026 Q4` the fourth quarter, `2026` the year.
- `1 234,5` or `50 %` in a number column is read with the column's own separators.

The operator works on the whole period: with `=` you get only week 47, with `≥` week 47 and later,
with `≠` every other week. The number and date columns start with `≥`, so change the operator to `=`
to see one period only. This is called **Filter as shown** in **Grid config**, where it can be
turned off for a column (see [Grid config](14-grid-config.md)).

## Filter a range with Between

1. Change the operator to **Between** (`a..b`).
2. Type both ends with `..` between them: `10..20`, or `2026-01-01..2026-03-31`. Both ends are
   included. Leave one out for an open end: `10..` is 10 or more, `..20` is 20 or less.

In a date column, a click in the box opens two months side by side: click the first day, then the
last day, then **Use**.

## Use the filter menu

Right-click a filter box. Under **Filter ›** are the operator, Match case, Filter as you type, Blank,
**Clear Filter** (this column) and **Clear All Filters** (every column). Under it:

- **A number or date column** has a range block: pick `=`, `≠`, `<`, `≤`, `>`, `≥` or **Between**,
  type a value - or **From** and **To** - and press **Apply** (or **Enter**). A click in a date
  input opens the calendar.
- **A date column** also has quick dates, see [below](#pick-a-quick-date).
- **A text column** has a list of its values, see [below](#check-values-in-a-list).

**Cancel**, **Esc** or a click outside closes the menu and leaves the filter as it was.

## Pick a quick date

In the filter menu of a date column, click one of **Today**, **Yesterday**, **This week**, **Last
week**, **This month**, **Last month**, **This quarter**, **Last quarter**, **This year**, **Last year**,
**Last 7 days**, **Last 30 days** or **Next 7 days** - and on some columns **Overdue** (every day
before today). The rows are filtered at once. Hold the pointer over a button to see its dates.

A quick date stays relative: a filter on *This month* saved in a view shows the current month every
time you open it. You can also type the name in the filter box, such as `today` or `last week`.

## Check values in a list

The filter menu of a text column lists the values its cells show, each with the number of rows, like
the filter of a spreadsheet.

1. Uncheck the values you do not want, or uncheck **Select all** and check the ones you want.
2. Press **Apply**.

- **Blank**, at the top in italics, stands for the empty cells.
- **Search values** narrows the list. Check **Filter on the text: contains "…"** under it to filter
  on the text you typed instead of on the values checked.
- **Only values in filtered rows**: while other columns are filtered, the list has only their rows'
  values. Uncheck it to list the values of every row.
- The list shows the first 100 values. Search to find the others.

## Build a filter in the filter editor

The filter editor (**Filter Editor**) builds any filter, with AND and OR. Open it with **Filter ›
Advanced Filter…** in the filter menu, a click on the filter chips in the footer, or **No filter** in
the footer.

- Each line is a condition: pick a **Field**, an **Operator**, and type a **Value**. The arrows beside
  the value switch to comparing with another column of the same row.
- **Aa** after a text value turns Match case on for that condition.
- A group is a set of conditions with **AND** (all must match) or **OR** (one is enough). **+
  Condition** adds a condition to it, **+ Group** a group inside it.
- The trash can deletes a condition. The icons on a group's line wrap it in a new group or delete it.
- **Undo** and **Redo** (**Ctrl+Z** and **Ctrl+Y**, **⌘Z** and **⇧⌘Z** on a Mac) take back what you
  did in the editor, step by step. They do not change the grid's filter until you apply.
- **Apply** filters and keeps the window open, **Apply & close** filters and closes it, **Cancel**
  closes it and keeps the filter as it was.

## Read and clear the filter in the footer

The footer shows the filter as chips, such as `Age between 10 and 20` or `Order date = This month`.
Click the chips to change the filter in the filter editor. **✕ Clear** removes the whole filter.

## Filter on a cell's value

Right-click a cell and open **Filter ›**:

- **Replace filter** (*all*) shows only the rows with this value, and removes every other filter.
- **Add to filter** (*and*) keeps the filter and adds this value to it.

On an empty cell it filters on blank values.

## Filter special columns

- **A checkbox column** has a checkbox in its filter box. Click once: checked rows only. Again:
  unchecked rows only (empty ones too). A third time: no filter.
- **A column with a text built from several fields, or a link**, such as `Ann Berg (12)`, is
  filtered on the text you see: `*(12)*` finds it. Turn off **Filter as shown** in **Grid config** to
  filter on the column's own value instead.
- **A column where you pick from a list** (such as a country code shown as `Norway`) is filtered on
  the name you see: type `Norway`, not `NO`, and the value list lists the names. The filter editor
  shows the codes, which is what the rows hold.
- **A calculated column** (see [Calculated columns](07-calculated-columns.md)) is filtered like any
  other column of its type: a number, a date or a text.

To see only the rows you have changed, pick **View › Changed rows only** in the row menu. To see only
rows with a certain text in any column, use **Filter rows** in the find bar, see [Find](10-find.md).

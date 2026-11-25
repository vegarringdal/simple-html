# Sorting

Sort the rows by clicking a column header. You can sort by one column, or by several: first by one,
then by the next within equal values. The sort stays when the rows are filtered or reloaded.

## Sort by a column

1. Click the column header (the name of the column). The rows are sorted A to Z, smallest to
   largest, oldest to newest.
2. Click it again to sort the other way. Each click after that turns the order around again.

An arrow in the header shows the sort: pointing up for ascending, down for descending. Clicking a
header sorts by that column only - the sort there was is replaced.

On a touch screen, tap the header. A header you hold still for a moment is dragged instead, to move
the column (see [Columns](05-columns.md)).

From the keyboard: put the focus on the header (**Alt+ArrowUp** from its filter box) and press
**Enter** or **Space**.

## Sort by several columns

1. Click the first column's header.
2. Hold **Shift** and click the next column's header. Its rows are sorted within the equal values of
   the first column.
3. Shift+click more headers to add more columns.

Each sorted header shows its arrow with a small number: 1 for the first column of the sort, 2 for the
next, and so on. Shift+click on a column that is in the sort already turns its order around and keeps
its place. From the keyboard, press **Shift+Enter** or **Shift+Space** on a header.

There is no Shift key on a touch screen, so there a tap always sorts by one column.

## Remove the sort

Right-click any column header and pick **Remove sorting**. The arrows go away. The rows keep the order
they have until they are filtered again; then they come back in the order they were loaded.

When the rows are grouped, the grouped columns stay sorted: grouping needs it (see
[Grouping](04-grouping.md)).

## Know how values are sorted

- **Blank cells** come first when you sort ascending, and last when you sort descending. A 0 is a
  number, not blank.
- **Text** is sorted alphabetically, with upper and lower case together: `apple` and `Apple` end up
  next to each other.
- **Dates** are sorted by day. A date and time column is sorted by the full time.
- **Yes/no** (checkbox) columns sort unchecked before checked.
- **A column where you pick from a list** - such as a country code shown as `Norway` - is sorted by
  the name you see: Denmark, Norway, Sweden. Not by the codes behind them.
- **A column shown in a format of its own** (a week, a month, a number with separators) is sorted by
  its real value, the date or the number - not by the text shown.
- **A column that shows a text built from several fields**, such as `Ann Berg (12)`, is sorted by its
  own value, not by the whole text you see.
- **A calculated column** (see [Calculated columns](07-calculated-columns.md)) is sorted as its type:
  a number, a date or a text.

## Sort while grouped

When the rows are grouped (see [Grouping](04-grouping.md)), the groups always stay together:

- Click the header of the grouped column to turn the order of the groups around.
- Click another column's header to sort the rows inside each group.

## Keep a sort

The sort is part of the grid's state. When your app keeps the state, or you save a view (see
[Views](13-views.md)), the sort comes back the next time.

# Grouping

Grouping puts rows with the same value together under a group row, such as all the orders of one
customer. You can group by one column, or by several for groups inside groups. Group rows can show
totals of the rows in them, and a totals row under all the rows can show the totals of everything you
have filtered.

```tryit grouping
```

## Group by a column

1. Find the grouping panel: the thin strip above the column headers.
2. Drag a column header up into the panel and drop it there.

The rows are grouped by that column. The panel shows a chip with the column's name. On a touch
screen, hold the header still for a moment, then drag it.

Your app may hide the grouping panel. Then you can not group the rows yourself.

## Group inside groups

Drag a second column header into the panel, after the first chip. Each group then has groups of its
own: customers, and within each customer the order dates, say.

- **Change the order of the levels**: drag a chip in the panel to another place. Dropped on the left
  side of a chip, it goes before that chip.
- A column header dropped on the left side of a chip is put in at that place, too.

## Open and close groups

Each group row shows the column's name, the value and the number of rows: `Country: Norway (12)`.
The rows with an empty value are one group at the top, named `blank`.

- Groups start closed. Click the **+** box on a group row to open it, **-** to close it.
- From the keyboard, press **Enter** or **Space** on a group row's box.
- To open or close all groups at once, right-click a column header and pick **Grouping › Expand all**
  or **Grouping › Collapse all**.

Lines at the left of the rows show which group each row belongs to, like a tree.

## Group by week, month, quarter or year

A date column groups by day. To group by a longer period, show the column in that format first:

1. Right-click the date column's header.
2. Pick **Format ›** and one of **Week, ISO**, **Week, US**, **Month**, **Quarter** or **Year**.
3. Group by the column as above.

There is now one group per period: `Due: 2026-W47 (8)`. Pick another format and the rows are grouped
again. See [Formatting](06-formatting.md) for the formats.

## Show totals in the group rows

Right-click the header of the column you want a total of, and open **Aggregate ›**:

| Item | Shows | Columns |
| --- | --- | --- |
| **Sum** | the sum of the numbers | number columns |
| **Average** | the average of the numbers | number columns |
| **Min** | the smallest number | number columns |
| **Max** | the largest number | number columns |
| **Count** | how many cells are not empty | every column |

Each is turned on or off with a click; a ✓ shows it is on. You can turn on several for one column.

Every group row then shows the value in that column, over all the rows of the group (also of the
groups inside it, open or closed). Each value has its own line with a short label: `Sum`, `Avg`,
`Min`, `Max` or `Count`. Your app may turn the totals in the group rows off.

## Show a totals row

Right-click a column header and pick **Aggregate › Totals row**. A row with **Total** at its left
appears under the rows, with the sum, average and so on of each column that has one turned on. It
counts every row of the filter, also the rows of closed groups - so it changes when you filter. The
totals row is not part of an export to Excel or CSV.

The totals row also works when the rows are not grouped.

## Sort the groups

The groups are sorted by their value, A to Z. Click the header of the grouped column to turn the
order of the groups around. Click another header to sort the rows inside each group. See
[Sorting](03-sorting.md#sort-while-grouped).

## Remove grouping

- **One level**: click the **✕** on its chip in the grouping panel. From the keyboard, **Tab** to the
  ✕ and press **Enter**.
- **All grouping**: right-click a column header and pick **Grouping › Clear all**.

## Know a few details

- A column where you pick from a list (such as a country code shown as `Norway`) groups by the code
  the rows hold: `Country: NO (12)`. The groups are in the order of the names.
- A group row can not be selected, edited or deleted.
- Find (**Ctrl+F**) only searches the rows of open groups, see [Find](10-find.md).
- The grouping, the open groups and the totals are kept with the grid's state, and in a saved view
  (see [Views](13-views.md)).

# Sorting and grouping

Sorting and grouping are done by the datasource. The user does them in the grid's header, you do
them from code, and the grid shows the result.

## Sorting

The user clicks (or taps) a header label to sort on that column, ascending. A second click sorts it
descending. Shift+click adds the column to the sort there is. A press that moves the label is a drag,
not a click, see [Moving and resizing columns](02-grid-config.md#moving-and-resizing-columns). The header menu's "Remove sorting"
removes the sort, apart from the grouped fields.

From code:

```ts
datasource.sort({ attribute: 'company', ascending: true }); // replaces the sort there was
datasource.sort({ attribute: 'age', ascending: false }, { add: true }); // company, then age

datasource.sort([
    { attribute: 'country', ascending: true },
    { attribute: 'company', ascending: false }
]);

datasource.sort(); // sort again with the sort there is, e.g. after edits
datasource.getLastSorting(); // [{ attribute: 'country', ascending: true }, { attribute: 'company', ascending: false }]
```

- With `{ add: true }`, a field that is in the sort already gets the new direction and keeps its
  place. A list (`sort([a, b])`) always replaces the sort.
- `setOrderBy(args, { add })` sets the sort without sorting, `sort()` sorts.
- `resetSort()` clears the sort, the rows keep their order. `filter()` after it gives them back the
  order they were set in - sorted on the grouped fields when grouped.
- The sort stays when the data changes: `setData()` sorts the new rows.

How values compare:

- Empty values (`null`, `undefined`, `''`, an invalid date) come first when ascending, last when
  descending. `0` and `false` are values, not empty.
- Text is compared with `localeCompare`. `datasource.setLocaleCompare('nb')` sorts it with the
  rules of a language (an `Intl.Collator`).
- A `date` field sorts on the day, the time is ignored. A `datetime` field sorts on the full time.
- In a grid, a `text` column with a [template or a link](08-formatting.md#what-a-template-and-a-link-change)
  sorts on the text its cells show (`{last}, {first}` sorts by the last name), a column grouped by on
  its value. A lookup column sorts on the name it shows.

The sort is part of the grid's [state](03-state.md): `getState().sorting`. To start sorted, put it
in the config's `initialState`.

## Grouping

The user groups by dragging a header label to the panel above the header. A group shows as a chip
in the panel: its icon removes it, and the chips can be dragged to change the order. A group row
shows the group's name and its number of rows, and its `+` / `-` box expands or collapses it. The
header menu has "Expand all", "Collapse all" and "Clear all".

Left of the rows each level of grouping has a column, like a tree: a group row has its box in the
column of its level, and the line of an expanded group runs from under its box down through its rows,
so where a group ends shows. The colour of the lines and the box's frame is
`--simple-html-grid-group-line-color` (see [Theming](13-theming.md)).

From code:

```ts
datasource.group([{ attribute: 'country', title: 'Country' }]);
datasource.group([{ attribute: 'company', title: 'Company' }], { add: true }); // country, then company

datasource.expandGroup(); // every group
datasource.collapseGroup(); // every group
datasource.expandGroup('Norway'); // one group, by its id

datasource.group([]); // no grouping. removeGroup() does the same
```

- `attribute` is the field, `title` the text in front of the value in the group row:
  `Country: Norway`. Its first letter is shown in upper case.
- `group()` sorts the rows on the grouped fields, ascending, and replaces the sort there was. A
  `sort()` after it sorts within the groups, the grouped fields stay first.
- **Groups start collapsed**, only the ids given to `setExpanded()` start expanded. `getExpanded()`
  lists the expanded ids.
- A row is grouped on its value as the field's formatter shows it: a `date` field groups by day, a
  number with its decimals as the formatter shows them. In a grid, a date column shown as weeks,
  months, quarters or years (its display format `weekIso`, `weekUs`, `month`, `quarter`, `year`, see
  [Display formats](08-formatting.md#display-formats)) groups by them: `Due: 2026-W47`. Another format
  for the column groups the rows again. The rows with an empty value are one group
  at the top, its id is `' blank'`.
- Use `group()` to group. `setGrouping()` only stores the grouping: the next call that builds the
  displayed rows (`group()`, `sort()`, `filter()`, `setData()` ...) groups them.
- **The rows are always grouped sorted on the grouped fields**, whatever led there: `group()`,
  `sort()`, `filter()` after `setGrouping()`, `setOrderBy()` or `resetSort()`. The grouped fields come
  first in the sort, each with the direction the sort gives it (ascending when it has none), the other
  fields of the sort after them. A group is built from each run of equal values, so the rows of a
  group have to be next to each other.
- `removeGroup(group)` removes one level, found by its field: the object from `getGrouping()` or a
  copy, e.g. from a saved state. A field that is not grouped on changes nothing.
- **Sums in the group rows**: a column with an `aggregate` (`'sum'`, `'avg'`, `'min'`, `'max'` or
  `'count'`) shows it in its place in every group row, over the group's rows - collapsed sub groups
  included. The name stays at the left. See [Aggregates](18-aggregates.md).

The grouping and the expanded groups are part of the grid's [state](03-state.md):
`getState().grouping` and `expandedGroups`.

```sample sorting-grouping
```

## Group rows

When the datasource is grouped, `getRows()` has a group row in front of each group, and leaves out
the rows of a collapsed group. A group row is a `GroupRow`, made by the datasource, not one of your
objects. `isGroupRow(row)` tells it from a data row, and narrows the type:

```ts
import { isGroupRow } from '@simple-html/grid';

datasource.group([{ attribute: 'country', title: 'Country' }]);
datasource.expandGroup();

for (const row of datasource.getRows()) {
    if (isGroupRow(row)) {
        console.log(row.__groupName, row.__groupTotal); // 'Country: Norway', 2
    } else {
        console.log('  ', row.name);
    }
}

// the data rows only, the rows of collapsed groups included
const names = datasource.getDataRows().map((row) => row.name);
```

| field | what it is |
| --- | --- |
| `__group` | always `true` |
| `__groupID` | the id for `expandGroup(id)` / `collapseGroup(id)`: the value as formatted, e.g. `'Norway'` |
| `__groupName` | the text the grid shows: `'Country: Norway'` |
| `__groupLvl` | the level, 0 for the first grouped field. The grid indents by it |
| `__groupTotal` | the number of data rows in the group, its sub groups included. More sums of a group: `datasource.aggregate(field, fn, groupRow)`, see [Aggregates](18-aggregates.md#from-code) |
| `__groupChildren` | its rows: data rows, or the group rows of the next level |
| `__groupExpanded` | `true` when the group is expanded |

Read the fields, do not change them. A group row can not be selected, edited or marked for
deletion: `getSelectedRows()`, `getDataRows()` and `getAllData()` never have one. `getRow(n)` and
`currentEntity` can, check them with `isGroupRow()`.

## Groups in groups

Each field given to `group()` is one level. The id of a sub group starts with the ids of the groups
above it, joined by `-`:

```ts
import { isGroupRow } from '@simple-html/grid';

datasource.group([
    { attribute: 'country', title: 'Country' },
    { attribute: 'company', title: 'Company' }
]);

datasource.expandGroup('Norway'); // the first level
datasource.expandGroup('Norway-ACME'); // company ACME in Norway, and Norway if it was collapsed

const ids = datasource
    .getRows()
    .filter(isGroupRow)
    .map((row) => `${'  '.repeat(row.__groupLvl)}${row.__groupID}`);
```

- Expanding a sub group expands the groups above it too, so it is shown:
  `expandGroup('Norway-ACME')` while `Norway` is collapsed expands both.
- A sub group stays expanded when the group above it is collapsed and expanded again.
- `expandGroup()` and `collapseGroup()` without an id work on every level.

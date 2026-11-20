# State

The config is what you write. The state is what the user changes while working with the grid. Read
it with `getState()`, give it back with `setState()`, and go back to the start with `resetState()`.

## What the state is

`gridInterface.getState()` returns a `GridState`:

| part | what it is |
| --- | --- |
| `layout` | the column order, pinning and widths: the user drags, pins, hides and resizes columns |
| `sorting` | the sort, as `datasource.getLastSorting()`. When grouped, the grouped fields come first |
| `grouping` | the grouping, as `datasource.getGrouping()` |
| `expandedGroups` | the ids of the expanded groups |
| `filter` | the filter the rows are filtered by, as `datasource.getFilter()`. `null` when there is none |
| `headerFilters` | what each header filter cell shows: the value and the operator picked in its menu |

```ts
const state = gridInterface.getState();
state.layout.center.map((column) => column.fields); // [['name'], ['age', 'born']]
state.sorting; // [{ attribute: 'name', ascending: true }]
state.filter; // { group: 'AND', children: [{ field: 'age', operator: 'GREATER_THAN_OR_EQUAL_TO', value: 30 }] }
state.headerFilters; // { age: { value: 30 } }
```

`filter` is what the rows are filtered by. `headerFilters` is only what the header cells show: the
conditions a header filter made are in `filter` already. Keep both, as `getState()` gives them, so
the header shows what the rows are filtered by.

These are **not** state: the options (`readonly`, `dimRepeatedValues`, sizes ... see
[Grid config](02-grid-config.md)), the data and its edits, the selected rows, the current row, the
selected columns and the scroll position.

## `getState()`, `setState()` and `resetState()`

```ts
const saved = gridInterface.getState();

// ... the user sorts, filters and moves columns around

gridInterface.setState(saved); // back to what it was
gridInterface.resetState(); // back to the state the grid started in
```

- `getState()` returns a copy. Changing it changes nothing in the grid, and what the user does
  later does not change it.
- `setState()` applies the parts it is given and **keeps the rest**. Within a part nothing is
  merged: `layout` replaces the whole layout, `headerFilters` every header filter.
- `setState()` copies what it is given with `structuredClone`, so a `Date` stays a `Date`. The
  state must be plain data: no functions, no rows from the datasource.
- `resetState()` goes back to `initialState` (below), with the config's `layout`. What
  `initialState` leaves out is cleared: no sorting, no grouping, no filter.

```ts
gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] }); // only the sort
gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: [] });
gridInterface.setState({ filter: null, headerFilters: {} }); // no filter, empty header filters
```

An empty `sorting` gives the rows back the order they were set in.

## Saving it

The state is plain data, so it can be stored as JSON. A `Date` in a filter becomes its ISO text,
which a `date` or `datetime` field filters on the same way.

```ts
import type { GridState } from '@simple-html/grid';

const KEY = 'orders-grid-state';

// e.g. when the page is left
window.addEventListener('beforeunload', () => {
    localStorage.setItem(KEY, JSON.stringify(gridInterface.getState()));
});

// when the grid is made
const saved: GridState | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
if (saved) {
    gridInterface.setState(saved);
}
```

A saved layout is the layout the user had. When you add a column to the config later, a state saved
before does not have it. Put a version in the key, and change it when the layout in the config
changes.

```sample grid-state
```

## The state the grid starts in

`initialState` in the config is the state the grid starts in, and the one `resetState()` goes back
to. It takes the same parts as `setState()`. The layout comes from the config's `layout`, unless
`initialState` has one.

```ts
import { type GridConfig, where } from '@simple-html/grid';

const config: GridConfig = {
    layout: {
        center: [
            { fields: ['name'], width: 150 },
            { fields: ['age'], width: 80 }
        ]
    },
    initialState: {
        sorting: [{ attribute: 'name', ascending: true }],
        filter: where('age', 'GREATER_THAN_OR_EQUAL_TO', 18),
        headerFilters: { age: { value: 18 } } // what the age header filter shows
    }
};
```

The grid applies `initialState` to the datasource when it is made: a filter, sort or grouping
set on the datasource before is replaced, and **cleared when `initialState` leaves it out**. Set
them in `initialState`, or on the datasource after the grid is made.

`updateConfig({ initialState })` changes what the next `resetState()` goes back to, it changes
nothing now. Call `resetState()` after it to apply it at once.

## Header filters in the state

`headerFilters` is keyed by field. Only the columns whose header filter has a value, or an operator
picked in its menu, are listed:

```ts
import type { GridState } from '@simple-html/grid';

const headerFilters: GridState['headerFilters'] = {
    name: { value: 'ann*' }, // typed in the name column
    age: { value: 30, operator: 'LESS_THAN_OR_EQUAL_TO' }, // the operator picked in the menu
    active: { value: true } // a boolean column's checkbox
};
```

The operator picked in a header filter's menu is state. The column's `operator` in the config is
only the operator its header filter starts with, the grid never changes it. See
[Filtering](06-filtering.md#header-filters).

To set a filter from code that the header also shows, set both:

```ts
import { and, where } from '@simple-html/grid';

gridInterface.setState({
    filter: and(where('country', 'EQUAL', 'Norway')),
    headerFilters: { country: { value: 'Norway' } }
});
```

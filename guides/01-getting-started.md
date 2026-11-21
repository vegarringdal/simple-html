# Getting started

`@simple-html/grid` is a data grid for plain TypeScript or JavaScript apps, no framework needed. Its
only dependency is lit-html, which is installed with it. This page installs it and puts a first grid
on a page.

## Install

The package is not on npm. Install it from a git branch: the `prepare` script builds `dist` when it
is installed.

```json
"dependencies": {
    "@simple-html/grid": "github:airemote/simple-html#<branch>"
}
```

Or make a tgz in a clone of the repo with `npm run build:tgz`, copy it from `build/` into your
project and point to the file:

```json
"dependencies": {
    "@simple-html/grid": "file:./libs/simple-html-grid-X.Y.Z.tgz"
}
```

## Css

The grid needs its stylesheet. Date cells and date header filters open a date picker, which has a
stylesheet of its own. Both are imported from the package root:

```ts
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css'; // the date picker
```

A bundler such as esbuild or Vite handles the css import. Without one, link the files from
`node_modules/@simple-html/grid/dist/` in your html.

## A first grid

A grid needs two things:

- a `Datasource`: your rows, and the type of each field that is not text
- a `GridConfig`: the columns to show and the options of the grid

Both take plain data, JSON, so they can be stored. What has to be code - a cell readonly from its
row, css classes from the row, changes to the menus - are hooks, given next to them:
`createGrid(host, { config, datasource, hooks })`, see [Grid config](02-grid-config.md#hooks).

`createGrid()` puts the grid in a container and returns the grid interface, the object you work
with the grid through. The grid fills the container, so the container needs a height:

```html
<div id="grid" style="height: 400px"></div>
```

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css';

// the fields that are not text, with their type. A field that is not listed is text
const datasource = new Datasource({
    key: 'id',
    fields: {
        age: 'number',
        born: { type: 'date', label: 'Born' },
        active: 'boolean'
    }
});

datasource.setData([
    { id: 1, name: 'Ann', age: 36, born: new Date(1990, 4, 17), active: true },
    { id: 2, name: 'Bob', age: 41, born: new Date(1985, 0, 2), active: false },
    { id: 3, name: 'Cid', age: 25, born: new Date(2001, 11, 24), active: true }
]);

// layout: where the columns go and how wide they are. columns: the options of a column, by field
const config: GridConfig = {
    columns: {
        name: { label: 'Name' }
    },
    layout: {
        center: [
            { fields: ['name'], width: 150 },
            { fields: ['age'], width: 80 },
            { fields: ['born'], width: 110 },
            { fields: ['active'], width: 80 }
        ]
    }
};

const gridInterface = createGrid(document.getElementById('grid')!, { config, datasource });
```

```sample basic-grid
```

Out of the box the user can:

- sort: click a header label, shift+click to sort on one more column
- filter: type in the row under the labels and press Enter, see [Filtering](06-filtering.md)
- resize a column (drag its right edge) and move it (drag its label) - with a mouse, a pen or a
  finger, see [Moving and resizing columns](02-grid-config.md#moving-and-resizing-columns)
- group: drag a label to the panel above the header, see [Sorting and grouping](07-sorting-grouping.md)
- right click a cell, a label or a header filter for a menu, see [Menus](10-menus.md)

The grid is **readonly by default**. Set `readonly: false` in the config to edit cells, see
[Editing](05-editing.md).

## Why the fields matter

The datasource sorts, filters, groups and formats a field by its type. A `number` field sorts as a
number and is right aligned, a `date` field gets a date picker and filters on the day, a `boolean`
field is a checkbox. A field you do not list is `text`. List every field that is not text:

```ts
import { Datasource } from '@simple-html/grid';

const datasource = new Datasource({
    fields: {
        balance: 'number',
        born: 'date', // the day: 2026-11-20
        lastLogin: 'datetime', // the time too: 2026-11-20T08:15:00
        active: 'boolean'
    }
});
```

The values must have the type: numbers for a `number` field, `Date` objects for `date` and
`datetime`. Convert dates from JSON when you load them. See [Datasource](04-datasource.md).

## Done with the grid

`destroy()` takes the grid off the page and disconnects it from the datasource. The datasource
keeps its rows, it can be shown in a new grid.

```ts
gridInterface.destroy();
```

## Placing the element yourself

`createGrid()` makes a `<simple-html-grid>` element that fills the container. To place and size it
yourself, make the element and connect a `GridInterface` to it:

```ts
import { GridElement, GridInterface, type GridConfig } from '@simple-html/grid';

const config: GridConfig = { layout: { center: [{ fields: ['name'], width: 150 }] } };

const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.connectInterface(new GridInterface(config, datasource));
host.appendChild(element);
```

Removing such an element from the page disconnects the grid too, it connects again when the
element is put back.

## Where to go next

- [Grid config](02-grid-config.md) - columns, layout, every option, the hooks and saving the config
- [State](03-state.md) - save and restore what the user changed: sorting, filters, column order
- [Datasource](04-datasource.md) - data in and out, keys, fields, selection
- [Editing](05-editing.md) - editing, change tracking, deleting rows, saving
- [Filtering](06-filtering.md) - the header filters, the filter editor, filters from code
- [Sorting and grouping](07-sorting-grouping.md)
- [Formatting](08-formatting.md) - how values are shown and parsed
- [Events](09-events.md) - every event and what it sends
- [Menus](10-menus.md) - change the right click menus, open menus of your own
- [Migrating from v5](11-migrating-from-v5.md)
- [Texts](12-texts.md) - translate the grid: every text by id, `setTexts()`

# Migrating from v5

v6 changes the API: the datasource knows its fields, the grid config is split from its state, events
are subscribed one by one, and filters, menus and options are plain data. TypeScript points to most
of the places to change.

[MIGRATION.md](../MIGRATION.md) has every breaking change with code before and after:

- [Package](../MIGRATION.md#package): the css path, installing from git
- [Renamed](../MIGRATION.md#renamed) and [Removed](../MIGRATION.md#removed): `Formater` is
  `Formatter`, `deSelectAll` is `deselectAll` ...
- [Events](../MIGRATION.md#events): `on()` instead of `addEventListener`, kebab case names
- [Group rows are not entities](../MIGRATION.md#group-rows-are-not-entities): `GroupRow`,
  `isGroupRow()`
- [Fields and formatters](../MIGRATION.md#fields-and-formatters): `new Datasource(options)`, types in
  `fields`, `date` and `datetime`, formatters per field
- [Filters](../MIGRATION.md#filters): one filter format, `and()` / `or()` / `where()`, and
  [a converter for saved v5 filters](../MIGRATION.md#saved-configs)
- [Options objects instead of boolean flags](../MIGRATION.md#options-objects-instead-of-boolean-flags)
- [Change tracking](../MIGRATION.md#change-tracking-getchanges): the typed `getChanges()`
- [Grid config](../MIGRATION.md#grid-config): `columns` and `layout`, the state, and
  [a converter for a v5 config](../MIGRATION.md#a-v5-config-converted)
- [Setup, callbacks and methods of the grid](../MIGRATION.md#setup-callbacks-and-methods-of-the-grid):
  `createGrid()`, `isReadonly` / `cellClass`, `updateConfig()`, renamed methods
- [Menus](../MIGRATION.md#menus): `GridConfig.menus`, `openMenu()`
- [Internals are no longer in the typings](../MIGRATION.md#internals-are-no-longer-in-the-typings)
  and [Types are stricter](../MIGRATION.md#types-are-stricter)

Below are the ten changes almost every app has to make.

## 1. Css and setup

The css is imported from the package root, and `createGrid()` replaces the element, its class and
`connectInterface()`.

```ts nocheck
// v5
import '@simple-html/grid/dist/grid.css';

const gridInterface = new GridInterface(gridConfig, datasource);
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);
container.appendChild(element);
```

```ts
// v6
import { createGrid, type GridConfig } from '@simple-html/grid';
import '@simple-html/grid/grid.css';

declare const gridConfig: GridConfig;

const grid = createGrid(host, { config: gridConfig, datasource });
grid.destroy(); // when done with it, new in v6
```

See [Getting started](01-getting-started.md).

## 2. The datasource takes one options object, with the types

`new Datasource(new DataContainer(key), options)` is `new Datasource({ key, ... })`. The types of
the fields move from the grid config's `attributes` and `setDates()` to `fields`.

```ts nocheck
// v5
const datasource = new Datasource(new DataContainer('id'), { selectionMode: 'single' });
datasource.setDates(['born']);
// and in the grid config: attributes: [{ attribute: 'age', type: 'number' }, { attribute: 'born', type: 'date' }]
```

```ts
// v6
import { Datasource } from '@simple-html/grid';

const people = new Datasource({
    key: 'id',
    fields: { age: 'number', born: 'date' } // a field not listed is text
});
```

A grid sets the selection mode from its own config, so `selectionMode: 'single'` goes in the
`GridConfig`. See [Datasource](04-datasource.md).

## 3. `columns` and `layout` replace `attributes` and `columns*`

```ts nocheck
// v5
const gridConfig: GridConfig = {
    columnsPinnedLeft: [{ rows: ['name'], width: 150 }],
    columnsCenter: [{ rows: ['age', 'born'], width: 100 }],
    attributes: [
        { attribute: 'name', label: 'Name', placeHolderFilter: 'search' },
        { attribute: 'age', readonly: true }
    ]
};
```

```ts
// v6
import type { GridConfig } from '@simple-html/grid';

const gridConfig: GridConfig = {
    columns: {
        name: { label: 'Name', placeholderFilter: 'search' },
        age: { readonly: true }
    },
    layout: {
        left: [{ fields: ['name'], width: 150 }],
        center: [{ fields: ['age', 'born'], width: 100 }]
    }
};
```

`placeHolderRow` and `placeHolderFilter` are `placeholderRow` and `placeholderFilter`. See
[Grid config](02-grid-config.md).

## 4. Events: `on()`

```ts nocheck
// v5
datasource.addEventListener({
    handleEvent: (e) => {
        if (e.type === 'selectionChange') {
            updateToolbar();
        }
        return true; // keep listening
    }
});
```

```ts
// v6
declare function updateToolbar(): void;

const off = datasource.on('selection-change', () => updateToolbar());
off(); // unsubscribe
```

The handler gets the payload, not `{ type, data }`. What it returns is ignored. `selectionChange`,
`currentEntity` and `gridConnected` are kebab case now: `selection-change`, `current-entity` and
`grid-connected`. See [Events](09-events.md).

## 5. Filters: one format and builders

```ts nocheck
// v5
datasource.filter({
    type: 'GROUP',
    logicalOperator: 'AND',
    filterArguments: [
        { type: 'CONDITION', logicalOperator: 'NONE', attribute: 'age', attributeType: 'number', operator: 'GREATER_THAN', value: 18, valueType: 'VALUE' }
    ]
});
```

```ts
// v6
import { and, where } from '@simple-html/grid';

datasource.filter(and(where('age', 'GREATER_THAN', 18)));
datasource.filter(null); // no filter. In v5 filter(null) ran the filter again
```

The type comes from the datasource's `fields`. A filter saved by v5 is ignored, MIGRATION.md has a
[converter](../MIGRATION.md#saved-configs). See [Filtering](06-filtering.md).

## 6. Options objects instead of boolean flags

```ts nocheck
// v5
datasource.setData(rows, true);
datasource.sort({ attribute: 'age', ascending: false }, true);
datasource.markForDeletion(null, true);
const dataRows = datasource.getRows(true);
```

```ts
// v6
declare const rows: object[];

datasource.setData(rows, { add: true });
datasource.sort({ attribute: 'age', ascending: false }, { add: true });
datasource.markAllForDeletion();
const dataRows = datasource.getDataRows();
```

A boolean passed the v5 way throws a `TypeError` that shows the v6 way to write it.

## 7. Formatters per field

```ts nocheck
// v5
datasource.setNumberFormater(NumberFormaterComma);
datasource.setDateFormater(DateFormaterDDMMYYYY);
```

```ts
// v6
import { Datasource, DateFormatterDDMMYYYY, NumberFormatterComma } from '@simple-html/grid';

const orders = new Datasource({
    fields: { price: 'number', ordered: 'date' },
    formatters: { number: NumberFormatterComma, date: DateFormatterDDMMYYYY }
});
```

`Formater` is spelled `Formatter`, and a formatter is an object with `format` and `parse`. See
[Formatting](08-formatting.md).

## 8. The state: `getState()` and `setState()`

```ts nocheck
// v5
localStorage.setItem('grid', JSON.stringify(gridInterface.saveConfig()));
gridInterface.loadConfig(JSON.parse(localStorage.getItem('grid')));
gridInterface.loadInitConfig();
```

```ts
// v6
localStorage.setItem('grid', JSON.stringify(gridInterface.getState()));
gridInterface.setState(JSON.parse(localStorage.getItem('grid') ?? '{}'));
gridInterface.resetState();
```

The state has no options: change an option with `updateConfig()`. A grid that starts sorted,
grouped or filtered sets it in `initialState`, not as `sorting` / `grouping` / `filter` in the
config. See [State](03-state.md).

## 9. Callbacks in the config, renamed methods

```ts nocheck
// v5
gridInterface.readonlySetter((attribute, rowData) => (attribute === 'company' && !rowData.isActive ? true : null));
gridInterface.cellAppendClassSetter((attribute, rowData) =>
    attribute === 'balance' && rowData.balance < 0 ? { inputClass: 'red', dimmedClass: '' } : { inputClass: '', dimmedClass: '' }
);
gridInterface.triggerScrollEvent();
gridInterface.triggerRebuild();
```

```ts
// v6
import type { GridConfig } from '@simple-html/grid';

const gridConfig: GridConfig = {
    layout: { center: [{ fields: ['company'], width: 150 }, { fields: ['balance'], width: 100 }] },
    isReadonly: (row, field) => (field === 'company' && !row.isActive ? true : null),
    cellClass: (row, field) => (field === 'balance' && row.balance < 0 ? { input: 'red' } : null)
};

gridInterface.refresh(); // was triggerScrollEvent()
gridInterface.rebuild(); // was triggerRebuild()
```

The row comes first. `getAttributeColumns()` is `getLayoutFields()`, `getOptionalAttributes()` is
`getHiddenFields()`. See [Grid config](02-grid-config.md).

## 10. Menus

```ts nocheck
// v5
gridInterface.contextMenuCustom(data.originalEvent, [{ value: 'Apple', label: 'Apple', isHeader: false }], data.cell, (value) => {
    data.rowData.fruit = value;
    gridInterface.triggerScrollEvent();
});
```

```ts
// v6
gridInterface.on('cell-click', (data) => {
    gridInterface.openMenu(data.originalEvent, [
        {
            id: 'fruit.apple',
            label: 'Apple',
            action: () => {
                data.rowData.fruit = 'Apple';
                gridInterface.refresh();
            }
        }
    ]);
});
```

`setContextMenuElement(element)` is a block of a menu: `openMenu(cell, [{ type: 'block', id, element }])`.
The grid's own menus are changed with `GridConfig.menus`. See [Menus](10-menus.md).

## Group rows

One more change that hits code that reads rows: when grouped, the group rows in `getRows()` are a
`GroupRow`, not an entity. `isGroupRow(row)` replaces `row.__group`, and `getDataRows()` gives the
data rows only. See [Sorting and grouping](07-sorting-grouping.md#group-rows).

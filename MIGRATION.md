# Migrating from v5 to v6

Every breaking change in v6, with what to change in your code. Ordered by area, not by date.

## Package

### Css is imported from the package root

The package now has an `exports` map, so files inside it can only be imported through the paths
it lists. The css moved from `dist/` to the root:

```ts
// v5
import '@simple-html/grid/dist/grid.css';
import '@simple-html/grid/dist/date.css';

// v6
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css';
```

The same applies to any other deep import (`@simple-html/grid/dist/...`): import from
`@simple-html/grid` instead.

### Installing from a git branch builds `dist`

`dist` is not committed. Installing straight from a git branch now works because the `prepare`
script builds it on install. The tgz is made with `npm run build:tgz` (was part of `npm run build`).

## Renamed

`Formater` is spelled `Formatter` everywhere, and a few other typos in public names are fixed.
Search and replace is enough for all of them.

| v5 | v6 |
| --- | --- |
| `DateFormaterDDMMYYYY` | `DateFormatterDDMMYYYY` |
| `DateFormaterDDMMYYYYTHHMMSS` | `DateFormatterDDMMYYYYTHHMMSS` |
| `DateFormaterYYYYMMDD` | `DateFormatterYYYYMMDD` |
| `DateFormaterYYYYMMDDTHHMMSS` | `DateFormatterYYYYMMDDTHHMMSS` |
| `NumberFormaterComma` | `NumberFormatterComma` |
| `NumberFormaterDot` | `NumberFormatterDot` |
| `ValueFormater` (type) | `ValueFormatter` |
| `datasource.setValueFormater()` / `getValueFormater()` | `setValueFormatter()` / `getValueFormatter()` |
| `datasource.setDateFormater()` / `getDateFormater()` | `setDateFormatter()` / `getDateFormatter()` |
| `datasource.setNumberFormater()` / `getNumberFormater()` | `setNumberFormatter()` / `getNumberFormatter()` |
| `datasource.setLocalCompare()` | `setLocaleCompare()` |
| `datasource.deSelectAll()` | `deselectAll()` |
| config `placeHolderRowCurrentEnityOnly` | `placeHolderRowCurrentEntityOnly` |

## Removed

| v5 | v6 |
| --- | --- |
| `datasource.sortReset()` | `datasource.resetSort()` - it did the same |
| `import { html, render } from '@simple-html/grid'` | `import { html, render } from 'lit-html'` - it was only re-exported |
| `import { Grid } from '@simple-html/grid'` | not exported, it is the grid's internal class. Use `GridInterface`. |
| `import { EntityHandler } from '@simple-html/grid'` | type only: `import type { EntityHandler }` (it is the type of `Entity.__controller`) |

## Internals are no longer in the typings

Members meant for the grid itself were public and showed up in autocomplete. They are tagged
`@internal` and left out of the published `.d.ts` files, so calling them is now a type error:

* `GridInterface`: `connectGrid`, `handleEvent`, `__parseConfig`, `__getGridConfig`,
  `__disconnectGrid`, `__setSelectedColumn`, `__isColumnSelected`, `__selectedColumns`,
  `__isConnected`, `__dataSourceUpdated`, `__getScrollState`, `__callReadonlySetter`,
  `__callCellAppendClass`, `__callSubscribers`
* `Datasource`: `__select`, `__callSubscribers`, `getSelection`

Use `datasource.setRowAsCurrentEntity(row)` instead of `__select(row)`, and the selection methods
on the datasource (`select`, `selectAll`, `getSelectedRows` ...) instead of `getSelection()`.

## Types are stricter

The library is compiled with TypeScript `strict` now, and the types say what the code really
does. With `strict` on in your project, you may have to handle these:

* `datasource.getFilter()` returns `FilterArgument | null` - it is `null` when no filter is set.
  `setFilter(null)` is allowed.
* the state fields of a `GridConfig` from `saveConfig()` can be `null`: `sorting`, `grouping`,
  `filter`, `expandedGroups`, and `Attribute.currentFilterValue`
* `HTMLCellElement.$attribute` is `string | null` - group and selector cells have none
* `IDateConfig.datepickerDate` is `Date | null | undefined` - empty opens on today
* `getFilterString(ctx)` / `getFilterTree(ctx)` take `{ gridInterface }` instead of the internal
  `Grid` class

Types that public signatures use are now exported, so you can name them: `Listener`, `Columns`,
`Sort`, `ColType`, `EntityUnion`, `DataEntity`, `DatasourceConfigOptions`,
`DateAndNumberFormatter`.

`readonlySetter(null)` and `cellAppendClassSetter(null)` were always allowed at runtime (they
remove the callback). The types say so now.

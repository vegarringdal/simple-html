# @simple-html/grid

A data grid for plain TypeScript or JavaScript apps, no framework needed. A `Datasource` holds your
rows and knows the type of each field: it sorts, filters and groups them, keeps the selection, and
tracks and validates the edits for a server. The grid shows it with virtual scrolling, pinned and stacked columns,
header filters, a filter editor, grouping, editing and right click menus. Its only dependency is
lit-html, which is installed with it.

The grid's config and the datasource's fields are plain JSON, so they can be stored - in a backend,
say. Formatters and validators are named by id (`registerFormatter()`, `registerValidator()`), and
the functions of a grid - readonly cells and css classes from the row, changes to the menus - are
hooks, given next to the config.

Docs, guides and live samples: https://airemote.github.io/simple-html/. The guides are also in this
repo, see [Guides](#guides) below.

## Install

The package is not on npmjs.com. It is published to **GitHub Packages** as
`@airemote/simple-html-grid` (the scope of the repository's owner): install it under its usual name
with an npm alias, so the imports stay `@simple-html/grid`. GitHub Packages needs a token that may read
packages (a personal access token with `read:packages`), in an `.npmrc` next to your package.json:

```ini
@airemote:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
npm install @simple-html/grid@npm:@airemote/simple-html-grid              # the last release
npm install @simple-html/grid@npm:@airemote/simple-html-grid@beta-v6-maybe # the last beta of a branch
```

A release is published from the default branch only (the `release` workflow), a beta from any branch
(the `beta` workflow, `<version>-beta.<branch>.<run>`, npm tag `beta-<branch>`); both run from the
Actions tab and only publish what passes the checks. See `scripts/githubPackage.js`.

Or install it from a git branch, the `prepare` script builds `dist` on install:

```json
"dependencies": {
    "@simple-html/grid": "github:airemote/simple-html#<branch>"
}
```

Or run `npm run build:tgz` in a clone and copy the tgz from `build/` to your project:

```json
"dependencies": {
    "@simple-html/grid": "file:./libs/simple-html-grid-X.Y.Z.tgz"
}
```

## A first grid

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css'; // the date picker of date cells

// the fields that are not text, with their type
const datasource = new Datasource({
    key: 'id',
    fields: { age: 'number', born: { type: 'date', label: 'Born' } }
});
datasource.setData([
    { id: 1, name: 'Ann', age: 36, born: new Date(1990, 4, 17) },
    { id: 2, name: 'Bob', age: 41, born: new Date(1985, 0, 2) }
]);

// where the columns go, and the options of a column by field name
const config: GridConfig = {
    columns: { name: { label: 'Name' } },
    layout: {
        center: [
            { fields: ['name'], width: 150 },
            { fields: ['age'], width: 80 },
            { fields: ['born'], width: 110 }
        ]
    }
};

// the grid fills the container, so it needs a height: <div id="grid" style="height: 400px"></div>
const gridInterface = createGrid(document.getElementById('grid')!, { config, datasource });

gridInterface.updateConfig({ readonly: false }); // the grid is readonly by default
// a function is a hook, not part of the config: here a css class on the cells of the young
gridInterface.updateHooks({ cellClass: (row, field) => (field === 'age' && row.age < 18 ? { input: 'young' } : null) });
const state = gridInterface.getState(); // what the user changed: sorting, filters, column order ...
gridInterface.destroy(); // done with it
```

## Guides

1. [Getting started](guides/01-getting-started.md)
2. [Grid config](guides/02-grid-config.md)
3. [State](guides/03-state.md)
4. [Datasource](guides/04-datasource.md)
5. [Editing](guides/05-editing.md)
6. [Filtering](guides/06-filtering.md)
7. [Sorting and grouping](guides/07-sorting-grouping.md)
8. [Formatting](guides/08-formatting.md)
9. [Events](guides/09-events.md)
10. [Menus](guides/10-menus.md)
11. [Migrating from v5](guides/11-migrating-from-v5.md)
12. [Texts](guides/12-texts.md)

## Migrating from v5

v6 changes the API. [MIGRATION.md](MIGRATION.md) lists every breaking change with code before and
after, and [CHANGELOG.md](CHANGELOG.md) what changed in each phase. The
[migration guide](guides/11-migrating-from-v5.md) shows the ten changes almost every app needs.

## Development

```sh
git clone https://github.com/airemote/simple-html
cd simple-html
npm i
npm start # the docs and samples site on http://localhost:8080
```

- `PORT=8090 npm start` serves it on another port, `npm start <folder>` another folder under
  `samples/`
- `npm test` runs the tests, `npm run check:docs` checks the guides, the JSDoc and their examples
- `npm run build` builds `dist`, `npm run build:tgz` the tgz
- publishing: the workflows `release` (the default branch only: the version of package.json, npm tag
  `latest`, a git tag) and `beta` (any branch) in `.github/workflows`, run from the Actions tab - bump
  the version in package.json before a release

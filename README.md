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

Docs, guides and live samples: https://vegarringdal.github.io/simple-html/. The guides are also in this
repo, see [Guides](#guides) below.

## Features

The highlights. Every feature, each linked to its guide and a live sample:
[Feature overview](https://vegarringdal.github.io/simple-html/#guide/features) (in this repo:
[guides/00-features.md](guides/00-features.md)).

- Typed fields - text, numbers, dates, date and time, yes/no - sorted, filtered and edited by their type
- Pinned and stacked columns: the user moves, resizes, hides and fits them to their content
- Header filters with operators, a value list as in a spreadsheet, date and range pickers, filter as
  you type, and a filter editor for nested AND / OR groups
- Sorting on several columns, grouping by drag and drop, aggregates in the group rows and a totals row
- Ranges of cells: copy and paste to and from Excel, fill down, a summary of the selected cells
- Editing with validation, undo and redo, change tracking and a save workflow - and permissions to add,
  change and delete rows
- Lookups: a value picked from a select or a dropdown grid
- Display formats, templates and links, colour rules - the user sets them in the grid config dialog
- A detail form beside the rows, with the current row
- Find (Ctrl+F) with match case and filter rows
- Export to Excel (.xlsx) and CSV
- Save and restore what the user changed: the layout, sorting, grouping, filters, formats
- Live data: rows from a server merged by key, the user's edits kept
- Two themes, light and dark; every text translatable; the keyboard, screen readers and touch
- `toSqlWhere()`: the filter as a SQL WHERE for PostgreSQL, Oracle, SQLite and SQL Server, safe from
  injection

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
npm install @simple-html/grid@npm:@airemote/simple-html-grid@next          # the last dev build
npm install @simple-html/grid@npm:@airemote/simple-html-grid@6.0.0-next.3  # one dev build
npm install @simple-html/grid@npm:@airemote/simple-html-grid@beta-v6-maybe # the last beta of a branch
```

A release is published from master by hand (the `publish` workflow, see [Releases](#releases)). A
dev build from any branch (the `next` workflow, `<version>-next.<run>`, npm tag `next`) and a beta from
any branch (the `beta` workflow, `<version>-beta.<branch>.<run>`, npm tag `beta-<branch>`) are run from
the Actions tab too. All of them only publish what passes the checks. See `scripts/githubPackage.js`.

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
// a second theme, the TreDeSpace UI colours: on with <html data-grid-theme="tredespace">
// import '@simple-html/grid/theme-tredespace.css';

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
- publishing and the docs site: see [Releases](#releases) below

### Releases

Every change goes to master through a pull request. Its title is a conventional commit, the
`pull request` check (`.github/workflows/pr.yml`, `scripts/prTitle.js`) fails until it starts with one
of `fix:`, `feat:`, `fix!:` / `feat!:` (something breaks), `chore:`, `docs:`, `test:`, `refactor:`,
`ci:`, `build:`, `perf:` or `style:`. A scope is fine (`feat(grid): a find bar`). The tests run on it as
on every push (`checks.yml`).

The version is set by hand in package.json (and package-lock.json, `npm version 6.1.0
--no-git-tag-version`), in a pull request like any other change. A release is then two workflows, both
run by hand from the Actions tab on master; neither pushes a commit:

- `tag` (`tag.yml`): tags the commit `v<version>`, the version of package.json. Stops when the tag is
  there already
- `publish` (`publish.yml`): the checks, then the package to GitHub Packages with the npm tag `latest`.
  Stops when that version is published already

A pull request to master runs both as a dry run (`release dry run`, `release-dry-run.yml`): their own
steps, nothing tagged or published, so a release that would fail fails in the pull request. A version
tagged or published already is a warning there.

### The docs site

`.github/workflows/pages.yml` puts the docs site (`npm run build:demo`) on the `gh-pages` branch:

- master's at the root, https://vegarringdal.github.io/simple-html/, after every push to master
- any other branch's under `dev/<branch>/` (https://vegarringdal.github.io/simple-html/dev/v6-maybe/), by
  hand: Actions -> pages -> Run workflow, pick the branch. `dev/` lists them. Run it with "remove"
  ticked to take a branch's docs down; deleting the branch takes them down too

The sidebar of the site says what it is built from: the version, the branch, the commit and its date,
and a **dev** badge on a branch's docs that links to the released ones.

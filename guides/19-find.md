# Find

Ctrl+F (Cmd+F on a Mac) with the focus in the grid opens a find bar over the grid's top right corner:
type a text, and every cell that shows it is marked - the current match more - with the count beside
it, `3 of 17`. Enter goes to the next match, Shift+Enter to the previous one, and the grid scrolls to
it. Esc closes the bar and puts the focus in the cell of the current match. The button `Aa`, *Match
case*, finds the text as it is typed (see [below](#match-case)); the funnel button, *Filter rows*, shows
only the rows with a match (see [below](#filter-rows)). A browser's find does not work in a grid:
only the rows on screen are in the page, and the text is in inputs.

```sample find
```

## The keys

With the focus anywhere in the grid - a cell, a header filter, a column header:

| key | does |
| --- | --- |
| Ctrl+F, Cmd+F | opens the find bar, the focus in its input with the text it had selected. Again while it is open: the focus back in its input |
| F3 / Shift+F3 | while the find bar is open: the next / previous match |

Outside the grid Ctrl+F is the browser's own: the page around it, and the grid's menus, the editor of a
multiline cell and the filter editor, which are on the body. Ctrl+Shift+F and Ctrl+Alt+F are left alone.
It is the key that types f; on a keyboard layout without Latin letters (Cyrillic, Greek) the key where
F is on a US keyboard.

In the find bar:

| key | does |
| --- | --- |
| typing | finds the text, 150ms after the last key: the cells are marked, the grid scrolls to the current match |
| Enter, F3 | the next match. After the last one, the first. Right after typing, before the matches showed: the first match |
| Shift+Enter, Shift+F3 | the previous match. Before the first one, the last |
| Esc | closes the bar. The focus goes to the cell of the current match, which is the active cell then and its row the current row - as moving to it with the keys makes it. Without a match, back to the cell (or the header filter) Ctrl+F was pressed in. *Filter rows* is turned off |
| Alt+C | *Match case* on or off, the focus stays where it is - as in the find bars of Firefox and VS Code. Not on a Mac: Option+C types `ç` there |
| Tab, Shift+Tab | the buttons: *Match case* (`Aa`), *Filter rows* (the funnel), previous (↑), next (↓), close (✕). Shift+Tab from the input leaves the grid, Tab from the close button goes on to the header filters |
| Space, Enter | on *Match case* or *Filter rows*: turns it on or off |

The focus stays in the input while you go from match to match, as in a browser: a click on ↑ or ↓
(or `Aa`, the funnel) keeps it there too. *Filter rows* has no key of its own: Tab from the input,
Space, Shift+Tab back. Alt+R would type `®` on a Mac (Option+R), and is the key of regular expressions in
other find bars (VS Code). On a Mac *Match case* is Tab and Space too, its tooltip leaves out Alt+C. The
wheel scrolls the grid and leaves the focus in the bar. A click in a cell puts the focus there and leaves
the bar open; Ctrl+F gets back to it.

## What is found

- **The text a cell shows**: its value through the field's formatter - a date as `2026-03-14` (or
  `14.03.2026` with that formatter), `12,5` with a decimal comma, a `0` shown blank (`numberOverride`)
  not as `0`. The text contains what you typed, in any case: `acme` finds `ACME CORP` - with *Match
  case* as it is typed.
- **The text as it is typed**: `*`, `%`, `_` and `?` are characters, no wildcards - `50%` finds
  `50% off`, not `500`.
- **Every line** of a cell of several lines, also those it does not show.
- **The displayed rows**: after the filter, in the sort order. When grouped, the rows of the expanded
  groups; the rows of a collapsed group are not displayed, they are not found. The group rows (their
  names, `Country: Norway (12)`) are not searched.
- **The fields of the layout**: a field not in it (hidden) is not searched. Not the row numbers, and not
  a checkbox - a boolean cell shows no text.
- **The order** of the matches, for next and previous: the rows top to bottom, and in a row the fields
  in the order of `gridInterface.getLayoutFields()` - pinned left, center, pinned right, the stacked
  fields of a column top to bottom.
- **Where it starts**: at the cell that had the focus when the bar opened, the first match at or after
  it - else the first match. While you type, the current match stays while it still matches (`acm`,
  `acme`), else it is the next one after it.
- An empty text finds nothing.

## Match case

The button `Aa` in the bar, *Match case*, is a toggle (`aria-pressed`), filled in the accent colour while
it is on - as *Filter rows*. On, the text is found as it is typed: `Acme` finds `Acme 2`, not `ACME
CORP` or `acme`. Off (the default), in any case.

- **Everything follows it**: the matches, the count, the marked cells, the current match (it stays while
  it still matches, else the next one) - and *Filter rows*, which filters the rows again with it. The
  grid scrolls to the current match, as for typing.
- **Alt+C** in the bar turns it on and off, Space or Enter on the button; a click keeps the focus in the
  input.
- **It is kept** when the bar closes, as the text: Ctrl+F opens the bar with it as it was. It is not
  part of the grid's state.
- **The chip** of *Filter rows* in the footer has the marker `Aa` (the text `footer.matchCase`) while it
  matches case, as a condition of the filter that matches case.
- Case is the case of JavaScript (`toLowerCase()`): `Ø` and `ø` are one letter in any case.

```ts
gridInterface.find('Acme', { caseSensitive: true }); // Acme as it is, not ACME
gridInterface.getFind().caseSensitive; // true
gridInterface.find('acme', { caseSensitive: false }); // in any case again
```

## How the matches look

Every match has a tint, the current one a stronger tint and a 2px line inside its edge. The colours are
`--simple-html-grid-find-match-color`, `--simple-html-grid-find-current-color` and
`--simple-html-grid-find-current-border-color`, light and dark, see [Find](13-theming.md#find). The cells
have the classes `simple-html-cell-find-match` and `simple-html-cell-find-current` (the current match has
both); the cells are reused while the grid scrolls, the classes follow the rows and fields they show. A
match in a range of cells shows both tints.

The find bar is an element of the grid, `simple-html-grid-find`, the first one in it: over the top right
of the grouping panel - or of the column labels, without a panel (`panelHeight: 0`). It gets narrower
with a narrow grid.

## Filter rows

The funnel button in the bar, *Filter rows*, is a toggle: on, only the rows with at least one match are
shown; off, every row the filter lets through again. The matches, the count and the current match work
as before, in the rows shown - the current match stays the current one, the grid scrolls to it.

- **The same matches**: a row is shown when a cell of it is marked - the text as the cells show it
  (formatted, `numberOverride`, the label of a lookup, every line of a multiline cell; not a checkbox),
  the fields of the layout. The rows shown and the marked cells agree.
- **On top of the filter** (AND), as *Changed rows only* is - and after it: not part of the filter.
  `datasource.getFilter()`, `getFilterString()`, the filter editor and the grid's state
  (`getState()`) do not have it. The footer shows a chip for it, `Find: denma` (the text
  `footer.findFilter`), after the one of *Changed rows only*.
- **When the rows are filtered**: when the text changes - 150ms after the last key, as the search -
  when the columns change (a column hidden or shown), and whenever the datasource filters the rows: a
  filter, a header filter, `setData()`, `upsert()`, `reloadDatasource()` ... A sort or a grouping keeps
  the rows, they only move.
- **Not when a value is edited**, as for every filter here: a row edited so it no longer shows the text
  stays, without a mark, until the rows are filtered next. A row does not disappear while you type in it.
- **As any filter**: the groups keep the rows with a match (their counts too, the rows of a collapsed
  group as well), the aggregates and the footer's count are of the rows shown, the ranges of cells are
  cleared, the current row and the selection are left as a filter leaves them.
- **An empty text** shows every row, the toggle stays on: the rows are filtered once you type.
- **It is turned off** when the bar closes - Esc, ✕, `closeFind()`, the grid taken off the page - and by
  the footer's "✕ Clear" (and the filter menu's Clear All Filters), which leave the bar open with its
  matches. Ctrl+F opens the bar with it off.

```ts
gridInterface.find('denma', { filterRows: true }); // only the rows with a cell that shows "denma"
gridInterface.getFind().filterRows; // true
gridInterface.find('norway'); // another text: it stays on
gridInterface.find('norway', { filterRows: false }); // every row, the bar stays open
```

## Filter rows and a backend

*Filter rows* is a filter of the browser only: it tests the text the cells show, which a database does
not have. It is not part of the filter, so `datasource.getFilter()` and `gridInterface.getServerFilter()`
do not have it, and no SQL is made of it. When a backend loads the rows, it loads them by the filter;
*Filter rows* then filters what came back - `setData()` with the new rows filters them again with it, as
long as it is on.

```ts
import type { FilterExpression } from '@simple-html/grid';

declare function loadRows(filter: FilterExpression | null): Promise<Record<string, unknown>[]>; // your backend

gridInterface.find('acme', { filterRows: true });
datasource.setData(await loadRows(gridInterface.getServerFilter())); // only the rows with "acme" shown
```

## It follows the data

While the bar is open the text is found again when what the grid shows changes: rows set, added or
removed, a filter, a sort, grouping, a group expanded or collapsed, a value edited (in the grid, from
code, by undo, by an upsert), a column moved, hidden or pinned, the texts of the grid. The current match
stays the current one while it still matches - also when a sort moved it - else it is the next one
after it. The grid does not scroll for it: you may be typing in a cell somewhere. It waits until the
changes stop, 150ms, as for the typing.

Closed, the bar finds nothing and *Filter rows* is off. Its text is kept: Ctrl+F shows it again,
selected, and finds it. The bar is closed when the grid is taken off the page.

## The API

```ts
import type { FindResult } from '@simple-html/grid';

// as typing in the find bar: opens it with the text, marks the cells, the current match scrolled to
const count = gridInterface.find('acme'); // how many cells show it

gridInterface.findNext(); // { row: 5, field: 'company' }, the cell of the current match
gridInterface.findPrevious();

const result: FindResult = gridInterface.getFind();
// { open: true, text: 'acme', filterRows: false, count: 17, position: 3, current: { row: 5, field: 'company' } }

// only the rows with a match, as the funnel button of the bar; the text as it is, as Aa
gridInterface.find('acme', { filterRows: true });
gridInterface.find('Acme', { caseSensitive: true });

gridInterface.on('find-change', ({ open, count, position }) => {
    console.log(open ? `${position} of ${count}` : 'find closed');
});

// as Ctrl+F: the focus into the bar - for a button or a menu entry of your own
gridInterface.openFind();
gridInterface.closeFind();
```

- **`find(text)`** opens the bar with the text and returns how many cells show it. The focus does not
  move. The current match is the first one at or after the cell with the focus; while the bar is open,
  the current match stays while it still matches. A text that is not a string throws a `TypeError`.
  **`find(text, { filterRows })`** turns *Filter rows* on or off as well; left out, it stays as it is.
- **`openFind()`** does what Ctrl+F does: the bar opens, the focus goes into its input.
- **`findNext()`** and **`findPrevious()`** move the current match, as Enter and Shift+Enter, and
  return its cell: `{ row, field }`, `row` an index in the displayed rows (`datasource.getRows()`) as in
  the grid events. `null` while the bar is closed or nothing matches.
- **`find(text, { caseSensitive })`** turns *Match case* on or off; left out, it stays as it is.
- **`closeFind()`** closes it, as Esc: when the focus was in the bar it goes to the current match.
  *Filter rows* is turned off.
- **`getFind()`** gives what it has found, see `FindResult`: `open`, `text`, `filterRows`,
  `caseSensitive`, `count`, `position` (1 to `count`, 0 without a match) and `current`. Plain JSON.
- **`find-change`** is sent with the same each time it changes: the bar opened or closed, the typing
  stopped, the current match moved, *Filter rows* or *Match case* turned on or off, the matches were
  found again after the data changed. Not when nothing changed.

Without the grid on the page they do nothing: `find()` returns 0, `getFind()` gives a closed find. The matches, *Match case* and *Filter rows* are not part of `getState()`.

## What a screen reader gets

- The find bar is a search region (`role="search"`) named "Find in the grid" (`find.label`); its input is
  named "Find" (`find.placeholder`).
- The count is a status (`role="status"`): a screen reader reads it out when it changes - after the
  typing stopped, at each next and previous: `3 of 17`, `No matches`.
- The buttons are buttons, named "Previous match", "Next match" and "Close", with the key in their
  tooltip. *Match case* is a toggle button named "Match case" (`find.matchCase`) - it shows `Aa` - and
  *Filter rows* one named "Filter rows" (`find.filterRows`), `aria-pressed` true while they are on; the
  funnel is hidden from a screen reader. A change of the count is read out after *Match case* too. While it filters, the footer's row
  count (`3/500`, a status) is read out when it changes.
- The texts are `find.*`, see [Texts](12-texts.md#find). The keys are in the table of
  [Keyboard and accessibility](14-accessibility.md#the-find-bar).

## Known limits

- **Ctrl+F needs the focus in the grid.** The wheel takes the focus from the cell (its row element is
  reused for other rows): Ctrl+F then is the browser's. Click a cell first, or call `openFind()` from a
  button.
- **The current match is not read out**, only the count: the focus stays in the input. Esc puts the
  focus in its cell, which is read then.
- **Contains**, in any case or with *Match case*: no whole word or regular expression. Not the group
  rows, the rows of collapsed groups, the hidden fields, the checkboxes.
- **No Cmd+G / Ctrl+G** for the next match: F3, Enter in the bar, `findNext()`.
- **A large grid**: each search makes the text of every cell, 100 000 rows of 10 fields are a million
  texts - some hundred ms. It runs once the typing (or the changes of the data) stop. *Filter rows*
  makes the texts once more when it filters the rows.
- **Filter rows and an edit**: a row edited so it no longer shows the text stays until the rows are
  filtered again (another text, a filter ...), as for every filter.
- **One datasource in two grids**: *Filter rows* filters the datasource, so both grids show the rows of
  the one whose find bar has it on; the chip is in the footer of that one only.
- **Checked in Chrome** (the keys, the bar, the look in light and dark). Firefox, Safari and screen
  readers have not been tried.

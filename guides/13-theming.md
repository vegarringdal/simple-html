# Theming

Every colour of the grid is a css variable: the grid itself, its menus, the column chooser, the
tooltips, the filter editor and the date picker. Each variable has a light and a dark colour, and the
grid follows the `color-scheme` of the page: dark mode is one line of css. Two themes come with the
grid, the default and [TreDeSpace](#themes).

```sample theming
```

The variables of the grid are set on `.simple-html-grid` in `grid.css`, the ones of the date picker
on `.simple-html-date` in `date.css`. The tables at the end list them all.

## Themes

The grid comes with two themes, each light and dark - four looks:

- **Default** - `grid.css` and `date.css`, the colours of the tables below
- **TreDeSpace** - `theme-tredespace.css` on top of them: the colours of the TreDeSpace UI widget
  library (`@treDeSpaceUI`), for a page built with it. Its panels, menus, dialogs and fields, its
  selection and focus blue, its reds, ambers and greens

Both are flat and square: no rounded corners, in light and in dark - the widgets have none either.
The sizes are the grid's in both (11px text, the row heights of the grid options).

The docs site has all four: the sidebar's *Grid theme* (Default, TreDeSpace) and *Toggle dark/light*.

### Turning TreDeSpace on

Load the file after the grid's, and put the attribute `data-grid-theme="tredespace"` on the root of
the page:

```ts
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css';
import '@simple-html/grid/theme-tredespace.css';
```

```html
<html data-grid-theme="tredespace">
```

- Every grid and date picker under the attribute takes it. Put it on `<html>` or `<body>`, as
  [`color-scheme`](#dark-mode): the menus, the column chooser, the tooltips and the filter editor
  are put on the body (or in the dialog or popover the grid is in). On the grid's container only, the
  grid would have the theme and its menus the default
- Without the attribute the grid has the default theme. So both can be loaded, and the attribute
  switches: `document.documentElement.dataset.gridTheme = 'tredespace'`, and
  `delete document.documentElement.dataset.gridTheme` for the default
- Light or dark follows `color-scheme`, as in the default theme. The widget library sets it itself
  (dark is its default, `data-theme="light"` on the root makes it light), so the grid switches with it:

```html
<!-- dark, the library's default -->
<html data-grid-theme="tredespace">

<!-- light -->
<html data-theme="light" data-grid-theme="tredespace">
```

On a page without the library, set `color-scheme` as for the default theme.

To change a colour of the TreDeSpace theme, use its selector - it is stronger than
`.simple-html-grid`, so a rule on `.simple-html-grid` does not reach a TreDeSpace grid:

```css
[data-grid-theme='tredespace'] .simple-html-grid {
    --simple-html-grid-focus-color: light-dark(#b45309, #fbbf24);
}
```

### The colours of TreDeSpace

The colours are the library's tokens: its `styles.css` (its light theme, and its dark surfaces lifted
half a step) over the Tailwind palette it is built on. Where the grid has a part the widgets do not,
the colour is made from the library's scale. The light colour is the token in the library's light
theme, the dark one in its dark theme. A Tailwind colour the library does not change is written as
Tailwind's own `oklch()` in the file, so it is the same colour as in the widgets; the table has it as
a screen shows it.

| the grid's | token (as in the library) | light | dark |
| --- | --- | --- | --- |
| bars - labels, panel, footer, row numbers - menus, filter editor, date picker | slate-900 (its Menu, dialogs, side bars) | `#f8fafc` | `#172033` |
| rows, the filter row, the inputs, the filter chips | slate-950 (the ground, the search field of its Select) | `#f1f5f9` | `#080f21` |
| every other row | midway slate-950 - slate-900 | `#f5f7fb` | `#0f182a` |
| lines between cells and rows, menu frames | slate-800 (`--dock-line`) | `#e2e8f0` | `#283548` |
| stronger lines: pinned columns, under the header, the filter editor's frame | slate-700 (`--dock-line-hi`) | `#cbd5e1` | `#314158` |
| text | slate-200 (`--dock-text`) | `#1e293b` | `#e2e8f0` |
| placeholders, quiet text, row state "deleted", aggregate labels | slate-400 (`--dock-text-dim`) | `#475569` | `#90a1b9` |
| selected rows, menu item under the pointer, the active option | blue-950 (its selected TreeView row, Select) | `#dbeafe` | `#162556` |
| the other selected rows | midway blue-950 - blue-900 | `#cde2fe` | `#192f72` |
| focus outline, the line of a range, Apply, the value list's checkboxes | blue-400 (`--dock-accent`) | `#2563eb` | `#51a2ff` |
| links (a link column, the column settings' preview) | blue-800, blue-100 | `#1e40af` | `#dbeafe` |
| the colour rules' text colours | red, blue, indigo, purple, pink 800, orange, amber, yellow, lime, green, teal, cyan 900, slate-700 in light; their 300 in dark. Brown, which Tailwind does not have: orange's hue with less chroma | `#9f0712` ... | `#ffa2a2` ... |
| the colour rules' backgrounds | red, orange, yellow, lime, green, teal, sky, indigo, purple, pink 200, amber and cyan 300 (apart from yellow and blue) and slate-300 in light; their 950, slate-800 in dark. Blue is sky: blue-200 and blue-950 are the selected rows | `#ffc9c9` ... | `#460809` ... |
| the icons of an icon set: green, amber, red | green-800, amber-800, red-700 in light; their 300 in dark | `#166534` `#92400e` `#b91c1c` | `#7bf1a8` `#ffd230` `#ffa2a2` |
| text on Apply | slate-950 (its picked day) | `#f1f5f9` | `#080f21` |
| frames of the controls of the value list and the filter editor | slate-500 | `#64748b` | `#62748e` |
| a range's tint | blue-500 at 15% (its info chip) | | |
| errors | red-400, red-500 at 15% (its danger chip) | `#dc2626` | `#ff6467` |
| row state: edited, new, conflict | amber-400, green-400, violet-400 (light: violet-600) | `#b45309` `#15803d` `#7c3aed` | `#ffb900` `#05df72` `#a684ff` |
| Find | amber-500 at 25% and 45%, a line in amber-200 | | |
| totals row | slate-800, text slate-100 | `#e2e8f0` | `#283548` |
| scrollbar thumbs | blue-400 45% into slate-800 (its scrollbars) | `#8dacee` | `#3a669d` |
| tooltips | its Tooltip, dark in both | `#242933` | `#242933` |
| shadows, the layer behind the filter editor | black at 50%, 45% (tooltips), 40% | | |
| font | `ui-sans-serif, system-ui, sans-serif` (its panels) | | |

`theme-tredespace.css` names the token of every variable. The contrasts are the default theme's:
text 4.5:1 or more to its background, lines and marks 3:1, light and dark (WCAG AA). Six colours
differ from the widgets for that, or because the grid has one colour where the widgets have two:

- placeholders and quiet text are slate-400: the library's placeholder slate-500 is under 4.5:1
- the frames of the value list's and the filter editor's controls are slate-500: the library's field
  frames (slate-700) are under 3:1 to a menu
- the filled controls (Apply, the AND / OR in use) are blue-400 with slate-950 text, as the
  library's checked box and picked day - its primary Button is blue-950 in a blue-400 frame, a fill
  under 3:1 to the dialog
- the date picker's selected day is blue-950 in a blue-400 frame (the library's range fill): its
  picked day (blue-400) has slate-950 text, the date picker's text is slate-200. The days between From
  and To of a range picker are blue-950 too, the library's span: From and To have the frame
- the line of the current match of Find is amber-200: amber-400 is under 3:1 to the match's tint on a
  selected row
- the links are blue-800 in light and blue-100 in dark, not the accent blue-400: a link's text keeps
  4.5:1 under the tints of Find and a range on a selected row, blue-400 has 2.2:1 there

And: a menu's frame is the grid's line (slate-800, the library's Menu has slate-700), a menu item
under the pointer is the selected blue (the library's Menu has slate-800, its Select blue-950), the
checkboxes in the cells are the browser's (in both themes), and the text is 11px (the widgets' 12px).

## A theme of your own

Set the variables you want to change on `.simple-html-grid`, in a css file loaded after `grid.css`:

```css
.simple-html-grid {
    --simple-html-grid-main-bg-selected-odd: light-dark(#b9e4dc, #0f5c52);
    --simple-html-grid-main-bg-selected-even: light-dark(#a7dbd1, #11685d);
    --simple-html-grid-focus-color: light-dark(#b45309, #fbbf24);
    --simple-html-grid-font-size: 12px;
}
```

- `light-dark(<light>, <dark>)` gives a colour for each, see [Dark mode](#dark-mode). A plain colour
  (`#b9e4dc`) is used in both.
- Same selector, so the rule that comes last wins: load your css after `grid.css`, or make your
  selector stronger (`.simple-html-grid.simple-html-grid`).
- The menus, the column chooser, the tooltips and the filter editor's dialog are not inside the grid's
  element: the grid puts them on the body (or in the dialog or popover the grid is in). They are
  elements with the `simple-html-grid` class too, so a rule on `.simple-html-grid` reaches them.
  A rule on the grid's container (`.my-page .simple-html-grid`) only reaches the grid itself, its
  menus keep the default colours.
- The grid's date picker is a `.simple-html-date` in a menu: set its own variables, see
  [The date picker](#the-date-picker).

What the classes and parts of the grid are, if you want to restyle more than the colours: read
`grid.css`, it is commented.

## Dark mode

Each colour is set with the css function `light-dark()`: the first colour when the element's
`color-scheme` is light, the second when it is dark. `color-scheme` is inherited, so it is set once
for the page:

```css
/* always dark */
:root {
    color-scheme: dark;
}

/* dark when the page has a dark class */
body.dark {
    color-scheme: dark;
}

/* follow the setting of the OS / browser */
:root {
    color-scheme: light dark;
}
```

`<meta name="color-scheme" content="light dark">` in the page's head does the same as the last one.
Without any of these the `color-scheme` is `normal`, and the grid is light: the colours it had before
v6.

Set it on `:root` or the body, not on the grid's container. The menus, the column chooser, the
tooltips and the filter editor are put on the body (or in the dialog or popover the grid is in): set
on the container only, the grid would be dark and its menus light.

The browser's own parts follow `color-scheme` on their own: the checkboxes, the number inputs of the
date picker, scrollbars. The grid's scrollbars have their colours from the grid's variables.

`light-dark()` is in Chrome and Edge 123, Firefox 120 and Safari 17.5 (May 2024). In an older browser
a colour set with it is not valid: the grid has no backgrounds and the text colour of the page. To
support one, set the variables with plain colours for it:

```css
@supports not (color: light-dark(white, black)) {
    .simple-html-grid {
        --simple-html-grid-main-bg-color: #f5f5f5;
        /* ... the light colour of every variable in the table below */
    }
}
```

## The keyboard focus

The element that has the keyboard focus gets an outline of 2px in `--simple-html-grid-focus-color`:
a cell, a filter input, a checkbox, a menu item, a button of the filter editor, the date picker. The
outline is inside the element (`outline-offset: -2px`): the cells are packed edge to edge, an outline
outside the cell would be painted over by the next one or cut off at the edge of the grid. A checkbox
in a cell has it on the cell. The buttons of the filter editor and of the filter menu's value list,
and the value list's checkboxes, have room around them: theirs is outside (`outline-offset: 1px`),
an outline inside a filled button would not show.

It is drawn for `:focus-visible`, so the browser decides when it shows: when you move with the
keyboard, and in an input you type in; not when you click a checkbox or a button. It replaces the
dashed border a focused input had before v6.

To change more than the colour, override the rule:

```css
.simple-html-grid :focus-visible {
    outline-width: 3px;
    outline-offset: -3px;
}
```

The date picker draws the same outline in `--simple-html-date-focus-color`. In the grid it takes the
grid's colour: `grid.css` sets `--simple-html-date-focus-color` to `--simple-html-grid-focus-color` on
`.simple-html-grid .simple-html-date`.

## The row state and errors

The grid shows the state of each row on its row number and marks the edited cells (`rowStatus` and
`editedMarker`, see [Showing the row state](05-editing.md#showing-the-row-state)), in these
variables:

- `--simple-html-grid-new-color` - the plus of a new row
- `--simple-html-grid-edited-color` - the pencil of an edited row, the marker of an edited cell
- `--simple-html-grid-deleted-color` - the trash can of a row marked for deletion
- `--simple-html-grid-conflict-color` - a conflict with the server: the arrows of the row number, the
  marker of a field in conflict, see [Live data](16-live-data.md#how-the-grid-shows-them)
- `--simple-html-grid-merged-color` - the flash of a cell a merge changed (`mergeHighlight`), it fades
  out: a see-through colour
- `--simple-html-grid-error-color` and `--simple-html-grid-error-bg-color` - a cell and a row with an
  error: the border of the cell, the bar and the exclamation mark of the row number, the tint, see
  [How the grid shows the errors](05-editing.md#how-the-grid-shows-the-errors)

The icons and the marker are graphics: the new, edited, deleted and conflict colours have a contrast of at least
3:1 to the rows, the row numbers and the selected rows, in light and in dark, also under an error's
tint (WCAG 1.4.11). Keep that when you change them. Each state has a shape of its own too, the colour is
not the only thing that tells them apart.

## Multiline text

A cell of several lines (see [Multiline text](05-editing.md#multiline-text)) has a marker at its
right, lines of text, in `--simple-html-grid-multiline-color` - at least 3:1 to the rows and the
selected rows too. In a row made taller (`fitRows()`) the cell shows its other lines under the first
one, in the cell's text colour (`--simple-html-grid-main-font-color`): an element of their own,
`simple-html-grid-cell-lines`, with the classes the `cellClass` hook gives the input. Their line
height is the grid option `multilineLineHeight` (15px), not a css variable: the grid needs it to
place the rows. With a larger `--simple-html-grid-font-size` make it and `cellHeight` larger too. The editor that
opens over the cell uses the colours of the rest: the textarea is
`--simple-html-grid-sec-bg-color` with `--simple-html-grid-main-font-color`, its hint
`--simple-html-grid-main-bg-color`, its frame `--simple-html-grid-pinned-border` and its shadow
`--simple-html-grid-dialog-shadow-color`. The editor is on the body (or in the dialog the grid is in),
like the menus: a theme set on `.simple-html-grid` reaches it, one set on the grid's container does not.

```css
.simple-html-grid {
    --simple-html-grid-edited-color: light-dark(#1d4ed8, #93c5fd);
}
```

The classes are there to restyle more: `row-is-new`, `row-is-modified` and `row-is-deleted` on the
element around the row number, `simple-html-row-status-icon` on the icon (with
`simple-html-row-status-new`, `-edited`, `-deleted` or `-error`), `simple-html-cell-edited-marker` on the
marker. With `rowStatus: false` the classes `row-is-*` are still there for a look of your own:

```css
.row-is-modified .simple-html-selector-text {
    color: light-dark(#4f46e5, #a5b4fc);
}

.row-is-new .simple-html-selector-text {
    color: light-dark(#16a34a, #86efac);
}

.row-is-deleted .simple-html-selector-text {
    color: light-dark(#dc2626, #fca5a5);
    text-decoration: line-through;
}
```

## Ranges of cells

A range of cells the user selected (see [Selection and clipboard](17-selection-and-clipboard.md)) is
a tint over its cells and a 2px line around it, in two variables:

- `--simple-html-grid-range-bg-color` - laid over the cells, under their text: over the colour of
  the row, a selected row's and an error's tint. A colour with alpha, so those still show through
- `--simple-html-grid-range-border-color` - the line on the outer sides of the range

The defaults keep the text at 4.5:1 or more over the tint, and the line at 3:1 or more against the
rows, the selected rows and an error's tint, in light and in dark (WCAG 1.4.3 and 1.4.11). Keep that
when you change them.

```css
.simple-html-grid {
    --simple-html-grid-range-bg-color: light-dark(rgba(22, 163, 74, 0.12), rgba(74, 222, 128, 0.18));
    --simple-html-grid-range-border-color: light-dark(#166534, #bbf7d0);
}
```

The classes: `simple-html-cell-in-range` on every cell in a range, and `simple-html-cell-range-top`,
`-bottom`, `-left` and `-right` on the cells whose side is an edge of the ranges. The line is a
`::after` of the cell, so a rule of your own can restyle it:

```css
/* a dashed line, as a cut in a spreadsheet */
.simple-html-grid .simple-html-cell-in-range::after {
    border-style: dashed;
}
```

## Find

Find (Ctrl+F in the grid, see [Find](19-find.md)) marks the cells that show the text with a tint, the
current match with a stronger tint and a 2px line inside its edge:

- `--simple-html-grid-find-match-color` - laid over a cell that matches, under its text: yellow in
  light, amber in dark. A colour with alpha, so the row's colour and a range's tint show through
- `--simple-html-grid-find-current-color` - laid over the current match instead: orange
- `--simple-html-grid-find-current-border-color` - the line around the current match

The defaults keep the text at 4.5:1 or more over both tints (on the rows and on the selected rows), and
the line at 3:1 or more against the rows, the selected rows and the current match's tint, in light and
in dark (WCAG 1.4.3 and 1.4.11): the line tells the current match, not the colour alone. The tint of the
other matches is a highlighter's, not a line - it is not 3:1 against the rows. Keep that when you change
them.

```css
.simple-html-grid {
    --simple-html-grid-find-match-color: light-dark(rgba(34, 197, 94, 0.3), rgba(21, 128, 61, 0.5));
    --simple-html-grid-find-current-border-color: light-dark(#14532d, #bbf7d0);
}
```

The classes: `simple-html-cell-find-match` on every match, `simple-html-cell-find-current` on the
current one too. The find bar is `simple-html-grid-find`, in the grid's colours: the panel's background
(`--simple-html-grid-main-bg-color`), the input of the header filters (`--simple-html-grid-sec-bg-color`),
the frame and shadow of the tooltips. Its *Match case* button (`simple-html-grid-find-case`, the text
`Aa`) and *Filter rows* button (`simple-html-grid-find-filter`) are filled with
`--simple-html-grid-accent-color` while they are on (`aria-pressed="true"`), the `Aa` and the funnel in
`--simple-html-grid-accent-font-color`.

## Lookup columns

A column whose value is picked from a list (`ColumnConfig.editor`, see [Lookups](20-lookups.md)) has a
button at the right of its cells, on hover and on the focused cell: square, inside the cell's focus
outline, `--simple-html-grid-lookup-button-bg-color` with its triangle in
`--simple-html-grid-lookup-icon-color` - at least 3:1 to the button - and
`--simple-html-grid-main-bg-selected-even` under the pointer. The select under the cell has the colours
of the menus (`--simple-html-grid-main-bg-color`), its search field the header filters'
(`--simple-html-grid-sec-bg-color`), its frame and shadow the editor of a multiline cell's; the active
option is `--simple-html-grid-lookup-active-bg-color`, the text on it 4.5:1. The dropdown grid is a
grid, in the grid's colours.

```css
.simple-html-grid {
    --simple-html-grid-lookup-icon-color: light-dark(#1d4ed8, #93c5fd);
    --simple-html-grid-lookup-active-bg-color: light-dark(#fef3c7, #78350f);
}
```

The classes: `simple-html-grid-lookup-button` on the button, `simple-html-grid-cell-lookup` on the input
(its text stops before the button), `simple-html-grid-lookup` on the popover (with
`simple-html-grid-lookup-select` or `simple-html-grid-lookup-grid`), `simple-html-grid-lookup-option` on
an option, `-active` and `-current` (the cell's value, bold with a check) on top.

## Colour rules

The [colour rules](08-formatting.md#colour-rules) of a column colour its cells from a palette: 14
colours, each a text colour and a background - two variables of the theme each, light and dark:

- `--simple-html-grid-palette-<colour>-color` - the text colour: red, orange, amber, yellow, lime,
  green, teal, cyan, blue, indigo, purple, pink, brown, grey (the order of the swatches). At least 4.5:1
  to the rows and the selected rows, under a range's tint too, to the inputs (the detail form, the
  dialog's preview) and to every background of the palette
- `--simple-html-grid-palette-<colour>-bg-color` - the background: the grid's text and a link at least
  4.5:1 on it, under a range's tint too; the focus outline, the row state, the marker of an edited cell
  and of more lines 3:1

So any text colour on any background stays readable, in light and in dark. The rows of the default
theme's dark look are grey (`#4b5563`, `#5a6370`): 4.5:1 to them is a light tint of a colour, so its
text colours are pale there - the backgrounds show the colours better. TreDeSpace's dark rows are near
black: its text colours are stronger (Tailwind 300). The grid writes no colour of its own for the
palette: a rule takes a name of it.

**A custom colour** (`#rrggbb`, picked in the dialog's colour picker after the swatches) is no variable
of the theme: it is one colour, in light and in dark, so the grid keeps it readable itself. It is set on
the cell as a custom property with `style.setProperty()` - its value checked, never css text:

- `--simple-html-grid-rule-bg` - a custom background, the same in light and dark. A rule without a text
  colour gets black or white text on it, whichever has the more contrast.
- `--simple-html-grid-rule-text-light`, `--simple-html-grid-rule-text-dark` - a custom text colour: the
  colour picked in light, and in dark the same colour lighter (its lightness raised) until it has 4.5:1
  to `#5a6370`, the lightest dark row of the two themes. On a custom background it is the colour picked
  in both. The grid config dialog warns when a custom text colour has less than 4.5:1 to the light rows,
  or to its custom background - the pick is the user's, the grid keeps it.

The classes are `simple-html-grid-cell-text-custom` and `simple-html-grid-cell-bg-custom`:

```css
/* grid.css */
.simple-html-grid .simple-html-grid-cell-text-custom {
    color: light-dark(var(--simple-html-grid-rule-text-light), var(--simple-html-grid-rule-text-dark));
}
.simple-html-grid .simple-html-grid-cell-bg-custom {
    background-color: var(--simple-html-grid-rule-bg);
}
```

Keep those contrasts when you change one:

```css
/* a lighter orange background in light, a stronger one in dark */
.simple-html-grid {
    --simple-html-grid-palette-orange-bg-color: light-dark(#ffedd5, #9a3412);
}
```

The classes, on the cell element (`simple-html-grid-col-cell`) and on a value of the detail form:
`simple-html-grid-cell-text` and `simple-html-grid-cell-text-<colour>` for a text colour,
`simple-html-grid-cell-bg` and `simple-html-grid-cell-bg-<colour>` for a background,
`simple-html-grid-cell-bold` for bold. The cell's text - its input, the lines of a multiline cell, a
custom cell's host, a link - takes the cell's colour (`color: inherit`). A cell with a validation error
(`simple-html-cell-error`) or a match of Find (`simple-html-cell-find-match`) shows as without a rule:
the classes are there, the colours wait. A rule of your own can restyle them:

```css
/* the cells with grey text in italics too */
.simple-html-grid .simple-html-grid-cell-text-grey input {
    font-style: italic;
}
```

The swatches of the grid config dialog are `column-settings-swatch` radio buttons, square, in the
palette's variables; the colour picker of a custom colour is `column-settings-swatch-custom`, an
`<input type="color">` in a box of the swatches' frame (a `+` until a colour is picked).

## Data bars, colour scales and icons

The [data bars](08-formatting.md#data-bars) and [colour scales](08-formatting.md#colour-scales) of a
number column are drawn in the **backgrounds of the palette**, `--simple-html-grid-palette-<colour>-bg-color`:
the grid's text reads on every one of them, and on the mix of two of them a scale gives a cell, light
and dark, in both themes - the theme tests compute it. A theme that changes the palette changes them
too. They have no variables of their own but the icons':

- `--simple-html-grid-icon-green-color`, `--simple-html-grid-icon-amber-color`,
  `--simple-html-grid-icon-red-color` - the icons of an [icon set](08-formatting.md#icon-sets): the high,
  the middle and the low one. Marks, at least 3:1 to the rows, the selected rows (under a range's tint
  too) and every background of the palette. Tailwind's green-800, amber-800 and red-700 in light, green
  and amber 300 and red-200 in dark (red-300 is under 3:1 to a range's tint on the light dark row) -
  TreDeSpace's are the same in light and its 300 in dark

**A custom colour** of a bar or a scale is a tint of it, computed by the grid: a fifth of the colour and
the rest white in light mode, black in dark mode - so the text reads on it whatever colour is picked (its
channels are 0.8 or more in light, 0.2 or less in dark).

The grid sets them on the cell element as custom properties, with `style.setProperty()` - their values a
palette variable or a custom colour's two tints in `light-dark()`, built from a palette name or a checked
`#rrggbb` only:

| class | custom properties | |
| --- | --- | --- |
| `simple-html-grid-cell-bar` | `--simple-html-grid-bar-start`, `--simple-html-grid-bar-end` (`12.5%`), `--simple-html-grid-bar-color` | the bar: a background image of the cell from start to end, under a range's tint (`--simple-html-grid-cell-bar-image`), over a rule's background. Square |
| `simple-html-grid-cell-scale` | `--simple-html-grid-scale-from`, `--simple-html-grid-scale-to`, `--simple-html-grid-scale-at` (`37.5%`) | the scale: the cell's background, `color-mix(in srgb, to at, from)`. A rule's background wins: such a cell does not get the class |

The icon is `simple-html-grid-cell-icon` (and `-before` / `-after`, `-green` / `-amber` / `-red`), a 12px
svg at the left or the right of the cell, its input `simple-html-grid-cell-with-icon-before` (or
`-after`) with room for it. A cell with a validation error or a match of Find shows as without a bar
and a scale, as without a rule's colours; the icon stays.

```css
/* bars a little stronger in light: the backgrounds of the palette stay as they are */
.simple-html-grid .simple-html-grid-cell-bar {
    --simple-html-grid-bar-color: light-dark(#93c5fd, #1e3a8a);
}
```

## The variables of the grid

On `.simple-html-grid`, in `grid.css`.

| variable | colours | light | dark |
| --- | --- | --- | --- |
| `--simple-html-grid-main-bg-color` | the labels, the panel, the footer, the row selector, group rows, the menus, the filter editor and the grid config dialog | `#f5f5f5` | `#374151` |
| `--simple-html-grid-sec-bg-color` | the filter row, the inputs, pickers and buttons of the filter editor and the value list, the value list's box, the column chooser's search, the fields of the detail form, the filter chips, the list of the columns and the preview of the column settings, the tooltips (through `--simple-html-grid-tooltip-bg-color`) | `#ffffff` | `#4b5563` |
| `--simple-html-grid-alt-bg-color` | scrollbar tracks, the focus button of a cell | `#ffffff` | `#4b5563` |
| `--simple-html-grid-main-bg-even` | the even rows | `#ffffff` | `#4b5563` |
| `--simple-html-grid-main-bg-odd` | the odd rows | `#f7f7f7` | `#5a6370` |
| `--simple-html-grid-main-bg-selected-odd` | selected rows (odd), the number of a selected column, scrollbar thumbs (through `--simple-html-grid-scrollbar-thumb-color`) | `#bdd4e7` | `#234882` |
| `--simple-html-grid-main-bg-selected-even` | selected rows (even), menu items and buttons under the pointer, the menu item the keyboard is on and the one whose submenu is open | `#afc7db` | `#274e8f` |
| `--simple-html-grid-main-bg-border` | the lines between cells, rows and menu sections, the frame of the grid and the menus | `#e6e5e5` | `#1f2937` |
| `--simple-html-grid-pinned-border` | the lines at the pinned columns and under the header, the frame of the filter editor, the tooltips (through `--simple-html-grid-tooltip-border-color`) and the column chooser's button, the line of a group (the bracket) in the filter editor | `#d1d0d0` | `#1f2937` |
| `--simple-html-grid-sec-bg-border` | the line right of the grouping columns | `#e6e5e5` | `#1f2937` |
| `--simple-html-grid-main-font-color` | the text | `#2e2d2d` | `#f9f7f7` |
| `--simple-html-grid-sec-font-color` | placeholders - the filter row, the search boxes, a picker of the filter editor with nothing picked - the AND/OR between the filter chips, the "too many conditions" box, the drag handles of the column chooser and the Detail form tab, the column chooser's magnifying glass and ✎ | `#6b6b6b` | `#c8c8c8` |
| `--simple-html-grid-boxshadow` | the inset shadow of the labels, the panel and the row selector | `#fffdfd` | `#4b5563` |
| `--simple-html-grid-dropzone-color` | where a dragged column can go, the resize handle under the pointer | `rgba(129, 127, 127, 0.7)` | `rgba(151, 148, 148, 0.4)` |
| `--simple-html-grid-focus-color` | the outline of the element with the keyboard focus | `#005fcc` | `#b3d7ff` |
| `--simple-html-grid-accent-color` | the filled controls of the filter menu's value list and the filter editor: Apply and Apply & close, the AND / OR a group uses, the checkboxes of the value list (`accent-color`), the find bar's *Match case* and *Filter rows* while they are on. At least 3:1 to the menus and the dialog | `#2563eb` | `#93c5fd` |
| `--simple-html-grid-accent-font-color` | the text on the accent colour, at least 4.5:1 to it | `#ffffff` | `#111827` |
| `--simple-html-grid-control-border-color` | the frame of the controls of the value list and the filter editor: the search boxes (the column chooser's too), the pickers, the value inputs, the buttons; a field of the detail form under the pointer and with the focus. At least 3:1 to the menus and the dialog (WCAG 1.4.11) | `#8c8c8c` | `#9ca3af` |
| `--simple-html-grid-detail-input-border-color` | the frame of a field of the detail form at rest: quiet, near the form's background - the field is seen by its own background (`--simple-html-grid-sec-bg-color`). The controls' frame under the pointer, the focus outline with the focus, the error colour with an error | `#d4d4d4` | `#5f6b7a` |
| `--simple-html-grid-range-bg-color` | laid over the cells of a range of cells, see [Ranges of cells](#ranges-of-cells) | `rgba(37, 99, 235, 0.12)` | `rgba(59, 130, 246, 0.2)` |
| `--simple-html-grid-range-border-color` | the line around a range of cells | `#1e40af` | `#dbeafe` |
| `--simple-html-grid-find-match-color` | laid over a cell that matches Find (Ctrl+F), see [Find](#find) | `rgba(250, 204, 21, 0.4)` | `rgba(180, 83, 9, 0.45)` |
| `--simple-html-grid-find-current-color` | laid over the current match of Find | `rgba(251, 146, 60, 0.6)` | `rgba(194, 65, 12, 0.65)` |
| `--simple-html-grid-find-current-border-color` | the line around the current match of Find | `#9a3412` | `#fed7aa` |
| `--simple-html-grid-error-color` | a validation error: the border of the cell, the bar and the exclamation mark of the row selector | `#dc2626` | `#fca5a5` |
| `--simple-html-grid-error-bg-color` | a validation error: laid over the cell and the row selector | `rgba(220, 38, 38, 0.12)` | `rgba(248, 113, 113, 0.22)` |
| `--simple-html-grid-edited-color` | the marker of an edited cell, the pencil of an edited row (`editedMarker`, `rowStatus`) | `#9a3412` | `#fdba74` |
| `--simple-html-grid-new-color` | the plus of a new row (`rowStatus`) | `#166534` | `#86efac` |
| `--simple-html-grid-deleted-color` | the trash can of a row marked for deletion (`rowStatus`) | `#57534e` | `#d1d5db` |
| `--simple-html-grid-conflict-color` | a conflict with the server: the arrows of the row number, the marker of a field in conflict | `#6d28d9` | `#ddd6fe` |
| `--simple-html-grid-merged-color` | the flash of a cell a merge changed (`mergeHighlight`), fading out | `rgba(250, 204, 21, 0.45)` | `rgba(250, 204, 21, 0.35)` |
| `--simple-html-grid-multiline-color` | the marker of a cell with more lines than it shows (`FieldConfig.multiline`) | `#475569` | `#e2e8f0` |
| `--simple-html-grid-lookup-button-bg-color` | the button of a lookup column (`ColumnConfig.editor`) | `#e9edf2` | `#374151` |
| `--simple-html-grid-lookup-icon-color` | the triangle on it, at least 3:1 to it | `#475569` | `#e2e8f0` |
| `--simple-html-grid-lookup-active-bg-color` | the active option of the select of a lookup column | `#dbe7f3` | `#2f4f80` |
| `--simple-html-grid-link-color` | the text of a link: a cell of a link column ([Templates and links](08-formatting.md#templates-and-links)), underlined, and the link in the preview of the column settings. At least 4.5:1 to the rows, the selected rows, under the tints of an error, a range and Find, and to the inputs and the bars | `#1e3a8a` | `#e8f1ff` |
| `--simple-html-grid-palette-red-color` | the text colours of the [colour rules](#colour-rules): red. At least 4.5:1 to the rows, the selected rows (a range's tint over them too), the inputs and every background of the palette | `#90101a` | `#ffe4dd` |
| `--simple-html-grid-palette-orange-color` | orange | `#7c2f00` | `#ffe7c4` |
| `--simple-html-grid-palette-amber-color` | amber | `#6b3a00` | `#ffeab0` |
| `--simple-html-grid-palette-yellow-color` | yellow | `#654100` | `#ffec6c` |
| `--simple-html-grid-palette-lime-color` | lime | `#2f4a00` | `#e4ffb0` |
| `--simple-html-grid-palette-green-color` | green | `#00541c` | `#9dffb3` |
| `--simple-html-grid-palette-teal-color` | teal | `#00504a` | `#b8fff0` |
| `--simple-html-grid-palette-cyan-color` | cyan | `#004a60` | `#c8f8ff` |
| `--simple-html-grid-palette-blue-color` | blue | `#12429f` | `#ccf1ff` |
| `--simple-html-grid-palette-indigo-color` | indigo | `#3426a0` | `#e4e6ff` |
| `--simple-html-grid-palette-purple-color` | purple | `#681aa4` | `#fae2ff` |
| `--simple-html-grid-palette-pink-color` | pink | `#8a1050` | `#ffe0f0` |
| `--simple-html-grid-palette-brown-color` | brown | `#5c3317` | `#fbe8d8` |
| `--simple-html-grid-palette-grey-color` | grey | `#414853` | `#e3ecf9` |
| `--simple-html-grid-palette-red-bg-color` | the backgrounds of the colour rules: red. The text and a link at least 4.5:1 on it, the marks 3:1 | `#fecaca` | `#7f1d1d` |
| `--simple-html-grid-palette-orange-bg-color` | orange | `#fed7aa` | `#7c2d12` |
| `--simple-html-grid-palette-amber-bg-color` | amber | `#fcd34d` | `#805500` |
| `--simple-html-grid-palette-yellow-bg-color` | yellow | `#fef08a` | `#713f12` |
| `--simple-html-grid-palette-lime-bg-color` | lime | `#d9f99d` | `#365314` |
| `--simple-html-grid-palette-green-bg-color` | green | `#bbf7d0` | `#14532d` |
| `--simple-html-grid-palette-teal-bg-color` | teal | `#99f6e4` | `#134e4a` |
| `--simple-html-grid-palette-cyan-bg-color` | cyan | `#67e8f9` | `#155e75` |
| `--simple-html-grid-palette-blue-bg-color` | blue | `#bae6fd` | `#0c4a6e` |
| `--simple-html-grid-palette-indigo-bg-color` | indigo | `#c7d2fe` | `#312e81` |
| `--simple-html-grid-palette-purple-bg-color` | purple | `#e9d5ff` | `#581c87` |
| `--simple-html-grid-palette-pink-bg-color` | pink | `#fbcfe8` | `#831843` |
| `--simple-html-grid-palette-brown-bg-color` | brown | `#e8d5c4` | `#4a2c1a` |
| `--simple-html-grid-palette-grey-bg-color` | grey | `#d1d5db` | `#2b3544` |
| `--simple-html-grid-icon-green-color` | the high icon of an icon set (`ColumnFormat.icons`): ▲, a green light, ✓. At least 3:1 to the rows, the selected rows and the palette's backgrounds | `#166534` | `#86efac` |
| `--simple-html-grid-icon-amber-color` | the middle icon: ►, an amber light, ! | `#92400e` | `#fcd34d` |
| `--simple-html-grid-icon-red-color` | the low icon: ▼, a red light, ✕ | `#b91c1c` | `#fecaca` |
| `--simple-html-grid-totals-bg-color` | the totals row under the rows (`totalsRow`), see [Aggregates](18-aggregates.md) | `#e8edf3` | `#2a3441` |
| `--simple-html-grid-totals-font-color` | the text of the totals row | `#1f2328` | `#f9fafb` |
| `--simple-html-grid-aggregate-label-color` | the label in front of an aggregate (`Sum`) in a group row and the totals row. At least 4.5:1 to both | `#57606a` | `#c9d1d9` |
| `--simple-html-grid-group-line-color` | the grouping columns: the line of each level down its group's rows, the frame of a group row's `+` / `-` box. At least 3:1 to the group rows | `#8c8c8c` | `#9ca3af` |
| `--simple-html-grid-warning-font-color` | the "only the first 100 values" warning of the filter menu's value list | `red` | `#fca5a5` |
| `--simple-html-grid-danger-font-color` | the footer's Clear filter button under the pointer: its text. A problem of a template in the grid config dialog, at least 4.5:1 to the dialog and the inputs | `#c0392b` | `#fecaca` |
| `--simple-html-grid-danger-border` | the footer's Clear filter button under the pointer: its border | `#d98282` | `#f87171` |
| `--simple-html-grid-readonly-stripe-color` | the red stripes of a readonly cell in an editable grid (`.simple-html-readonly`) | `rgb(255, 0, 0)` | `rgb(255, 0, 0)` |
| `--simple-html-grid-required-stripe-color` | the blue stripes of an empty required cell (`.simple-html-mandatory`) | `rgb(0, 8, 255)` | `rgb(120, 140, 255)` |
| `--simple-html-grid-stripe-bg-color` | between the stripes | `rgb(255, 255, 255)` | `transparent` |
| `--simple-html-grid-menu-shadow-color` | the drop shadow of the menus and the other popovers (column chooser, date picker, dropdowns) | `rgba(0, 0, 0, 0.28)` | `rgba(0, 0, 0, 0.6)` |
| `--simple-html-grid-dialog-shadow-color` | the shadow of the filter editor and the grid config dialog | `rgba(0, 0, 0, 0.32)` | `rgba(0, 0, 0, 0.6)` |
| `--simple-html-grid-tooltip-shadow-color` | the shadow of the tooltips | `rgba(0, 0, 0, 0.28)` | `rgba(0, 0, 0, 0.5)` |
| `--simple-html-grid-tooltip-bg-color` | the background of the tooltips | `--simple-html-grid-sec-bg-color` | |
| `--simple-html-grid-tooltip-font-color` | the text of the tooltips | `--simple-html-grid-main-font-color` | |
| `--simple-html-grid-tooltip-border-color` | the frame of the tooltips | `--simple-html-grid-pinned-border` | |
| `--simple-html-grid-scrollbar-thumb-color` | the scrollbar thumbs (the tracks are `--simple-html-grid-alt-bg-color`) | `--simple-html-grid-main-bg-selected-odd` | |
| `--simple-html-grid-scrollbar-shadow-color` | the shadow in a scrollbar thumb (Safari, the other browsers use `scrollbar-color`) | `rgb(0 0 0 / 30%)` | `rgb(0 0 0 / 30%)` |
| `--simple-html-grid-backdrop-color` | the layer over the page behind the filter editor and the grid config dialog | `rgba(129, 127, 127, 0.2)` | `rgba(0, 0, 0, 0.4)` |

`--simple-html-grid-grouping-border` and `--simple-html-grid-main-hr-border` are still set, but
nothing in `grid.css` uses them. The four that name another variable are that one's colour, light
and dark: a theme can give the tooltips and the scrollbar thumbs colours of their own (TreDeSpace
does), and an override of the other one still changes them.

The stripes are a pattern drawn at 20% opacity over the cell, so their colours show much lighter
than they are.

The fonts:

| variable | for | default |
| --- | --- | --- |
| `--simple-html-grid-font-family` | all text | `'Roboto', 'Helvetica', 'Arial', 'sans-serif'` |
| `--simple-html-grid-font-size` | all text | `11px`. A larger font needs a larger `cellHeight` and `multilineLineHeight` (grid options, in px) |
| `--simple-html-grid-touch-row-height` | on a touch screen (`pointer: coarse`): the height of a menu item, a column chooser field, a row of the filter menu's value list | `28px`. With a mouse they keep their own height |
| `--simple-html-grid-font-weight` | the cells, the inputs | `500` |
| `--simple-html-grid-font-weight-header` | the labels, the menu sections, group rows, buttons | `700` |
| `--simple-html-grid-font-weight-cell` | the menu items, the filter editor's title and captions | `--simple-html-grid-font-weight` |

## The date picker

On `.simple-html-date`, in `date.css`: the grid's date picker, and the date picker or calendar on
its own (`<simple-html-date>`).

It looks like the grid: flat, square corners, thin lines, the grid's font. On top the month and the
year on one line, between square buttons to the year and the month before (« ‹) and after (› »).
Then the week numbers and the days: the days of the months before and after are quieter, today is
bold with a bar under it, the selected day has a frame and a fill. At the bottom the hour and the
minutes, each a number between a step down and a step up (the arrow keys step it too), and Clear,
Now and Use in a bar of buttons of the same width - Use in the colours of the selected day.

A range picker (`rangepicker: true`, the grid's date header filter with Between) has two months side
by side with « ‹ before the first and › » after the last (`.simple-html-date-nav-space` holds their
place in the other header). From and To have the frame and fill of the selected day
(`.simple-html-date-day-selected`), the days between them a fill of their own
(`.simple-html-date-day-in-range`). Under the months, as wide as both, the line of From and To
(`.simple-html-date-range-ends`: a label over the day picked) and Clear and Use - no hours, minutes
or Now. The bottom is `.simple-html-date-range`.

| variable | colours | light | dark |
| --- | --- | --- | --- |
| `--simple-html-date-main-bg-color` | the background, the buttons, the hour and minute inputs | `white` | `#374151` |
| `--simple-html-date-main-color` | the text | `#2e2d2d` | `#f9f7f7` |
| `--simple-html-date-dimmed-color` | the days of the months before and after | `#767676` | `#adadad` |
| `--simple-html-date-week-color` | the week numbers, the names of the days, the hour and minute labels | `#6b6b6b` | `#b4b4b4` |
| `--simple-html-date-main-bg-border` | the lines: under the names of the days, right of the week numbers, over the time | `#e6e5e5` | `#4b5563` |
| `--simple-html-date-button-border` | the frame of the buttons and of the hour and minute inputs | `#d1d0d0` | `#6b7280` |
| `--simple-html-date-hover-bg-color` | a day or a button under the pointer | `#e5ebf1` | `#4b5563` |
| `--simple-html-date-main-bg-selected` | the selected day, the Use button | `#bdd4e7` | `#234882` |
| `--simple-html-date-in-range-bg-color` | a range picker: the days between From and To - midway between the background and the selected day | `#dee9f3` | `#2d4469` |
| `--simple-html-date-selected-border` | the frame of the selected day and of the Use button | `#3f73a8` | `#7fb0ff` |
| `--simple-html-date-today-color` | the bar under today | `#005fcc` | `#93c5fd` |
| `--simple-html-date-focus-color` | the outline of the element with the keyboard focus (in the grid: the grid's) | `#005fcc` | `#b3d7ff` |
| `--simple-html-date-font-size` | the text | `11px` | |
| `--simple-html-date-font-family` | the text | `'Roboto', 'Helvetica', 'Arial', 'sans-serif'` | |

The text has a contrast of at least 4.5:1 to its background, in light and in dark - the fill of the
days of a range too; the frame of the selected day and the bar under today at least 3:1 to the
background, the selected day's fill and the fill of a range (WCAG 1.4.3 and 1.4.11). Keep that when you change them. The dimmed days and the week numbers had
lighter colours before v6 (`#dfdfdf`, `#8b8b8b`): too light to read.

`--simple-html-date-header-bg-border` is still set, but nothing in `date.css` uses it.

# Theming

Every colour of the grid is a css variable: the grid itself, its menus, the column chooser, the
tooltips, the filter editor and the date picker. Each variable has a light and a dark colour, and the
grid follows the `color-scheme` of the page: dark mode is one line of css.

```sample theming
```

The variables of the grid are set on `.simple-html-grid` in `grid.css`, the ones of the date picker
on `.simple-html-date` in `date.css`. The tables at the end list them all.

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
in a cell has it on the cell.

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
- `--simple-html-grid-error-color` and `--simple-html-grid-error-bg-color` - a cell and a row with an
  error: the border of the cell, the bar and the exclamation mark of the row number, the tint, see
  [How the grid shows the errors](05-editing.md#how-the-grid-shows-the-errors)

The icons and the marker are graphics: the new, edited and deleted colours have a contrast of at least
3:1 to the rows, the row numbers and the selected rows, in light and in dark, also under an error's
tint (WCAG 1.4.11). Keep that when you change them. Each state has a shape of its own too, the colour is
not the only thing that tells them apart.

## Multiline text

A cell of several lines (see [Multiline text](05-editing.md#multiline-text)) has a marker at its
right, lines of text, in `--simple-html-grid-multiline-color` - at least 3:1 to the rows and the
selected rows too. In a row made taller (`fitRows()`) the cell shows its other lines under the first
one, in the cell's text colour (`--simple-html-grid-main-font-color`): an element of their own,
`simple-html-grid-cell-lines`, with the classes the `cellClass` hook gives the input. The editor that
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

## The variables of the grid

On `.simple-html-grid`, in `grid.css`.

| variable | colours | light | dark |
| --- | --- | --- | --- |
| `--simple-html-grid-main-bg-color` | the labels, the panel, the footer, the row selector, group rows, the menus, the filter editor | `#f5f5f5` | `#374151` |
| `--simple-html-grid-sec-bg-color` | the filter row, the inputs and buttons of the filter editor, the filter chips, the tooltips | `#ffffff` | `#4b5563` |
| `--simple-html-grid-alt-bg-color` | scrollbar tracks, the search input of the column chooser, the focus button of a cell | `#ffffff` | `#4b5563` |
| `--simple-html-grid-main-bg-even` | the even rows | `#ffffff` | `#4b5563` |
| `--simple-html-grid-main-bg-odd` | the odd rows | `#f7f7f7` | `#5a6370` |
| `--simple-html-grid-main-bg-selected-odd` | selected rows (odd), the number of a selected column, the selected menu item, scrollbar thumbs | `#bdd4e7` | `#234882` |
| `--simple-html-grid-main-bg-selected-even` | selected rows (even), menu items and buttons under the pointer | `#afc7db` | `#274e8f` |
| `--simple-html-grid-main-bg-border` | the lines between cells, rows and menu sections, the frame of the grid and the menus | `#e6e5e5` | `#1f2937` |
| `--simple-html-grid-pinned-border` | the lines at the pinned columns and under the header, the frame of the filter editor, the tooltips and the buttons | `#d1d0d0` | `#1f2937` |
| `--simple-html-grid-sec-bg-border` | the line right of the grouping columns | `#e6e5e5` | `#1f2937` |
| `--simple-html-grid-main-font-color` | the text | `#2e2d2d` | `#f9f7f7` |
| `--simple-html-grid-sec-font-color` | placeholders, the AND/OR between the filter chips, the "too many conditions" box | `#979494` | `#c8c8c8` |
| `--simple-html-grid-boxshadow` | the inset shadow of the labels, the panel and the row selector | `#fffdfd` | `#4b5563` |
| `--simple-html-grid-dropzone-color` | where a dragged column can go, the resize handle under the pointer | `rgba(129, 127, 127, 0.7)` | `rgba(151, 148, 148, 0.4)` |
| `--simple-html-grid-focus-color` | the outline of the element with the keyboard focus | `#005fcc` | `#b3d7ff` |
| `--simple-html-grid-range-bg-color` | laid over the cells of a range of cells, see [Ranges of cells](#ranges-of-cells) | `rgba(37, 99, 235, 0.12)` | `rgba(59, 130, 246, 0.2)` |
| `--simple-html-grid-range-border-color` | the line around a range of cells | `#1e40af` | `#dbeafe` |
| `--simple-html-grid-error-color` | a validation error: the border of the cell, the bar and the exclamation mark of the row selector | `#dc2626` | `#fca5a5` |
| `--simple-html-grid-error-bg-color` | a validation error: laid over the cell and the row selector | `rgba(220, 38, 38, 0.12)` | `rgba(248, 113, 113, 0.22)` |
| `--simple-html-grid-edited-color` | the marker of an edited cell, the pencil of an edited row (`editedMarker`, `rowStatus`) | `#9a3412` | `#fdba74` |
| `--simple-html-grid-new-color` | the plus of a new row (`rowStatus`) | `#166534` | `#86efac` |
| `--simple-html-grid-deleted-color` | the trash can of a row marked for deletion (`rowStatus`) | `#57534e` | `#d1d5db` |
| `--simple-html-grid-multiline-color` | the marker of a cell with more lines than it shows (`FieldConfig.multiline`) | `#475569` | `#e2e8f0` |
| `--simple-html-grid-totals-bg-color` | the totals row under the rows (`totalsRow`), see [Aggregates](18-aggregates.md) | `#e8edf3` | `#2a3441` |
| `--simple-html-grid-totals-font-color` | the text of the totals row | `#1f2328` | `#f9fafb` |
| `--simple-html-grid-aggregate-label-color` | the label in front of an aggregate (`Sum`) in a group row and the totals row. At least 4.5:1 to both | `#57606a` | `#c9d1d9` |
| `--simple-html-grid-group-line-color` | the grouping columns: the line of each level down its group's rows, the frame of a group row's `+` / `-` box. At least 3:1 to the group rows | `#8c8c8c` | `#9ca3af` |
| `--simple-html-grid-warning-font-color` | the "too many values" warning of the filter menu | `red` | `#fca5a5` |
| `--simple-html-grid-danger-font-color` | the footer's Clear filter button under the pointer: its text | `#c0392b` | `#fecaca` |
| `--simple-html-grid-danger-border` | the footer's Clear filter button under the pointer: its border | `#d98282` | `#f87171` |
| `--simple-html-grid-readonly-stripe-color` | the red stripes of a readonly cell in an editable grid (`.simple-html-readonly`) | `rgb(255, 0, 0)` | `rgb(255, 0, 0)` |
| `--simple-html-grid-required-stripe-color` | the blue stripes of an empty required cell (`.simple-html-mandatory`) | `rgb(0, 8, 255)` | `rgb(120, 140, 255)` |
| `--simple-html-grid-stripe-bg-color` | between the stripes | `rgb(255, 255, 255)` | `transparent` |
| `--simple-html-grid-menu-shadow-color` | the shadow of the menus | `black` | `black` |
| `--simple-html-grid-dialog-shadow-color` | the shadow of the filter editor | `rgba(0, 0, 0, 0.32)` | `rgba(0, 0, 0, 0.6)` |
| `--simple-html-grid-tooltip-shadow-color` | the shadow of the tooltips | `rgba(0, 0, 0, 0.28)` | `rgba(0, 0, 0, 0.5)` |
| `--simple-html-grid-scrollbar-shadow-color` | the shadow in a scrollbar thumb (Safari, the other browsers use `scrollbar-color`) | `rgb(0 0 0 / 30%)` | `rgb(0 0 0 / 30%)` |
| `--simple-html-grid-backdrop-color` | the layer over the page behind the filter editor | `rgba(129, 127, 127, 0.2)` | `rgba(0, 0, 0, 0.4)` |

`--simple-html-grid-grouping-border` and `--simple-html-grid-main-hr-border` are still set, but
nothing in `grid.css` uses them.

The stripes are a pattern drawn at 20% opacity over the cell, so their colours show much lighter
than they are.

The fonts:

| variable | for | default |
| --- | --- | --- |
| `--simple-html-grid-font-family` | all text | `'Roboto', 'Helvetica', 'Arial', 'sans-serif'` |
| `--simple-html-grid-font-size` | all text | `11px` |
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
| `--simple-html-date-selected-border` | the frame of the selected day and of the Use button | `#3f73a8` | `#7fb0ff` |
| `--simple-html-date-today-color` | the bar under today | `#005fcc` | `#93c5fd` |
| `--simple-html-date-focus-color` | the outline of the element with the keyboard focus (in the grid: the grid's) | `#005fcc` | `#b3d7ff` |
| `--simple-html-date-font-size` | the text | `11px` | |
| `--simple-html-date-font-family` | the text | `'Roboto', 'Helvetica', 'Arial', 'sans-serif'` | |

The text has a contrast of at least 4.5:1 to its background, in light and in dark; the frame of the
selected day and the bar under today at least 3:1 to the background and the selected day's fill
(WCAG 1.4.3 and 1.4.11). Keep that when you change them. The dimmed days and the week numbers had
lighter colours before v6 (`#dfdfdf`, `#8b8b8b`): too light to read.

`--simple-html-date-header-bg-border` is still set, but nothing in `date.css` uses it.

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

The grid styles a cell and a row with a validation error with `--simple-html-grid-error-color` and
`--simple-html-grid-error-bg-color`, see
[How the grid shows the errors](05-editing.md#how-the-grid-shows-the-errors).

The row state classes (`row-is-new`, `row-is-modified`, `row-is-deleted`, see
[Showing the row state](05-editing.md#showing-the-row-state)) are not styled by `grid.css`. Give them
a light and a dark colour the same way:

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
| `--simple-html-grid-error-color` | a validation error: the border of the cell, the bar of the row selector | `#dc2626` | `#fca5a5` |
| `--simple-html-grid-error-bg-color` | a validation error: laid over the cell and the row selector | `rgba(220, 38, 38, 0.12)` | `rgba(248, 113, 113, 0.22)` |
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

| variable | colours | light | dark |
| --- | --- | --- | --- |
| `--simple-html-date-main-bg-color` | the background, the buttons, the hour and minute inputs | `white` | `#374151` |
| `--simple-html-date-main-color` | the text | `#2e2d2d` | `#f9f7f7` |
| `--simple-html-date-dimmed-color` | the days of the months before and after | `#dfdfdf` | `#979494` |
| `--simple-html-date-week-color` | the week numbers, the hour and minute labels | `#8b8b8b` | `#b4b4b4` |
| `--simple-html-date-main-bg-border` | the lines, the frame of the buttons, the selected day and the day under the pointer | `#e6e5e5` | `#979494` |
| `--simple-html-date-main-bg-selected` | the selected day, a button under the pointer | `#bdd4e7` | `#234882` |
| `--simple-html-date-focus-color` | the outline of the element with the keyboard focus (in the grid: the grid's) | `#005fcc` | `#b3d7ff` |
| `--simple-html-date-font-size` | the text | `11px` | |
| `--simple-html-date-font-family` | the text | `'Roboto', 'Helvetica', 'Arial', 'sans-serif'` | |

`--simple-html-date-header-bg-border` is still set, but nothing in `date.css` uses it.

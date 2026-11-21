# Custom cell rendering - plan

V6_PLAN.md item 39, the rendering half: a column can show its cells with code of your own - a badge,
a progress bar, a link, an icon, a button - written with plain DOM, lit-html, React, Solid or
anything else that can render into an element.

Not started. Size **M** for step 1, **M** for step 2.

## The decision: a renderer hook, not a framework in the core

Asked: should the grid move from lit-html to Solid 2.0, for JSX cells and signals? No:

- **JSX cells would only help Solid users.** The grid is for apps without a framework (README).
  Solid JSX is compiled by Solid's Babel plugin and is not React's JSX, so a React or Vue app could
  not write Solid cells either. A grid built on Solid ships Solid to everyone.
- **The build would need Babel.** esbuild does not compile Solid JSX by itself; the build and vitest
  would both need the plugin. Solid's no-compile `html` template is about what lit-html is already.
- **Signals do not fit the hot path.** The cell elements are a pool (assignPool.ts): a scroll gives a
  cell another row, and everything in it changes at once - signals would re-run every binding and
  add subscription bookkeeping. What signals would give is already there: a write to a row sends
  `rows-changed`, and the rows on screen render once in the next frame (renderChangedRows.ts), with
  lit-html touching only the parts that changed.
- **Cost and timing.** 28 files use lit-html (grid and date picker), v6 is nearly done, and Solid 2.0
  went stable in November 2026.

A renderer hook that does not depend on any framework gives every app custom cells in its own tool,
Solid apps included - with signals inside their cells if they want. AG Grid and the like do the same:
a framework-free core and a small renderer interface.

## The API (proposed)

Like formatters: the renderer is code, registered under an id; the config names the id and stays
plain JSON.

```ts
/** what the grid gives a renderer each time the cell shows a row */
export interface CellRenderContext<T = unknown> {
    /** the row - always a data row, a group row has no cells. A write goes through the datasource
     *  as code does: edit tracking, validation, undo, and the cell renders again */
    row: EntityUnion<T>;
    /** the cell's field */
    field: string;
    /** `row[field]` */
    value: unknown;
    /** the text the default cell would show: the field's formatter, `numberOverride` applied */
    text: string;
    /** the cell's type - the field's, or the one `dynamicCellTypeColumn` gives this row */
    type: FieldType;
    /** the grid is readonly, or this cell is (the column's `readonly`, the `isReadonly` hook) */
    readonly: boolean;
    /** the displayed row index, as in the grid's events */
    rowIndex: number;
    /** the grid: the registry is for the page, a renderer can not know its grid otherwise */
    gridInterface: GridInterface<T>;
}

export interface CellRendererInstance<T = unknown> {
    /** called every time the cell is rendered: a new row while scrolling, a changed value, refresh() */
    update(context: CellRenderContext<T>): void;
    /** called when the cell element stops using this renderer, or is thrown away */
    destroy?(): void;
}

/** called once per cell element: render into `host`, keep what you need, return the instance */
export type CellRenderer<T = unknown> = (host: HTMLElement) => CellRendererInstance<T>;

export function registerCellRenderer(id: string, renderer: CellRenderer<any>): void;
```

```ts
// ColumnConfig
renderer?: string; // the id of a registered renderer
```

**Why `update()` and not a new mount per row:** a cell element shows another row on every scroll
step. Mounting a component each time would be slow; `update()` lets the renderer (or its framework)
change only what differs. The number of instances is the number of cell elements in the pool that
show the column - rows on screen + 5, times stacked cells - not the number of rows.

### What it looks like in each tool

Plain DOM:

```ts
registerCellRenderer('badge', (host) => {
    const span = document.createElement('span');
    host.appendChild(span);
    return {
        update({ value, text }) {
            span.textContent = text;
            span.className = `badge badge-${String(value)}`;
        }
    };
});

// the config, plain JSON
const config: GridConfig = { columns: { status: { renderer: 'badge' } }, layout: { center: [{ fields: ['status'], width: 100 }] } };
```

lit-html (the grid depends on it already):

```ts
registerCellRenderer('progress', (host) => ({
    update: ({ value }) => render(html`<progress max="100" .value=${Number(value) || 0}></progress>`, host)
}));
```

React:

```tsx
registerCellRenderer('owner', (host) => {
    const root = createRoot(host);
    return {
        update: (context) => root.render(<Owner row={context.row} />),
        destroy: () => root.unmount()
    };
});
```

Solid - the shape only, check names and import paths against the Solid 2.0 docs when the guide is
written:

```tsx
registerCellRenderer('owner', (host) => {
    const [context, setContext] = createSignal<CellRenderContext>();
    const dispose = render(() => <Show when={context()}>{(c) => <Owner row={c().row} />}</Show>, host);
    return { update: setContext, destroy: dispose };
});
```

React and Solid may write the DOM a tick later than `update()`. The grid never reads the renderer's
DOM, so that is fine.

## How it works in the grid

### The cell

`renderRowCell` gets a third template next to the checkbox one and the input one, for a column with
a `renderer`:

```html
<div style="width:100%;height:100%;">
    <div data-attribute-dimmed=... class=${backgroundClass}></div>
    <div class="simple-html-grid-cell-custom cellpos-${colType}-${row}-${column}-${celno} ${cellClass.input}${repeatedClass}"
         tabindex="0" data-attribute=... @keydown @focus @blur @click @contextmenu></div>
</div>
```

- the inner `div` is the **host**. It has no children in the template, so lit-html leaves what the
  renderer puts in it alone: re-rendering the same template keeps the host and its content
- it carries the `cellpos-` class and `tabindex`, so keyboard navigation finds and focuses it as it
  does the input (`getElementByClassName(...).focus()` in cellRowKeyNavigationCellRowHandler.ts)
- its handlers are the input's, minus the typing: navigation, range keys, Delete, undo/redo, the
  current row and `cell-click` on click, `cell-row-focus` and `rangeCellFocused` on focus, the row menu.
  An event from the renderer's own content bubbles to them; a renderer with its own keys stops them

### The lifecycle

The cell element remembers its renderer: `HTMLCellElement.$renderer = { id, instance }`.

- **render a custom column:** a `$renderer` with another id is destroyed and the host emptied; with
  none, the renderer is looked up and called with the host. Then `instance.update(context)`
- **render anything else** in the cell (another column after a horizontal scroll, the checkbox, the
  input, the empty cell): destroy `$renderer` first - lit-html is about to remove the host
- **a group row:** the cells are hidden and nothing is called; the instance stays for the next data row
- **cells thrown away:** `rebuildRows` and `rebuildRowColumns` remove the old elements (resize,
  `cellHeight`, layout changes): destroy every `$renderer` in them first. Same in
  `disconnectElement()` - a React root or a subscription would otherwise keep the grid alive. The grid
  mounts again when the element comes back, it rebuilds then
- **two columns with the same renderer:** a horizontal scroll that moves a cell from one to the other
  keeps the instance, `update()` gets the other field

One helper file, `src/grid/gridFunctions/customCell.ts`: `renderCustomCell`, `releaseRenderer(cell)`,
`releaseAllRenderers(ctx)`. The registry in `src/grid/cellRendererRegistry.ts`, as
formatterRegistry.ts.

### What keeps working without changes

They work on the cell element or on the data, not on the input:

- validation errors (class and tooltip on the cell), the edited mark, ranges of cells
- the `cellClass` hook's `background`, the readonly and required stripes (the dimmed div)
- copy, paste, clear, Delete on a range (data, and `copy` is a listener on `document`)
- CSV and Excel export, sort, filter, group, aggregates (data and formatter)

### What needs a change

- **a row marked for deletion:** grid.css strikes through `.simple-html-cell-deleted input` only -
  add the host
- **repeated values:** the class goes on the host; content of your own keeps its own colours
- **accessibility:** the cell stays the `gridcell`, the host is the focus target. No `aria-label` on
  the host: it would hide the content. The renderer should render readable text (or label its own
  controls) - check in Chrome's accessibility tree

### Left out of step 1

The column's `placeholderRow`, multiline handling, `focusButton` and the date picker on click are the
default cell's: a custom column does not get them. `autoResizeColumns` measures the formatter's text,
which may be narrower than a badge.

## Steps

### Step 1 - display (M)

1. `registerCellRenderer`, the types, `ColumnConfig.renderer`; an id that is not registered throws a
   `TypeError` when the grid is made or `updateConfig()` gets the column, as `aggregate` does. Export
   from index.ts, check:typings
2. the custom template and the lifecycle in renderRowCell / customCell.ts
3. release in rebuildRows, rebuildRowColumns, disconnectElement
4. the css for the host: focus ring, deleted, fills the cell
5. a renderer can make an editable cell of its own: a select or a button that writes
   `context.row[field]`, when `context.readonly` is false. The sample shows one

### Step 2 - editing in a custom cell (M)

For a renderer that only displays: Enter, F2, typing a character and double click open the overlay
text editor (textEditor.ts, the multiline cell's) with the field's formatter, as a multiline cell
does. It needs a single-line mode: Enter saves. A date field opens the date picker, as the default
cell's click does. A boolean is left to the renderer.

### Later, if asked

- `focusButton` on a custom cell (it moves `.simple-html-grid-cell-input`, the host needs the same)
- `measure?(context): number` for autoResizeColumns
- renderers for group rows, the totals row, header labels
- choose the renderer per row (a hook) - a renderer can already draw each row its own way

The other half of item 39, conditional formatting: cell classes from a function is the `cellClass`
hook, done. Row classes are not.

## Tests

vitest + happy-dom, `src/grid/__tests__/customCell.test.ts`:

- the registry: register, replace, a bad id or a renderer that is not a function throws; an unknown
  id in the config throws at createGrid and at updateConfig
- one mount per cell element, not per row: scroll 1000 rows, the mount count stays at the pool size;
  `update()` gets the rows scrolled in
- destroy: a horizontal scroll to a column without the renderer, or with another; `updateConfig()`
  removing `renderer`; a rebuild (cellHeight); `gridInterface.destroy()`; the element removed
- a value set from code: `update()` with the new value in the next frame
- a write from the renderer: edit tracking, validation, one undo step
- the arrows and Tab move through a custom cell; focus sends `cell-row-focus`; click makes the row
  current and sends `cell-click`
- errors, the edited mark and a range show on a custom cell; `readonly` follows the `isReadonly` hook

Chromium check (scratch folder): the focus ring, 10 000 rows scrolled with two custom columns, copy
from a custom cell, the accessibility tree.

## Docs

- guide `guides/19-custom-cells.md`: plain DOM and lit-html as ```ts blocks (typechecked by
  check:docs); React and Solid as ```tsx, check:docs only typechecks ```ts
- demo sample `samples/demo/samples/customCells.ts`: badge, progress bar, link, a select that edits
- JSDoc with `@sample custom-cells` on `registerCellRenderer`, the types and `ColumnConfig.renderer`
- CHANGELOG, MIGRATION (nothing breaks: new option), V6_PLAN item 39, IMPORVEMENT.md

## Open questions

1. the name in the config: `renderer` or `cellRenderer`?
2. an unknown id: throw (as `aggregate`), or the default cell and a console warning? Throw proposed
3. call `update()` on every render, or skip it when the row and the value are the same? Every render
   proposed - lit-html, React and Solid diff anyway, and a renderer may read other fields of the row
4. step 2: the overlay editor, or leave editing to the renderer only?

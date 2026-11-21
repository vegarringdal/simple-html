# Custom cells

A column can draw its cells with code of your own: a badge, a progress bar, a link, an icon, a select
that edits the value - written with plain DOM, lit-html, React, Solid or anything else that renders
into an element. Register the code once as a **cell renderer**, with an id, and name the id in the
column's `renderer`: the config stays plain JSON. The cell keeps everything else a cell of the grid
does - the keys, the focus, copy and paste, ranges, Find, errors and the edited marker.

```sample custom-cells
```

## A renderer

`registerCellRenderer(id, renderer)` when the page loads, before the grid that names it is made. A
renderer is a function: the grid calls it with an element to render into, the **host**, and it returns
an object with an `update()` the grid calls every time the cell shows a row.

```ts
import { createGrid, type GridConfig, registerCellRenderer } from '@simple-html/grid';

registerCellRenderer('badge', (host) => {
    // made once per cell element
    const span = document.createElement('span');
    host.appendChild(span);
    return {
        // every time the cell is rendered: change what differs
        update({ value, text }) {
            span.textContent = text;
            span.className = `badge badge-${String(value)}`;
        }
    };
});

const config: GridConfig = {
    columns: { status: { renderer: 'badge' } },
    layout: { center: [{ fields: ['status'], width: 100 }] }
};
createGrid(host, { config, datasource });
```

- **Once per cell element, not per row.** The grid shows a few more cell elements than fit on screen
  and reuses them while it scrolls: a cell element shows another row on every scroll step. The renderer
  is called once for each cell element that shows the column, `update()` every time the cell is
  rendered - another row scrolled in, a value changed, `refresh()`, a sort or a filter. With 10 000
  rows there are as many renderers as cell elements of the column, about the rows on screen. Make the
  elements in the renderer, change them in `update()`.
- **`destroy()`**, when the instance has one, is called once when the cell element is done with it: it
  shows a column without the renderer now (scrolled sideways), the column lost its `renderer`
  (`updateConfig()`), the cells are made again (a resize, `cellHeight`, a new layout, grouping), the grid
  is taken off the page or `gridInterface.destroy()` is called. Undo there what lives outside the host -
  a framework's root, a subscription, a timer: else it keeps the grid alive. The grid empties the host
  after it.
- **An id that is not registered throws** a `TypeError` when the grid is made, or when `updateConfig()`
  is given the column - naming the ids that are. So does a renderer that is not a function, and an
  instance without `update()`.
- **Registering an id again replaces the renderer** for the cells that mount it after; the cells that
  show it keep theirs until they are done with it. There is one registry for the page.
- Two columns with the same renderer share the instances: a cell element that scrolls from one to the
  other keeps its instance, `update()` gets the other field.

## What update() gets

A new `CellRenderContext` every call:

| field | is |
| --- | --- |
| `row` | the row: always a data row, a group row has no cells. Writing to it is an edit, see [below](#a-cell-that-edits-its-value) |
| `field` | the cell's field |
| `value` | `row[field]` |
| `text` | the text the default cell would show: the value through the field's formatter, with `numberOverride` |
| `type` | the cell's type: the field's, or the one `dynamicCellTypeColumn` gives this row |
| `readonly` | the cell can not be edited: the grid is readonly, the column is, or the `isReadonly` hook says so |
| `rowIndex` | the row's index in the displayed rows (`datasource.getRows()`), as in the grid's events |
| `gridInterface` | the grid: the registry is for the page, so this is how a renderer knows its grid |

`update()` is called on every render, also when nothing changed: compare and skip if your drawing is
expensive. A renderer may read other fields of the row.

## lit-html

The grid renders with lit-html, so it is installed already. `render()` into the host on every
`update()`: lit-html keeps the elements and changes only what differs.

```ts
import { registerCellRenderer } from '@simple-html/grid';
import { html, render } from 'lit-html';

registerCellRenderer('progress', (host) => ({
    update({ value }) {
        const percent = Math.min(Math.max(Number(value) || 0, 0), 100);
        render(html`<span class="bar"><span style=${`width:${percent}%`}></span></span> ${percent}%`, host);
    }
}));
```

## React

A root per cell element, rendered again on every `update()`, unmounted in `destroy()` (React 18 and
19, `react-dom/client`):

```tsx
import { createRoot } from 'react-dom/client';
import { registerCellRenderer } from '@simple-html/grid';

function Owner({ name, readonly }: { name: string; readonly: boolean }) {
    return <span className={readonly ? 'owner readonly' : 'owner'}>{name}</span>;
}

registerCellRenderer('owner', (host) => {
    const root = createRoot(host);
    return {
        update: (context) => root.render(<Owner name={context.text} readonly={context.readonly} />),
        destroy: () => root.unmount()
    };
});
```

- Pass the values the component shows as props. The row is the same object while its values change -
  the datasource changes it in place - so a component memoized on `row` would not see an edit.
- `root.render()` is not synchronous: React writes the DOM a moment later. That is fine, the grid never
  reads what the renderer drew.

## Solid

Solid 2.0 (`render` from `@solidjs/web`, `createSignal` and `Show` from `solid-js` - checked against
[docs.solidjs.com](https://docs.solidjs.com/), which covers 2.0). The context goes into a signal, the
component reads it: Solid updates only what depends on what changed.

```tsx
import { createSignal, Show } from 'solid-js';
import { render } from '@solidjs/web';
import { type CellRenderContext, registerCellRenderer } from '@simple-html/grid';

function Owner(props: { name: string }) {
    return <span class="owner">{props.name}</span>;
}

registerCellRenderer('owner', (host) => {
    const [context, setContext] = createSignal<CellRenderContext>();
    // render() returns the function that disposes of the root and removes what it rendered
    const dispose = render(() => <Show when={context()}>{(c) => <Owner name={c().text} />}</Show>, host);
    return {
        update: (next) => setContext(next),
        destroy: dispose
    };
});
```

- Solid 2 applies a write to a signal on the next microtask, so the cell shows the row a moment after
  `update()`. As for React, that is fine.
- `Show`'s function child gets an accessor (`c()`), not the value: without `keyed` the content is kept
  when the cell shows another row, only what reads the context runs again.
- Solid 1.x imports `render` from `solid-js/web` instead; the rest is the same. Neither is checked by
  the docs build: it typechecks the `ts` examples of this guide, not these.

## A cell that edits its value

`context.row[context.field] = value` writes the row - as a write from code does: the edit is tracked
(the row state, the edited marker), the field is validated, it is one step of the undo history, and the
cell is rendered again in the next frame. Write only when `context.readonly` is false.

```ts
import { type CellRenderContext, registerCellRenderer } from '@simple-html/grid';

registerCellRenderer('priority', (host) => {
    const select = document.createElement('select');
    // the cell is the stop of Tab: edit() below focuses the select
    select.tabIndex = -1;
    // a control of your own needs a name for a screen reader
    select.setAttribute('aria-label', 'Priority');
    for (const priority of ['Low', 'Normal', 'High']) {
        select.add(new Option(priority, priority));
    }
    let context: CellRenderContext | undefined;
    select.addEventListener('change', () => {
        if (context && !context.readonly) {
            context.row[context.field] = select.value;
        }
    });
    select.addEventListener('keydown', (event) => {
        // its own key: Esc goes back to the cell, not to the grid (it clears the ranges there)
        if (event.key === 'Escape') {
            event.stopPropagation();
            host.focus();
        }
    });
    host.appendChild(select);
    return {
        update(next) {
            context = next;
            select.value = String(next.value ?? '');
            select.disabled = next.readonly;
        },
        // Enter, F2, typing or a double click on the cell: the select is the editor
        edit() {
            select.focus();
        }
    };
});
```

Keep the value in your control as `update()` gives it: undo, a paste, a write from code and a merge
from the server change it too.

## Editing

A cell the renderer only draws is edited by the grid, where it can be edited - the grid and the cell are
not readonly, the column is not `allowPasteClearOnly`:

| how | does |
| --- | --- |
| Enter, F2, a double click | opens the grid's editor over the cell, with the text of the field's formatter |
| a character typed | opens it with the character at the end of the text |
| a click on a date cell | opens the date picker, as the default date cell does. A date can be typed in the editor too |

The editor is an input in a popover over the cell, `Enter to save, Esc to cancel` under it (the text
`cell.editor.hint`): Enter saves and closes it, Esc closes it without a write, Tab saves and goes on to
the next cell, a click outside it or scrolling saves. The text is read with the formatter's `parse`, the
write is one step of the undo history; the focus goes back to the cell. A text of several lines (a
`multiline` field, or a value with a line break) gets the editor of a multiline cell instead - Ctrl+Enter
saves - and that one opens read-only in a readonly cell, to read the text, as in a multiline cell. See
[Multiline text](05-editing.md#multiline-text).

A boolean has no editor: draw a control of your own, or let the cell be read only.

A renderer that edits the value itself gives its instance an `edit()`: the grid calls it instead of
opening its editor (and the date picker), with the character typed or `undefined`, and only where the
cell can be edited. Focus your control there, open it, step the value.

The keys and the double click are the grid's when they are on the cell itself. On what your renderer put
in the cell - a select with the focus, an input - Enter and typing are the control's: the grid opens
nothing.

## The keys and the focus

The host is what gets the focus: it has the cell's `cellpos-` class and `tabindex="0"`, the keys find
it as they find the input of another cell. It has the keyboard focus ring of every control of the grid.

- **Tab, Alt+arrows**, the ranges (Alt+Shift+arrows, Esc), Delete on a range, Ctrl+D, Ctrl+Z / Ctrl+Y
  and the row menu (Shift+F10) work as in any cell - also from what your renderer put in it, the keys
  bubble to the host.
- **The plain arrows** move to the next cell too when the host has the focus: it has no caret. On your
  own control they are the control's.
- **Space** on the host does not scroll the page (a typed space opens the editor).
- **Copy** (Ctrl+C) copies the cell's text - the formatter's, not what the renderer drew. **Paste** writes
  the value, as into a checkbox: the host is no input.
- A click makes the row the current row and sends `cell-click`; the focus moving into the cell sends
  `cell-row-focus` once - moving on from the host into your control is not a new focus of the cell.

Stop a key your control handles itself, `event.stopPropagation()`, when the grid should not get it: a
text input of your own, say, where Ctrl+Z is the input's undo and the arrows move the caret.

## What the grid shows on a custom cell

What the grid puts on the cell element shows on a custom cell as on any other: the red border and tooltip
of a validation error, the edited marker, a range of cells and its fill handle, the tint of a match of
Find, the readonly and required stripes, the `cellClass` hook's `background` class (behind the host) and
`input` class (on the host), the flash of a merge. A row marked for deletion strikes the host's text
through. A repeated value (`dimRepeatedValues`) dims the host, your content with it.

The host fills the cell: `position: absolute`, a flex row with its content in the middle of the line and
3px of padding at the left, the grid's font and text colour, `overflow: hidden`. In a row made taller by
`fitRows()` its content stays on the first line, as the text of the other cells. It is transparent: an
error or a range shows through it. Style what you put in it with your own classes; the host's own
`class`, `style`, `tabindex` and `data-` attributes are the grid's and are set again on a render. The class
of the host is `simple-html-grid-cell-custom`.

Sort, filter, group, the aggregates, Find, the CSV and Excel export and copy use the value and the
field's formatter, not what the renderer drew: give the field a formatter for the text you want there.

## Accessibility

The cell element stays the `gridcell`, the host inside it is the focus target. The host has no
`aria-label` - it would hide your content: what the renderer puts in it is what a screen reader reads.
Render readable text, not only colour or an icon (a badge with the word in it, an icon with an
`aria-label` or text next to it), and label a control of your own. Mark what is only decoration with
`aria-hidden="true"`.

## Known limits

- **No renderer with a lookup editor**: a column with an `editor` ([Lookups](20-lookups.md)) and a
  `renderer` throws a `TypeError` - the lookup column draws its own cell, the label and its button.
- **The default cell's extras** are not on a custom cell: `placeholderRow`, `focusButton`, and the other
  lines and marker of a multiline cell. A text of several lines opens the multiline editor all the same.
- **`fitColumns()`** measures the text of the field's formatter, which may be narrower than a badge or a
  bar: set the width of the column in the layout.
- **Only the body cells**: no renderer for group rows, the totals row or the column headers, and a column
  has one renderer for every row - draw each row your own way in `update()`.

# Live data

Rows that change while the grid shows them: prices from a server every second, the rows another user
saved. `datasource.upsert()` merges what the server sends by key, the cells show the new values on
their own, and an edit the user has not saved is never overwritten - when the server changed it too,
it is a conflict, for the user to resolve.

```sample live-data
```

## Values show on their own

A value set on a row shows in the grid without `gridInterface.refresh()`:

```ts
const row = datasource.getDataRows()[0];
row.price = 10; // shows in the next animation frame
```

The datasource sends `rows-changed` once the code that changed the rows is done (in a microtask):
one event, however many rows and fields it set, with the rows and the fields of each. The grid
renders the rows of it that are on screen in the next animation frame - once per frame, also for a
loop over 100 000 rows. A row off screen is rendered when it scrolls in.

A row is in `rows-changed` when:

- a field was set on it: from code, by the user, by `undo()` / `redo()`, `resetField()`,
  `resetRows()`, `resetData()`, `resolveConflict()`, or by `upsert()`. The validation of the edit is
  done by then: its errors show with it
- its deletion mark changed, or its server error (`getDataContainer().setErrors()`)
- one of its conflicts came or went

Still call `refresh()` when what the cells show changed without a row changing: what the
`isReadonly` or `cellClass` hooks read, a value written to your own object instead of the row the
datasource hands out (that is no edit either, see [Edits from code](05-editing.md#edits-from-code)).
A formatter that shows values differently needs `rebuild()`.

**The cell being typed in is left as it is.** Rendering it would put the formatted value into what
the user is typing - `12,` would become `12` - so no render touches the input the user typed in
since it got the focus, not even `refresh()`. Once the focus leaves it, the grid renders the rows on
screen again. A cell with the focus the user has not typed in yet is rendered: its text is its value,
nothing is lost.

**Scrolling renders only the rows that scroll in.** A row that stays on screen is up to date already:
its changes render themselves.

## Merging rows by key: `upsert()`

```ts
import { Datasource } from '@simple-html/grid';

interface Stock {
    id: number;
    name: string;
    price: number;
}
declare function fetchStocks(): Promise<Stock[]>;

const stocks = new Datasource<Stock>({ key: 'id', fields: { price: 'number' } });
stocks.setData(await fetchStocks());

// a full poll: every row the server has. A row it no longer has goes, unless it has changes here
setInterval(async () => {
    stocks.upsert(await fetchStocks(), { removeMissing: true });
}, 1000);

// a push of what changed: only the fields sent change
stocks.upsert([{ id: 7, price: 12.5 }]);
```

`upsert()` needs a key (`new Datasource({ key: 'id' })`), it throws a `TypeError` without one, and
for a row without its key. For each row it gets:

| the row | what happens |
| --- | --- |
| its key is in the data | the fields it has get its values, as the server's: the value and its original, so the row is not edited by them. The fields it does not have stay as they are |
| a field the user has edited | the user's value stays, the server's becomes its original - see [Conflicts](#conflicts) |
| a row marked for deletion | its fields get the values, it stays marked |
| its key is not in the data | added at the end: a loaded row, not new, not edited - the object itself, as `setData()` adds it |

- **The keys are compared as text**: `7` and `'7'` are the same key. The key field is never written.
- **A new row** (`addNewEmpty()`) is not on the server yet: its key is a generated one, it never
  matches a row of the server.
- **Not in the undo history**: the server's values are no edits. The fields that change are
  validated, as for an edit. Undoing the user's own edits of a field the server changed goes back to
  the server's value, not to the value the field had before - that would be an edit of the server's
  value, and a save would send the old value back.
- **`removeMissing: true`** (default `false`): the rows are every row there is, and a row whose key
  is not among them is removed for good. Not a new row, and not a row with changes of the user's - an
  edit, a deletion mark, a cell being typed in: that one stays, in conflict. Use it for a full poll,
  leave it out for a push of changes.
- **`refilter: false`** (default `true`): the filter does not run, so a row whose new values the
  filter leaves out stays shown until it runs again - as for `setData(rows, { refilter: false })`.
  The sorting and grouping still run.

Then the displayed rows are rebuilt once - filtered (`filterChangedOnly()` too), sorted, grouped. The
selection (it follows the key), the expanded groups and the scroll position stay. A row removed
leaves the selection, and `currentEntity` is set to `null` when it was the current row. The grid keeps
its row elements: the input the user types in keeps its focus and its text.

It returns what it did: the rows `added`, `updated` and `removed`, and the `conflicts` it made.

```ts
declare const rowsFromServer: object[];

const { added, updated, removed, conflicts } = datasource.upsert(rowsFromServer, { removeMissing: true });
console.log(`${added.length} new, ${updated.length} changed, ${removed.length} removed, ${conflicts.length} conflicts`);
```

It is cheap on many rows: one look up by key per row. 100 000 rows of which 1% changed take about 55
ms in node, 1000 rows into 100 000 about 16 ms - plus the sorting and grouping, which run as for
`filter()`.

## Conflicts

A conflict is a change of the server's that `upsert()` did not write because the user changed the
same thing:

- **A field**: the server changed a field the user has edited and not saved (or is typing in). The
  user's value stays; the server's value becomes the field's original, so `getChanges()` sends the
  user's value as an edit of what the server has now, and reverting the field goes to the server's
  value. When the server has the user's value, the edit is done (not edited any more), and when it
  is back at the value the edit started from, nothing has to be chosen: neither is a conflict.
- **A row**: `removeMissing` did not get a row that has changes here. It stays.

```ts
datasource.on('conflicts-changed', () => {
    for (const conflict of datasource.getConflicts()) {
        if (conflict.field === null) {
            console.log(`row ${conflict.row.__KEY} was removed on the server, it has changes here`);
        } else {
            console.log(`${conflict.field}: yours ${conflict.local}, the server's ${conflict.remote}, it was ${conflict.original}`);
        }
    }
});
```

| method, event | what it does |
| --- | --- |
| `getConflicts(rows?)` | the conflicts, every row's or the rows given: `{ row, field, local, remote, original }` for a field, `{ row, field: null, remote: 'removed' }` for a row. `local` is the value the row has when it is called |
| `hasConflicts()` | `true` when there is one |
| `resolveConflict(row, field, 'local')` | the user's value stays, still edited: a save sends it. A row the server removed stays, and is not in conflict again |
| `resolveConflict(row, field, 'remote')` | the server's value, as `resetField()` sets it: an edit, a step of the undo history. A row the server removed is removed |
| `conflicts-changed` | sent when they changed, once per run of code |

A conflict also goes when what it is about goes: the field is not edited any more (reverted, undone,
typed back to the server's value, saved with `acceptChanges()`), the row has no changes any more, or
it leaves the data (`removeData()`, `setData()` without `add` ...). `resetData()` clears every one.

```ts
// the server wins every conflict
for (const conflict of datasource.getConflicts()) {
    datasource.resolveConflict(conflict.row, conflict.field, 'remote');
}
```

## Showing what a merge changed

`datasource.getMergedAt(row, field)` is the time (`Date.now()`) the last `upsert()` changed the value
of a field - `undefined` when no upsert changed it. A field the user has edited keeps the user's value,
an upsert does not change it (a conflict is no change of the value). The grid renders the rows an
upsert changed, so a `cellClass` hook can give those cells a class for a short highlight:

```ts
gridInterface.updateHooks({
    cellClass: (row, field) => {
        const at = datasource.getMergedAt(row, field);
        return at !== undefined && Date.now() - at < 1000 ? { input: 'just-changed' } : null;
    }
});
```

```css
@keyframes just-changed {
    from { background: #ffe58a; }
    to { background: transparent; }
}
.just-changed {
    animation: just-changed 1s ease-out;
}
```

The animation runs when the class is added, once: a cell rendered again keeps it until it is
rendered after the second is over.

## Events

| event | sent when | payload |
| --- | --- | --- |
| `rows-changed` | values of rows changed (see above), once per run of code | `{ rows, fields }`: the rows, and `fields.get(row)` the fields set on each |
| `conflicts-changed` | conflicts came or went, once per run of code, after `rows-changed` | `{}`, read `getConflicts()` |
| `collection-changed` | `upsert()` added or removed rows, or the displayed rows changed (filter, sort order, groups) | `{ info: 'upsert', added, removed? }` |

An upsert that only changed values sends no `collection-changed`: the grid renders the cells from
`rows-changed`. Both live data events are the data container's: every datasource on the same
`DataContainer` sends them. See [Events](09-events.md#datasource-events).

import type { GridState, LayoutColumn } from './gridConfig';

/**
 * A named view: a snapshot of the grid's state - its columns, widths and pinning, the filter and the
 * header filters, sorting, grouping, the formats and colour rules of the columns, the aggregates, the
 * totals row, the detail form ... what `gridInterface.getState()` gives - under a name the user picked,
 * "My open orders". The user switches between them in the views menu, the button at the left end of the
 * footer, see `GridConfig.views`.
 *
 * **It is plain JSON**: store it anywhere and give it back - `GridConfig.views`, `setViews()`. Where the
 * views are kept is the app's choice: the grid sends `views-change` with the list when the user saves,
 * renames or deletes one, or `GridConfig.viewsStorageKey` keeps them in the browser's localStorage. A
 * `Date` in the filter comes back from JSON as its ISO text, as for a {@link GridState}.
 *
 * Applied (`applyView()`, a click in the menu), what `state` leaves out is the state the grid starts in -
 * `GridConfig.initialState` and the config's `layout` - so a view of a few parts (a filter and a sort)
 * is the config's columns with that filter and sort, and a view saved before a part was added to the
 * state gets the config's.
 *
 * @sample views
 * @example
 * ```ts
 * import { type GridView, where } from '@simple-html/grid';
 *
 * const views: GridView[] = [
 *     {
 *         id: 'late',
 *         name: 'Late deliveries',
 *         // the parts it sets, the rest is the config's
 *         state: {
 *             filter: where('dueDate', 'LESS_THAN', '2026-11-22'),
 *             sorting: [{ attribute: 'dueDate', ascending: true }]
 *         },
 *         // shared: the user can apply it, not change, rename or delete it
 *         readonly: true
 *     },
 *     { id: 'mine', name: 'My open orders', state: gridInterface.getState(), default: true }
 * ];
 * gridInterface.setViews(views);
 * ```
 */
export interface GridView {
    /**
     * unique in the list, never shown. A view the user saves gets one made by the grid (`view-` and a
     * random part); a view of yours can have any text
     */
    id: string;
    /** what the views menu and the footer's button show: "My open orders" */
    name: string;
    /**
     * the state the view applies, what `getState()` gave when it was saved. It can leave parts out: they
     * are the state the grid starts in (`GridConfig.initialState`, the config's `layout`)
     */
    state: Partial<GridState>;
    /**
     * `true`: a view of yours the user can apply and save as a new view of their own, but not save over,
     * rename or delete - a view shared by the company, say. The views menu shows it with the hint
     * "shared". Default `false`
     */
    readonly?: boolean;
    /**
     * `true`: the view the grid applies when it is made - instead of `initialState`, on top of it. One
     * view of the list at most. The user sets it with *Default view* in the views menu
     * (`setDefaultView()`). Default `false`
     */
    default?: boolean;
}

/**
 * @internal
 * Throws when `views` is no list of {@link GridView}s: plain js and JSON can give anything - say so now,
 * not as a menu that breaks later. The states are checked when a view is applied (`setState()`'s checks)
 * @param where who was given them, for the message: 'GridConfig.views', 'setViews()'
 */
export function assertViews(views: unknown, where: string): asserts views is GridView[] {
    if (!Array.isArray(views)) {
        throw new TypeError(`${where} is a list of views { id, name, state }, got ${JSON.stringify(views)}`);
    }
    const ids = new Set<string>();
    let defaults = 0;
    views.forEach((view, index) => {
        if (!isView(view)) {
            throw new TypeError(
                `${where}[${index}] is a view { id, name, state, readonly?, default? }: a text id and name, the state an object, readonly and default true or false - got ${JSON.stringify(view)}`
            );
        }
        if (ids.has(view.id)) {
            throw new TypeError(`${where}: two views have the id '${view.id}', an id is unique in the list`);
        }
        ids.add(view.id);
        if (view.default) {
            defaults++;
        }
    });
    if (defaults > 1) {
        throw new TypeError(`${where}: ${defaults} views are the default, one at most`);
    }
}

/**
 * true when `value` has the shape of a view: a non-empty text id, a text name, the state an object (not
 * a list), `readonly` and `default` booleans or left out
 */
function isView(value: unknown): value is GridView {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const { id, name, state, readonly, default: isDefault } = value as Record<string, unknown>;
    return (
        typeof id === 'string' &&
        id !== '' &&
        typeof name === 'string' &&
        typeof state === 'object' &&
        state !== null &&
        !Array.isArray(state) &&
        (readonly === undefined || typeof readonly === 'boolean') &&
        (isDefault === undefined || typeof isDefault === 'boolean')
    );
}

/**
 * @internal
 * A new id for a view the user saves, one no view of `views` has: `view-`, the time and a random part.
 * Not `crypto.randomUUID()`: a page served over plain http (an intranet) has none
 */
export function newViewId(views: readonly GridView[]): string {
    const ids = new Set(views.map((view) => view.id));
    let id: string;
    do {
        id = `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    } while (ids.has(id));
    return id;
}

/**
 * @internal
 * The state as text, to tell whether it changed since a view was applied or saved: JSON with the keys of
 * every object sorted - a header filter typed again comes after the others, the same state all the same.
 * Left out:
 * - `expandedGroups`: a group opened or closed is no change of the view (a view keeps them all the same)
 * - the columns of the layout without a field: the grid drops them when it lays out (`__parseConfig`)
 *
 * A `Date` is its ISO text, as after JSON. The current row, the scroll position and Find are not state,
 * they are not in it either.
 */
export function viewStateText(state: GridState): string {
    const { expandedGroups, layout, ...rest } = state;
    const withFields = (columns: LayoutColumn[] | undefined) => (columns ?? []).filter((column) => column.fields?.length);
    const comparable = {
        ...rest,
        layout: { left: withFields(layout.left), center: withFields(layout.center), right: withFields(layout.right) }
    };
    // JSON.stringify calls a Date's toJSON before the replacer: the replacer gets its text
    return JSON.stringify(comparable, (_key, value) =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
            : value
    );
}

/**
 * What `GridConfig.viewsStorageKey` keeps in localStorage, as JSON: the user's views - not the
 * readonly ones, they come from the config every time - and the id of the default view, which can be a
 * readonly one
 */
interface StoredViews {
    views: GridView[];
    defaultView: string | null;
}

/**
 * @internal
 * The views kept under `key` in localStorage, null when there are none: nothing stored, the browser
 * does not let the page read it (blocked storage, a sandboxed frame), or it is no JSON of views. A view
 * that is no view (an edit by hand, a version of the app of before) is left out, not thrown: the grid
 * starts all the same
 */
export function readStoredViews(key: string): StoredViews | null {
    let data: unknown;
    try {
        const text = localStorage.getItem(key);
        if (text === null) {
            return null;
        }
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof data !== 'object' || data === null || !Array.isArray((data as StoredViews).views)) {
        return null;
    }
    const { views, defaultView } = data as StoredViews;
    const ids = new Set<string>();
    const valid = views.filter((view) => {
        const keep = isView(view) && !view.readonly && !ids.has(view.id);
        if (keep) {
            ids.add(view.id);
        }
        return keep;
    });
    return { views: valid, defaultView: typeof defaultView === 'string' ? defaultView : null };
}

/**
 * @internal
 * Keeps the user's views under `key` in localStorage: those that are not readonly, and the id of the
 * default view. The browser can refuse - blocked storage, a full one: a warning in the console, the
 * views stay in the grid until the page is left
 */
export function writeStoredViews(key: string, views: readonly GridView[]) {
    const stored: StoredViews = {
        views: views.filter((view) => !view.readonly).map(({ default: _default, ...view }) => view),
        defaultView: views.find((view) => view.default)?.id ?? null
    };
    try {
        localStorage.setItem(key, JSON.stringify(stored));
    } catch (error) {
        console.warn(`GridConfig.viewsStorageKey: the views could not be stored under '${key}'`, error);
    }
}

/**
 * @internal
 * The views the grid starts with: `configViews` (`GridConfig.views`) - and with a `storageKey` the
 * views stored under it, once the user has saved some. Then the stored list is the user's views: the
 * readonly views come from the config (the app's, they can change), the others from the storage - a view
 * of the config the user deleted stays deleted. The stored default wins, it is what the user picked last.
 * Copies: the config is not changed
 */
export function startViews(configViews: readonly GridView[] | undefined, storageKey: string | undefined): GridView[] {
    const own = structuredClone(configViews ?? []) as GridView[];
    const stored = storageKey ? readStoredViews(storageKey) : null;
    if (!stored) {
        return own;
    }
    const shared = own.filter((view) => view.readonly);
    const sharedIds = new Set(shared.map((view) => view.id));
    const views = [...shared, ...stored.views.filter((view) => !sharedIds.has(view.id))];
    for (const view of views) {
        if (view.id === stored.defaultView) {
            view.default = true;
        } else {
            delete view.default;
        }
    }
    return views;
}

import type { GroupArgument } from '../datasource/groupArgument';
import type { SortArgument } from '../datasource/sortArgument';
import { convertV5Filter, type V5Filter } from '../datasource/v5Filter';
import type { ColumnConfig, GridConfig, GridState, LayoutColumn } from './gridConfig';
import type { GridView } from './gridView';

/**
 * The version of the saved grid `exportConfig()` writes. A saved grid without a version is version 1:
 * a config v5 saved (`saveConfig()`) or was written for. `convertGridConfig()` makes the one of this
 * version of every older one.
 *
 * - **1** - v5: `attributes`, `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight`, and the
 *   state - `sorting`, `grouping`, `expandedGroups`, `filter`, a column's `currentFilterValue` - in the
 *   config. No `version`
 * - **2** - v6: `{ version: 2, config, state, views }` - the {@link GridConfig}, the {@link GridState} and
 *   the named views (`views`, optional: every view, the ones the user saved too)
 */
export const GRID_CONFIG_VERSION = 2;

/**
 * A grid saved as plain JSON: `gridInterface.exportConfig()` makes it, `importConfig()` takes it back
 * - also a saved grid of an older version, converted on the way in (`convertGridConfig()`).
 *
 * The hooks and the datasource are not in it: they are code and data of the app.
 *
 * @example
 * ```ts
 * import type { ExportedGrid } from '@simple-html/grid';
 *
 * const saved: ExportedGrid = gridInterface.exportConfig();
 * localStorage.setItem('my-grid', JSON.stringify(saved)); // { "version": 2, "config": {...}, "state": {...} }
 *
 * gridInterface.importConfig(JSON.parse(localStorage.getItem('my-grid') ?? 'null'));
 * ```
 */
export interface ExportedGrid {
    /** the version of the saved grid: {@link GRID_CONFIG_VERSION} when it is written */
    version: number;
    /** the config: options, columns, layout, `initialState` ... - as the app gave it, and changed it with `updateConfig()` */
    config: GridConfig;
    /** what the user did with it: `getState()` - left out, the config's `initialState` is what it starts with */
    state?: Partial<GridState>;
    /**
     * the named views: every one - the config's (`config.views`) and the ones the user saved, renamed and
     * deleted since with the views button (`viewsStorageKey`) - as `gridInterface.getViews()` has them, in
     * their order. `importConfig()` gives them back with `setViews()`. Left out: the grid keeps the views it has
     */
    views?: GridView[];
}

// ------------------------------------------------------------------ version 1: a v5 config

/** a column of `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight` in v5 */
interface V5Column {
    rows: string[];
    width: number;
}

/** an entry of `attributes` in v5: a ColumnConfig with the old names, the field in `attribute` */
type V5Attribute = ColumnConfig & {
    attribute: string;
    placeHolderRow?: string;
    placeHolderFilter?: string;
    currentFilterValue?: unknown;
    type?: string;
    mandatory?: boolean;
};

/** a v5 config: the options that did not change are the v6 ones */
type V5GridConfig = Record<string, unknown> & {
    attributes?: V5Attribute[];
    columnsPinnedLeft?: V5Column[];
    columnsCenter?: V5Column[];
    columnsPinnedRight?: V5Column[];
    placeHolderRowCurrentEntityOnly?: boolean;
    placeHolderRowCurrentEnityOnly?: boolean;
    sorting?: SortArgument[] | null;
    grouping?: GroupArgument[] | null;
    expandedGroups?: string[] | null;
    filter?: V5Filter | null;
};

/** the v5 options that are gone without a place in v6: they are left out */
const V5_DROPPED = ['tooltipText', 'selectionMode'];

const layoutColumnsOfV5 = (columns: V5Column[] = []): LayoutColumn[] =>
    columns.map((column) => ({ fields: [...column.rows], width: column.width }));

/**
 * Version 1 - a v5 config - as version 2: `attributes` become `columns` (the placeholders with their new
 * names; `type` and `mandatory` are the datasource's fields' now, they are left out), the `columns*` the
 * `layout`, and the state v5 kept in the config - the sort, the grouping, the groups expanded, the filter,
 * the header filters' values - `initialState` and the state
 */
function fromVersion1(v5: V5GridConfig): ExportedGrid {
    const {
        attributes = [],
        columnsPinnedLeft,
        columnsCenter,
        columnsPinnedRight,
        placeHolderRowCurrentEntityOnly,
        placeHolderRowCurrentEnityOnly,
        sorting,
        grouping,
        expandedGroups,
        filter,
        ...rest
    } = v5;
    const options: Record<string, unknown> = { ...rest };
    for (const name of V5_DROPPED) {
        delete options[name];
    }

    const columns: Record<string, ColumnConfig> = {};
    const headerFilters: GridState['headerFilters'] = {};
    for (const { attribute, placeHolderRow, placeHolderFilter, currentFilterValue, type, mandatory, ...column } of attributes) {
        const converted: ColumnConfig = { ...column };
        if (placeHolderRow !== undefined) {
            converted.placeholderRow = placeHolderRow;
        }
        if (placeHolderFilter !== undefined) {
            converted.placeholderFilter = placeHolderFilter;
        }
        columns[attribute] = converted;
        if (currentFilterValue !== null && currentFilterValue !== undefined && currentFilterValue !== '') {
            headerFilters[attribute] = { value: currentFilterValue };
        }
    }

    const layout = {
        left: layoutColumnsOfV5(columnsPinnedLeft),
        center: layoutColumnsOfV5(columnsCenter),
        right: layoutColumnsOfV5(columnsPinnedRight)
    };
    const initialState: Partial<GridState> = {
        sorting: sorting ?? [],
        grouping: grouping ?? [],
        expandedGroups: expandedGroups ?? [],
        filter: convertV5Filter(filter),
        headerFilters
    };
    const config: GridConfig = { ...(options as Partial<GridConfig>), columns, layout, initialState };
    const entityOnly = placeHolderRowCurrentEntityOnly ?? placeHolderRowCurrentEnityOnly;
    if (entityOnly !== undefined) {
        config.placeholderRowCurrentEntityOnly = entityOnly;
    }
    return { version: GRID_CONFIG_VERSION, config, state: { ...structuredClone(initialState), layout: structuredClone(layout) } };
}

// ------------------------------------------------------------------ converting

/** the keys of a v6 config: a saved grid without a version that has one is no v5 config */
const V6_KEYS = ['layout', 'columns', 'initialState'];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A saved grid of any version as one of this version ({@link GRID_CONFIG_VERSION}): what
 * `importConfig()` reads, and for a grid that is made from it - `createGrid()` with its `config`, then
 * `setState()` with its `state`.
 *
 * - **No `version`, or 1**: a config v5 saved or was written for, converted - `attributes` to
 *   `columns`, the `columns*` to `layout`, its sort, grouping, groups expanded, filter and header filter
 *   values to `initialState` and `state`. A column's `type` and `mandatory` are left out: they are the
 *   datasource's fields' in v6 (`{ type: 'date' }`, `validate: ['required']`). So are `tooltipText` and
 *   `selectionMode` (the texts, the datasource)
 * - **2**: as it is, copied
 *
 * The config is checked when the grid takes it, as any config.
 * @throws a `TypeError` for what is no saved grid, a version that is no whole number from 1, one newer
 * than this grid's, and a saved grid without a version that has `layout`, `columns` or `initialState` - a
 * v6 config: give it `{ version: 2, config }`
 * @example
 * ```ts
 * import { convertGridConfig, createGrid, Datasource } from '@simple-html/grid';
 *
 * declare const host: HTMLElement;
 * const datasource = new Datasource();
 * const saved = JSON.parse(localStorage.getItem('my-grid') ?? 'null'); // v5's saveConfig(), or exportConfig()
 * const { config, state } = convertGridConfig(saved);
 * const gridInterface = createGrid(host, { config, datasource });
 * if (state) {
 *     gridInterface.setState(state);
 * }
 * ```
 */
export function convertGridConfig(saved: unknown): ExportedGrid {
    if (!isObject(saved)) {
        throw new TypeError(`convertGridConfig: a saved grid is an object, got ${JSON.stringify(saved)}`);
    }
    const version = saved.version ?? 1;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        throw new TypeError(`convertGridConfig: version is a whole number from 1, got ${JSON.stringify(saved.version)}`);
    }
    if (version > GRID_CONFIG_VERSION) {
        throw new TypeError(
            `convertGridConfig: version ${version} is newer than this grid's (${GRID_CONFIG_VERSION}): it was saved by a newer version of the grid`
        );
    }
    if (version === 1) {
        const v6Keys = V6_KEYS.filter((key) => key in saved);
        if (v6Keys.length) {
            throw new TypeError(
                `convertGridConfig: a saved grid without a version is a v5 config, this one has ${v6Keys.join(', ')} of v6 - save it as { version: ${GRID_CONFIG_VERSION}, config }`
            );
        }
        const { version: _version, ...v5 } = saved;
        return fromVersion1(structuredClone(v5) as V5GridConfig);
    }
    // version 2
    if (!isObject(saved.config)) {
        throw new TypeError(`convertGridConfig: config of version ${version} is an object, got ${JSON.stringify(saved.config)}`);
    }
    if (saved.state !== undefined && saved.state !== null && !isObject(saved.state)) {
        throw new TypeError(`convertGridConfig: state is an object, got ${JSON.stringify(saved.state)}`);
    }
    const converted: ExportedGrid = { version: GRID_CONFIG_VERSION, config: structuredClone(saved.config) as GridConfig };
    if (isObject(saved.state)) {
        converted.state = structuredClone(saved.state) as Partial<GridState>;
    }
    if (saved.views !== undefined && saved.views !== null) {
        if (!Array.isArray(saved.views)) {
            throw new TypeError(`convertGridConfig: views is a list of views, got ${JSON.stringify(saved.views)}`);
        }
        converted.views = structuredClone(saved.views) as GridView[];
    }
    return converted;
}

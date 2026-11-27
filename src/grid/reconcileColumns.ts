import type { FilterExpression } from '../datasource/filterExpression';
import type { CalculatedColumn } from './calculatedColumns';
import type { ColorRule, RuleCondition } from './colorRules';
import type { ColumnFormat } from './columnFormat';
import type { ExportedGrid } from './configVersion';
import type { ColumnConfig, DetailForm, GridLayout, GridState, LayoutColumn } from './gridConfig';
import type { GridView } from './gridView';

/**
 * A column the source of the rows has now - a database view, an API - as {@link reconcileColumns} and
 * `gridInterface.updateColumns()` take it: its field and the options of its column (a
 * {@link ColumnConfig}: label, readonly, operator ...).
 */
export type SourceColumn = ColumnConfig & {
    /** the field: the property on the rows */
    field: string;
};

/** How {@link reconcileColumns} brings a grid up to date */
export interface ReconcileOptions {
    /**
     * `true`: a new column is shown - at the end of the scrolling columns, `width` px wide. Default `false`:
     * it is hidden, the column chooser lists it
     */
    showNew?: boolean;
    /** the width in px of a new column shown, default 100 */
    width?: number;
}

/** What {@link reconcileColumns} changed: for a message to the user, a log */
export interface ColumnsReport {
    /** the fields the source has that the grid had not: in `columns` now, the column chooser lists them */
    added: string[];
    /** the fields the grid had that the source has not anymore: taken out of everything that named them */
    removed: string[];
    /** the calculated columns taken out: their formula named a field that is gone (or such a column) */
    removedCalculated: string[];
    /**
     * the colour rules taken out, with the column they were on: a formula that named a field that is gone,
     * or conditions on such fields only. A rule with a condition left keeps it, without the others
     */
    removedRules: RemovedRule[];
}

/** A colour rule {@link reconcileColumns} took out */
export interface RemovedRule {
    /** the column the rule was on */
    field: string;
    /** the rule as it was */
    rule: ColorRule;
}

/** What {@link reconcileColumns} returns */
export interface ReconciledGrid {
    /** the saved grid with the source's columns: a new one, the one given is not changed */
    grid: ExportedGrid;
    /** what changed */
    report: ColumnsReport;
}

/** the fields a formula names: `{balance}`, `{order date}` */
function formulaFields(formula: string): string[] {
    return Array.from(formula.matchAll(/\{([^{}]+)\}/g), (match) => match[1].trim());
}

/**
 * The grid of a saved one with the columns its source has now. A grid made from a source - the columns of
 * a database view, say - and saved (`exportConfig()`, its views) names the fields the source had then; the
 * source changed since: columns added, columns removed. This makes the saved grid fit it, before the grid
 * is made from it (or `gridInterface.updateColumns()` on a grid that is shown):
 *
 * - **`config.columns`** is the source's columns: each one's options as given, over the options the saved
 *   config had for it. A column the source has not is taken out - not a calculated column, it is the grid's
 * - **A field that is gone** is taken out of everything that names it - the config, its `initialState`, the
 *   state and every view - of `config.views` and the saved grid's `views` (the user's): the layout (a column left without a field goes), the sort, the
 *   grouping, the header filters, the conditions of the filter (an AND / OR group left empty goes, a
 *   condition comparing with it - `valueField` - too), the formats, the aggregates, the detail form's
 *   fields and options. A colour rule: its conditions on the field go, a rule left without one goes, and
 *   so does a formula that names the field
 * - **A calculated column** whose formula names a field that is gone goes too, the same way - and one that
 *   names that one, and so on
 * - **A new field** is in `config.columns`: the column chooser lists it. Hidden, unless `showNew`
 *
 * The saved grid is not changed: a new one is returned, with a report of what changed. It is of the
 * version {@link GRID_CONFIG_VERSION}: an older saved grid is converted first (`convertGridConfig()`).
 * Give the datasource the types of the new fields (`new Datasource({ fields })`): the grid shows a field it
 * has no type of as text.
 *
 * @param saved a saved grid: what `exportConfig()` made, or a `{ version: 2, config }`
 * @param columns the columns of the source now, in their order
 * @sample reconcile-columns
 * @example
 * ```ts
 * import { convertGridConfig, createGrid, Datasource, reconcileColumns, type SourceColumn } from '@simple-html/grid';
 *
 * declare const host: HTMLElement;
 * // the columns of the view now - one was added, one removed since the grid was saved
 * const columns: SourceColumn[] = [
 *     { field: 'company', label: 'Company' },
 *     { field: 'country', label: 'Country' },
 *     { field: 'region', label: 'Region' } // new
 * ];
 * const saved = convertGridConfig(JSON.parse(localStorage.getItem('my-grid') ?? 'null'));
 * const { grid, report } = reconcileColumns(saved, columns);
 * report; // { added: ['region'], removed: ['city'], removedCalculated: [], removedRules: [] }
 *
 * const datasource = new Datasource({ fields: { region: 'text' } });
 * const gridInterface = createGrid(host, { config: grid.config, datasource });
 * if (grid.state) {
 *     gridInterface.setState(grid.state);
 * }
 * ```
 */
export function reconcileColumns(
    saved: ExportedGrid,
    columns: readonly SourceColumn[],
    options: ReconcileOptions = {}
): ReconciledGrid {
    const config = structuredClone(saved.config);
    const state = saved.state ? structuredClone(saved.state) : undefined;

    const source = new Map(columns.map((column) => [column.field, column]));
    const calculated: Record<string, CalculatedColumn> = {
        ...config.calculatedColumns,
        ...config.initialState?.calculatedColumns,
        ...state?.calculatedColumns
    };
    // the fields the grid knew: its columns, its layout, the fields its parts name
    const known = new Set<string>([
        ...Object.keys(config.columns ?? {}),
        ...layoutFields(config.layout),
        ...layoutFields(state?.layout)
    ]);
    for (const name of Object.keys(calculated)) {
        known.delete(name);
    }
    const removed = new Set([...known].filter((field) => !source.has(field)));
    const added = columns.map((column) => column.field).filter((field) => !known.has(field) && !(field in calculated));

    // a calculated column is gone when its formula names a field that is gone - or such a column
    const removedCalculated = new Set<string>();
    for (let changed = true; changed; ) {
        changed = false;
        for (const [name, column] of Object.entries(calculated)) {
            if (
                !removedCalculated.has(name) &&
                formulaFields(column.formula).some((field) => removed.has(field) || removedCalculated.has(field))
            ) {
                removedCalculated.add(name);
                changed = true;
            }
        }
    }
    const gone = new Set([...removed, ...removedCalculated]);
    const removedRules: RemovedRule[] = [];
    const clean = cleaner(gone, removedRules);

    // the config: its columns the source's, then each part that names a field
    const nextColumns: Record<string, ColumnConfig> = {};
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        if (!gone.has(field) && (source.has(field) || field in calculated)) {
            nextColumns[field] = column;
        }
    }
    for (const { field, ...own } of columns) {
        nextColumns[field] = { ...nextColumns[field], ...own };
    }
    for (const [field, column] of Object.entries(nextColumns)) {
        if (column.format) {
            const format = clean.format(field, column.format);
            if (format) {
                column.format = format;
            } else {
                delete column.format;
            }
        }
    }
    config.columns = nextColumns;
    config.layout = clean.layout(config.layout) as GridLayout;
    if (config.calculatedColumns) {
        config.calculatedColumns = withoutKeys(config.calculatedColumns, gone);
    }
    if (config.detailForm) {
        config.detailForm = clean.detailForm(config.detailForm);
    }
    if (config.initialState) {
        config.initialState = clean.state(config.initialState);
    }
    if (config.views) {
        config.views = config.views.map((view: GridView) => ({ ...view, state: clean.state(view.state) }));
    }
    let nextState = state ? clean.state(state) : undefined;

    // a new column shown: at the end of the scrolling columns, of the state and of the config
    if (options.showNew && added.length) {
        const width = options.width ?? 100;
        const show = (layout: GridLayout | undefined): GridLayout | undefined =>
            layout
                ? { ...layout, center: [...layout.center, ...added.map((field): LayoutColumn => ({ fields: [field], width }))] }
                : layout;
        config.layout = show(config.layout) as GridLayout;
        if (nextState?.layout) {
            nextState = { ...nextState, layout: show(nextState.layout) };
        }
    }

    const grid: ExportedGrid = { version: saved.version, config };
    if (nextState) {
        grid.state = nextState;
    }
    if (saved.views) {
        grid.views = saved.views.map((view: GridView) => ({
            ...structuredClone(view),
            state: clean.state(structuredClone(view.state))
        }));
    }
    return {
        grid,
        report: { added, removed: [...removed], removedCalculated: [...removedCalculated], removedRules }
    };
}

/** every field of a layout's columns */
function layoutFields(layout: GridLayout | undefined): string[] {
    if (!layout) {
        return [];
    }
    return [...(layout.left ?? []), ...layout.center, ...(layout.right ?? [])].flatMap((column) => column.fields);
}

/** a record without the keys of `gone` */
function withoutKeys<T>(record: Record<string, T>, gone: ReadonlySet<string>): Record<string, T> {
    return Object.fromEntries(Object.entries(record).filter(([key]) => !gone.has(key)));
}

/**
 * The parts of a grid without the fields that are gone: each takes a part and returns it cleaned, a new
 * object. The colour rules taken out are pushed on `removedRules`
 */
function cleaner(gone: ReadonlySet<string>, removedRules: RemovedRule[]) {
    const keep = (field: string) => !gone.has(field);

    const layout = (value: GridLayout | undefined): GridLayout | undefined => {
        if (!value) {
            return value;
        }
        const section = (columns: LayoutColumn[] | undefined) =>
            columns
                ?.map((column) => ({ ...column, fields: column.fields.filter(keep) }))
                .filter((column) => column.fields.length);
        const next: GridLayout = { ...value, center: section(value.center) ?? [] };
        if (value.left) {
            next.left = section(value.left);
        }
        if (value.right) {
            next.right = section(value.right);
        }
        return next;
    };

    const filter = (expression: FilterExpression | null | undefined): FilterExpression | null => {
        if (!expression) {
            return null;
        }
        if ('children' in expression) {
            const children = expression.children.map(filter).filter((child): child is FilterExpression => child !== null);
            return children.length ? { ...expression, children } : null;
        }
        const named = [expression.field, expression.valueField].filter((field): field is string => typeof field === 'string');
        return named.every(keep) ? expression : null;
    };

    const rule = (field: string, value: ColorRule): ColorRule | null => {
        if (value.expression !== undefined && formulaFields(value.expression).some((name) => gone.has(name))) {
            removedRules.push({ field, rule: value });
            return null;
        }
        if (value.conditions) {
            const conditions = value.conditions.filter((condition: RuleCondition) => keep(condition.field));
            if (!conditions.length) {
                removedRules.push({ field, rule: value });
                return null;
            }
            return conditions.length === value.conditions.length ? value : { ...value, conditions };
        }
        return value;
    };

    const format = (field: string, value: ColumnFormat): ColumnFormat | undefined => {
        if (!value.rules) {
            return value;
        }
        const rules = value.rules.map((each) => rule(field, each)).filter((each): each is ColorRule => each !== null);
        const next: ColumnFormat = { ...value, rules };
        if (!rules.length) {
            delete next.rules;
        }
        return Object.keys(next).length ? next : undefined;
    };

    const formats = (value: Record<string, ColumnFormat>) => {
        const next: Record<string, ColumnFormat> = {};
        for (const [field, each] of Object.entries(value)) {
            const cleaned = keep(field) ? format(field, each) : undefined;
            if (cleaned) {
                next[field] = cleaned;
            }
        }
        return next;
    };

    const detailForm = (value: DetailForm): DetailForm => {
        const next: DetailForm = { ...value, fields: value.fields.filter((entry) => typeof entry !== 'string' || keep(entry)) };
        if (value.fieldOptions) {
            next.fieldOptions = withoutKeys(value.fieldOptions, gone);
        }
        return next;
    };

    const state = (value: Partial<GridState>): Partial<GridState> => {
        const next: Partial<GridState> = { ...value };
        if (value.layout) {
            next.layout = layout(value.layout) as GridLayout;
        }
        if (value.sorting) {
            next.sorting = value.sorting.filter((sort) => keep(sort.attribute));
        }
        if (value.grouping) {
            next.grouping = value.grouping.filter((group) => keep(group.attribute));
        }
        if (value.filter !== undefined) {
            next.filter = filter(value.filter);
        }
        if (value.headerFilters) {
            next.headerFilters = withoutKeys(value.headerFilters, gone);
        }
        if (value.aggregates) {
            next.aggregates = withoutKeys(value.aggregates, gone);
        }
        if (value.formats) {
            next.formats = formats(value.formats);
        }
        if (value.detailForm) {
            next.detailForm = detailForm(value.detailForm);
        }
        if (value.calculatedColumns) {
            next.calculatedColumns = withoutKeys(value.calculatedColumns, gone);
        }
        return next;
    };

    return { layout, filter, format, detailForm, state };
}

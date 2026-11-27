import type { ColumnConfig, GridConfig } from './gridConfig';

/**
 * `null` in a grid config is an option left out: the default. A config from a backend or a database
 * often has `null` for what is not set - `placeholderRow: null`, `operator: null`, `format: null` - and
 * the grid would take it as a value and throw (`operator is null, ...`).
 *
 * - **the options of the config** (`readonly: null`, `texts: null`, `edit: null` ...): `undefined`, the
 *   default - as `updateConfig({ tooltips: undefined })` goes back to it. `layout` is left as it is: a
 *   grid has one, its check says so
 * - **the options of a column** (`ColumnConfig`): left out - the label of the field, the default operator,
 *   the formatter's format ...
 * - **the options of a column's `format`** (`ColumnFormat`): left out - the format by type, the column's
 *   own label and placeholder ...
 *
 * A copy: the config given is not changed. What is not `null` is not looked at, the checks of the grid
 * still throw for a value that is wrong.
 */
export function nullsAsDefaults<C extends Partial<GridConfig>>(config: C): C {
    if (config === null || typeof config !== 'object') {
        return config;
    }
    const copy: Record<string, unknown> = { ...config };
    for (const [key, value] of Object.entries(copy)) {
        if (value === null && key !== 'layout') {
            copy[key] = undefined;
        }
    }
    const columns = copy.columns;
    if (columns && typeof columns === 'object' && !Array.isArray(columns)) {
        copy.columns = Object.fromEntries(
            Object.entries(columns as Record<string, ColumnConfig | null>).map(([field, column]) => [
                field,
                columnWithoutNulls(column)
            ])
        );
    }
    return copy as C;
}

/** a column's options without the `null` ones, and its format's; a column that is `null` is `{}` */
function columnWithoutNulls(column: ColumnConfig | null): ColumnConfig {
    if (column === null) {
        return {};
    }
    if (typeof column !== 'object' || Array.isArray(column)) {
        // not a column: its check says so
        return column;
    }
    const copy = withoutNulls(column as Record<string, unknown>);
    if (copy.format && typeof copy.format === 'object' && !Array.isArray(copy.format)) {
        copy.format = withoutNulls(copy.format as Record<string, unknown>);
    }
    return copy as ColumnConfig;
}

/** the object without its keys whose value is `null` */
function withoutNulls(object: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null));
}

import type { SqlColumn, SqlColumnType, SqlDateStorage, SqlFieldsOptions } from '../sql';
import { show } from './show';

const TYPES: readonly SqlColumnType[] = ['text', 'number', 'boolean', 'date', 'datetime'];

/**
 * The columns of toSqlWhere from the fields of the grid's datasource (`DatasourceOptions.fields`): each
 * field a column of its type, its name as the options say. See sqlColumnsFromFields in sql.ts
 * @throws a `TypeError` for fields that are no object of fields, a type that is none, wrong options
 */
export function sqlColumnsOf(fields: unknown, options: SqlFieldsOptions = {}): Record<string, SqlColumn> {
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
        throw new TypeError(
            `sqlColumnsFromFields: fields is an object: { born: 'date', age: { type: 'number' } }, not ${show(fields)}`
        );
    }
    const { nameCase = 'asIs', column, dateStorage } = options;
    if (nameCase !== 'asIs' && nameCase !== 'upper' && nameCase !== 'lower') {
        throw new TypeError(`sqlColumnsFromFields: options.nameCase is 'asIs', 'upper' or 'lower', not ${show(nameCase)}`);
    }
    if (column !== undefined && typeof column !== 'function') {
        throw new TypeError('sqlColumnsFromFields: options.column is a function: (field) => the name of its column');
    }
    const nameOf = (field: string) => {
        const name = column ? column(field) : field;
        return nameCase === 'upper' ? name.toUpperCase() : nameCase === 'lower' ? name.toLowerCase() : name;
    };
    const columns: Record<string, SqlColumn> = {};
    for (const [field, config] of Object.entries(fields)) {
        const type: unknown = typeof config === 'string' ? config : ((config as { type?: unknown } | null)?.type ?? 'text');
        if (!TYPES.some((each) => each === type)) {
            throw new TypeError(
                `sqlColumnsFromFields: fields.${field} has the type ${show(type)}, it is one of ${TYPES.join(', ')}`
            );
        }
        const entry: SqlColumn = { column: nameOf(field), type: type as SqlColumnType };
        // a locked case and a LOB of the field: the column's too. toSqlWhere checks they are of text
        for (const option of ['caseSensitive', 'clobType'] as const) {
            const value: unknown = typeof config === 'object' && config !== null ? (config as SqlColumn)[option] : undefined;
            if (value !== undefined) {
                if (typeof value !== 'boolean') {
                    throw new TypeError(`sqlColumnsFromFields: fields.${field}.${option} is true or false, not ${show(value)}`);
                }
                if (value) {
                    entry[option] = true;
                }
            }
        }
        if (dateStorage !== undefined && (type === 'date' || type === 'datetime')) {
            entry.dateStorage = dateStorage as SqlDateStorage;
        }
        columns[field] = entry;
    }
    return columns;
}

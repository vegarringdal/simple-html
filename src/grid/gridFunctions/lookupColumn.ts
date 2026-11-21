import type { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { Formatter } from '../../datasource/formatter';
import { objectFilter } from '../../datasource/objectFilter';
import type { ColumnConfig, ColumnEditor } from '../gridConfig';
import type { GridInterface } from '../gridInterface';
import { getRegisteredLookup, type RegisteredLookup } from '../lookup';

/**
 * A column with an `editor` (ColumnConfig.editor): its value is picked from the rows of a lookup
 * (lookup.ts). The grid keeps one of these per column, made when the grid is made and when
 * `updateConfig()` is given `columns`.
 *
 * The cell stores the value of the picked row and shows its label. Everywhere the grid shows or reads
 * the text of such a cell it uses the column's `formatter`: the cell, the marker of an edited cell, the
 * CSV export, copy and paste. Sorting uses the same text (Datasource.__setSortValue).
 */

/**
 * @internal
 * A column with an editor, see the top of the file
 */
export interface LookupColumn {
    field: string;
    /** the column's editor, as the config has it */
    editor: ColumnEditor;
    /** the lookup the editor names */
    lookup: RegisteredLookup;
    /**
     * the text of the cell: the label of the row with the value, the value as the field's formatter
     * shows it when no row has it. `parse` finds the value of a label, for a paste
     */
    formatter: Formatter;
}

/**
 * The field types a lookup column can be: the value is compared with `===`, and the cell is a text
 * input. A date is an object (never `===` another), a boolean is a checkbox
 */
const LOOKUP_TYPES = ['text', 'number'];

/**
 * @internal
 * The lookup columns of a config's columns, by field: checked, and their lookups looked up.
 * @throws a `TypeError` naming the column and what is wrong: no editor object, an unknown type, a
 * lookup that is not registered, a `set` that is no object of field names or sets the column's own
 * field, a field that is no text or number, `focusButton` or `dynamicCellTypeColumn` next to it
 */
export function lookupColumnsOf(columns: Record<string, ColumnConfig> | undefined, datasource: Datasource<any>) {
    const lookupColumns = new Map<string, LookupColumn>();
    for (const [field, column] of Object.entries(columns ?? {})) {
        const editor: unknown = column?.editor;
        if (editor === undefined) {
            continue;
        }
        const where = `columns.${field}.editor`;
        if (typeof editor !== 'object' || editor === null || Array.isArray(editor)) {
            throw new TypeError(
                `GridConfig: ${where} is { type: 'select' | 'grid', lookup: '<id>' }, got ${JSON.stringify(editor)}`
            );
        }
        const { type, lookup, set } = editor as Record<string, unknown>;
        if (type !== 'select' && type !== 'grid') {
            throw new TypeError(`GridConfig: ${where}.type is 'select' or 'grid', got ${JSON.stringify(type)}`);
        }
        const registered = getRegisteredLookup(lookup, where);
        if (set !== undefined) {
            assertSet(set, field, where);
        }
        const fieldType = datasource.getField(field).type;
        if (!LOOKUP_TYPES.includes(fieldType)) {
            throw new TypeError(
                `GridConfig: ${where} is for a text or number field, '${field}' is ${fieldType} - the value is compared with ===`
            );
        }
        if (column.focusButton !== undefined) {
            throw new TypeError(
                `GridConfig: columns.${field} has an editor and a focusButton: the editor shows its own button, leave focusButton out`
            );
        }
        if (column.dynamicCellTypeColumn !== undefined) {
            throw new TypeError(
                `GridConfig: columns.${field} has an editor and a dynamicCellTypeColumn: a lookup column has one type`
            );
        }
        lookupColumns.set(field, {
            field,
            editor: editor as ColumnEditor,
            lookup: registered,
            formatter: lookupFormatter(registered, datasource.getFormatter(field))
        });
    }
    return lookupColumns;
}

/**
 * @throws a `TypeError` when `set` is not an object of field names, or sets the column's own field
 */
function assertSet(set: unknown, field: string, where: string) {
    if (typeof set !== 'object' || set === null || Array.isArray(set)) {
        throw new TypeError(
            `GridConfig: ${where}.set is { <field of the row>: <field of the picked row> }, got ${JSON.stringify(set)}`
        );
    }
    for (const [target, source] of Object.entries(set)) {
        if (typeof source !== 'string' || source === '') {
            throw new TypeError(
                `GridConfig: ${where}.set.${target} is the name of a field of the picked row, got ${JSON.stringify(source)}`
            );
        }
        if (target === field) {
            throw new TypeError(`GridConfig: ${where}.set sets '${field}', the column's own field: it gets the picked value`);
        }
    }
}

/**
 * The formatter of a lookup column, see LookupColumn.formatter
 * @param fieldFormatter the field's own formatter, for a value no row has and a text no label is
 */
function lookupFormatter(lookup: RegisteredLookup, fieldFormatter: Formatter): Formatter {
    return {
        format(value) {
            const row = lookup.rowOf(value);
            return row ? lookup.labelOf(row) : String(fieldFormatter.format(value) ?? '');
        },
        parse(text) {
            if (text === '') {
                return null;
            }
            const row = lookup.rowOfLabel(text);
            return row ? row[lookup.valueField] : fieldFormatter.parse(text);
        }
    };
}

/**
 * @internal
 * Writes a value to a cell, as the user picked or pasted it: for a lookup column with `set` the fields
 * of `set` too, from the row with the value - or null when no row has it, the cell is emptied. One run
 * of code: one step of the undo history. A plain column gets the value only
 */
export function writeCellValue(gridInterface: GridInterface<any>, row: Entity, field: string, value: unknown) {
    const column = gridInterface.__getLookupColumn(field);
    row[field] = value;
    if (column?.editor.set) {
        const picked = column.lookup.rowOf(value);
        for (const [target, source] of Object.entries(column.editor.set)) {
            row[target] = picked ? picked[source] : null;
        }
    }
}

/**
 * @internal
 * The values of the lookup rows whose label matches a header filter's text with its operator, as a
 * text field's filter matches (wildcards included): what a lookup column's header filter filters on,
 * as `IN` - the user types what the cells show, the label, and the rows hold the value. The values
 * once each, in the order of the rows
 */
export function valuesWithLabel(column: LookupColumn, operator: FilterOperator, text: string): unknown[] {
    const values = new Set<unknown>();
    const { lookup } = column;
    for (const row of lookup.datasource.getAllData()) {
        const value = row[lookup.valueField];
        // IN takes 'NULL' for the blank cells: a row without a value is no row to pick
        if (value === null || value === undefined || value === '') {
            continue;
        }
        const label = { label: lookup.labelOf(row) };
        if (!values.has(value) && objectFilter(label, { field: 'label', operator, value: text, type: 'text' })) {
            values.add(value);
        }
    }
    return Array.from(values);
}

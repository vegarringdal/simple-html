import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { CLOB_OPERATORS } from '../../datasource/field';
import { type FilterCondition, where } from '../../datasource/filterExpression';
import { isSqlFilterError, type SqlColumn, sqlColumnsFromFields, toSqlWhere } from '../../sql';
import { SQL_CLOB_OPERATORS } from '../buildWhere';

/**
 * SqlColumn.clobType - a LOB (an Oracle CLOB) filtered with LIKE only - and SqlColumn.caseSensitive - a
 * column that always compares with its case, so its index is used. The Oracle SQL was run on Oracle 23
 * (dbfiddle): LIKE finds a CLOB of 8004 characters, `"NOTES" = 'Ann'` is ORA-22848
 */

const columns: Record<string, SqlColumn> = {
    notes: { column: 'NOTES', clobType: true },
    code: { column: 'CODE', caseSensitive: true },
    name: { column: 'NAME' }
};
const oracle = (filter: unknown) => toSqlWhere(filter, { dialect: 'oracle', columns });

/** the error toSqlWhere throws for a filter, or null */
function errorOf(filter: unknown): unknown {
    try {
        oracle(filter);
        return null;
    } catch (error) {
        return error;
    }
}

describe('clobType: LIKE only', () => {
    it("expect the SQL's operators of a LOB those the grid offers", () => {
        expect(SQL_CLOB_OPERATORS).toEqual(CLOB_OPERATORS);
    });

    it('expect EQUAL and NOT_EQUAL_TO a LIKE of the whole text, not =', () => {
        expect(oracle(where('notes', 'EQUAL', 'Ann'))).toEqual({
            sql: `("NOTES" IS NOT NULL AND LOWER("NOTES") LIKE :1 ESCAPE '!')`,
            params: ['ann']
        });
        expect(oracle(where('notes', 'NOT_EQUAL_TO', 'Ann'))).toEqual({
            sql: `("NOTES" IS NULL OR NOT (LOWER("NOTES") LIKE :1 ESCAPE '!'))`,
            params: ['ann']
        });
        // a wildcard of the text is escaped when it is literal: 50% is the text 50%
        expect(oracle(where('notes', 'EQUAL', '50%', { literal: true })).params).toEqual(['50!%']);
        // the other text column keeps its =
        expect(oracle(where('name', 'EQUAL', 'Ann')).sql).toBe(`("NAME" IS NOT NULL AND LOWER("NAME") = :1)`);
    });

    it('expect CONTAINS, BEGIN_WITH, END_WITH, their NOT and the blanks as on any text', () => {
        expect(oracle(where('notes', 'CONTAINS', 'ann')).params).toEqual(['%ann%']);
        expect(oracle(where('notes', 'BEGIN_WITH', 'ann')).params).toEqual(['ann%']);
        expect(oracle(where('notes', 'END_WITH', 'ann')).params).toEqual(['%ann']);
        expect(oracle(where('notes', 'DOES_NOT_CONTAIN', 'ann')).sql).toContain('NOT (LOWER("NOTES") LIKE');
        expect(oracle(where('notes', 'IS_BLANK')).sql).toBe('"NOTES" IS NULL');
        expect(oracle(where('notes', 'IS_NOT_BLANK')).sql).toBe('"NOTES" IS NOT NULL');
    });

    it('expect IN, the comparisons and BETWEEN a filter error naming the operators it takes', () => {
        const conditions: FilterCondition[] = [
            where('notes', 'IN', ['a']),
            where('notes', 'NOT_IN', ['a']),
            where('notes', 'GREATER_THAN', 'a'),
            where('notes', 'LESS_THAN_OR_EQUAL_TO', 'a'),
            where('notes', 'BETWEEN', ['a', 'b'])
        ];
        for (const condition of conditions) {
            const error = errorOf(condition);
            expect(isSqlFilterError(error), condition.operator).toBe(true);
            expect((error as Error).message).toContain('a CLOB column (clobType): it takes EQUAL, NOT_EQUAL_TO, CONTAINS');
        }
    });

    it('expect a valueField on either side a filter error', () => {
        for (const condition of [
            { field: 'notes', operator: 'EQUAL', valueField: 'name' },
            { field: 'name', operator: 'EQUAL', valueField: 'notes' }
        ]) {
            const error = errorOf(condition);
            expect(isSqlFilterError(error)).toBe(true);
            expect((error as Error).message).toContain('"notes" is a CLOB column (clobType), it is compared with a value only');
        }
    });

    it('expect a calculated column or a shown template that reads it a filter error', () => {
        const calculated = () =>
            toSqlWhere(where('size', 'GREATER_THAN', 1), {
                dialect: 'oracle',
                columns,
                calculated: { size: 'LEN({notes})' }
            });
        expect(calculated).toThrow('options.calculated["size"].formula reads {notes}, a CLOB column (clobType)');
        const shown = () =>
            toSqlWhere(where('name', 'EQUAL', 'x'), { dialect: 'oracle', columns, shown: { name: 'CONCAT({name}, {notes})' } });
        expect(shown).toThrow('options.shown["name"].formula reads {notes}, a CLOB column (clobType)');
    });

    it('expect clobType and caseSensitive on a column that is no text a TypeError of the options', () => {
        for (const option of ['clobType', 'caseSensitive']) {
            const options = {
                dialect: 'oracle' as const,
                columns: { n: { column: 'N', type: 'number' as const, [option]: true } }
            };
            expect(() => toSqlWhere(null, options)).toThrow(`options.columns["n"].${option} is for a text column`);
            const notBoolean = { dialect: 'oracle' as const, columns: { n: { column: 'N', [option]: 'yes' } } };
            expect(() => toSqlWhere(null, notBoolean as never)).toThrow(`options.columns["n"].${option} is true or false`);
        }
    });
});

describe('caseSensitive: always with its case', () => {
    it('expect a condition without caseSensitive, or with false, compared with its case - an index is used', () => {
        expect(oracle(where('code', 'EQUAL', 'abc-1'))).toEqual({
            sql: `("CODE" IS NOT NULL AND "CODE" = :1)`,
            params: ['abc-1']
        });
        expect(oracle({ field: 'code', operator: 'EQUAL', value: 'abc-1', caseSensitive: false }).sql).toBe(
            `("CODE" IS NOT NULL AND "CODE" = :1)`
        );
        expect(oracle(where('code', 'IN', ['a', 'B'])).sql).toBe(`("CODE" IS NOT NULL AND "CODE" IN (:1, :2))`);
        expect(oracle(where('code', 'BEGIN_WITH', 'AB')).sql).toBe(`("CODE" IS NOT NULL AND "CODE" LIKE :1 ESCAPE '!')`);
        expect(oracle(where('code', 'BEGIN_WITH', 'AB')).params).toEqual(['AB%']);
    });
});

describe('sqlColumnsFromFields', () => {
    it('expect caseSensitive and clobType of the fields copied to their columns', () => {
        const fields = {
            notes: { clobType: true },
            code: { caseSensitive: true },
            plain: { caseSensitive: false },
            n: 'number'
        } as const;
        expect(sqlColumnsFromFields(fields, { nameCase: 'upper' })).toEqual({
            notes: { column: 'NOTES', type: 'text', clobType: true },
            code: { column: 'CODE', type: 'text', caseSensitive: true },
            plain: { column: 'PLAIN', type: 'text' },
            n: { column: 'N', type: 'number' }
        });
        expect(() => sqlColumnsFromFields({ notes: { clobType: 'yes' } } as never)).toThrow(
            'sqlColumnsFromFields: fields.notes.clobType is true or false'
        );
    });
});

describe('the same rows as the grid', () => {
    const rows = [
        { id: 1, notes: 'Ann', code: 'AB-1' },
        { id: 2, notes: 'ann berg', code: 'ab-1' },
        { id: 3, notes: 'paid 50% now', code: 'AB-2' },
        { id: 4, notes: null, code: null },
        { id: 5, notes: `${'y'.repeat(4000)} ann`, code: 'Ab-1' }
    ];
    const fields = { id: 'number', notes: { clobType: true }, code: { caseSensitive: true } } as const;

    it('expect each filter on SQLite to give the rows the datasource gives', () => {
        const database = new DatabaseSync(':memory:');
        database.exec('CREATE TABLE t (id INTEGER, notes TEXT, code TEXT)');
        const insert = database.prepare('INSERT INTO t VALUES (?, ?, ?)');
        for (const row of rows) {
            insert.run(row.id, row.notes, row.code);
        }
        const datasource = new Datasource({ key: 'id', fields });
        datasource.setData(structuredClone(rows));
        const sqlColumns = sqlColumnsFromFields(fields);
        const filters: FilterCondition[] = [
            where('notes', 'EQUAL', 'ann'),
            where('notes', 'NOT_EQUAL_TO', 'ann'),
            where('notes', 'CONTAINS', '50%', { literal: true }),
            where('notes', 'END_WITH', 'ANN'),
            where('notes', 'IS_BLANK'),
            where('code', 'EQUAL', 'ab-1'),
            where('code', 'BEGIN_WITH', 'AB'),
            where('code', 'IN', ['ab-1', 'AB-2'])
        ];
        for (const filter of filters) {
            datasource.filter(filter);
            const grid = datasource
                .getRows()
                .map((row) => (row as { id: number }).id)
                .sort((a, b) => a - b);
            const { sql, params } = toSqlWhere(filter, { dialect: 'sqlite', columns: sqlColumns });
            const found = database
                .prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`)
                .all(...(params as (string | number)[]))
                .map((row) => row.id);
            expect(found, `${filter.field} ${filter.operator} ${String(filter.value)}`).toEqual(grid);
        }
        // the locked case: ab-1 is only ab-1, AB matches AB-1 and AB-2
        datasource.filter(where('code', 'EQUAL', 'ab-1'));
        expect(datasource.getRows().map((row) => (row as { id: number }).id)).toEqual([2]);
    });
});

// @vitest-environment happy-dom

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FilterCondition, FilterExpression, FilterGroup, FilterOperator } from '../../datasource/filterExpression';
import * as grid from '../../index';
import {
    convertV5Filter,
    isSqlFilterError,
    isV5Filter,
    normalizeFilter,
    type SqlFilter,
    type SqlFilterCondition,
    type SqlFilterGroup,
    type SqlFilterOperator,
    sqlColumnsFromFields,
    toSqlWhere,
    withoutFields
} from '../../sql';

/**
 * The helpers of the sql entry beside toSqlWhere: the v5 filters (convertV5Filter, isV5Filter,
 * normalizeFilter), withoutFields, sqlColumnsFromFields and isSqlFilterError - and that its filter types
 * are the grid's
 */

describe('the filter types of the sql entry', () => {
    it("expect SqlFilter and its parts to be the grid's FilterExpression and its parts, both ways", () => {
        expectTypeOf<SqlFilter>().toEqualTypeOf<FilterExpression>();
        expectTypeOf<SqlFilterGroup>().toEqualTypeOf<FilterGroup>();
        expectTypeOf<SqlFilterCondition>().toEqualTypeOf<FilterCondition>();
        expectTypeOf<SqlFilterOperator>().toEqualTypeOf<FilterOperator>();
    });

    it('expect the helpers of both entries to give the same', () => {
        const v5 = { logicalOperator: 'OR', filterArguments: [{ attribute: 'a', operator: 'EQUAL', value: 1 }] };
        expect(convertV5Filter(v5)).toEqual(grid.convertV5Filter(v5));
        expect(normalizeFilter(JSON.stringify(v5))).toEqual(grid.normalizeFilter(v5));
        expect(isV5Filter(v5)).toBe(grid.isV5Filter(v5));
        const filter = grid.and(grid.where('a', 'EQUAL', 1), grid.where('b', 'EQUAL', 2));
        expect(withoutFields(filter, ['b'])).toEqual(grid.withoutFields(filter, ['b']));
    });
});

describe('a v5 filter on a backend', () => {
    it('expect a v5 link to give the SQL of its v6 filter', () => {
        const options = {
            dialect: 'postgres' as const,
            columns: { name: 'name', age: { column: 'age', type: 'number' as const } }
        };
        const v5 = JSON.stringify({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                { attribute: 'name', operator: 'BEGIN_WITH', value: 'an' },
                { attribute: 'age', operator: 'GREATER_THAN', value: 18 }
            ]
        });
        expect(toSqlWhere(normalizeFilter(v5), options)).toEqual(
            toSqlWhere(grid.and(grid.where('name', 'BEGIN_WITH', 'an'), grid.where('age', 'GREATER_THAN', 18)), options)
        );
    });
});

describe('sqlColumnsFromFields', () => {
    const fields = {
        project: 'text',
        born: 'date',
        seen: { type: 'datetime' },
        amount: { type: 'number', label: 'Amount' },
        note: {}
    } as const;

    it('expect a column of each field, of its type - text without one - named as the field', () => {
        expect(sqlColumnsFromFields(fields)).toEqual({
            project: { column: 'project', type: 'text' },
            born: { column: 'born', type: 'date' },
            seen: { column: 'seen', type: 'datetime' },
            amount: { column: 'amount', type: 'number' },
            note: { column: 'note', type: 'text' }
        });
    });

    it('expect nameCase, column and dateStorage to change the names and the dates', () => {
        const columns = sqlColumnsFromFields(fields, {
            nameCase: 'upper',
            column: (field) => `crm.${field}`,
            dateStorage: 'utc'
        });
        expect(columns.project).toEqual({ column: 'CRM.PROJECT', type: 'text' });
        expect(columns.born).toEqual({ column: 'CRM.BORN', type: 'date', dateStorage: 'utc' });
        expect(columns.seen.dateStorage).toEqual('utc');
        expect(sqlColumnsFromFields({ Born: 'date' }, { nameCase: 'lower' }).Born.column).toEqual('born');
        // toSqlWhere takes them
        expect(
            toSqlWhere({ field: 'project', operator: 'EQUAL', value: 'x' }, { dialect: 'oracle', columns, timeZone: 'UTC' }).sql
        ).toContain('"CRM"."PROJECT"');
    });

    it('expect a type that is none, fields that are no object and wrong options to throw a TypeError', () => {
        expect(() => sqlColumnsFromFields({ a: 'money' } as never)).toThrow(
            'sqlColumnsFromFields: fields.a has the type "money"'
        );
        expect(() => sqlColumnsFromFields(null as never)).toThrow(TypeError);
        expect(() => sqlColumnsFromFields(fields, { nameCase: 'title' as never })).toThrow('options.nameCase');
        expect(() => sqlColumnsFromFields(fields, { column: 'x' as never })).toThrow('options.column is a function');
    });
});

describe('isSqlFilterError', () => {
    const options = { dialect: 'postgres' as const, columns: { name: 'name' } };
    const thrown = (run: () => unknown) => {
        try {
            run();
        } catch (error) {
            return error;
        }
        throw new Error('it did not throw');
    };

    it('expect true for what is wrong with the filter - its shape, a field, a limit - the class kept', () => {
        const shape = thrown(() => toSqlWhere({ field: 'name', operator: 'NOPE' }, options));
        expect(shape).toBeInstanceOf(TypeError);
        expect(isSqlFilterError(shape)).toBe(true);
        expect(isSqlFilterError(thrown(() => toSqlWhere({ field: 'password', operator: 'EQUAL', value: 'x' }, options)))).toBe(
            true
        );
        const limit = thrown(() =>
            toSqlWhere({ field: 'name', operator: 'IN', value: ['a', 'b', 'c'] }, { ...options, limits: { listLength: 2 } })
        );
        expect(limit).toBeInstanceOf(RangeError);
        expect(isSqlFilterError(limit)).toBe(true);
        expect(isSqlFilterError(thrown(() => convertV5Filter({ attribute: 'a', operator: 'NOPE' })))).toBe(true);
        expect(isSqlFilterError(thrown(() => normalizeFilter('{x')))).toBe(true);
        // the user's time zone, sent with the filter
        expect(isSqlFilterError(thrown(() => toSqlWhere(null, { ...options, timeZone: 'Mars/Base' })))).toBe(true);
        expect(isSqlFilterError(thrown(() => toSqlWhere(null, { ...options, timeZone: 5 as never })))).toBe(true);
    });

    it('expect false for options that are wrong - the backend code - and for any other error', () => {
        expect(isSqlFilterError(thrown(() => toSqlWhere(null, { dialect: 'mysql' as never, columns: {} })))).toBe(false);
        expect(
            isSqlFilterError(
                thrown(() => toSqlWhere({ field: 'name', operator: 'EQUAL', value: 'x' }, { ...options, firstParam: 0 }))
            )
        ).toBe(false);
        expect(isSqlFilterError(new TypeError('x'))).toBe(false);
        expect(isSqlFilterError(null)).toBe(false);
        expect(isSqlFilterError('x')).toBe(false);
    });
});

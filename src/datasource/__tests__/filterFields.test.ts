import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, type FilterExpression, or, where } from '../filterExpression';
import { withoutFields } from '../filterFields';

/**
 * withoutFields (filterFields.ts): a filter without the conditions on some fields, for a backend - a
 * condition taken out matches every row, so the backend's rows are never fewer than the browser's
 */

describe('withoutFields', () => {
    it('expect a condition on a field left out of an AND group, the rest kept', () => {
        expect(withoutFields(and(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 100)), ['total'])).toEqual(
            and(where('country', 'EQUAL', 'Norway'))
        );
    });

    it('expect an OR group with one left out whole: any row can match it', () => {
        expect(withoutFields(or(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 100)), ['total'])).toBeNull();
        expect(
            withoutFields(
                and(where('age', 'LESS_THAN', 30), or(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 100))),
                new Set(['total'])
            )
        ).toEqual(and(where('age', 'LESS_THAN', 30)));
    });

    it('expect a condition comparing with the field (valueField) left out too, a function to pick the fields', () => {
        const filter = and(where('age', 'EQUAL', 1), { field: 'age', operator: 'LESS_THAN', valueField: 'total' });
        expect(withoutFields(filter, ['total'])).toEqual(and(where('age', 'EQUAL', 1)));
        expect(withoutFields(filter, (field) => field !== 'country')).toBeNull();
        expect(withoutFields(where('total', 'EQUAL', 1), ['total'])).toBeNull();
    });

    it('expect the same object when nothing goes, an empty group as it is, null for none', () => {
        const filter = and(where('age', 'EQUAL', 1), or(where('a', 'EQUAL', 1)));
        expect(withoutFields(filter, ['total'])).toBe(filter);
        const empty = and();
        expect(withoutFields(empty, ['total'])).toBe(empty);
        expect(withoutFields(null, ['total'])).toBeNull();
        expect(withoutFields(undefined, ['total'])).toBeNull();
    });

    it('expect the rows of what is left to be every row of the whole filter, or more', () => {
        const rows: { id: number; country: string; age: number; total: number }[] = [];
        for (let i = 0; i < 60; i++) {
            rows.push({ id: i, country: ['Norway', 'Sweden', 'Denmark'][i % 3], age: i % 50, total: (i * 37) % 200 });
        }
        const ids = (filter: FilterExpression | null) => {
            const datasource = new Datasource({ fields: { age: 'number', total: 'number' } });
            datasource.setData(rows.map((row) => ({ ...row })));
            datasource.filter(filter);
            return new Set(datasource.getRows().map((row) => (row as { id: number }).id));
        };
        const filters = [
            and(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 100)),
            or(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 100)),
            and(
                where('age', 'LESS_THAN', 30),
                or(where('country', 'EQUAL', 'Sweden'), and(where('total', 'LESS_THAN', 50), where('age', 'GREATER_THAN', 5)))
            ),
            or(and(where('total', 'LESS_THAN', 50), where('country', 'EQUAL', 'Denmark')), where('age', 'EQUAL', 3))
        ];
        for (const filter of filters) {
            const all = ids(filter);
            const backend = ids(withoutFields(filter, ['total']));
            expect([...all].every((id) => backend.has(id))).toBe(true);
        }
    });
});

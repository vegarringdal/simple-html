import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, or, where } from '../filterExpression';

/**
 * FieldConfig.caseSensitive - every filter on the field matches case - and FieldConfig.clobType - a long
 * text filtered with LIKE only: set in the fields, by code
 */

const rows = () => [
    { id: 1, code: 'AB-1', name: 'Ann' },
    { id: 2, code: 'ab-1', name: 'ann' }
];
const ids = (datasource: Datasource) => datasource.getRows().map((row) => (row as { id: number }).id);

describe('the options', () => {
    it('expect getField to give both, false when not set', () => {
        const datasource = new Datasource({ fields: { code: { caseSensitive: true }, notes: { clobType: true } } });
        expect(datasource.getField('code')).toMatchObject({ caseSensitive: true, clobType: false });
        expect(datasource.getField('notes')).toMatchObject({ caseSensitive: false, clobType: true });
        expect(datasource.getField('other')).toMatchObject({ caseSensitive: false, clobType: false });
    });

    it('expect them on a field that is no text, or not true / false, to throw', () => {
        expect(() => new Datasource({ fields: { n: { type: 'number', caseSensitive: true } } })).toThrow(
            "Datasource: field 'n' has caseSensitive, that is for text fields only, not 'number'"
        );
        expect(() => new Datasource({ fields: { d: { type: 'date', clobType: true } } })).toThrow(
            "Datasource: field 'd' has clobType, that is for text fields only, not 'date'"
        );
        expect(() => new Datasource({ fields: { n: { clobType: 'yes' as never } } })).toThrow(
            "Datasource: field 'n' has clobType 'yes', it is true or false"
        );
    });
});

describe('readonly: no grid lets the user edit the field', () => {
    it('expect getField to give it on any type, false when not set', () => {
        const datasource = new Datasource({
            fields: { id: { type: 'number', readonly: true }, born: { type: 'date', readonly: true } }
        });
        expect(datasource.getField('id').readonly).toBe(true);
        expect(datasource.getField('born').readonly).toBe(true);
        expect(datasource.getField('other').readonly).toBe(false);
        expect(datasource.__isFieldReadonly('id')).toBe(true);
        expect(datasource.__isFieldReadonly('other')).toBe(false);
    });

    it('expect it not true / false to throw', () => {
        expect(() => new Datasource({ fields: { n: { readonly: 'yes' as never } } })).toThrow(
            "Datasource: field 'n' has readonly 'yes', it is true or false"
        );
    });

    it('expect code to still set its values', () => {
        const datasource = new Datasource({ key: 'id', fields: { id: 'number', code: { readonly: true } } });
        datasource.setData([{ id: 1, code: 'a' }]);
        const row = datasource.getAllData()[0] as { code: string };
        row.code = 'b';
        expect(row.code).toBe('b');
    });
});

describe('caseSensitive: every filter on the field matches case', () => {
    it('expect a condition without caseSensitive kept as a copy with it, and run so', () => {
        const datasource = new Datasource({ key: 'id', fields: { id: 'number', code: { caseSensitive: true } } });
        datasource.setData(rows());
        const condition = where('code', 'EQUAL', 'ab-1');
        datasource.filter(condition);
        expect(ids(datasource)).toEqual([2]);
        expect(datasource.getFilter()).toEqual({ ...condition, caseSensitive: true });
        // the object given is not changed
        expect(condition.caseSensitive).toBeUndefined();
    });

    it('expect the conditions in groups locked, the others as they are, and caseSensitive: false locked too', () => {
        const datasource = new Datasource({ key: 'id', fields: { id: 'number', code: { caseSensitive: true } } });
        datasource.setData(rows());
        datasource.setFilter(
            and(where('name', 'EQUAL', 'ANN'), or({ field: 'code', operator: 'IN', value: ['ab-1'], caseSensitive: false }))
        );
        datasource.filter();
        expect(ids(datasource)).toEqual([2]);
        expect(datasource.getFilter()).toEqual(
            and(where('name', 'EQUAL', 'ANN'), or({ field: 'code', operator: 'IN', value: ['ab-1'], caseSensitive: true }))
        );
    });

    it('expect a filter without a locked field kept as the same object', () => {
        const datasource = new Datasource({ fields: { code: { caseSensitive: true } } });
        const filter = and(where('name', 'EQUAL', 'Ann'));
        datasource.filter(filter);
        expect(datasource.getFilter()).toBe(filter);
    });

    it('expect setFields that locks a field to lock the conditions of the filter there is', () => {
        const datasource = new Datasource({ key: 'id', fields: { id: 'number' } });
        datasource.setData(rows());
        datasource.filter(where('code', 'EQUAL', 'ab-1'));
        expect(ids(datasource)).toEqual([1, 2]);
        datasource.setFields({ id: 'number', code: { caseSensitive: true } });
        expect(ids(datasource)).toEqual([2]);
    });
});

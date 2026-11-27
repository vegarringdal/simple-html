import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

/**
 * datasource.setFields(): the fields replaced after the datasource is made - the metadata of a query came
 */

const rows = () => [
    { id: 1, n: '10', born: '2026-11-22', code: '' },
    { id: 2, n: '9', born: '2025-01-01', code: 'x' }
];

describe('setFields', () => {
    it('expect the new types, labels and formatters in getField, the fields left out text', () => {
        const datasource = new Datasource({ key: 'id', fields: { code: 'number' } });
        datasource.setFields({ n: 'number', born: { type: 'date', label: 'Born' } });
        expect(datasource.getField('n').type).toEqual('number');
        expect(datasource.getField('born')).toMatchObject({ type: 'date', label: 'Born' });
        expect(datasource.getField('code').type).toEqual('text');
    });

    it('expect the rows sorted and filtered again by the new types: fields-change, then collection-filtered', () => {
        const datasource = new Datasource({ key: 'id' });
        datasource.setData([
            { id: 1, n: 10 },
            { id: 2, n: 9 },
            { id: 3, n: 100 }
        ]);
        datasource.sort([{ attribute: 'n', ascending: true }]);
        const events: string[] = [];
        datasource.on('fields-change', () => {
            events.push('fields-change');
        });
        datasource.on('collection-filtered', () => {
            events.push('collection-filtered');
        });

        datasource.setFields({ n: 'number' });
        expect(events).toEqual(['fields-change', 'collection-filtered']);
        datasource.sort([{ attribute: 'n', ascending: true }]);
        expect(datasource.getRows().map((row) => (row as { n: number }).n)).toEqual([9, 10, 100]);
        datasource.filter(where('n', 'GREATER_THAN', 9));
        expect(datasource.getRows().map((row) => (row as { id: number }).id)).toEqual([1, 3]);
    });

    it('expect the rows with errors validated again with the new rules, an error of a rule that is gone gone', () => {
        const datasource = new Datasource({ key: 'id', fields: { code: { validate: ['required'] } } });
        datasource.setData(rows());
        expect(datasource.validate().map((error) => error.field)).toEqual(['code']);

        datasource.setFields({ code: 'text' });
        expect(datasource.getErrors()).toEqual([]);
        datasource.setFields({ n: { validate: ['required'] }, code: { validate: ['required'] } });
        // only the rows with an error are checked again: none has one now - validate() checks the rest
        expect(datasource.getErrors()).toEqual([]);
        expect(datasource.validate().map((error) => error.field)).toEqual(['code']);
    });

    it('expect a field that does not fit to throw, nothing changed: an unknown type, another type on the same container', () => {
        const container = new DataContainer('id');
        const one = new Datasource({ container, fields: { n: 'number' } });
        const two = new Datasource({ container, fields: { born: 'date' } });

        expect(() => two.setFields({ n: 'text' })).toThrow("field 'n' is 'text' here and 'number' in another datasource");
        expect(two.getField('born').type).toEqual('date');
        expect(() => two.setFields({ born: 'money' as never })).toThrow("unknown type 'money'");
        expect(two.getField('born').type).toEqual('date');

        // its own fields it can change: born is no date now, n of the other one stays
        two.setFields({ born: 'text', n: 'number' });
        expect(two.getField('born').type).toEqual('text');
        // one takes n out: two has it alone, and can give it another type
        one.setFields({});
        expect(() => two.setFields({ n: 'text' })).not.toThrow();
    });
});

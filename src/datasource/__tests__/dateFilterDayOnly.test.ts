import { describe, expect, it } from 'vitest';
import { DateFormaterYYYYMMDD } from '../DateFormaterYYYYMMDD';
import { DateFormaterYYYYMMDDTHHMMSS } from '../DateFormaterYYYYMMDDTHHMMSS';
import { Datasource } from '../dataSource';
import { DefaultValueFormater } from '../defaultValueFormater';
import type { ValueFormater } from '../valueFormater';

/**
 * Date filters on a date format without time (the default YYYY-MM-DD) match on the calendar day,
 * time ignored on the row value and the filter value. Formats with time keep comparing with time.
 * Storage is unchanged: an edited date cell still gets the current time stamped on it.
 */

const dayOperators = ['EQUAL', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN_OR_EQUAL_TO'] as const;

const filterOn = (ds: Datasource, operator: string, value: any) => {
    ds.filter({ attribute: 'd', attributeType: 'date', operator: operator as any, value });
    return ds.getRows().map((r) => r.n);
};

describe('date filter - date only format matches on the day', () => {
    for (const operator of dayOperators) {
        it(`expect an edited cell (current time stamped) to match ${operator} on its day`, () => {
            const ds = new Datasource();
            ds.setData([{ d: null, n: 'row' }]);
            const row = ds.getAllData()[0];
            row.d = ds.getValueFormater().toSource('2020-01-01', 'date', 'd', false);

            const value = ds.getValueFormater().toFilter('2020-01-01', 'date', 'd', true);
            expect(filterOn(ds, operator, value)).toEqual(['row']);
        });

        it(`expect source data with a time to match ${operator} on its day`, () => {
            const ds = new Datasource();
            ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);
            expect(filterOn(ds, operator, new Date(2020, 0, 1))).toEqual(['row']);
        });
    }

    it('expect other days to still be told apart', () => {
        const ds = new Datasource();
        ds.setData([
            { d: new Date(2019, 11, 31, 23, 59), n: 'before' },
            { d: new Date(2020, 0, 1, 12, 0), n: 'on' },
            { d: new Date(2020, 0, 2, 0, 1), n: 'after' }
        ]);
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 18, 0))).toEqual(['on']);
        expect(filterOn(ds, 'LESS_THAN', new Date(2020, 0, 1))).toEqual(['before']);
        expect(filterOn(ds, 'GREATER_THAN', new Date(2020, 0, 1))).toEqual(['after']);
    });
});

describe('date filter - formats with time keep comparing with time', () => {
    it('expect the datetime formater to respect the time', () => {
        const ds = new Datasource();
        ds.setDateFormater(DateFormaterYYYYMMDDTHHMMSS);
        ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);

        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1))).toEqual([]);
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 15, 30, 10))).toEqual(['row']);
        expect(filterOn(ds, 'LESS_THAN', new Date(2020, 0, 1, 16, 0, 0))).toEqual(['row']);
        expect(filterOn(ds, 'GREATER_THAN', new Date(2020, 0, 1, 16, 0, 0))).toEqual([]);
    });

    it('expect a date formater without includesTime to keep comparing with time', () => {
        const ds = new Datasource();
        // same formater, minus the flag, like a custom date formater written before the flag existed
        const custom = {
            fromSource: DateFormaterYYYYMMDD.fromSource,
            toSource: DateFormaterYYYYMMDD.toSource,
            toFilter: DateFormaterYYYYMMDD.toFilter,
            fromSourceDisplay: DateFormaterYYYYMMDD.fromSourceDisplay,
            fromSourceGrouping: DateFormaterYYYYMMDD.fromSourceGrouping,
            placeholder: DateFormaterYYYYMMDD.placeholder
        };
        ds.setDateFormater(custom);
        ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);

        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1))).toEqual([]);
    });

    it('expect a custom ValueFormater without dateIncludesTime to keep comparing with time', () => {
        const ds = new Datasource();
        const inner = new DefaultValueFormater(ds);
        // a ValueFormater written before dateIncludesTime existed
        const custom: ValueFormater = {
            datasource: ds,
            fromSource: (value, type, attribute) => inner.fromSource(value, type, attribute),
            toSource: (value, type, attribute) => inner.toSource(value, type, attribute),
            toFilter: (value, type, attribute) => inner.toFilter(value, type, attribute),
            placeholder: (type, attribute) => inner.placeholder(type, attribute),
            fromSourceDisplay: (value, type, attribute) => inner.fromSourceDisplay(value, type, attribute),
            fromSourceGrouping: (value, type, attribute) => inner.fromSourceGrouping(value, type, attribute)
        };
        ds.setValueFormater(custom);
        ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);

        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1))).toEqual([]);
        expect(filterOn(ds, 'LESS_THAN_OR_EQUAL_TO', new Date(2020, 0, 1))).toEqual([]);
    });

    it('expect a custom ValueFormater to decide per attribute', () => {
        const ds = new Datasource();
        const inner = new DefaultValueFormater(ds);
        const custom: ValueFormater = {
            datasource: ds,
            fromSource: (value, type, attribute) => inner.fromSource(value, type, attribute),
            toSource: (value, type, attribute) => inner.toSource(value, type, attribute),
            toFilter: (value, type, attribute) => inner.toFilter(value, type, attribute),
            placeholder: (type, attribute) => inner.placeholder(type, attribute),
            fromSourceDisplay: (value, type, attribute) => inner.fromSourceDisplay(value, type, attribute),
            fromSourceGrouping: (value, type, attribute) => inner.fromSourceGrouping(value, type, attribute),
            dateIncludesTime: (attribute) => attribute === 'withTime'
        };
        ds.setValueFormater(custom);
        ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), withTime: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);

        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1))).toEqual(['row']);
        ds.filter({ attribute: 'withTime', attributeType: 'date', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(ds.getRows()).toEqual([]);
    });
});

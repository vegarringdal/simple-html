import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';
import type { FieldType } from '../field';
import type { FilterComparisonOperator } from '../filterComparisonOperator';

/**
 * A `date` field is about the day: it sorts, groups and filters on the calendar day, the time of
 * day is ignored. A `datetime` field uses the full timestamp. Replaces the v5 `includesTime` flag of
 * the date formatter and `setDates()`.
 * Storage is unchanged: an edited date cell still gets the current time of day stamped on it.
 */

const rows = () => [
    { d: new Date(2020, 0, 1, 15, 30, 10), n: 'afternoon' },
    { d: new Date(2019, 11, 31, 23, 59), n: 'day before' },
    { d: new Date(2020, 0, 1, 9, 0, 0), n: 'morning' },
    { d: new Date(2020, 0, 2, 0, 1), n: 'day after' }
];

const datasource = (type: FieldType) => {
    const ds = new Datasource({ fields: { d: type } });
    ds.setData(rows());
    return ds;
};

const names = (ds: Datasource) => ds.getRows().map((row) => (isGroupRow(row) ? `G:${row.__groupID}` : row.n));

const filterOn = (ds: Datasource, operator: FilterComparisonOperator, value: unknown) => {
    ds.filter({ attribute: 'd', operator, value: value instanceof Date || typeof value === 'string' ? value : null });
    return names(ds);
};

describe('date vs datetime - sort', () => {
    it('expect a date field to sort on the day, rows of the same day keep their order', () => {
        const ds = datasource('date');
        ds.sort({ attribute: 'd', ascending: true });
        expect(names(ds)).toEqual(['day before', 'afternoon', 'morning', 'day after']);
    });

    it('expect a date field to sort on the day descending too', () => {
        const ds = datasource('date');
        ds.sort({ attribute: 'd', ascending: false });
        expect(names(ds)).toEqual(['day after', 'afternoon', 'morning', 'day before']);
    });

    it('expect a datetime field to sort on the timestamp', () => {
        const ds = datasource('datetime');
        ds.sort({ attribute: 'd', ascending: true });
        expect(names(ds)).toEqual(['day before', 'morning', 'afternoon', 'day after']);
    });

    it('expect a field that is not listed to sort on the timestamp, like v5 without setDates()', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.sort({ attribute: 'd', ascending: true });
        expect(names(ds)).toEqual(['day before', 'morning', 'afternoon', 'day after']);
    });

    it('expect a second sort argument to decide between rows of the same day', () => {
        const ds = datasource('date');
        ds.sort([
            { attribute: 'd', ascending: true },
            { attribute: 'n', ascending: true }
        ]);
        expect(names(ds)).toEqual(['day before', 'afternoon', 'morning', 'day after']);
        ds.sort([
            { attribute: 'd', ascending: true },
            { attribute: 'n', ascending: false }
        ]);
        expect(names(ds)).toEqual(['day before', 'morning', 'afternoon', 'day after']);
    });
});

describe('date vs datetime - group', () => {
    it('expect a date field to group by day', () => {
        const ds = datasource('date');
        ds.group([{ attribute: 'd', title: 'day' }]);
        expect(names(ds)).toEqual(['G:2019-12-31', 'G:2020-01-01', 'G:2020-01-02']);
    });

    it('expect a datetime field to group by the second', () => {
        const ds = datasource('datetime');
        ds.group([{ attribute: 'd', title: 'time' }]);
        expect(names(ds)).toEqual([
            'G:2019-12-31T23:59:00',
            'G:2020-01-01T09:00:00',
            'G:2020-01-01T15:30:10',
            'G:2020-01-02T00:01:00'
        ]);
    });
});

describe('date vs datetime - filter on a date field matches the day', () => {
    for (const operator of ['EQUAL', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN_OR_EQUAL_TO'] as const) {
        it(`expect an edited cell (current time stamped) to match ${operator} on its day`, () => {
            const ds = new Datasource({ fields: { d: 'date' } });
            ds.setData([{ d: null, n: 'row' }]);
            const formatter = ds.getFormatter('d');
            ds.getAllData()[0].d = formatter.parse('2020-01-01');

            expect(filterOn(ds, operator, formatter.parseFilter?.('2020-01-01'))).toEqual(['row']);
        });

        it(`expect source data with a time to match ${operator} on its day`, () => {
            const ds = new Datasource({ fields: { d: 'date' } });
            ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10), n: 'row' }]);
            expect(filterOn(ds, operator, new Date(2020, 0, 1))).toEqual(['row']);
        });
    }

    it('expect other days to still be told apart', () => {
        const ds = datasource('date');
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 18, 0))).toEqual(['afternoon', 'morning']);
        expect(filterOn(ds, 'LESS_THAN', new Date(2020, 0, 1))).toEqual(['day before']);
        expect(filterOn(ds, 'GREATER_THAN', new Date(2020, 0, 1))).toEqual(['day after']);
        expect(filterOn(ds, 'NOT_EQUAL_TO', new Date(2020, 0, 1))).toEqual(['day before', 'day after']);
    });
});

describe('date vs datetime - filter on a datetime field compares with time', () => {
    it('expect the time to decide', () => {
        const ds = datasource('datetime');
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1))).toEqual([]);
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 15, 30, 10))).toEqual(['afternoon']);
        expect(filterOn(ds, 'LESS_THAN', new Date(2020, 0, 1, 12, 0, 0))).toEqual(['day before', 'morning']);
        expect(filterOn(ds, 'GREATER_THAN', new Date(2020, 0, 1, 12, 0, 0))).toEqual(['afternoon', 'day after']);
    });

    it('expect the milliseconds to be ignored', () => {
        const ds = new Datasource({ fields: { d: 'datetime' } });
        ds.setData([{ d: new Date(2020, 0, 1, 15, 30, 10, 999), n: 'row' }]);
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 15, 30, 10, 0))).toEqual(['row']);
    });

    it('expect a typed filter with the time left out to start at midnight', () => {
        const ds = datasource('datetime');
        const value = ds.getFormatter('d').parseFilter?.('2020-01-01');
        expect(filterOn(ds, 'GREATER_THAN_OR_EQUAL_TO', value)).toEqual(['afternoon', 'morning', 'day after']);
    });

    it('expect blank rows to only match NOT_EQUAL_TO, like a date field', () => {
        const ds = new Datasource({ fields: { d: 'datetime' } });
        ds.setData([
            { d: null, n: 'blank' },
            { d: new Date(2020, 0, 1, 15, 0), n: 'row' }
        ]);
        expect(filterOn(ds, 'EQUAL', new Date(2020, 0, 1, 15, 0))).toEqual(['row']);
        expect(filterOn(ds, 'NOT_EQUAL_TO', new Date(2020, 0, 1, 15, 0))).toEqual(['blank']);
        ds.filter({ attribute: 'd', operator: 'IS_BLANK' });
        expect(names(ds)).toEqual(['blank']);
    });
});

describe('date vs datetime - the schema decides, attributeType is the fallback', () => {
    it('expect the field type to win over the condition attributeType', () => {
        const ds = datasource('datetime');
        ds.filter({ attribute: 'd', attributeType: 'date', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(names(ds)).toEqual([]);

        const dateDs = datasource('date');
        dateDs.filter({ attribute: 'd', attributeType: 'datetime', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(names(dateDs)).toEqual(['afternoon', 'morning']);
    });

    it('expect attributeType to decide for a field that is not listed', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({ attribute: 'd', attributeType: 'datetime', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(names(ds)).toEqual([]);
        ds.filter({ attribute: 'd', attributeType: 'date', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(names(ds)).toEqual(['afternoon', 'morning']);
    });

    it('expect a Date value without a type to match on the day, as in v5', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({ attribute: 'd', operator: 'EQUAL', value: new Date(2020, 0, 1) });
        expect(names(ds)).toEqual(['afternoon', 'morning']);
    });

    it('expect a blank value on a listed date field to be an incomplete condition, ignored', () => {
        const ds = datasource('date');
        ds.filter({ attribute: 'd', operator: 'EQUAL', value: null });
        expect(names(ds)).toHaveLength(4);
        expect(ds.getFilterString()).toEqual('');
    });
});

describe('date vs datetime - IN and the filter string use the field formatter', () => {
    it('expect IN on a datetime field to compare the text with time', () => {
        const ds = datasource('datetime');
        // a list as text, one value per line
        ds.filter({ attribute: 'd', operator: 'IN', value: '2020-01-01T09:00:00\n2019-12-31' });
        expect(names(ds)).toEqual(['morning']);
    });

    it('expect IN on a date field to compare the day', () => {
        const ds = datasource('date');
        ds.filter({ attribute: 'd', operator: 'IN', value: '2020-01-01' });
        expect(names(ds)).toEqual(['afternoon', 'morning']);
    });

    it('expect the filter string to show the value with the field formatter', () => {
        const ds = new Datasource({ fields: { d: { type: 'date', label: 'Day' }, t: { type: 'datetime', label: 'Time' } } });
        ds.filter({
            logicalOperator: 'AND',
            filterArguments: [
                { attribute: 'd', operator: 'EQUAL', value: new Date(2020, 0, 1, 15, 30) },
                { attribute: 't', operator: 'GREATER_THAN', value: new Date(2020, 0, 1, 15, 30) }
            ]
        });
        expect(ds.getFilterString()).toEqual(
            "([DAY] <<EQUAL_TO>> '2020-01-01' AND [TIME] <<GREATER_THAN>> '2020-01-01T15:30:00')"
        );
    });
});

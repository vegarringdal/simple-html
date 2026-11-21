import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import { type GroupRow, isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * datasource.aggregate(field, fn, rows?): sum, avg, min, max and count of a field over the filtered
 * rows, a group row's rows or a list of rows. What the grid's group rows and totals row show.
 */

interface Row {
    id: number;
    country: string;
    fruit: string;
    balance?: unknown;
    note?: unknown;
}

const rows = (): Row[] => [
    { id: 1, country: 'no', fruit: 'apple', balance: 10, note: 'a' },
    { id: 2, country: 'no', fruit: 'apple', balance: -2.5, note: '' },
    { id: 3, country: 'no', fruit: 'pear', balance: null, note: 0 },
    { id: 4, country: 'se', fruit: 'apple', balance: 4, note: false },
    { id: 5, country: 'se', fruit: 'pear', balance: 0, note: null }
];

function people(data: Row[] = rows()) {
    const ds = new Datasource<Row>({ key: 'id', fields: { balance: 'number' } });
    ds.setData(data);
    return ds;
}

/** the group rows of the displayed rows, by id */
function groupsById(ds: Datasource<Row>) {
    return new Map(
        ds
            .getRows()
            .filter(isGroupRow)
            .map((row) => [row.__groupID, row])
    );
}

describe('aggregate - the functions', () => {
    it('expect sum, avg, min, max and count over the rows the filter lets through', () => {
        const ds = people();

        expect(ds.aggregate('balance', 'sum')).toBe(11.5);
        // 4 numbers: 10, -2.5, 4, 0 - the null is left out
        expect(ds.aggregate('balance', 'avg')).toBe(11.5 / 4);
        expect(ds.aggregate('balance', 'min')).toBe(-2.5);
        expect(ds.aggregate('balance', 'max')).toBe(10);
        expect(ds.aggregate('balance', 'count')).toBe(4);
    });

    it('expect 0 to be a value: the smallest, and counted', () => {
        const ds = people([
            { id: 1, country: 'no', fruit: 'a', balance: 0 },
            { id: 2, country: 'no', fruit: 'a', balance: 5 }
        ]);

        expect(ds.aggregate('balance', 'min')).toBe(0);
        expect(ds.aggregate('balance', 'avg')).toBe(2.5);
        expect(ds.aggregate('balance', 'count')).toBe(2);
    });

    it('expect the largest of negative numbers to be negative, not 0', () => {
        const ds = people([
            { id: 1, country: 'no', fruit: 'a', balance: -5 },
            { id: 2, country: 'no', fruit: 'a', balance: -3 }
        ]);

        expect(ds.aggregate('balance', 'max')).toBe(-3);
        expect(ds.aggregate('balance', 'min')).toBe(-5);
    });

    it('expect count to count every value that is not blank, of any type: 0 and false too', () => {
        const ds = people();

        // 'a', 0, false - '' and null are blank
        expect(ds.aggregate('note', 'count')).toBe(3);
        expect(ds.aggregate('missing', 'count')).toBe(0);
    });

    it('expect sum, avg, min and max to leave out what is no number: text, a Date, NaN, Infinity', () => {
        const ds = people([
            { id: 1, country: 'no', fruit: 'a', balance: 2 },
            { id: 2, country: 'no', fruit: 'a', balance: '12' },
            { id: 3, country: 'no', fruit: 'a', balance: new Date(2026, 0, 1) },
            { id: 4, country: 'no', fruit: 'a', balance: Number.NaN },
            { id: 5, country: 'no', fruit: 'a', balance: Number.POSITIVE_INFINITY },
            { id: 6, country: 'no', fruit: 'a', balance: true },
            { id: 7, country: 'no', fruit: 'a', balance: 4 }
        ]);

        expect(ds.aggregate('balance', 'sum')).toBe(6);
        expect(ds.aggregate('balance', 'avg')).toBe(3);
        expect(ds.aggregate('balance', 'min')).toBe(2);
        expect(ds.aggregate('balance', 'max')).toBe(4);
        // count is about blanks only: every value here is one, NaN too
        expect(ds.aggregate('balance', 'count')).toBe(7);
    });

    it('expect no values: sum and count 0, avg, min and max null', () => {
        const ds = people([{ id: 1, country: 'no', fruit: 'a', balance: null }]);

        expect(ds.aggregate('balance', 'sum')).toBe(0);
        expect(ds.aggregate('balance', 'count')).toBe(0);
        expect(ds.aggregate('balance', 'avg')).toBeNull();
        expect(ds.aggregate('balance', 'min')).toBeNull();
        expect(ds.aggregate('balance', 'max')).toBeNull();
    });

    it('expect no rows: the same as no values', () => {
        const ds = people([]);

        expect(ds.aggregate('balance', 'sum')).toBe(0);
        expect(ds.aggregate('balance', 'avg')).toBeNull();
    });

    it('expect the average not to be rounded: the formatter formats it', () => {
        const ds = people([
            { id: 1, country: 'no', fruit: 'a', balance: 1 },
            { id: 2, country: 'no', fruit: 'a', balance: 1 },
            { id: 3, country: 'no', fruit: 'a', balance: 2 }
        ]);

        expect(ds.aggregate('balance', 'avg')).toBe(4 / 3);
        expect(ds.getFormatter('balance').format(ds.aggregate('balance', 'avg'))).toBe('1.3333333333333333');
    });

    it('expect the sum not to drift over many rows: compensated, 100 000 times 0.1 is 10000', () => {
        const data = Array.from({ length: 100_000 }, (_, i) => ({ id: i, country: 'no', fruit: 'a', balance: 0.1 }));
        const ds = people(data);

        // added up one by one it is 10000.000000018848
        let plain = 0;
        for (const row of data) {
            plain += row.balance;
        }
        expect(plain).not.toBe(10000);

        expect(ds.aggregate('balance', 'sum')).toBe(10000);
        expect(ds.aggregate('balance', 'avg')).toBe(0.1);
    });

    it('expect a function that is not one to throw a TypeError naming the functions', () => {
        const ds = people();

        expect(() => ds.aggregate('balance', 'total' as any)).toThrow(TypeError);
        expect(() => ds.aggregate('balance', 'total' as any)).toThrow(
            /'total' is no aggregate function, use 'sum', 'avg', 'min', 'max', 'count'/
        );
    });
});

describe('aggregate - which rows', () => {
    it('expect the filter to apply', () => {
        const ds = people();
        ds.filter(where('country', 'EQUAL', 'se'));

        expect(ds.aggregate('balance', 'sum')).toBe(4);
        expect(ds.aggregate('balance', 'count')).toBe(2);
    });

    it('expect the changed rows only (filterChangedOnly) to apply too', () => {
        const ds = people();
        ds.getAllData()[0].balance = 100;
        ds.filterChangedOnly(true);

        expect(ds.aggregate('balance', 'sum')).toBe(100);
    });

    it('expect grouped and collapsed: every row the filter lets through, not only the displayed ones', () => {
        const ds = people();
        ds.group([{ attribute: 'country', title: 'Country' }]);
        ds.collapseGroup();

        expect(ds.getRows().every(isGroupRow)).toBe(true);
        expect(ds.aggregate('balance', 'sum')).toBe(11.5);
    });

    it('expect rows marked for deletion to count until they are saved', () => {
        const ds = people();
        ds.markForDeletion(ds.getAllData()[0]);

        expect(ds.aggregate('balance', 'sum')).toBe(11.5);

        ds.clearMarkedForDeletion();
        expect(ds.aggregate('balance', 'sum')).toBe(1.5);
    });

    it('expect a list of rows: those rows, e.g. the selected ones', () => {
        const ds = people();
        ds.select(1);
        ds.getSelection().highlightRow({ ctrlKey: true } as MouseEvent, 3);

        expect(ds.getSelectedRows().map((row) => row.id)).toEqual([1, 4]);
        expect(ds.aggregate('balance', 'sum', ds.getSelectedRows())).toBe(14);
        expect(ds.aggregate('balance', 'sum', [])).toBe(0);
    });
});

describe('aggregate - group rows', () => {
    function grouped() {
        const ds = people();
        ds.group([
            { attribute: 'country', title: 'Country' },
            { attribute: 'fruit', title: 'Fruit' }
        ]);
        return ds;
    }

    it('expect a group row: the rows of its sub groups, collapsed ones included', () => {
        const ds = grouped();
        // every group collapsed: the sub groups are not displayed
        const groups = groupsById(ds);
        expect([...groups.keys()]).toEqual(['no', 'se']);

        expect(ds.aggregate('balance', 'sum', groups.get('no'))).toBe(7.5);
        expect(ds.aggregate('balance', 'count', groups.get('no'))).toBe(2);
        expect(ds.aggregate('balance', 'avg', groups.get('no'))).toBe(3.75);
        expect(ds.aggregate('balance', 'min', groups.get('se'))).toBe(0);
        expect(ds.aggregate('balance', 'max', groups.get('se'))).toBe(4);
    });

    it('expect a sub group row: its own rows', () => {
        const ds = grouped();
        ds.expandGroup();
        const groups = groupsById(ds);

        expect([...groups.keys()]).toEqual(['no', 'no-apple', 'no-pear', 'se', 'se-apple', 'se-pear']);
        expect(ds.aggregate('balance', 'sum', groups.get('no-apple'))).toBe(7.5);
        // its one row has no balance
        expect(ds.aggregate('balance', 'sum', groups.get('no-pear'))).toBe(0);
        expect(ds.aggregate('balance', 'avg', groups.get('no-pear'))).toBeNull();
        expect(ds.aggregate('balance', 'sum', groups.get('se-pear'))).toBe(0);
        expect(ds.aggregate('balance', 'count', groups.get('se-pear'))).toBe(1);
    });

    it('expect the filter to apply to the groups', () => {
        const ds = grouped();
        ds.filter(where('fruit', 'EQUAL', 'apple'));

        const groups = groupsById(ds);
        expect(ds.aggregate('balance', 'sum', groups.get('no'))).toBe(7.5);
        expect(ds.aggregate('balance', 'sum', groups.get('se'))).toBe(4);
    });

    it('expect the value to follow an edit right away, before rows-changed is sent', () => {
        const ds = grouped();
        const no = groupsById(ds).get('no') as GroupRow;
        expect(ds.aggregate('balance', 'sum', no)).toBe(7.5);

        // an edit does not group again: the same group row, its value is not kept
        ds.getAllData()[0].balance = 20;
        expect(groupsById(ds).get('no')).toBe(no);
        expect(ds.aggregate('balance', 'sum', no)).toBe(17.5);
        expect(ds.aggregate('balance', 'max', no)).toBe(20);
    });

    it('expect the value to follow undo and redo', () => {
        const ds = grouped();
        const no = groupsById(ds).get('no') as GroupRow;
        ds.getAllData()[1].balance = 7.5;
        expect(ds.aggregate('balance', 'sum', no)).toBe(17.5);

        ds.undo();
        expect(ds.aggregate('balance', 'sum', no)).toBe(7.5);

        ds.redo();
        expect(ds.aggregate('balance', 'sum', no)).toBe(17.5);
    });

    it('expect the value to follow an upsert, which keeps the group rows when only values changed', () => {
        const ds = grouped();
        ds.expandGroup();
        const se = groupsById(ds).get('se') as GroupRow;
        expect(ds.aggregate('balance', 'sum', se)).toBe(4);

        ds.upsert([{ id: 5, balance: 6 }]);

        const after = groupsById(ds).get('se') as GroupRow;
        expect(ds.aggregate('balance', 'sum', after)).toBe(10);
        // the group row given before still answers for its rows
        expect(ds.aggregate('balance', 'sum', se)).toBe(10);
    });

    it('expect an upsert that moves a row to another group to change both groups', () => {
        const ds = grouped();
        ds.upsert([{ id: 4, country: 'no' }]);

        const groups = groupsById(ds);
        expect(ds.aggregate('balance', 'sum', groups.get('no'))).toBe(11.5);
        expect(ds.aggregate('balance', 'sum', groups.get('se'))).toBe(0);
        expect(ds.aggregate('balance', 'count', groups.get('se'))).toBe(1);
    });

    it('expect a change through another datasource on the same container to be seen', () => {
        const container = new DataContainer('id');
        const ds = new Datasource<Row>({ container, fields: { balance: 'number' } });
        const other = new Datasource<Row>({ container, fields: { balance: 'number' } });
        ds.setData(rows());
        ds.group([{ attribute: 'country', title: 'Country' }]);
        const no = groupsById(ds).get('no') as GroupRow;
        expect(ds.aggregate('balance', 'sum', no)).toBe(7.5);

        other.getAllData()[0].balance = 0;

        expect(ds.aggregate('balance', 'sum', no)).toBe(-2.5);
    });

    it('expect each function and field to be kept apart', () => {
        const ds = grouped();
        const no = groupsById(ds).get('no') as GroupRow;

        expect(ds.aggregate('balance', 'sum', no)).toBe(7.5);
        expect(ds.aggregate('balance', 'count', no)).toBe(2);
        expect(ds.aggregate('note', 'count', no)).toBe(2);
        expect(ds.aggregate('balance', 'sum', no)).toBe(7.5);
    });
});

describe('aggregate - the filtered rows are kept', () => {
    it('expect the rows not to be read again when asked again, nothing changed', () => {
        let reads = 0;
        const row = { id: 1, country: 'no', fruit: 'a' };
        Object.defineProperty(row, 'balance', {
            enumerable: true,
            get: () => {
                reads++;
                return 5;
            }
        });
        const ds = people([row as Row]);

        expect(ds.aggregate('balance', 'sum')).toBe(5);
        expect(ds.aggregate('balance', 'sum')).toBe(5);
        expect(reads).toBe(1);
        // another function or field is its own
        expect(ds.aggregate('balance', 'max')).toBe(5);
        expect(reads).toBe(2);
    });

    it('expect an edit of another field to keep it, an edit of the field to compute it again', () => {
        let reads = 0;
        const data = [1, 2].map((id) => {
            const row = { id, country: 'no', fruit: 'a', note: 'x' };
            let balance = id * 10;
            Object.defineProperty(row, 'balance', {
                enumerable: true,
                get: () => {
                    reads++;
                    return balance;
                },
                set: (value) => {
                    balance = value;
                }
            });
            return row as Row;
        });
        const ds = people(data);
        ds.group([{ attribute: 'country', title: 'Country' }]);
        const group = ds.getRows()[0] as GroupRow;
        const both = () => [ds.aggregate('balance', 'sum'), ds.aggregate('balance', 'sum', group)];

        expect(both()).toEqual([30, 30]);
        const afterFirst = reads;
        ds.getAllData()[0].note = 'changed';
        expect(both()).toEqual([30, 30]);
        expect(reads).toBe(afterFirst);

        ds.getAllData()[0].balance = 15;
        expect(both()).toEqual([35, 35]);
        expect(reads).toBeGreaterThan(afterFirst);
    });

    it('expect the value to follow every change of the rows: the same as computed over getDataRows()', () => {
        const ds = people();
        const steps: [string, () => void][] = [
            ['nothing', () => {}],
            ['sort', () => ds.sort({ attribute: 'balance', ascending: false })],
            ['filter', () => ds.filter(where('country', 'EQUAL', 'no'))],
            ['no filter', () => ds.filter(null)],
            ['an edit', () => (ds.getAllData()[0].balance = 100)],
            ['undo', () => ds.undo()],
            ['addNewEmpty', () => ds.addNewEmpty({ balance: 7 }, { scrollTo: false })],
            ['removeData', () => ds.removeData(ds.getAllData()[1])],
            ['setData add', () => ds.setData([{ id: 9, country: 'se', fruit: 'a', balance: 3 }], { add: true })],
            ['upsert a value', () => ds.upsert([{ id: 9, balance: 30 }])],
            ['upsert adds', () => ds.upsert([{ id: 10, country: 'se', fruit: 'a', balance: 1 }])],
            [
                'upsert replaces a row with another, the same number of rows',
                () => {
                    const all = ds.getAllData().filter((row) => row.id !== 10 && row.__rowState === undefined);
                    ds.upsert([...all.map((row) => ({ id: row.id })), { id: 11, country: 'se', fruit: 'b', balance: 1000 }], {
                        removeMissing: true
                    });
                }
            ],
            ['markForDeletion', () => ds.markForDeletion(ds.getAllData()[0])],
            ['clearMarkedForDeletion', () => ds.clearMarkedForDeletion()],
            ['filterChangedOnly', () => ds.filterChangedOnly(true)],
            ['filterChangedOnly off', () => ds.filterChangedOnly(false)],
            ['group and collapse', () => ds.group([{ attribute: 'country', title: 'Country' }])],
            ['expand', () => ds.expandGroup()],
            ['acceptChanges', () => ds.acceptChanges()],
            ['setData', () => ds.setData(rows())],
            [
                'resetData after an edit',
                () => {
                    ds.getAllData()[2].balance = 50;
                    ds.resetData();
                }
            ]
        ];
        const sums: number[] = [];
        for (const [name, step] of steps) {
            step();
            const computed = ds.getDataRows().slice();
            expect(ds.aggregate('balance', 'sum'), name).toBe(ds.aggregate('balance', 'sum', computed));
            expect(ds.aggregate('balance', 'count'), name).toBe(ds.aggregate('balance', 'count', computed));
            sums.push(ds.aggregate('balance', 'sum') ?? Number.NaN);
        }
        // a sanity check: the steps did change the sum
        expect(new Set(sums).size).toBeGreaterThan(5);
    });
});

describe('aggregate - performance', () => {
    it('expect 100 000 rows in 1000 groups: every group and the totals of three fields in well under a second', () => {
        const data = Array.from({ length: 100_000 }, (_, i) => ({
            id: i,
            country: `c${i % 1000}`,
            fruit: `f${i % 7}`,
            balance: (i % 977) * 1.25,
            note: i % 3 ? 'x' : null
        }));
        const ds = people(data);
        ds.group([{ attribute: 'country', title: 'Country' }]);
        const groups = ds.getRows().filter(isGroupRow);
        expect(groups).toHaveLength(1000);

        const start = performance.now();
        for (const group of groups) {
            ds.aggregate('balance', 'sum', group);
            ds.aggregate('balance', 'avg', group);
            ds.aggregate('note', 'count', group);
        }
        ds.aggregate('balance', 'sum');
        ds.aggregate('balance', 'avg');
        ds.aggregate('note', 'count');
        const first = performance.now() - start;

        // asked again: kept on the group rows
        const againStart = performance.now();
        for (const group of groups) {
            ds.aggregate('balance', 'sum', group);
        }
        const again = performance.now() - againStart;

        console.log(
            `aggregate: 1000 groups x 3 + totals x 3 over 100 000 rows ${first.toFixed(1)}ms, again ${again.toFixed(2)}ms`
        );
        // a generous bound for a slow CI machine; on a laptop it is around 50ms
        expect(first).toBeLessThan(1000);
        expect(again).toBeLessThan(first);
    });
});

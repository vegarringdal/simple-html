import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * v6: no positional booleans in the public API of Datasource and DataContainer. Each option is
 * tested with its default and with the option set, and the `all` flags are their own methods.
 */

interface Row {
    id: number;
    name: string;
    country: string;
}

const rows = (): Row[] => [
    { id: 1, name: 'c', country: 'no' },
    { id: 2, name: 'a', country: 'se' },
    { id: 3, name: 'b', country: 'no' }
];

const datasource = () => {
    const ds = new Datasource<Row>({ key: 'id' });
    ds.setData(rows());
    return ds;
};

const names = (ds: Datasource<Row>) => ds.getDataRows().map((row) => row.name);

/** the names of the events the datasource sends while fn runs */
const eventsDuring = (ds: Datasource<Row>, fn: () => void) => {
    const sent: string[] = [];
    const offs = (['select', 'selection-change', 'collection-changed', 'collection-filtered'] as const).map((type) =>
        ds.on(type, () => sent.push(type))
    );
    fn();
    for (const off of offs) {
        off();
    }
    return sent;
};

describe('options objects - setData', () => {
    it('expect the rows to replace the rows there are by default', () => {
        const ds = datasource();
        ds.setData([{ id: 4, name: 'd', country: 'dk' }]);
        expect(names(ds)).toEqual(['d']);
    });

    it('expect { add: true } to add them', () => {
        const ds = datasource();
        ds.setData([{ id: 4, name: 'd', country: 'dk' }], { add: true });
        expect(names(ds)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('expect the filter to run on the rows by default', () => {
        const ds = datasource();
        ds.filter(where('country', 'EQUAL', 'no'));
        ds.setData([{ id: 4, name: 'd', country: 'dk' }], { add: true });
        expect(names(ds)).toEqual(['c', 'b']);
    });

    it('expect { refilter: false } to show every row set', () => {
        const ds = datasource();
        ds.filter(where('country', 'EQUAL', 'no'));
        ds.setData([{ id: 4, name: 'd', country: 'dk' }], { add: true, refilter: false });
        expect(names(ds)).toEqual(['c', 'b', 'd']);
    });

    it('expect the collection-changed event to say whether rows were added', () => {
        const ds = datasource();
        const added: (boolean | undefined)[] = [];
        ds.on('collection-changed', (data) => added.push(data.added));
        ds.setData(rows());
        ds.setData(rows(), { add: true });
        expect(added).toEqual([false, true]);
    });
});

describe('options objects - sort and setOrderBy', () => {
    it('expect sort to replace the sort by default', () => {
        const ds = datasource();
        ds.sort({ attribute: 'country', ascending: true });
        ds.sort({ attribute: 'name', ascending: true });
        expect(ds.getOrderBy()).toEqual([{ attribute: 'name', ascending: true }]);
        expect(names(ds)).toEqual(['a', 'b', 'c']);
    });

    it('expect sort with { add: true } to add to the sort', () => {
        const ds = datasource();
        ds.sort({ attribute: 'country', ascending: false });
        ds.sort({ attribute: 'name', ascending: true }, { add: true });
        expect(ds.getOrderBy()).toEqual([
            { attribute: 'country', ascending: false },
            { attribute: 'name', ascending: true }
        ]);
        expect(names(ds)).toEqual(['a', 'b', 'c']);
    });

    it('expect setOrderBy to replace by default and add with { add: true }, without sorting', () => {
        const ds = datasource();
        ds.setOrderBy({ attribute: 'country', ascending: true });
        ds.setOrderBy({ attribute: 'name', ascending: false }, { add: true });
        expect(ds.getOrderBy()).toEqual([
            { attribute: 'country', ascending: true },
            { attribute: 'name', ascending: false }
        ]);
        expect(names(ds)).toEqual(['c', 'a', 'b']);

        ds.setOrderBy({ attribute: 'name', ascending: true });
        expect(ds.getOrderBy()).toEqual([{ attribute: 'name', ascending: true }]);
    });
});

describe('options objects - group', () => {
    it('expect the groups to replace the grouping by default', () => {
        const ds = datasource();
        ds.group([{ attribute: 'country', title: 'Country' }]);
        ds.group([{ attribute: 'name', title: 'Name' }]);
        expect(ds.getGrouping()).toEqual([{ attribute: 'name', title: 'Name' }]);
    });

    it('expect { add: true } to add them after the grouping there is', () => {
        const ds = datasource();
        ds.group([{ attribute: 'country', title: 'Country' }]);
        ds.group([{ attribute: 'name', title: 'Name' }], { add: true });
        expect(ds.getGrouping()).toEqual([
            { attribute: 'country', title: 'Country' },
            { attribute: 'name', title: 'Name' }
        ]);
        ds.expandGroup(); // more than one level starts collapsed
        expect(
            ds
                .getRows()
                .filter(isGroupRow)
                .map((row) => row.__groupID)
        ).toEqual(['no', 'no-b', 'no-c', 'se', 'se-a']);
    });
});

describe('options objects - select and deselectAll', () => {
    it('expect select to not send the select event by default', () => {
        const ds = datasource();
        expect(eventsDuring(ds, () => ds.select(2))).toEqual(['selection-change']);
        expect(ds.currentEntity).toBe(ds.getRow(1));
    });

    it('expect select with { notify: true } to send it, so the grid scrolls to the row', () => {
        const ds = datasource();
        const selected: number[] = [];
        ds.on('select', (data) => selected.push(data.row));
        ds.select(2, { notify: true });
        expect(selected).toEqual([1]);
    });

    it('expect deselectAll to not send selection-change by default', () => {
        const ds = datasource();
        ds.selectAll();
        expect(eventsDuring(ds, () => ds.deselectAll())).toEqual([]);
        expect(ds.getSelectedRows()).toEqual([]);
    });

    it('expect deselectAll with { notify: true } to send it', () => {
        const ds = datasource();
        ds.selectAll();
        expect(eventsDuring(ds, () => ds.deselectAll({ notify: true }))).toEqual(['selection-change']);
        expect(ds.getSelectedRows()).toEqual([]);
    });
});

describe('options objects - addNewEmpty', () => {
    it('expect the new row to be selected and current by default', () => {
        const ds = datasource();
        expect(eventsDuring(ds, () => ds.addNewEmpty({ name: 'new' }))).toContain('select');
        expect(ds.currentEntity).toBe(ds.getDataRows()[3]);
        expect(ds.getSelectedRows().map((row) => row.name)).toEqual(['new']);
    });

    it('expect { scrollTo: false } to leave the selection and current entity as they are', () => {
        const ds = datasource();
        ds.select(1);
        expect(eventsDuring(ds, () => ds.addNewEmpty({ name: 'new' }, { scrollTo: false }))).not.toContain('select');
        expect(ds.currentEntity).toBe(ds.getDataRows()[0]);
        expect(ds.getSelectedRows().map((row) => row.name)).toEqual(['c']);
        expect(names(ds)).toEqual(['c', 'a', 'b', 'new']);
    });

    it('expect a typed datasource to take part of a row', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'new' }, { scrollTo: false });
        expect(ds.getChanges().newEntities).toEqual([{ name: 'new', id: ds.getDataRows()[3].id }]);
    });
});

describe('options objects - markForDeletion and markAllForDeletion', () => {
    it('expect markForDeletion to take one row or a list, the rows stay displayed', () => {
        const ds = datasource();
        const [c, a, b] = ds.getDataRows();
        ds.markForDeletion(c);
        ds.markForDeletion([a]);
        expect(ds.getMarkedForDeletion()).toEqual([c, a]);
        expect(ds.getDataRows().map((row) => row.__rowState)).toEqual(['D', 'D', undefined]);
        expect(b.__rowState).toBeUndefined();
    });

    it('expect markAllForDeletion to mark every row, and resetData to unmark them', () => {
        const ds = datasource();
        expect(eventsDuring(ds, () => ds.markAllForDeletion())).toEqual(['collection-filtered']);
        expect(ds.getDataRows().map((row) => row.__rowState)).toEqual(['D', 'D', 'D']);
        expect(ds.getChanges().deletedEntities).toEqual(rows());

        ds.resetData();
        expect(ds.getChanges().deletedEntities).toEqual([]);
        expect(ds.getDataRows().map((row) => row.__rowState)).toEqual([undefined, undefined, undefined]);
    });
});

describe('options objects - removeData and removeAllData', () => {
    it('expect removeData to rebuild the displayed rows by default', () => {
        const ds = datasource();
        const removed = ds.removeData(ds.getDataRows()[0]);
        expect(removed.map((row) => row.name)).toEqual(['c']);
        expect(names(ds)).toEqual(['a', 'b']);
        expect(ds.length()).toEqual(2);
    });

    it('expect { refilter: false } to leave the displayed rows as they are', () => {
        const ds = datasource();
        ds.removeData(ds.getDataRows()[0], { refilter: false });
        expect(ds.getAllData().map((row) => row.name)).toEqual(['a', 'b']);
        expect(ds.length()).toEqual(3);

        ds.removeData(ds.getDataRows()[1]); // the last one rebuilds them
        expect(names(ds)).toEqual(['b']);
    });

    it('expect removeAllData to remove every row and send collection-changed with data null', () => {
        const ds = datasource();
        const sent: unknown[] = [];
        ds.on('collection-changed', (data) => sent.push(data));

        const removed = ds.removeAllData();
        expect(removed.map((row) => row.name)).toEqual(['c', 'a', 'b']);
        expect(ds.getAllData()).toEqual([]);
        expect(ds.getRows()).toEqual([]);
        expect(sent).toEqual([{ removed: true, info: 'removeData', data: null }]);
    });

    it('expect removeAllData to not be a deletion: getChanges and resetData do not see the rows', () => {
        const ds = datasource();
        ds.removeAllData();
        expect(ds.getChanges().deletedEntities).toEqual([]);
        ds.resetData();
        expect(ds.getAllData()).toEqual([]);
    });
});

describe('options objects - getRows, getDataRows and length', () => {
    it('expect getDataRows to be the data rows, the rows of collapsed groups included', () => {
        const ds = datasource();
        ds.group([{ attribute: 'country', title: 'Country' }]);
        ds.collapseGroup();

        expect(ds.getRows().every(isGroupRow)).toBe(true);
        expect(ds.length()).toEqual(2);
        expect(ds.length()).toEqual(ds.getRows().length);
        expect(ds.getDataRows().map((row) => row.name)).toEqual(['c', 'b', 'a']);
    });

    it('expect getDataRows to be the rows the filter lets through', () => {
        const ds = datasource();
        ds.filter(where('country', 'EQUAL', 'no'));
        expect(ds.getDataRows().map((row) => row.name)).toEqual(['c', 'b']);
    });
});

describe('options objects - DataContainer', () => {
    it('expect setData to replace by default, and { add, isNew } to add new rows', () => {
        const container = new DataContainer('id');
        container.setData(rows());
        container.setData([{ id: 4, name: 'd', country: 'dk' }], { add: true, isNew: true });
        expect(container.getDataSet().map((row) => row.__rowState)).toEqual([undefined, undefined, undefined, 'N']);

        container.setData([{ id: 5, name: 'e', country: 'fi' }]);
        expect(container.getDataSet().map((row) => [row.name, row.__rowState])).toEqual([['e', undefined]]);
    });

    it('expect markAllForDeletion to drop the new rows and mark the rest', () => {
        const container = new DataContainer('id');
        container.setData(rows());
        container.setData([{ id: 4, name: 'd', country: 'dk' }], { add: true, isNew: true });
        container.markAllForDeletion();
        expect(container.getDataSet().map((row) => [row.name, row.__rowState])).toEqual([
            ['c', 'D'],
            ['a', 'D'],
            ['b', 'D']
        ]);
    });

    it('expect removeData to take one row or a list, and removeAllData to remove every row', () => {
        const container = new DataContainer('id');
        container.setData(rows());
        const [c, a] = container.getDataSet();
        expect(container.removeData(c)).toEqual([c]);
        expect(container.removeData([a])).toEqual([a]);
        expect(container.removeAllData().map((row) => row.name)).toEqual(['b']);
        expect(container.getDataSet()).toEqual([]);
    });
});

describe('a v5 call with a positional boolean throws instead of quietly doing something else', () => {
    // what plain javascript (no type check) would still send after upgrading
    const v5Call = (target: object, method: string, args: unknown[]) => () =>
        Reflect.apply(Reflect.get(target, method) as (...a: unknown[]) => unknown, target, args);

    const rows = () => [{ a: 1 }, { a: 2 }];

    it.each([
        ['setData', [rows(), true]],
        ['addNewEmpty', [{}, false]],
        ['sort', [{ attribute: 'a', ascending: true }, true]],
        ['setOrderBy', [{ attribute: 'a', ascending: true }, true]],
        ['group', [[{ attribute: 'a', title: 'a' }], true]],
        ['deselectAll', [true]],
        ['select', [0, true]],
        ['removeData', [null, true]],
        ['markForDeletion', [null, true]]
    ])('expect datasource.%s with a boolean to throw a TypeError', (method, args) => {
        const datasource = new Datasource();
        datasource.setData(rows());

        expect(v5Call(datasource, method, args)).toThrow(TypeError);
    });

    it.each([
        ['setData', [rows(), true]],
        ['markForDeletion', [null, true]],
        ['removeData', [null, true]]
    ])('expect dataContainer.%s with a boolean to throw a TypeError', (method, args) => {
        const container = new DataContainer();
        container.setData(rows());

        expect(v5Call(container, method, args)).toThrow(TypeError);
    });

    it('expect the error to say how to write it in v6', () => {
        const datasource = new Datasource();

        expect(v5Call(datasource, 'setData', [rows(), true])).toThrow('setData(rows, { add: true })');
    });

    it('expect the v6 calls to still work', () => {
        const datasource = new Datasource();
        datasource.setData(rows());
        datasource.setData(rows(), { add: true });

        expect(datasource.getDataRows().length).toEqual(4);
    });
});

import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { type Entity, type GroupRow, isGroupRow } from '../entity';

/**
 * Group rows are their own type (GroupRow), not entities. getRows() mixes them with the data rows
 * when grouped, getRows(true), the selection and editing never see one.
 */

interface Row {
    country: string;
    fruit: string;
    v: number;
}

const rows = (): Row[] => [
    { country: 'no', fruit: 'apple', v: 1 },
    { country: 'no', fruit: 'apple', v: 2 },
    { country: 'no', fruit: 'pear', v: 3 },
    { country: 'se', fruit: 'apple', v: 4 }
];

/**
 * grouped on country, all expanded. Displayed: [G:no, 1, 2, 3, G:se, 4]
 */
const grouped = () => {
    const ds = new Datasource<Row>();
    ds.setData(rows());
    ds.group([{ attribute: 'country', title: 'country' }]);
    ds.expandGroup();
    return ds;
};

/**
 * grouped on country and fruit, all expanded.
 * Displayed: [G:no, G:no-apple, 1, 2, G:no-pear, 3, G:se, G:se-apple, 4]
 */
const groupedTwoLevels = () => {
    const ds = new Datasource<Row>();
    ds.setData(rows());
    ds.group([
        { attribute: 'country', title: 'country' },
        { attribute: 'fruit', title: 'fruit' }
    ]);
    ds.expandGroup();
    return ds;
};

const shown = (ds: Datasource<Row>) => ds.getRows().map((row) => (isGroupRow(row) ? `G:${row.__groupID}` : row.v));

describe('group rows - isGroupRow', () => {
    it('expect true for every group row and false for every data row', () => {
        const ds = groupedTwoLevels();
        expect(shown(ds)).toEqual(['G:no', 'G:no-apple', 1, 2, 'G:no-pear', 3, 'G:se', 'G:se-apple', 4]);

        const groupRows = ds.getRows().filter(isGroupRow);
        expect(groupRows.map((row) => row.__groupID)).toEqual(['no', 'no-apple', 'no-pear', 'se', 'se-apple']);

        const dataRows = ds.getRows().filter((row) => !isGroupRow(row));
        expect(dataRows.map((row) => (row as Entity).v)).toEqual([1, 2, 3, 4]);
    });

    it('expect false for every row when not grouped', () => {
        const ds = new Datasource<Row>();
        ds.setData(rows());
        expect(ds.getRows().some(isGroupRow)).toBe(false);
    });

    it('expect false for null, undefined and a row out of range', () => {
        const ds = grouped();
        expect(isGroupRow(null)).toBe(false);
        expect(isGroupRow(undefined)).toBe(false);
        expect(isGroupRow(ds.getRow(100))).toBe(false);
    });

    it('expect false for a data row whose own data has a __group field', () => {
        // the row proxy keeps the __group* names off the user's data
        const ds = new Datasource();
        ds.setData([{ __group: true, __groupID: 'x', v: 1 }]);
        expect(isGroupRow(ds.getRow(0))).toBe(false);
    });
});

describe('group rows - the GroupRow fields', () => {
    it('expect a group row to have every group field', () => {
        const ds = grouped();
        const row = ds.getRow(0);
        expect(isGroupRow(row)).toBe(true);
        const group = row as GroupRow;

        expect(group.__group).toBe(true);
        expect(group.__groupID).toEqual('no');
        expect(group.__groupName).toEqual('Country: no');
        expect(group.__groupLvl).toEqual(0);
        expect(group.__groupTotal).toEqual(3);
        expect(group.__groupExpanded).toBe(true);
        expect(group.__groupChildren.map((child) => (child as Entity).v)).toEqual([1, 2, 3]);
    });

    it('expect a group row to hold its sub groups, and count the data rows below them', () => {
        const ds = groupedTwoLevels();
        const group = ds.getRow(0) as GroupRow;

        expect(group.__groupTotal).toEqual(3);
        expect(group.__groupChildren.every(isGroupRow)).toBe(true);
        expect(group.__groupChildren.map((child) => (child as GroupRow).__groupID)).toEqual(['no-apple', 'no-pear']);
        expect((group.__groupChildren[0] as GroupRow).__groupLvl).toEqual(1);
    });

    it('expect __groupExpanded to follow collapse and expand', () => {
        const ds = grouped();
        ds.collapseGroup('no');
        expect((ds.getRow(0) as GroupRow).__groupExpanded).toBe(false);
        ds.expandGroup('no');
        expect((ds.getRow(0) as GroupRow).__groupExpanded).toBe(true);
    });
});

describe('group rows - getRows(true) has data rows only', () => {
    it('expect no group rows when grouped and expanded', () => {
        const ds = groupedTwoLevels();
        expect(ds.getRows(true).some(isGroupRow)).toBe(false);
        expect(ds.getRows(true).map((row) => row.v)).toEqual([1, 2, 3, 4]);
    });

    it('expect no group rows, and the rows of collapsed groups, when collapsed', () => {
        const ds = groupedTwoLevels();
        ds.collapseGroup();
        expect(ds.getRows().every(isGroupRow)).toBe(true);
        expect(ds.getRows(true).some(isGroupRow)).toBe(false);
        expect(ds.getRows(true).map((row) => row.v)).toEqual([1, 2, 3, 4]);
    });

    it('expect no group rows after a filter and a sort while grouped', () => {
        const ds = grouped();
        ds.filter({ attribute: 'v', operator: 'GREATER_THAN', value: 1, valueType: 'VALUE', attributeType: 'number' });
        ds.sort({ attribute: 'v', ascending: false });
        expect(ds.getRows().some(isGroupRow)).toBe(true);
        expect(ds.getRows(true).some(isGroupRow)).toBe(false);
        expect(ds.getRows(true).map((row) => row.v)).toEqual([3, 2, 4]);
    });

    it('expect a row added while grouped to be a data row', () => {
        const ds = grouped();
        ds.addNewEmpty({ country: 'dk', fruit: 'kiwi', v: 5 });
        expect(ds.getRows(true).some(isGroupRow)).toBe(false);
        expect(ds.getRows(true).map((row) => row.v)).toContain(5);
    });
});

describe('group rows - selection and editing take data rows only', () => {
    it('expect getSelectedRows after selectAll to be the data rows', () => {
        const ds = groupedTwoLevels();
        ds.selectAll();
        const selected = ds.getSelectedRows();
        expect(selected.some(isGroupRow)).toBe(false);
        expect(selected.map((row) => row.v)).toEqual([1, 2, 3, 4]);
    });

    it('expect a range over group rows to select the data rows only', () => {
        const ds = groupedTwoLevels();
        ds.getSelection().selectRowRange(0, ds.length() - 1);
        expect(ds.getSelectedRows().map((row) => row.v)).toEqual([1, 2, 3, 4]);
        expect(ds.getSelection().getSelectedKeys()).not.toContain(undefined);
    });

    it('expect markForDeletion of the selected rows to leave the group rows alone', () => {
        const ds = grouped();
        ds.selectAll();
        ds.markForDeletion(ds.getSelectedRows());
        expect(ds.getMarkedForDeletion().map((row) => row.v)).toEqual([1, 2, 3, 4]);
        expect(ds.getMarkedForDeletion().some(isGroupRow)).toBe(false);
    });

    it('expect editing a selected row to not touch the group rows', () => {
        const ds = grouped();
        ds.selectAll();
        ds.getSelectedRows().forEach((row) => {
            row.fruit = 'banana';
        });
        const groupRows = ds.getRows().filter(isGroupRow);
        expect(groupRows).toHaveLength(2);
        expect(groupRows.some((row) => 'fruit' in row)).toBe(false);
        expect(ds.getChanges().modifiedEntities).toHaveLength(4);
    });
});

describe('group rows - currentEntity', () => {
    it('expect select, selectNext and clicking a group row to never make a group row current', () => {
        const ds = grouped();
        ds.select(1);
        expect(isGroupRow(ds.currentEntity)).toBe(false);
        ds.selectNext();
        ds.selectNext();
        ds.selectNext(); // past the G:se row
        expect(isGroupRow(ds.currentEntity)).toBe(false);
        expect((ds.currentEntity as Row).v).toEqual(4);
        ds.getSelection().highlightRow({} as MouseEvent, 4); // G:se
        expect((ds.currentEntity as Row).v).toEqual(4);
    });

    it('expect setRowAsCurrentEntity with a group row index to make the group row current', () => {
        // documented: currentEntity is typed EntityUnion<T> | GroupRow | null for this
        const ds = grouped();
        ds.setRowAsCurrentEntity(0);
        const current = ds.currentEntity;
        expect(isGroupRow(current)).toBe(true);
        expect(isGroupRow(current) && current.__groupID).toEqual('no');
        expect(ds.getSelectedRows()).toEqual([]);
    });
});

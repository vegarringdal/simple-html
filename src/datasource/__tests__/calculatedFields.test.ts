import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalculatedField } from '../calculatedField';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { Entity } from '../entity';
import { isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * The calculated fields of the datasource (CalculatedField, `__setCalculatedField()` - the grid's
 * calculated columns): the rows' proxies answer a read of one with its value, computed then. So it is
 * no edit and never stored - not in getChanges(), JSON or Object.keys() - always the value of the row as
 * it is after an edit, undo, upsert or resetData(); the filter, the sort, the grouping and the aggregates
 * read it as any field; a kept aggregate is computed again when a field it uses changes, and `rows-changed`
 * names it with the field.
 */

afterEach(() => {
    vi.useRealTimers();
});

/** price * qty, a blank when either is: a calculated field as the grid makes one */
const total = (): CalculatedField => ({
    type: 'number',
    label: 'Total',
    value: (row: Entity) => (typeof row.price === 'number' && typeof row.qty === 'number' ? row.price * row.qty : null),
    uses: ['price', 'qty'],
    daily: false
});

const rows = () => [
    { id: 1, name: 'Ann', price: 10, qty: 3, group: 'a' },
    { id: 2, name: 'Bob', price: 2, qty: 4, group: 'b' },
    { id: 3, name: 'Cid', price: 5, qty: null, group: 'a' }
];

function make() {
    const datasource = new Datasource({ key: 'id', fields: { id: 'number', price: 'number', qty: 'number' } });
    datasource.setData(rows());
    datasource.__setCalculatedField('total', total());
    return datasource;
}

describe('calculated fields - the value of a row', () => {
    it('expect a read of it to be its value in the row now, nothing stored on the row', () => {
        const datasource = make();
        const [ann] = datasource.getAllData();

        expect(ann.total).toEqual(30);
        expect(Object.keys(ann)).toEqual(['id', 'name', 'price', 'qty', 'group']);
        expect(JSON.stringify(ann)).not.toContain('total');
        expect('total' in ann).toBe(false);
        ann.qty = 5;
        expect(ann.total).toEqual(50);
    });

    it('expect it never to be an edit: the row not edited by it, setting it does nothing', () => {
        const datasource = make();
        const [ann] = datasource.getAllData();

        ann.total = 999;
        expect(ann.total).toEqual(30);
        expect(ann.__rowState).toBeUndefined();
        expect(datasource.hasChanges()).toBe(false);
        expect(datasource.canUndo()).toBe(false);

        ann.price = 20;
        expect(datasource.getChanges().modifiedEntities).toEqual([{ id: 1, price: 20 }]);
    });

    it('expect undo, redo, resetData() and upsert() to give the value of the row as it is then', () => {
        const datasource = make();
        const [ann] = datasource.getAllData();

        ann.price = 20;
        expect(ann.total).toEqual(60);
        datasource.undo();
        expect(ann.total).toEqual(30);
        datasource.redo();
        expect(ann.total).toEqual(60);
        datasource.resetData();
        expect(ann.total).toEqual(30);
        datasource.upsert([{ id: 1, qty: 10 }]);
        expect(ann.total).toEqual(100);
        expect(datasource.hasChanges()).toBe(false);
    });

    it('expect getField() to give its type and label, the formatter of its type, no rules', () => {
        const datasource = make();

        expect(datasource.getField('total')).toMatchObject({
            name: 'total',
            type: 'number',
            label: 'Total',
            validate: [],
            multiline: false
        });
        expect(datasource.getFormatter('total').format(1.5)).toEqual('1.5');
        expect(datasource.__getFieldConfig('total')).toEqual({ type: 'number', label: 'Total' });
        expect(datasource.__getListedField('total')).toBeUndefined();
    });

    it('expect it taken out with null: the rows have no such field anymore', () => {
        const datasource = make();

        datasource.__setCalculatedField('total', null);

        expect(datasource.getAllData()[0].total).toBeUndefined();
        expect(datasource.getField('total').type).toEqual('text');
    });

    it('expect a calculated field to read another through the row', () => {
        const datasource = make();
        datasource.__setCalculatedField('double', {
            type: 'number',
            label: 'Double',
            value: (row) => (typeof row.total === 'number' ? row.total * 2 : null),
            uses: ['price', 'qty'],
            daily: false
        });

        expect(datasource.getAllData()[0].double).toEqual(60);
    });
});

describe('calculated fields - filter, sort, group, aggregate', () => {
    it('expect the filter, the sort and the grouping to read it as a field of its type', () => {
        const datasource = make();

        datasource.filter(where('total', 'GREATER_THAN', 10));
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Ann']);
        datasource.filter(where('total', 'IS_BLANK'));
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Cid']);
        datasource.filter(null);

        // a number: 8 before 30, not as text
        datasource.sort({ attribute: 'total', ascending: true });
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Cid', 'Bob', 'Ann']);

        datasource.group([{ attribute: 'total', title: 'Total' }]);
        expect(
            datasource
                .getRows()
                .filter(isGroupRow)
                .map((row) => row.__groupName)
        ).toEqual(['Total: blank', 'Total: 8', 'Total: 30']);
    });

    it('expect an aggregate kept until a field it uses changes - another field keeps it', () => {
        const datasource = make();
        const value = vi.fn(total().value);
        datasource.__setCalculatedField('total', { ...total(), value });

        expect(datasource.aggregate('total', 'sum')).toEqual(38);
        const reads = value.mock.calls.length;
        expect(datasource.aggregate('total', 'sum')).toEqual(38);
        expect(value.mock.calls.length).toEqual(reads);

        datasource.getAllData()[0].name = 'Anne';
        expect(datasource.aggregate('total', 'sum')).toEqual(38);
        expect(value.mock.calls.length).toEqual(reads);

        datasource.getAllData()[0].qty = 4;
        expect(datasource.aggregate('total', 'sum')).toEqual(48);
        // a new field of the same name: computed again
        datasource.__setCalculatedField('total', { ...total(), value: () => 1 });
        expect(datasource.aggregate('total', 'sum')).toEqual(3);
    });

    it('expect an aggregate of a field that uses TODAY() to be computed again the next day', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 10, 22, 23, 0));
        const datasource = make();
        datasource.__setCalculatedField('day', {
            type: 'number',
            label: 'Day',
            value: () => new Date().getDate(),
            uses: [],
            daily: true
        });

        expect(datasource.aggregate('day', 'max')).toEqual(22);
        vi.setSystemTime(new Date(2026, 10, 22, 23, 59));
        expect(datasource.aggregate('day', 'max')).toEqual(22);
        vi.setSystemTime(new Date(2026, 10, 23, 0, 1));
        expect(datasource.aggregate('day', 'max')).toEqual(23);
    });

    it('expect rows-changed to name a calculated field with a field it uses', async () => {
        const datasource = make();
        const changed: ReadonlyMap<Entity, ReadonlySet<string>>[] = [];
        datasource.getDataContainer().__on('rows-changed', ({ fields }) => changed.push(fields));

        datasource.getAllData()[0].price = 11;
        datasource.getAllData()[1].name = 'Bobby';
        await Promise.resolve();

        const [fields] = changed;
        expect([...fields.values()].map((each) => [...each])).toEqual([['price', 'total'], ['name']]);
    });
});

describe('calculated fields - names', () => {
    it('expect a field a datasource lists, or a name of the grid’s own, refused', () => {
        const datasource = make();

        expect(() => datasource.__setCalculatedField('price', total())).toThrow(
            /'price' is a field of the datasource \(its fields\), a calculated field needs a name of its own/
        );
        expect(() => datasource.__setCalculatedField('__KEY', total())).toThrow(
            /the names that start with __ are the grid's own/
        );
        expect(datasource.__isListedField('price')).toBe(true);
        expect(datasource.__isListedField('total')).toBe(false);
    });

    it('expect it on the container: a datasource on the same container reads it, and may not list it as a field', () => {
        const container = new DataContainer('id');
        const first = new Datasource({ container, fields: { price: 'number', qty: 'number' } });
        first.setData(rows());
        first.__setCalculatedField('total', total());
        const second = new Datasource({ container });
        second.reloadDatasource();

        expect(second.getAllData()[0].total).toEqual(30);
        expect(second.getField('total').type).toEqual('number');
        expect(() => new Datasource({ container, fields: { total: 'number' } })).toThrow(
            /is a calculated field of a grid on the same container/
        );
    });
});

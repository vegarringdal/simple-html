import { describe, expect, it, vi } from 'vitest';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';
import { where } from '../filterExpression';

/**
 * datasource.on(): the events the datasource sends and what they carry
 */

const rows = () => [
    { name: 'b', age: 2 },
    { name: 'a', age: 1 },
    { name: 'c', age: 3 }
];

function datasourceWithRows() {
    const datasource = new Datasource();
    datasource.setData(rows());
    return datasource;
}

describe('datasource events - subscribing', () => {
    it('expect the payload to reach the handler', () => {
        const datasource = datasourceWithRows();
        const received: DatasourceEvents['collection-filtered'][] = [];
        datasource.on('collection-filtered', (data) => {
            received.push(data);
        });

        datasource.filter(where('name', 'EQUAL', 'a'));

        expect(received).toEqual([{ info: 'filter' }]);
    });

    it('expect a handler that returns nothing to keep listening', () => {
        const datasource = datasourceWithRows();
        let calls = 0;
        datasource.on('collection-sorted', () => {
            calls++;
        });

        datasource.sort({ attribute: 'name', ascending: true });
        datasource.sort({ attribute: 'name', ascending: false });
        datasource.sort({ attribute: 'age', ascending: true });

        expect(calls).toEqual(3);
    });

    it('expect the function on() returns to unsubscribe', () => {
        const datasource = datasourceWithRows();
        const removed = vi.fn();
        const kept = vi.fn();
        const off = datasource.on('collection-sorted', removed);
        datasource.on('collection-sorted', kept);

        datasource.sort({ attribute: 'name', ascending: true });
        off();
        datasource.sort({ attribute: 'name', ascending: false });

        expect(removed).toHaveBeenCalledTimes(1);
        expect(kept).toHaveBeenCalledTimes(2);
    });

    it('expect a handler on one event not to be called for another', () => {
        const datasource = datasourceWithRows();
        const handler = vi.fn();
        datasource.on('collection-grouped', handler);

        datasource.sort({ attribute: 'name', ascending: true });

        expect(handler).not.toHaveBeenCalled();
    });

    it('expect each datasource to have its own handlers', () => {
        const first = datasourceWithRows();
        const second = datasourceWithRows();
        const handler = vi.fn();
        first.on('collection-sorted', handler);

        second.sort({ attribute: 'name', ascending: true });

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('datasource events - renamed in v6', () => {
    it('expect selection-change when the selection changes (was selectionChange)', () => {
        const datasource = datasourceWithRows();
        const received: DatasourceEvents['selection-change'][] = [];
        datasource.on('selection-change', (data) => {
            received.push(data);
        });

        datasource.selectAll();

        expect(received).toEqual([{}]);
        expect(datasource.getSelectedRows()).toHaveLength(3);
    });

    it('expect selection-change from deselectAll only when asked for', () => {
        const datasource = datasourceWithRows();
        datasource.selectAll();
        const handler = vi.fn();
        datasource.on('selection-change', handler);

        datasource.deselectAll();
        expect(handler).not.toHaveBeenCalled();

        datasource.deselectAll(true);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('expect current-entity when the current entity is set (was currentEntity)', () => {
        const datasource = datasourceWithRows();
        const current: unknown[] = [];
        datasource.on('current-entity', () => {
            current.push(datasource.currentEntity?.name);
        });

        datasource.setRowAsCurrentEntity(2);

        expect(current).toEqual(['c']);
    });
});

describe('datasource events - payloads', () => {
    it('expect collection-changed with added when setting and adding data', () => {
        const datasource = new Datasource();
        const received: DatasourceEvents['collection-changed'][] = [];
        datasource.on('collection-changed', (data) => {
            received.push(data);
        });

        datasource.setData(rows());
        datasource.setData([{ name: 'd', age: 4 }], true);
        datasource.addNewEmpty();

        expect(received).toEqual([{ added: false }, { added: true }, { added: true }]);
    });

    it('expect collection-changed from removeData to carry what was removed', () => {
        const datasource = datasourceWithRows();
        const toRemove = datasource.getAllData()[0];
        const received: DatasourceEvents['collection-changed'][] = [];
        datasource.on('collection-changed', (data) => {
            received.push(data);
        });

        datasource.removeData(toRemove);

        expect(received).toHaveLength(1);
        expect(received[0].removed).toBe(true);
        expect(received[0].info).toEqual('removeData');
        expect(received[0].data).toBe(toRemove);
    });

    it('expect collection-filtered to say what rebuilt the rows', () => {
        const datasource = datasourceWithRows();
        const infos: DatasourceEvents['collection-filtered']['info'][] = [];
        datasource.on('collection-filtered', (data) => {
            infos.push(data.info);
        });

        datasource.markForDeletion(datasource.getAllData()[0]);
        datasource.resetData();
        datasource.reloadDatasource();

        expect(infos).toEqual(['markForDeletion', 'resetData', 'filter']);
    });

    it('expect collection-grouped with the groupings, then removeGroup', () => {
        const datasource = datasourceWithRows();
        const received: DatasourceEvents['collection-grouped'][] = [];
        datasource.on('collection-grouped', (data) => {
            received.push(data);
        });

        datasource.group([{ attribute: 'name', title: 'Name' }]);
        datasource.removeGroup();

        expect(received).toEqual([
            { info: 'group', groupings: [{ attribute: 'name', title: 'Name' }] },
            { info: 'group', groupings: [] },
            { info: 'removeGroup' }
        ]);
    });

    it('expect collection-expand and collection-collapse with an empty payload', () => {
        const datasource = datasourceWithRows();
        datasource.group([{ attribute: 'name', title: 'Name' }]);
        const expand = vi.fn();
        const collapse = vi.fn();
        datasource.on('collection-expand', expand);
        datasource.on('collection-collapse', collapse);

        datasource.collapseGroup();
        datasource.expandGroup();

        expect(collapse).toHaveBeenCalledWith({});
        expect(expand).toHaveBeenCalledWith({});
    });

    it('expect select with the row and what selected it', () => {
        const datasource = datasourceWithRows();
        const received: DatasourceEvents['select'][] = [];
        datasource.on('select', (data) => {
            received.push(data);
        });

        datasource.selectFirst();
        datasource.selectNext();
        datasource.selectLast();
        datasource.selectPrev();
        datasource.select(2, true);

        expect(received).toEqual([
            { info: 'select-first', row: 0 },
            { info: 'select-next', row: 1 },
            { info: 'select-last', row: 2 },
            { info: 'select-prev', row: 1 },
            { info: 'select-first', row: 1 }
        ]);
    });
});

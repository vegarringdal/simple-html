// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { isGroupRow } from '../../datasource/entity';
import type { ColumnFormat } from '../columnFormat';
import type { GridConfig } from '../gridConfig';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * Grouping a date column by what it shows (GROUP_BY_FORMATS): a column with the display format of a
 * week, a month, a quarter or a year groups by them, by its days otherwise. A new format groups again.
 */

// Sunday 22 to Tuesday 24 November 2026, and 1 December: ISO weeks 47, 48, 48, 49; US weeks 48, 48, 48, 49
const rows = () => [
    { name: 'a', due: new Date(2026, 10, 22) },
    { name: 'b', due: new Date(2026, 10, 23) },
    { name: 'c', due: new Date(2026, 10, 24) },
    { name: 'd', due: new Date(2026, 11, 1) },
    { name: 'e', due: null }
];

const config = (format?: ColumnFormat): GridConfig => ({
    columns: { due: { label: 'Due', format } },
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['due'], width: 100 }
        ]
    }
});

const fields = { fields: { due: 'date' as const } };

/** the names of the group rows, the groups collapsed */
const groupNames = (datasource: Datasource) =>
    datasource
        .getRows()
        .filter(isGroupRow)
        .map((row) => row.__groupName);

const groupOnDue = (datasource: Datasource) => datasource.group([{ attribute: 'due', title: 'Due' }]);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('grouping a date column by the period it shows', () => {
    it('expect ISO weeks, US weeks, months, quarters and years as groups, the blank group first (sorted first)', async () => {
        const groups = async (format: ColumnFormat) => {
            const { datasource } = await mountGrid(config(format), rows(), fields);
            groupOnDue(datasource);
            return groupNames(datasource);
        };
        expect(await groups({ date: 'weekIso' })).toEqual(['Due: blank', 'Due: 2026-W47', 'Due: 2026-W48', 'Due: 2026-W49']);
        expect(await groups({ date: 'weekUs' })).toEqual(['Due: blank', 'Due: 2026-W48', 'Due: 2026-W49']);
        expect((await groups({ date: 'month' })).length).toEqual(3);
        expect(await groups({ date: 'quarter' })).toEqual(['Due: blank', 'Due: 2026 Q4']);
        expect(await groups({ date: 'year' })).toEqual(['Due: blank', 'Due: 2026']);
    });

    it('expect the rows of a week in its group', async () => {
        const { datasource } = await mountGrid(config({ date: 'weekIso' }), rows(), fields);
        groupOnDue(datasource);
        datasource.expandGroup();
        const week48 = datasource.getRows().find((row) => isGroupRow(row) && row.__groupName === 'Due: 2026-W48');
        expect(week48 && isGroupRow(week48) ? week48.__groupChildren.map((row: any) => row.name) : []).toEqual(['b', 'c']);
    });

    it('expect days without a format, and with a format of a day or of the day of the week', async () => {
        const days = async (format?: ColumnFormat) => {
            const { datasource } = await mountGrid(config(format), rows(), fields);
            groupOnDue(datasource);
            return groupNames(datasource).length;
        };
        // four days and the blank group
        expect(await days()).toEqual(5);
        expect(await days({ date: 'norwegian' })).toEqual(5);
        // Sunday, Monday, Tuesday, Tuesday: grouped by the day, not the weekday - its rows are not together
        expect(await days({ date: 'weekday' })).toEqual(5);
    });

    it('expect a new format to group again: setState, the reset, updateConfig - the sort kept', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), rows(), fields);
        groupOnDue(datasource);
        expect(groupNames(datasource).length).toEqual(5);

        gridInterface.setState({ formats: { due: { date: 'quarter' } } });
        expect(groupNames(datasource)).toEqual(['Due: blank', 'Due: 2026 Q4']);
        expect(datasource.getGrouping().map((group) => group.attribute)).toEqual(['due']);

        gridInterface.resetState();
        expect(groupNames(datasource).length).toEqual(0);

        groupOnDue(datasource);
        gridInterface.updateConfig({ columns: { due: { label: 'Due', format: { date: 'year' } } } });
        expect(groupNames(datasource)).toEqual(['Due: blank', 'Due: 2026']);
    });

    it('expect a grouping in the state to group by the format of the same state', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), rows(), fields);
        gridInterface.setState({ formats: { due: { date: 'year' } }, grouping: [{ attribute: 'due', title: 'Due' }] });
        expect(groupNames(datasource)).toEqual(['Due: blank', 'Due: 2026']);
    });

    it('expect a datasource without the grid to group by days again', async () => {
        const datasource = new Datasource({ fields: { due: 'date' } });
        datasource.setData(rows());
        const gridInterface = new GridInterface(config({ date: 'year' }), datasource);
        groupOnDue(datasource);
        expect(groupNames(datasource)).toEqual(['Due: blank', 'Due: 2026']);

        gridInterface.destroy();
        groupOnDue(datasource);
        expect(groupNames(datasource).length).toEqual(5);
    });
});

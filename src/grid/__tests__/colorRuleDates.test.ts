// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import { type ColorRule, colorRuleOf } from '../colorRules';
import type { ColumnFormat } from '../columnFormat';
import type { GridConfig } from '../gridConfig';
import { GridInterface } from '../gridInterface';
import { stubCanvas } from './gridTestHelpers';

/**
 * Colour rules on a date (colorRules.ts dateRuleCondition): a period as the value - a week, a month, a
 * quarter, a year - and a quick date (`datePreset`), the weeks ISO (Monday) or US (Sunday) - `week`, else
 * the column's week format, else the date picker's first day. Today is Wednesday 25 November 2026: this
 * week is Monday 23 - Sunday 29 (ISO), Sunday 22 - Saturday 28 (US).
 */

beforeAll(() => {
    stubCanvas();
    vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => {
    vi.useRealTimers();
});
beforeEach(() => {
    vi.setSystemTime(new Date(2026, 10, 25, 12, 0));
});
afterEach(() => {
    vi.setSystemTime(new Date(2026, 10, 25, 12, 0));
});

/** the days of November 2026 of the rows, and a blank */
const DAYS = [9, 16, 21, 22, 23, 28, 29];
const rows = (): Entity[] => [
    ...DAYS.map((day, id) => ({ id, born: new Date(2026, 10, day), updated: new Date(2026, 10, day, 23, 30) })),
    { id: 99, born: null, updated: null },
    { id: 100, born: new Date(2026, 11, 31), updated: new Date(2026, 11, 31, 8, 0) }
];

function grid(config: Partial<GridConfig> = {}) {
    const datasource = new Datasource({ key: 'id', fields: { born: 'date', updated: 'datetime' } });
    datasource.setData(rows());
    const gridInterface = new GridInterface(
        {
            layout: {
                center: [
                    { fields: ['born'], width: 100 },
                    { fields: ['updated'], width: 100 }
                ]
            },
            ...config
        },
        datasource
    );
    return { gridInterface, datasource };
}

/** the rows a rule colours: the day of November (the blank `-`, 31 December `dec31`) */
function coloured(rule: ColorRule, field = 'born', config: Partial<GridConfig> = {}): (number | string)[] {
    const { gridInterface, datasource } = grid(config);
    const format: ColumnFormat = { ...config.columns?.[field]?.format, rules: [{ ...rule, background: 'red' }] };
    return datasource
        .getAllData()
        .filter((row) => colorRuleOf(gridInterface, field, row, format) !== null)
        .map((row) => {
            const date = row[field] as Date | null;
            return !date ? '-' : date.getMonth() === 11 ? 'dec31' : date.getDate();
        });
}

describe('colour rules on a date - a quick date', () => {
    it('expect This week Monday to Sunday with ISO weeks, Sunday to Saturday with US weeks', () => {
        expect(coloured({ operator: 'EQUAL', datePreset: 'thisWeek', week: 'iso' })).toEqual([23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', datePreset: 'thisWeek', week: 'us' })).toEqual([22, 23, 28]);
        expect(coloured({ operator: 'EQUAL', datePreset: 'lastWeek', week: 'iso' })).toEqual([16, 21, 22]);
        expect(coloured({ operator: 'EQUAL', datePreset: 'lastWeek', week: 'us' })).toEqual([16, 21]);
    });

    it('expect the operators: before, to its end, after, from its start, not in it (or blank)', () => {
        const week = { datePreset: 'thisWeek', week: 'iso' } as const;
        expect(coloured({ operator: 'LESS_THAN', ...week })).toEqual([9, 16, 21, 22]);
        expect(coloured({ operator: 'LESS_THAN_OR_EQUAL_TO', ...week })).toEqual([9, 16, 21, 22, 23, 28, 29]);
        expect(coloured({ operator: 'GREATER_THAN', ...week })).toEqual(['dec31']);
        expect(coloured({ operator: 'GREATER_THAN_OR_EQUAL_TO', ...week })).toEqual([23, 28, 29, 'dec31']);
        expect(coloured({ operator: 'NOT_EQUAL_TO', ...week })).toEqual([9, 16, 21, 22, '-', 'dec31']);
    });

    it('expect a datetime to its last second, Overdue every day before today - its open start', () => {
        expect(coloured({ operator: 'EQUAL', datePreset: 'thisWeek', week: 'iso' }, 'updated')).toEqual([23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', datePreset: 'overdue' })).toEqual([9, 16, 21, 22, 23]);
        expect(coloured({ operator: 'GREATER_THAN', datePreset: 'overdue' })).toEqual([28, 29, 'dec31']);
        // before an open start: nothing
        expect(coloured({ operator: 'LESS_THAN', datePreset: 'overdue' })).toEqual([]);
        expect(coloured({ operator: 'NOT_EQUAL_TO', datePreset: 'overdue' })).toEqual([28, 29, '-', 'dec31']);
    });

    it('expect the days of today: another day, other rows', () => {
        vi.setSystemTime(new Date(2026, 10, 30, 9, 0));
        expect(coloured({ operator: 'EQUAL', datePreset: 'lastWeek', week: 'iso' })).toEqual([23, 28, 29]);
    });
});

describe('colour rules on a date - a period typed', () => {
    it('expect a week of the rule: 2026-W48 is 23 to 29 ISO, 22 to 28 US', () => {
        expect(coloured({ operator: 'EQUAL', value: '2026-W48', week: 'iso' })).toEqual([23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', value: '2026-W48', week: 'us' })).toEqual([22, 23, 28]);
        expect(coloured({ operator: 'LESS_THAN', value: '2026-W48', week: 'iso' })).toEqual([9, 16, 21, 22]);
    });

    it('expect a month, a quarter and a year; a day as before', () => {
        expect(coloured({ operator: 'EQUAL', value: '2026-11' })).toEqual([9, 16, 21, 22, 23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', value: '2026 Q4' })).toEqual([9, 16, 21, 22, 23, 28, 29, 'dec31']);
        expect(coloured({ operator: 'GREATER_THAN', value: '2026-11' })).toEqual(['dec31']);
        expect(coloured({ operator: 'EQUAL', value: '2026' })).toEqual([9, 16, 21, 22, 23, 28, 29, 'dec31']);
        expect(coloured({ operator: 'EQUAL', value: '2026-11-22' })).toEqual([22]);
    });

    it('expect a Between of periods - and of a period and a day', () => {
        expect(coloured({ operator: 'BETWEEN', value: ['2026-W47', '2026-W47'], week: 'iso' })).toEqual([16, 21, 22]);
        expect(coloured({ operator: 'BETWEEN', value: ['2026-W47', '2026-11-23'], week: 'iso' })).toEqual([16, 21, 22, 23]);
        expect(coloured({ operator: 'BETWEEN', value: ['2026-11-21', '2026-W48'], week: 'us' })).toEqual([21, 22, 23, 28]);
        expect(coloured({ operator: 'BETWEEN', value: ['2026-12', ''] })).toEqual(['dec31']);
    });

    it("expect a week as the grid's texts write it, and as the library's: a saved rule in every language", () => {
        const norwegian: Partial<GridConfig> = {
            texts: { 'format.weekIso': 'uke {week} {year}', 'format.quarter': '{quarter}. kvartal {year}' }
        };
        expect(coloured({ operator: 'EQUAL', value: 'uke 48 2026', week: 'iso' }, 'born', norwegian)).toEqual([23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', value: '2026-W48', week: 'iso' }, 'born', norwegian)).toEqual([23, 28, 29]);
        expect(coloured({ operator: 'EQUAL', value: '4. kvartal 2026' }, 'born', norwegian)).toHaveLength(8);
    });
});

describe('colour rules on a date - the weeks when the rule says none', () => {
    it("expect the column's week format, else the date picker's first day: Sunday is US, else ISO", () => {
        const rule: ColorRule = { operator: 'EQUAL', datePreset: 'thisWeek' };
        expect(coloured(rule)).toEqual([23, 28, 29]);
        expect(coloured(rule, 'born', { columns: { born: { format: { date: 'weekUs' } } } })).toEqual([22, 23, 28]);
        expect(coloured(rule, 'born', { datePickerConfig: { weekStart: 0 } })).toEqual([22, 23, 28]);
        expect(
            coloured(rule, 'born', { columns: { born: { format: { date: 'weekIso' } } }, datePickerConfig: { weekStart: 0 } })
        ).toEqual([23, 28, 29]);
        // the rule's own wins
        expect(coloured({ ...rule, week: 'iso' }, 'born', { datePickerConfig: { weekStart: 0 } })).toEqual([23, 28, 29]);
    });

    it('expect a condition on a date field to take them too', () => {
        expect(
            coloured({ conditions: [{ field: 'born', operator: 'EQUAL', datePreset: 'thisWeek', week: 'us' }] }, 'updated')
        ).toEqual([22, 23, 28]);
    });
});

describe('colour rules on a date - what does not fit (TypeError)', () => {
    const set =
        (rule: unknown, field = 'born') =>
        () =>
            grid({ columns: { [field]: { format: { rules: [{ background: 'red', ...(rule as object) }] as ColorRule[] } } } });

    it('expect a quick date and weeks on a date column only, an operator that compares, no value', () => {
        expect(set({ operator: 'EQUAL', datePreset: 'someday' })).toThrow(/datePreset is "someday", it is a quick date/);
        expect(set({ operator: 'BETWEEN', datePreset: 'thisWeek' })).toThrow(/a datePreset takes 'EQUAL'/);
        expect(set({ operator: 'EQUAL', datePreset: 'thisWeek', value: '2026-W48' })).toThrow(/has a value and a datePreset/);
        expect(set({ operator: 'EQUAL', value: '2026-W48', week: 'monday' })).toThrow(
            /week is "monday", it is 'iso' \(Monday\) or 'us' \(Sunday\)/
        );
        expect(set({ datePreset: 'thisWeek' })).toThrow(/has no condition/);
        expect(set({ conditions: [{ field: 'born', operator: 'EQUAL', datePreset: 'thisWeek', week: 'us' }] })).not.toThrow();
        expect(set({ conditions: [{ field: 'born', operator: 'IS_BLANK', datePreset: 'thisWeek' }] })).toThrow(
            /datePreset takes/
        );
    });

    it('expect them refused on another type', () => {
        const datasource = new Datasource({ key: 'id', fields: { age: 'number' } });
        datasource.setData([{ id: 1, age: 1 }]);
        const make = (rule: object) => () =>
            new GridInterface(
                {
                    layout: { center: [{ fields: ['age'], width: 100 }] },
                    columns: { age: { format: { rules: [{ background: 'red', ...rule }] as ColorRule[] } } }
                },
                datasource
            );
        expect(make({ operator: 'EQUAL', datePreset: 'thisWeek' })).toThrow(
            /datePreset is for a date column, this one is number/
        );
        expect(make({ operator: 'EQUAL', value: '1', week: 'iso' })).toThrow(/week is for a date column/);
    });
});

describe('colour rules on a date - a new day', () => {
    it('expect refreshDatePresets() to render the cells again on a new day when a rule has a quick date', () => {
        const { gridInterface } = grid({
            columns: { born: { format: { rules: [{ operator: 'EQUAL', datePreset: 'today', background: 'red' }] } } }
        });
        const refresh = vi.spyOn(gridInterface, 'refresh');
        gridInterface.refreshDatePresets();
        expect(refresh).not.toHaveBeenCalled();
        vi.setSystemTime(new Date(2026, 10, 26, 8, 0));
        gridInterface.refreshDatePresets();
        expect(refresh).toHaveBeenCalledTimes(1);
        gridInterface.refreshDatePresets();
        expect(refresh).toHaveBeenCalledTimes(1);

        const { gridInterface: plain } = grid();
        const none = vi.spyOn(plain, 'refresh');
        vi.setSystemTime(new Date(2026, 10, 27, 8, 0));
        plain.refreshDatePresets();
        expect(none).not.toHaveBeenCalled();
    });
});

// @vitest-environment happy-dom
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { FilterExpression } from '../../datasource/filterExpression';
import { stubCanvas } from '../../grid/__tests__/gridTestHelpers';
import type { GridConfig } from '../../grid/gridConfig';
import { findFilter } from '../../grid/gridFunctions/findFilter';
import { findRowFilter } from '../../grid/gridFunctions/findMatches';
import { getLayoutFields } from '../../grid/gridFunctions/getLayoutFields';
import { GridInterface } from '../../grid/gridInterface';
import { registerLookup } from '../../grid/lookup';
import { type SqlColumn, type SqlDialect, toSqlWhere } from '../../sql';

/**
 * Find's filter (findFilter.ts, `gridInterface.getFindFilter()`) as SQL, on a real SQLite database
 * (node:sqlite): the rows it selects are rows "Filter rows" shows - never a row without a match. On the
 * text fields and the lookup columns they are the same rows: the text as it is (`*`, `%` and `_` are
 * characters, `literal`), in any case or with Match case, every line of a multiline text, the labels of
 * a lookup. A number and a date are found by their whole value only, Find also by a part of their text.
 *
 * The texts searched for are ASCII: SQLite's LOWER() folds ASCII letters only (the SQL guide's
 * differences). The grid is an interface without a page: Find's model reads the interface only.
 */

const TIME_ZONE = 'Europe/Oslo';
const originalTimeZone = process.env.TZ;

const NAMES = [
    null,
    '',
    'Acme',
    'ACME corp',
    'acme\nline two',
    '50% off',
    '500',
    'a_b',
    'axb',
    'aXb',
    'a*b',
    'a?b',
    'a[b]',
    'a!b',
    'æble',
    'Æble',
    "o'brien",
    'tab\there',
    '30',
    '2026-03-14'
];
const NOTES = [null, '', 'first line\nsecond Acme', 'note', 'x_y', '100%', 'OSLO notes'];
/** the lookups' values: every one has a label, a blank has none */
const OFFICES = [null, 'k0', 'k1', 'k2'];
const TEAMS = [null, 1, 2];
const AGES = [null, 0, 3, 30, 130, 2.5, -1, 1000];
const DAYS = [
    null,
    new Date(2026, 2, 14, 10, 30),
    new Date(2026, 2, 14, 23, 59, 59),
    new Date(2026, 2, 15),
    new Date(2026, 9, 25, 2, 30)
];

const FIELDS: Record<string, SqlColumn> = {
    name: { column: 'name' },
    notes: { column: 'notes' },
    office: { column: 'office' },
    team: { column: 'team', type: 'number' },
    age: { column: 'age', type: 'number' },
    born: { column: 'born', type: 'date' },
    active: { column: 'active', type: 'boolean' }
};

const pad = (value: number) => String(value).padStart(2, '0');
/** the wall clock of a Date in Oslo, as SQLite text */
const localText = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

interface Setup {
    db: DatabaseSync;
    datasource: Datasource;
    /** the grid: the layout, the lookup columns, the formatters */
    gridInterface: GridInterface<any>;
}

/** 300 rows of every kind of value, in the grid and in SQLite */
function setup(layout: string[]): Setup {
    const db = new DatabaseSync(':memory:');
    db.exec(
        'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, notes TEXT, office TEXT, team INTEGER, age REAL, born TEXT, active INTEGER)'
    );
    const insert = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const rows: Record<string, unknown>[] = [];
    for (let id = 1; id <= 300; id++) {
        const pick = <T>(list: readonly T[], step: number) => list[(id * step + Math.floor(id / list.length)) % list.length];
        const row = {
            id,
            name: pick(NAMES, 1),
            notes: pick(NOTES, 3),
            office: pick(OFFICES, 5),
            team: pick(TEAMS, 7),
            age: pick(AGES, 11),
            born: pick(DAYS, 13),
            active: id % 3 === 0 ? null : id % 2 === 0
        };
        rows.push(row);
        insert.run(
            id,
            row.name,
            row.notes,
            row.office,
            row.team,
            row.age,
            row.born ? localText(row.born) : null,
            row.active === null ? null : Number(row.active)
        );
    }
    const datasource = new Datasource({
        key: 'id',
        fields: { id: 'number', notes: { multiline: true }, team: 'number', age: 'number', born: 'date', active: 'boolean' }
    });
    datasource.setData(rows);
    const config: GridConfig = {
        layout: { left: [], center: layout.map((field) => ({ fields: [field], width: 100 })), right: [] },
        columns: {
            office: { editor: { type: 'select', lookup: 'findSql-offices' } },
            team: { editor: { type: 'select', lookup: 'findSql-teams' } }
        }
    };
    return { db, datasource, gridInterface: new GridInterface(config, datasource) };
}

/** the find filter as getFindFilter() makes it: the fields of the layout */
const filterOf = ({ gridInterface }: Setup, text: string, caseSensitive: boolean) =>
    findFilter({ gridInterface }, text, caseSensitive, getLayoutFields(gridInterface));

/** the ids of the rows "Filter rows" shows: the grid's row predicate */
function gridIds({ gridInterface, datasource }: Setup, text: string, caseSensitive: boolean): number[] {
    const shows = findRowFilter({ gridInterface }, text, caseSensitive);
    return datasource
        .getAllData()
        .filter(shows)
        .map((row) => row.id as number);
}

/** the ids of the rows SQLite selects with the SQL of a filter */
function sqlIds({ db }: Setup, filter: FilterExpression | null): number[] {
    const { sql, params } = toSqlWhere(JSON.parse(JSON.stringify(filter)), {
        dialect: 'sqlite',
        columns: FIELDS,
        timeZone: TIME_ZONE
    });
    return db
        .prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`)
        .all(...(params as (string | number)[]))
        .map((row) => row.id as number);
}

/** the ASCII texts searched for */
const TEXTS = [
    'acme',
    'Acme',
    'ACME',
    'a',
    'line',
    '50%',
    '%',
    '_',
    '*',
    '?',
    '[',
    '!',
    'a_b',
    'a*b',
    'axb',
    'x_y',
    'oslo',
    'Oslo',
    'OSLO',
    'office',
    'team',
    'Team B',
    'blue',
    "o'b",
    '\t',
    'zzz',
    '30',
    '3',
    '0',
    '2.5',
    '-1',
    '1000',
    '2026-03-14',
    '2026-03',
    'true'
];

beforeAll(() => {
    // the grid reads the wall clock of the process, the SQL the one of options.timeZone
    process.env.TZ = TIME_ZONE;
    stubCanvas();
    const offices = new Datasource();
    offices.setData([
        { code: 'k0', name: 'Oslo office' },
        { code: 'k1', name: 'Bergen office' },
        { code: 'k2', name: 'OSLO west' }
    ]);
    registerLookup('findSql-offices', { datasource: offices, valueField: 'code', labelField: 'name' });
    const teams = new Datasource({ fields: { id: 'number' } });
    teams.setData([
        { id: 1, name: 'Team Oslo' },
        { id: 2, name: 'Team Blue' }
    ]);
    registerLookup('findSql-teams', { datasource: teams, valueField: 'id', labelField: 'name' });
});

afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

describe('the find filter on SQLite selects the rows "Filter rows" shows', () => {
    it('expect the same rows on text fields and lookup columns: the text as it is, any case or Match case, every line', () => {
        const data = setup(['name', 'notes', 'office', 'team']);
        let some = 0;
        for (const text of TEXTS) {
            for (const caseSensitive of [false, true]) {
                const grid = gridIds(data, text, caseSensitive);
                expect(sqlIds(data, filterOf(data, text, caseSensitive)), `${JSON.stringify(text)} ${caseSensitive}`).toEqual(
                    grid
                );
                some += grid.length > 0 && grid.length < 300 ? 1 : 0;
            }
        }
        // the comparison is not empty: most texts find some rows, not all
        expect(some).toBeGreaterThan(40);
    });

    it('expect never a row without a match with numbers and dates too - fewer rows, the ones of the whole value', () => {
        const data = setup(['name', 'notes', 'office', 'team', 'age', 'born', 'active']);
        const text = setup(['name', 'notes', 'office', 'team']);
        for (const find of TEXTS) {
            for (const caseSensitive of [false, true]) {
                const grid = gridIds(data, find, caseSensitive);
                const sql = sqlIds(data, filterOf(data, find, caseSensitive));
                const where = `${JSON.stringify(find)} ${caseSensitive}`;
                expect(
                    sql.filter((id) => !grid.includes(id)),
                    where
                ).toEqual([]);
                // the rows of the text fields and the lookups, and of the whole number or day
                const rows = data.datasource.getAllData();
                const value = (id: number, field: string) => rows.find((row) => row.id === id)?.[field];
                const byValue = sql.filter((id) => !gridIds(text, find, caseSensitive).includes(id));
                for (const id of byValue) {
                    const age = value(id, 'age');
                    const born = value(id, 'born') as Date | null;
                    const day = born ? `${born.getFullYear()}-${pad(born.getMonth() + 1)}-${pad(born.getDate())}` : '';
                    expect(String(age ?? '') === find || day === find, `${where}: row ${id}`).toBe(true);
                }
            }
        }
        // a number by its whole value: 30, not 130 and 1000 - Find marks those too
        const thirty = sqlIds(data, filterOf(data, '30', false));
        expect(gridIds(data, '30', false).length).toBeGreaterThan(thirty.length);
        expect(thirty.length).toBeGreaterThan(0);
        // a day by its text, all of it: 2026-03-14 at 10:30 and at 23:59:59 - and the name that is the text
        const day = sqlIds(data, filterOf(data, '2026-03-14', false));
        expect(day).toEqual(gridIds(data, '2026-03-14', false));
    });

    it('expect a lookup value without a label to be found by Find only: its cell shows the value', () => {
        const data = setup(['office']);
        data.datasource.getAllData()[0].office = 'oslo-x';
        data.db.prepare('UPDATE t SET office = ? WHERE id = 1').run('oslo-x');

        expect(gridIds(data, 'oslo', false)).toContain(1);
        expect(sqlIds(data, filterOf(data, 'oslo', false))).not.toContain(1);
        expect(sqlIds(data, filterOf(data, 'oslo', false)).every((id) => gridIds(data, 'oslo', false).includes(id))).toBe(true);
    });
});

describe('the SQL of a find filter', () => {
    const DIALECTS: SqlDialect[] = ['postgres', 'oracle', 'sqlite', 'mssql'];

    for (const dialect of DIALECTS) {
        it(`expect the SQL of ${dialect} to be the snapshot`, () => {
            const data = setup(['name', 'notes', 'office', 'team', 'age', 'born', 'active']);
            const lines: string[] = [];
            for (const [text, caseSensitive] of [
                ['acme', false],
                ['Oslo', true],
                ['50%_*', false],
                ['30', false],
                ['2026-03-14', false],
                ['true', false]
            ] as const) {
                const filter = JSON.parse(JSON.stringify(filterOf(data, text, caseSensitive)));
                const { sql, params } = toSqlWhere(filter, { dialect, columns: FIELDS, timeZone: TIME_ZONE });
                lines.push(
                    `${text}${caseSensitive ? ' caseSensitive' : ''}\n  ${JSON.stringify(filter)}\n  ${sql}\n  ${JSON.stringify(params)}`
                );
            }
            expect(lines.join('\n')).toMatchSnapshot();
        });
    }
});

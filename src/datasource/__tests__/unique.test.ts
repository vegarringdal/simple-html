import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { DatasourceOptions } from '../datasourceOptions';
import type { Entity } from '../entity';

/**
 * The built-in `unique` rule: the container compares the rows - one field, or with `with` several
 * fields together. Every row with the value has the error, an edit, a deletion mark or a row that
 * leaves takes it from the others. A blank value is no duplicate
 */

type Row = Entity & { id: number; code: string | null; year: number | null; email?: string | null };

const options = (more: Partial<DatasourceOptions> = {}): DatasourceOptions => ({
    key: 'id',
    fields: {
        id: 'number',
        code: { validate: ['unique'] },
        year: { type: 'number', label: 'Year' },
        email: { validate: [{ id: 'unique', ignoreCase: true }] }
    },
    ...more
});

function made(rows: Partial<Row>[], more: Partial<DatasourceOptions> = {}) {
    const datasource = new Datasource<Row>(options(more));
    datasource.setData(rows);
    const row = (id: number) =>
        datasource
            .getDataContainer()
            .getDataSet()
            .find((each) => each.id === id) as Row;
    /** the rows with an error, as `id field` */
    const errors = () =>
        datasource
            .getErrors()
            .map((error) => `${(error.row as Row).id} ${error.field}`)
            .sort();
    return { datasource, row, errors };
}

describe('unique - one field', () => {
    it('expect validate() to mark every row with the value, a blank value no duplicate', () => {
        const { datasource, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'A' },
            { id: 3, code: 'B' },
            { id: 4, code: null },
            { id: 5, code: null },
            { id: 6, code: '  ' },
            { id: 7, code: '  ' }
        ]);
        expect(datasource.validate().map((error) => [(error.row as Row).id, error.messages])).toEqual([
            [1, ['Another row has the same value']],
            [2, ['Another row has the same value']]
        ]);
        expect(errors()).toEqual(['1 code', '2 code']);
    });

    it('expect an edit to a value another row has to mark both, an edit away to clear both', () => {
        const { datasource, row, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'B' },
            { id: 3, code: 'C' }
        ]);
        expect(datasource.validate()).toEqual([]);
        row(2).code = 'A';
        expect(errors()).toEqual(['1 code', '2 code']);
        // a third: all three
        row(3).code = 'A';
        expect(errors()).toEqual(['1 code', '2 code', '3 code']);
        // one leaves: two still share it
        row(1).code = 'Z';
        expect(errors()).toEqual(['2 code', '3 code']);
        row(3).code = 'C';
        expect(errors()).toEqual([]);
    });

    it('expect the other row sent in rows-changed, so the grid shows its error', async () => {
        const { datasource, row } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'B' }
        ]);
        datasource.validate();
        const sent: number[][] = [];
        datasource.on('rows-changed', (event) => {
            sent.push(event.rows.map((each) => (each as Row).id).sort());
        });
        row(2).code = 'A';
        await Promise.resolve();
        expect(sent).toEqual([[1, 2]]);
    });

    it('expect text compared as it is, ignoreCase to take any case, numbers and dates by value', () => {
        const { datasource, errors } = made([
            { id: 1, code: 'a', email: 'Ann@x.no' },
            { id: 2, code: 'A', email: 'ann@X.no' }
        ]);
        datasource.validate();
        expect(errors()).toEqual(['1 email', '2 email']);

        const numbers = new Datasource({
            fields: { n: { type: 'number', validate: ['unique'] }, d: { type: 'date', validate: ['unique'] } }
        });
        numbers.setData([
            { n: 0, d: new Date(2026, 0, 1) },
            { n: 0, d: new Date(2026, 0, 1) },
            { n: 1, d: new Date(2026, 0, 2) }
        ]);
        // 0 is a value here, not blank: two rows with 0 break it
        expect(numbers.validate().map((error) => error.field)).toEqual(['n', 'd', 'n', 'd']);
    });

    it('expect a row marked for deletion not to count, and the error back when it is unmarked', () => {
        const { datasource, row, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'A' }
        ]);
        datasource.validate();
        datasource.markForDeletion(row(2));
        expect(errors()).toEqual([]);
        datasource.unmarkForDeletion(row(2));
        expect(errors()).toEqual(['1 code', '2 code']);
        // undo of the mark as well
        datasource.markForDeletion(row(1));
        expect(errors()).toEqual([]);
        datasource.undo();
        expect(errors()).toEqual(['1 code', '2 code']);
    });

    it('expect a row removed, or the rows set again, to take the error from the others', () => {
        const { datasource, row, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'A' },
            { id: 3, code: 'B' }
        ]);
        datasource.validate();
        const removed = row(2);
        datasource.getDataContainer().removeData(removed);
        expect(errors()).toEqual([]);
        // a row out of the container is not compared, also when it is edited
        removed.code = 'B';
        expect(errors()).toEqual([]);
        // rows added: in the comparison
        const [added] = datasource.getDataContainer().setData([{ id: 4, code: 'B' }], { add: true });
        expect(datasource.validate(added).map((error) => (error.row as Row).id)).toEqual([4]);
        // validate(some rows): the others with the value get the error too
        expect(errors()).toEqual(['3 code', '4 code']);
        datasource.setData([{ id: 5, code: 'B' }]);
        expect(datasource.validate()).toEqual([]);
    });

    it('expect resetData() to clear the errors and leave the originals unchecked', () => {
        const { datasource, row, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'A' },
            { id: 3, code: 'B' }
        ]);
        datasource.addNewEmpty({ code: 'B' } as Partial<Row>);
        datasource.validate();
        expect(errors()).toHaveLength(4);
        datasource.resetData();
        expect(errors()).toEqual([]);
        row(3).code = 'A';
        // an edit: its new group checked, the loaded rows 1 and 2 too
        expect(errors()).toEqual(['1 code', '2 code', '3 code']);
    });

    it('expect upsert() of a value from the server compared too', () => {
        const { datasource, errors } = made([
            { id: 1, code: 'A' },
            { id: 2, code: 'B' }
        ]);
        datasource.validate();
        datasource.upsert([{ id: 2, code: 'A' }]);
        expect(errors()).toEqual(['1 code', '2 code']);
        datasource.upsert([{ id: 1, code: 'Q' }]);
        expect(errors()).toEqual([]);
    });
});

describe('unique - with other fields', () => {
    const rows = (): Partial<Row>[] => [
        { id: 1, code: 'A', year: 2025 },
        { id: 2, code: 'A', year: 2026 },
        { id: 3, code: 'B', year: 2026 }
    ];
    const withYear = (extra: object = {}): Partial<DatasourceOptions> => ({
        fields: {
            id: 'number',
            code: { validate: [{ id: 'unique', with: ['year'], ...extra }] },
            year: { type: 'number', label: 'Year' }
        }
    });

    it('expect the values together compared, the message to name the label of the other field', () => {
        const { datasource, row, errors } = made(rows(), withYear());
        expect(datasource.validate()).toEqual([]);
        row(1).year = 2026;
        expect(errors()).toEqual(['1 code', '2 code']);
        expect(datasource.getErrors()[0].messages).toEqual(['Another row has the same value and Year']);
        // an edit of the other field takes it away again
        row(2).year = 2027;
        expect(errors()).toEqual([]);
        // a blank in one of them: no duplicate
        row(1).year = null;
        row(2).year = null;
        expect(errors()).toEqual([]);
    });

    it('expect the rule on both fields to mark both, one index for the two', () => {
        const { datasource, row, errors } = made(rows(), {
            fields: {
                id: 'number',
                code: { validate: [{ id: 'unique', with: ['year'] }] },
                year: { type: 'number', validate: [{ id: 'unique', with: ['code'] }] }
            }
        });
        datasource.validate();
        row(3).code = 'A';
        expect(errors()).toEqual(['2 code', '2 year', '3 code', '3 year']);
        // an edit away: both rules of the one index take it from the other row
        row(3).code = 'B';
        expect(errors()).toEqual([]);
        row(3).code = 'A';
        datasource.getDataContainer().removeData(row(3));
        expect(errors()).toEqual([]);
    });

    it('expect wrong options to throw when the datasource is made', () => {
        const make = (rule: object) =>
            new Datasource({ fields: { code: { validate: [{ id: 'unique', ...rule }] }, year: 'number' } });
        expect(() => make({ with: 'year' })).toThrow(
            "Datasource: field 'code' has the rule 'unique', which takes the other fields as with, a list of their names without 'code'"
        );
        expect(() => make({ with: ['code'] })).toThrow(/without 'code'/);
        expect(() => make({ with: ['year', 'year'] })).toThrow(/without 'code'/);
        expect(() => make({ ignoreCase: 'yes' })).toThrow("rule 'unique', which takes ignoreCase as true or false");
        // a field not listed in fields is a text field: any name
        expect(() => make({ with: ['country'] })).not.toThrow();
    });
});

describe('unique - rows not added yet (the import)', () => {
    it("expect __checkRows to compare with the container's rows and with each other", () => {
        const { datasource } = made([{ id: 1, code: 'A' }]);
        const checked = datasource
            .getDataContainer()
            .__checkRows([{ code: 'A' }, { code: 'B' }, { code: 'C' }, { code: 'C' }, { code: null }, { code: null }])
            .map((errors) => errors.get('code') ?? []);
        expect(checked).toEqual([
            ['Another row has the same value'],
            [],
            ['Another row has the same value'],
            ['Another row has the same value'],
            [],
            []
        ]);
        expect(datasource.hasErrors()).toBe(false);
    });
});

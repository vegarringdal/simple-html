import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, type FilterExpression, type FilterOperator, where } from '../filterExpression';

/**
 * Blank dates (null, undefined, '', invalid Date) in date filters:
 * - a blank row date never matches EQUAL, GREATER_THAN(_OR_EQUAL_TO), LESS_THAN(_OR_EQUAL_TO), nor
 *   the operators the date filter remaps onto those (END_WITH, DOES_NOT_CONTAIN, BEGIN_WITH, CONTAINS)
 * - a blank row date matches NOT_EQUAL_TO
 * - IS_BLANK / IS_NOT_BLANK are unchanged
 * - a date condition with a blank filter value is ignored
 * Before, null compared as 1970-01-01 and the other blanks matched nothing.
 */

const rows = () => [
    { d: null, n: 'null' },
    { d: undefined, n: 'undefined' },
    { d: '', n: 'empty' },
    { d: new Date('not a date'), n: 'invalid' },
    { d: new Date(2020, 0, 1), n: 'date' }
];

const blanks = ['null', 'undefined', 'empty', 'invalid'];

// d is a date field, the type comes from the fields
const dateDatasource = () => new Datasource({ fields: { d: 'date' } });

const filterOn = (filter: FilterExpression) => {
    const ds = dateDatasource();
    ds.setData(rows());
    ds.filter(filter);
    return ds.getRows().map((r) => r.n);
};

const blankMatches = (operator: FilterOperator, value: Date) =>
    filterOn(where('d', operator, value)).filter((n) => blanks.includes(n));

// a date before the epoch, a date on the epoch and a normal date, so a blank that compares as
// 1970 shows up on one side or the other
const values = [new Date(1950, 0, 1), new Date(1970, 0, 1), new Date(2020, 0, 1)];

describe('date filter - blank row dates', () => {
    const neverMatching: FilterOperator[] = [
        'EQUAL',
        'GREATER_THAN',
        'GREATER_THAN_OR_EQUAL_TO',
        'LESS_THAN',
        'LESS_THAN_OR_EQUAL_TO',
        'END_WITH',
        'DOES_NOT_CONTAIN',
        'BEGIN_WITH',
        'CONTAINS'
    ];

    for (const operator of neverMatching) {
        it(`expect no blank to match ${operator}`, () => {
            for (const value of values) {
                expect(blankMatches(operator, value)).toEqual([]);
            }
        });
    }

    it('expect every blank to match NOT_EQUAL_TO', () => {
        for (const value of values) {
            expect(blankMatches('NOT_EQUAL_TO', value)).toEqual(blanks);
        }
    });

    it('expect IS_BLANK and IS_NOT_BLANK to be unchanged', () => {
        expect(filterOn(where('d', 'IS_BLANK'))).toEqual(blanks);
        expect(filterOn(where('d', 'IS_NOT_BLANK'))).toEqual(['date']);
    });

    it('expect the real date to still match', () => {
        expect(filterOn(where('d', 'EQUAL', new Date(2020, 0, 1)))).toEqual(['date']);
    });
});

describe('date filter - blank filter value', () => {
    it('expect a date condition with a blank value to be ignored', () => {
        for (const value of [null, undefined, '', new Date('not a date')]) {
            expect(filterOn(where('d', 'EQUAL', value))).toEqual([...blanks, 'date']);
        }
    });

    it('expect it to be ignored next to another condition too', () => {
        const filter = and(where('d', 'LESS_THAN', null), where('n', 'EQUAL', 'date'));
        expect(filterOn(filter)).toEqual(['date']);
    });

    it('expect getFilterTree to leave it out, like the filter ignores it', () => {
        const ds = dateDatasource();
        ds.setData(rows());
        ds.filter(and(where('d', 'EQUAL', null), where('n', 'EQUAL', 'date')));
        expect(ds.getFilterTree()!.children).toHaveLength(1);
    });
});

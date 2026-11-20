import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

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

const filterOn = (filter: any) => {
    const ds = new Datasource();
    ds.setData(rows());
    ds.filter(filter);
    return ds.getRows().map((r) => r.n);
};

const blankMatches = (operator: string, value: Date) =>
    filterOn({ attribute: 'd', attributeType: 'date', operator, value }).filter((n) => blanks.includes(n));

// a date before the epoch, a date on the epoch and a normal date, so a blank that compares as
// 1970 shows up on one side or the other
const values = [new Date(1950, 0, 1), new Date(1970, 0, 1), new Date(2020, 0, 1)];

describe('date filter - blank row dates', () => {
    const neverMatching = [
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
        expect(filterOn({ attribute: 'd', attributeType: 'date', operator: 'IS_BLANK' })).toEqual(blanks);
        expect(filterOn({ attribute: 'd', attributeType: 'date', operator: 'IS_NOT_BLANK' })).toEqual(['date']);
    });

    it('expect the real date to still match', () => {
        expect(filterOn({ attribute: 'd', attributeType: 'date', operator: 'EQUAL', value: new Date(2020, 0, 1) })).toEqual([
            'date'
        ]);
    });
});

describe('date filter - blank filter value', () => {
    it('expect a date condition with a blank value to be ignored', () => {
        for (const value of [null, undefined, '', new Date('not a date')]) {
            expect(filterOn({ attribute: 'd', attributeType: 'date', operator: 'EQUAL', value })).toEqual([...blanks, 'date']);
        }
    });

    it('expect it to be ignored next to another condition too', () => {
        const filter = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                { type: 'CONDITION', attribute: 'd', attributeType: 'date', operator: 'LESS_THAN', value: null },
                { type: 'CONDITION', attribute: 'n', attributeType: 'text', operator: 'EQUAL', value: 'date' }
            ]
        };
        expect(filterOn(filter)).toEqual(['date']);
    });

    it('expect getFilterTree to leave it out, like the filter ignores it', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                { type: 'CONDITION', attribute: 'd', attributeType: 'date', operator: 'EQUAL', value: null },
                { type: 'CONDITION', attribute: 'n', attributeType: 'text', operator: 'EQUAL', value: 'date' }
            ]
        });
        expect(ds.getFilterTree().children).toHaveLength(1);
    });
});

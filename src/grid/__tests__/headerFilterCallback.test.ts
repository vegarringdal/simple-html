// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { typeInHeaderFilter } from './interactionTestHelpers';

/**
 * Typing in a header filter must only replace the top level conditions on that column.
 * It used to rebuild the whole filter: it kept only the first condition per attribute (a range
 * lost its upper bound), only the first nested group, and threw an OR root away entirely.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 10 },
    { firstname: 'b', lastname: 'y', age: 15 },
    { firstname: 'c', lastname: 'z', age: 20 },
    { firstname: 'd', lastname: 'x', age: 25 },
    { firstname: 'e', lastname: 'y', age: 30 }
];

const condition = (attribute: string, operator: string, value: any, attributeType = 'text') =>
    ({ type: 'CONDITION', attribute, operator, value, attributeType }) as any;

const names = (datasource: any) => datasource.getRows(true).map((row: any) => row.firstname);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('header filter - keeps the rest of the filter', () => {
    it('expect a range on another column to keep both bounds', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                condition('age', 'GREATER_THAN_OR_EQUAL_TO', 15, 'number'),
                condition('age', 'LESS_THAN_OR_EQUAL_TO', 20, 'number')
            ]
        } as any);

        typeInHeaderFilter(element, 'lastname', 'y');

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect a range in a group without logicalOperator to be kept, that is AND too', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({
            filterArguments: [
                condition('age', 'GREATER_THAN_OR_EQUAL_TO', 15, 'number'),
                condition('age', 'LESS_THAN_OR_EQUAL_TO', 20, 'number')
            ]
        } as any);

        typeInHeaderFilter(element, 'lastname', 'y');

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect a single condition set from code on another column to be kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(condition('age', 'GREATER_THAN_OR_EQUAL_TO', 20, 'number'));

        typeInHeaderFilter(element, 'lastname', 'x');

        expect(names(datasource)).toEqual(['d']);
    });

    it('expect every nested group to be kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                {
                    type: 'GROUP',
                    logicalOperator: 'OR',
                    filterArguments: [condition('firstname', 'EQUAL', 'a'), condition('firstname', 'EQUAL', 'd')]
                },
                {
                    type: 'GROUP',
                    logicalOperator: 'OR',
                    filterArguments: [condition('age', 'EQUAL', 10, 'number'), condition('age', 'EQUAL', 15, 'number')]
                }
            ]
        } as any);

        typeInHeaderFilter(element, 'lastname', 'x');

        expect(names(datasource)).toEqual(['a']);
    });

    it('expect an OR root to be kept and narrowed with AND', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [condition('firstname', 'EQUAL', 'a'), condition('firstname', 'EQUAL', 'b')]
        } as any);

        typeInHeaderFilter(element, 'lastname', 'x');

        const filter = datasource.getFilter();
        expect(filter.logicalOperator).toEqual('AND');
        expect(filter.filterArguments.some((arg: any) => arg.logicalOperator === 'OR')).toEqual(true);
        expect(names(datasource)).toEqual(['a']);
    });
});

describe('header filter - replaces its own column', () => {
    it('expect clearing a header to leave the filter editor range on another column alone', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                condition('age', 'GREATER_THAN_OR_EQUAL_TO', 15, 'number'),
                condition('age', 'LESS_THAN_OR_EQUAL_TO', 25, 'number')
            ]
        } as any);
        typeInHeaderFilter(element, 'lastname', 'x');

        typeInHeaderFilter(element, 'lastname', '');

        expect(names(datasource)).toEqual(['b', 'c', 'd']);
    });
});

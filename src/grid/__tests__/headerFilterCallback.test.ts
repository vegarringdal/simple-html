// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, type FilterGroup, isFilterGroup, or, where } from '../../datasource/filterExpression';
import { footerText, mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { typeInHeaderFilter } from './interactionTestHelpers';

/**
 * Typing in a header filter must only replace the top level conditions on that column.
 * It used to rebuild the whole filter: it kept only the first condition per attribute (a range
 * lost its upper bound), only the first nested group, and threw an OR root away entirely.
 * age is a number field (mountGrid's default fields), the rest text.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 10 },
    { firstname: 'b', lastname: 'y', age: 15 },
    { firstname: 'c', lastname: 'z', age: 20 },
    { firstname: 'd', lastname: 'x', age: 25 },
    { firstname: 'e', lastname: 'y', age: 30 }
];

const names = (datasource: any) => datasource.getDataRows().map((row: any) => row.firstname);

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
        datasource.filter(and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 15), where('age', 'LESS_THAN_OR_EQUAL_TO', 20)));

        typeInHeaderFilter(element, 'lastname', 'y');

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect a range in a group without `group` to be kept, that is AND too', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        // only plain js can leave `group` out
        datasource.filter({
            children: [where('age', 'GREATER_THAN_OR_EQUAL_TO', 15), where('age', 'LESS_THAN_OR_EQUAL_TO', 20)]
        } as FilterGroup);

        typeInHeaderFilter(element, 'lastname', 'y');

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect a single condition set from code on another column to be kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20));

        typeInHeaderFilter(element, 'lastname', 'x');

        expect(names(datasource)).toEqual(['d']);
        expect(datasource.getFilter()).toEqual(
            and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20), where('lastname', 'EQUAL', 'x'))
        );
    });

    it('expect every nested group to be kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(
            and(
                or(where('firstname', 'EQUAL', 'a'), where('firstname', 'EQUAL', 'd')),
                or(where('age', 'EQUAL', 10), where('age', 'EQUAL', 15))
            )
        );

        typeInHeaderFilter(element, 'lastname', 'x');

        expect(names(datasource)).toEqual(['a']);
    });

    it('expect an OR root to be kept and narrowed with AND', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(or(where('firstname', 'EQUAL', 'a'), where('firstname', 'EQUAL', 'b')));

        typeInHeaderFilter(element, 'lastname', 'x');

        const filter = datasource.getFilter();
        expect(filter && isFilterGroup(filter) && filter.group).toEqual('AND');
        expect(
            filter && isFilterGroup(filter) && filter.children.some((child) => isFilterGroup(child) && child.group === 'OR')
        ).toEqual(true);
        expect(names(datasource)).toEqual(['a']);
    });
});

describe('header filter - replaces its own column', () => {
    it('expect clearing a header to leave the filter editor range on another column alone', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 15), where('age', 'LESS_THAN_OR_EQUAL_TO', 25)));
        typeInHeaderFilter(element, 'lastname', 'x');

        typeInHeaderFilter(element, 'lastname', '');

        expect(names(datasource)).toEqual(['b', 'c', 'd']);
    });

    it('expect a single condition set from code on the same column to be replaced', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('lastname', 'EQUAL', 'x'));

        typeInHeaderFilter(element, 'lastname', 'y');

        expect(names(datasource)).toEqual(['b', 'e']);
        expect(datasource.getFilter()).toEqual(and(where('lastname', 'EQUAL', 'y')));
    });
});

describe('header filter - a single condition at the root', () => {
    /**
     * v5 only showed a root condition when filter() had wrapped it in a group: one set with
     * setFilter() was filtered on, but the footer showed nothing
     */
    it('expect the footer to show a root condition', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.setFilter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20));
        datasource.filter();

        expect(footerText(element)).toContain('3/5');
        const chips = Array.from(element.querySelectorAll('.footer-filter-chip')).map((chip) =>
            chip.textContent?.replace(/\s+/g, ' ').trim()
        );
        expect(chips).toEqual(['age ≥ 20']);
    });

    it('expect the header condition to be shown next to it in the footer', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20));

        typeInHeaderFilter(element, 'lastname', 'x');

        const chips = Array.from(element.querySelectorAll('.footer-filter-chip')).map((chip) =>
            chip.textContent?.replace(/\s+/g, ' ').trim()
        );
        expect(chips).toEqual(['age ≥ 20', 'lastname = x']);
    });
});

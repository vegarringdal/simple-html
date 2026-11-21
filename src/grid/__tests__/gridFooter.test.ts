// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, where } from '../../datasource/filterExpression';
import { footerText, mountGrid, renderedRows, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * the footer renders the active filter as chips. It runs inside every rebuild, so if it throws
 * the rows are never rendered either.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

const ageOver15 = where('age', 'GREATER_THAN', 15);

describe('grid footer - incomplete filter nodes', () => {
    it('expect a condition without operator or attribute not to break the rebuild', async () => {
        const { element, datasource, gridInterface } = await mountGrid();

        // independent of how the datasource builds the tree: the footer gets a node it can not label
        vi.spyOn(datasource, 'getFilterTree').mockReturnValue({
            kind: 'group',
            group: 'AND',
            children: [{ kind: 'condition', label: undefined, operator: undefined, value: '', hasValue: false } as any]
        });

        expect(() => gridInterface.rebuild()).not.toThrow();
        expect(renderedRows(element)).toHaveLength(5);
        expect(footerText(element)).toContain('5/5');
    });

    it('expect a filter with an empty sub group (filter editor "add sub group") to still render', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter(and(ageOver15, and()));

        expect(renderedRows(element)).toHaveLength(4);
        expect(footerText(element)).toContain('4/5');
    });
});

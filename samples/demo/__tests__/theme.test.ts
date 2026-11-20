// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { mountGrid, stubCanvas, stubElementSizes } from '../../../src/grid/__tests__/gridTestHelpers';
import { applyTheme } from '../theme';

/**
 * The dark theme of the docs site: its css has to match the elements the grid renders.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

describe('dark theme', () => {
    it('expect the row state colours to find the row numbers of new, modified and deleted rows', async () => {
        const { datasource, gridInterface } = await mountGrid();
        const [modified, deleted] = datasource.getDataRows();
        modified.firstname = 'edited';
        datasource.markForDeletion(deleted);
        datasource.addNewEmpty({ firstname: 'new' });
        gridInterface.rebuild();

        applyTheme(true);
        const css = document.getElementById('demo-dark-widgets')?.textContent ?? '';
        const selectors = [...css.matchAll(/([^{}]*row-is-[^{}]*)\{/g)].map((match) =>
            match[1].replace(/\/\*.*?\*\//gs, '').trim()
        );

        expect(selectors).toHaveLength(3);
        for (const selector of selectors) {
            // the grid puts row-is-* on the element around the row number: used to match nothing
            expect(document.querySelector(selector), selector).not.toBeNull();
        }
        applyTheme(false);
    });
});

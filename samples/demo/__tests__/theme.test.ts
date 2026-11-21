// @vitest-environment happy-dom
// reads index.css (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { mountGrid, stubCanvas, stubElementSizes } from '../../../src/grid/__tests__/gridTestHelpers';
import { applyTheme } from '../theme';

/**
 * The dark theme of the docs site: the dark class on the body, index.css sets color-scheme: dark for
 * it, and the grid follows (light-dark() in grid.css). The row state colours are the site's own: they
 * have to match the elements the grid renders, in both themes.
 */

const INDEX_CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

describe('dark theme', () => {
    it('expect the dark theme to be the dark class on the body, and nothing else', () => {
        applyTheme(true);
        expect(document.body.classList.contains('dark')).toBe(true);
        // no style tag of dark colours for the grid anymore (it was #demo-dark-widgets): it follows color-scheme
        expect(document.getElementById('demo-dark-widgets')).toBeNull();

        applyTheme(false);
        expect(document.body.classList.contains('dark')).toBe(false);
    });

    it('expect index.css to set color-scheme: dark with the dark class, on the body: the menus are there too', () => {
        const rule = /(^|})\s*body\.dark\s*\{([^}]*)\}/.exec(INDEX_CSS);

        expect(rule?.[2]).toMatch(/color-scheme:\s*dark;/);
    });

    it('expect the row state colours to find the row numbers of new, modified and deleted rows, light and dark', async () => {
        const { datasource, gridInterface } = await mountGrid();
        const [modified, deleted] = datasource.getDataRows();
        modified.firstname = 'edited';
        datasource.markForDeletion(deleted);
        datasource.addNewEmpty({ firstname: 'new' });
        gridInterface.rebuild();

        const rules = [...INDEX_CSS.matchAll(/([^{}]*row-is-[^{}]*)\{([^}]*)\}/g)].map((match) => ({
            selector: match[1].trim(),
            body: match[2]
        }));

        expect(rules).toHaveLength(3);
        for (const { selector, body } of rules) {
            // the grid puts row-is-* on the element around the row number
            expect(document.querySelector(selector), selector).not.toBeNull();
            expect(body, selector).toMatch(/color:\s*light-dark\(/);
        }
    });
});

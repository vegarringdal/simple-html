// @vitest-environment happy-dom
// reads index.css (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyTheme } from '../theme';

/**
 * The dark theme of the docs site: the dark class on the body, index.css sets color-scheme: dark for
 * it, and the grid follows (light-dark() in grid.css). The row state is the grid's own (rowStatus),
 * the site does not style it.
 */

const INDEX_CSS = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

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

    it("expect index.css not to style the row state: the grid shows it, in its theme's colours", () => {
        expect(INDEX_CSS).not.toMatch(/row-is-/);
    });
});

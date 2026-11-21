// @vitest-environment happy-dom
// reads index.css (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initTheme } from '../theme';

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

describe('the theme at start', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const osPrefersDark = (dark: boolean) =>
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query === '(prefers-color-scheme: dark)' }));

    it('expect the OS theme when the user has not chosen one', () => {
        osPrefersDark(true);
        initTheme();
        expect(document.body.classList.contains('dark')).toBe(true);

        osPrefersDark(false);
        initTheme();
        expect(document.body.classList.contains('dark')).toBe(false);
    });

    it('expect the theme chosen with the button to win over the OS', () => {
        osPrefersDark(true);
        applyTheme(false);
        initTheme();
        expect(document.body.classList.contains('dark')).toBe(false);

        osPrefersDark(false);
        applyTheme(true);
        initTheme();
        expect(document.body.classList.contains('dark')).toBe(true);
    });
});

describe('the colours of the site', () => {
    /** the declarations of index.css outside the :root rules, where the light-dark() tokens are */
    const outsideRoot = INDEX_CSS.replace(/(^|})\s*:root\s*\{[^}]*\}/g, '$1');

    it('expect every colour to be a token of :root: light and dark, nothing written for one theme only', () => {
        // the only colours left are the same in both: the scrollbar thumb's shadow, the translucent
        // backgrounds of the cellClass sample
        const literals = outsideRoot.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
        expect(literals).toEqual(['rgb(0 0 0 / 30%)', 'rgba(239, 68, 68, 0.25)', 'rgba(34, 197, 94, 0.25)']);
    });

    it('expect every token of :root to have a light and a dark colour', () => {
        const root = [...INDEX_CSS.matchAll(/(^|})\s*:root\s*\{([^}]*)\}/g)].map((match) => match[2]).join('\n');
        const tokens = [...root.matchAll(/(--demo-[\w-]+):\s*([^;]+);/g)];
        expect(tokens.length).toBeGreaterThan(20);
        for (const [, name, value] of tokens) {
            expect(`${name}: ${value}`).toMatch(/: light-dark\(/);
        }
    });

    it('expect body.dark to only switch the color-scheme: the tokens do the rest', () => {
        const rule = /(^|})\s*body\.dark\s*\{([^}]*)\}/.exec(INDEX_CSS);
        expect(rule?.[2].trim()).toBe('color-scheme: dark;');
    });
});

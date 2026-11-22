import { describe, expect, it } from 'vitest';
import { readCss, takeRule } from './themeCss';

/**
 * The built-in tooltip (tooltip.ts) is painted over everything of the grid: in the filter editor the
 * inputs (z-index 1000) were over the tooltip of Aa (600) - a flex item paints by its z-index, also when
 * it is not positioned. Its z-index has to stay over every other z-index of the css files.
 */

/** every z-index of a block of css, as numbers */
function zIndexes(css: string): number[] {
    return [...css.matchAll(/z-index\s*:\s*(-?\d+)/g)].map((match) => Number(match[1]));
}

describe('the tooltip layer', () => {
    it('expect the tooltip over every other layer of grid.css, date.css and the TreDeSpace theme', () => {
        const { body, rest } = takeRule(readCss('grid.css'), '.simple-html-grid.simple-html-grid-tooltip');
        const [tooltip] = zIndexes(body);
        expect(tooltip).toBe(10000);

        const others = [...zIndexes(rest), ...zIndexes(readCss('date.css')), ...zIndexes(readCss('theme-tredespace.css'))];
        expect(others.length).toBeGreaterThan(10);
        expect(Math.max(...others)).toBeLessThan(tooltip);
    });
});

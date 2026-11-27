// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, where } from '../../datasource/filterExpression';
import { footerText, mountGrid, renderedRows, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

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

/**
 * Without a filter the footer has a button "No filter" where Clear and the chips are with one: a click
 * opens the filter editor, as the chips and the filter menu's "Advanced Filter…" do
 */
describe('grid footer - the button "No filter"', () => {
    const noFilter = (element: Element) => element.querySelector('.footer-filter-none') as HTMLButtonElement | null;
    const clear = (element: Element) => element.querySelector('.footer-filter-clear') as HTMLButtonElement | null;
    const editorOpen = () => document.querySelector('dialog.filter-editor-content')?.hasAttribute('open') === true;
    /** the parts of the filter's row as text: the button, the chips, the connectors */
    const rowParts = (element: Element) =>
        Array.from(element.querySelectorAll('.footer-filter > *'), (part) => part.textContent?.replace(/\s+/g, ' ').trim());

    it('expect it without a filter, alone in the row under the count, with its tooltip', async () => {
        const { element } = await mountGrid();

        const button = noFilter(element) as HTMLButtonElement;
        expect(button.tagName).toEqual('BUTTON');
        // not a submit button: the grid can be in a form
        expect(button.type).toEqual('button');
        expect(button.textContent?.trim()).toEqual('No filter');
        expect(button.title).toEqual('Open the filter editor');
        expect(rowParts(element)).toEqual(['No filter']);
        expect(clear(element)).toBeNull();
        expect(element.querySelector('.footer-count')?.textContent?.trim()).toEqual('5/5');
    });

    it('expect a click to open the filter editor', async () => {
        const { element } = await mountGrid();

        noFilter(element)?.click();

        expect(editorOpen()).toBe(true);
    });

    it('expect Clear and the chips in its place with a filter, and it back after Clear', async () => {
        const { element, datasource } = await mountGrid();

        datasource.filter(ageOver15);
        expect(noFilter(element)).toBeNull();
        expect(rowParts(element)).toEqual(['✕ Clear', 'Age > 15']);

        clear(element)?.click();
        expect(datasource.getFilter()).toBeNull();
        expect(rowParts(element)).toEqual(['No filter']);
    });

    it('expect it gone while only the changed rows are shown, and while Find filters the rows', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        datasource.getDataRows()[0].firstname = 'changed';

        datasource.filterChangedOnly(true);
        expect(noFilter(element)).toBeNull();
        expect(rowParts(element)).toEqual(['✕ Clear', 'Changed rows only']);
        datasource.filterChangedOnly(false);
        expect(rowParts(element)).toEqual(['No filter']);

        gridInterface.find('first2', { filterRows: true });
        expect(noFilter(element)).toBeNull();
        expect(rowParts(element)).toEqual(['✕ Clear', 'Find: first2']);
        clear(element)?.click();
        expect(rowParts(element)).toEqual(['No filter']);
    });

    it('expect one element for Clear and "No filter": the focus stays on it when a filter comes and goes', async () => {
        const { element, datasource } = await mountGrid();
        const button = noFilter(element) as HTMLButtonElement;
        button.focus();

        datasource.filter(ageOver15);
        expect(clear(element)).toBe(button);
        expect(button.title).toEqual('Clear filter');
        expect(document.activeElement).toBe(button);

        button.click();
        expect(noFilter(element)).toBe(button);
        expect(document.activeElement).toBe(button);
        // and a click opens the editor again, it does not clear
        button.click();
        expect(editorOpen()).toBe(true);
    });

    it('expect the count in the scrollbar band with and without a filter: it does not move, it stays a status', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const band = `${gridInterface.__getGridConfig().__scrollbarSize}px`;
        const inner = element.querySelector('.footer-inner') as HTMLElement;
        const count = element.querySelector('.footer-count') as HTMLElement;
        const look = () => ({ padding: inner.style.paddingTop, height: count.style.height, lineHeight: count.style.lineHeight });

        expect(inner.classList.contains('no-filter')).toBe(true);
        expect(inner.classList.contains('has-filter')).toBe(false);
        expect(look()).toEqual({ padding: band, height: band, lineHeight: band });

        datasource.filter(ageOver15);
        expect(inner.classList.contains('no-filter')).toBe(false);
        expect(inner.classList.contains('has-filter')).toBe(true);
        expect(look()).toEqual({ padding: band, height: band, lineHeight: band });
        expect(element.querySelector('.footer-count')).toBe(count);
        expect(count.getAttribute('role')).toEqual('status');
    });

    it('expect it with the header filters hidden too: then it is the way into the filter editor', async () => {
        const { element } = await mountGrid({ ...simpleConfig(), hideFilter: true });

        noFilter(element)?.click();
        expect(editorOpen()).toBe(true);
    });

    it('expect none in a footer of no height: the count alone, in the middle', async () => {
        const { element, datasource } = await mountGrid({ ...simpleConfig(), footerHeight: 0 });
        const inner = element.querySelector('.footer-inner') as HTMLElement;

        expect(noFilter(element)).toBeNull();
        expect(element.querySelector('.footer-filter')).toBeNull();
        expect(inner.classList.contains('no-filter')).toBe(false);
        expect(inner.style.paddingTop).toEqual('');

        // Clear and the chips as before with a filter
        datasource.filter(ageOver15);
        expect(rowParts(element)).toEqual(['✕ Clear', 'Age > 15']);
    });

    it('expect the texts of the config', async () => {
        const { element } = await mountGrid({
            ...simpleConfig(),
            texts: { 'footer.noFilter': 'Ingen filter', 'footer.noFilter.tooltip': 'Åpne filterredigeringen' }
        });

        expect(noFilter(element)?.textContent?.trim()).toEqual('Ingen filter');
        expect(noFilter(element)?.title).toEqual('Åpne filterredigeringen');
    });
});

/**
 * The summary of the selected cells is at the footer's right, on the line of the filter's row: on a
 * narrow grid it is cut where the row ends. happy-dom lays nothing out: the rects are given here
 */
describe('grid footer - the summary of the selected cells beside the filter row', () => {
    let rects: Record<string, [number, number]> = {};
    const range = { fromRow: 0, fromField: 'age', toRow: 2, toField: 'age' };
    const summaryWidth = (element: Element) => (element.querySelector('.footer-summary') as HTMLElement).style.maxWidth;

    beforeEach(() => {
        rects = {};
        const original = HTMLElement.prototype.getBoundingClientRect;
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const found = Object.keys(rects).find((name) => this.classList.contains(name));
            if (!found) {
                return original.call(this);
            }
            const [left, right] = rects[found];
            return { left, right, top: 0, bottom: 45, width: right - left, height: 45, x: left, y: 0, toJSON: () => ({}) };
        });
    });

    it('expect it cut where "No filter" ends when it would reach under it, 12px between them', async () => {
        const { element, gridInterface } = await mountGrid();
        rects = { 'footer-filter': [450, 560], 'footer-summary': [500, 992] };

        gridInterface.setRanges([range]);

        expect(summaryWidth(element)).toEqual(`${992 - 560 - 12}px`);
    });

    it('expect the chips collapsed to one box when they are under it - also when they start right of its start', async () => {
        const { element, gridInterface, datasource } = await mountGrid();
        datasource.filter(where('age', 'GREATER_THAN', 10));
        // with the settings button the footer keeps room on both sides: the summary can start left of the chips
        rects = { 'footer-filter-chips': [520, 600], 'footer-summary': [500, 960] };

        gridInterface.setRanges([range]);

        expect(element.querySelector('.footer-filter-toomany')).not.toBeNull();
    });

    it('expect it as the css makes it when they are apart, also after it was cut', async () => {
        const { element, gridInterface } = await mountGrid();
        rects = { 'footer-filter': [450, 560], 'footer-summary': [500, 992] };
        gridInterface.setRanges([range]);
        expect(summaryWidth(element)).toEqual('420px');

        rects = { 'footer-filter': [450, 560], 'footer-summary': [600, 992] };
        gridInterface.setRanges([{ ...range, toRow: 3 }]);
        expect(summaryWidth(element)).toEqual('');
    });
});

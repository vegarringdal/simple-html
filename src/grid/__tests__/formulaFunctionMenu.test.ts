// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FUNCTIONS } from '../formula';
import { FUNCTION_GROUPS, withFunction } from '../gridFunctions/formulaFunctionMenu';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuTreeEntries, openMenus } from './interactionTestHelpers';

/**
 * formulaFunctionMenu.ts: the ƒ button beside a formula - a menu of every function of the language, in
 * four submenus, each with its tooltip; picked, the function is put in at the caret, around a selection
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('the functions of the menu', () => {
    it('expect every function of the language once, in a submenu', () => {
        const listed = Object.values(FUNCTION_GROUPS).flat();
        expect([...listed].sort()).toEqual([...FUNCTIONS.keys()].sort());
        expect(new Set(listed).size).toBe(listed.length);
    });
});

describe('withFunction', () => {
    it('expect the function at the caret, the caret between its brackets', () => {
        expect(withFunction('{a} + ', 6, 6, 'ROUND')).toEqual({ text: '{a} + ROUND()', caret: 12 });
    });

    it('expect a selection wrapped, the caret after the call', () => {
        expect(withFunction('x {name} y', 2, 8, 'LEFT')).toEqual({ text: 'x LEFT({name}) y', caret: 14 });
    });

    it('expect TODAY() whole, the caret after it', () => {
        expect(withFunction('DAYS({due}, )', 12, 12, 'TODAY')).toEqual({ text: 'DAYS({due}, TODAY())', caret: 19 });
    });
});

describe('the ƒ button of a calculated column', () => {
    it('expect a menu of four submenus, each function with its tooltip; picked, put in the formula', async () => {
        const { gridInterface } = await mountGrid(
            { layout: { center: [{ fields: ['name'], width: 100 }] } },
            [{ id: 1, name: 'Ann' }],
            { key: 'id' }
        );
        gridInterface.openColumnSettings('name');
        const dialog = document.querySelector('dialog.column-settings') as HTMLElement;
        const add = Array.from(dialog.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Add calculated column')
        ) as HTMLElement;
        add.click();
        const formula = dialog.querySelector('input[id$="-settings-calculated-formula"]') as HTMLInputElement;
        const ƒ = dialog.querySelector('.column-settings-insert-function') as HTMLElement;
        expect(ƒ.getAttribute('aria-label')).toBe('Insert a function');
        ƒ.click();
        const entries = menuTreeEntries();
        const submenus = entries
            .filter((entry) => entry.getAttribute('aria-haspopup') === 'menu')
            .map((entry) => entry.textContent?.trim());
        expect(submenus).toEqual(
            ['Logic ›', 'Numbers ›', 'Dates ›', 'Text ›'].map((label) => expect.stringContaining(label.replace(' ›', '')))
        );
        const left = entries.find((entry) => entry.getAttribute('data-menu-id') === 'formula.function.LEFT') as HTMLElement;
        expect(left.textContent?.trim()).toBe('LEFT(text, n)');
        expect(left.getAttribute('data-tooltip')).toBe('the first n characters');
        expect(left.getAttribute('aria-description')).toBe('the first n characters');
        left.click();
        expect(openMenus()).toHaveLength(0);
        expect((dialog.querySelector('input[id$="-settings-calculated-formula"]') as HTMLInputElement).value).toBe('LEFT()');
        expect(formula.isConnected).toBe(true);
    });
});

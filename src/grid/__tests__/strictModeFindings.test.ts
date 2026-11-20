// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { FilterGroup } from '../../datasource/filterExpression';
import { GridInterface } from '../gridInterface';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * Bugs found while turning on TypeScript strict mode.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

/**
 * errors thrown inside event listeners do not reach dispatchEvent, they are reported on window
 */
function collectErrors() {
    const errors: unknown[] = [];
    const listener = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener('error', listener);
    return { errors, stop: () => window.removeEventListener('error', listener) };
}

describe('grid interface without a connected grid', () => {
    it('expect the menu and column helpers not to throw before the grid is in the dom', () => {
        const gridInterface = new GridInterface(simpleConfig(), new Datasource());
        const cell = document.createElement('div');

        expect(() => gridInterface.contextMenuCustom(new MouseEvent('contextmenu'), [], cell, () => {})).not.toThrow();
        expect(() => gridInterface.removeContextMenuElement()).not.toThrow();
        // the columns come from the config, no grid needed
        expect(gridInterface.getAttributeColumns(false)).toEqual(['firstname', 'lastname', 'age']);
        expect(gridInterface.getOptionalAttributes()).toEqual([]);
    });
});

describe('header label cells', () => {
    it('expect mousedown on an empty label cell not to throw', async () => {
        // the second column has one row, the first two - so it has an empty label cell
        const { element } = await mountGrid(
            {
                columnsCenter: [
                    { rows: ['firstname', 'lastname'], width: 100 },
                    { rows: ['age'], width: 100 }
                ],
                attributes: [{ attribute: 'firstname' }, { attribute: 'lastname' }, { attribute: 'age' }]
            },
            [{ firstname: 'a', lastname: 'b', age: 1 }]
        );
        const emptyLabel = Array.from(element.querySelectorAll('.simple-html-label')).find(
            (cell: any) => cell.getAttribute('type') === 'label' && !cell.$attribute
        ) as HTMLElement;
        expect(emptyLabel).toBeDefined();

        const { errors, stop } = collectErrors();
        emptyLabel.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
        stop();

        expect(errors).toEqual([]);
    });
});

describe('filter editor', () => {
    it('expect "add condition" to work on a group set from code without children', async () => {
        const { gridInterface, datasource } = await mountGrid();
        // only plain js can leave children out
        datasource.setFilter({ group: 'AND' } as FilterGroup);
        gridInterface.openFilterEditor();

        const addCondition = document.querySelector('[data-tooltip="Add a condition to this group"]') as HTMLElement;
        const { errors, stop } = collectErrors();
        (addCondition.querySelector('svg') ?? addCondition).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        stop();

        // threw "Cannot read properties of undefined (reading 'push')"
        expect(errors).toEqual([]);
    });
});

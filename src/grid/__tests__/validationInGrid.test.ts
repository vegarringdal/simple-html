// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { ColumnConfig, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The grid shows the validation errors: a cell with an error gets `simple-html-cell-error` and its
 * messages as the tooltip, the row selector `simple-html-row-error` with the row's errors - the
 * server's (`__rowError`) and the validation errors. A field with the `required` rule gets the
 * stripes of an empty required cell (`simple-html-mandatory`), what `mandatory` did before.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const config = (): GridConfig => ({
    readonly: false,
    columns: { name: { label: 'Name' } },
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['age'], width: 100 }
        ]
    }
});

const data = () => [
    { id: 1, name: 'Ann', age: 36 },
    { id: 2, name: '', age: 0 },
    { id: 3, name: 'Cid', age: 52 }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: {
        name: { validate: ['required', { id: 'maxLength', value: 5 }] },
        age: { type: 'number', validate: ['required', { id: 'max', value: 120, message: 'at most {value}' }] }
    }
});

/** the input of a body cell: its field and its row in the displayed rows, 0 based */
function cellInput(element: GridElement, field: string, row: number): HTMLInputElement {
    return Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
}

/** the cell element of a body cell, where the error class and the tooltip go */
const cellOf = (element: GridElement, field: string, row: number) =>
    cellInput(element, field, row).closest('.simple-html-grid-col-cell') as HTMLElement;

/** the background element of a body cell, where the stripes go */
const backgroundOf = (element: GridElement, field: string, row: number) =>
    cellOf(element, field, row).querySelector(`[data-attribute-dimmed="${field}"]`) as HTMLElement;

/** the row selector of a displayed row: the element with the row number */
function selectorOf(element: GridElement, row: number): HTMLElement {
    const rowElement = Array.from(
        element.querySelectorAll('.simple-html-grid-body-row-container-selector .simple-html-grid-row')
    ).find((candidate) => candidate.getAttribute('aria-rowindex') === String(row + 1));
    return rowElement?.firstElementChild as HTMLElement;
}

/** types into a cell the way a user does: the input event per key */
function typeInCell(element: GridElement, field: string, row: number, text: string) {
    const input = cellInput(element, field, row);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('validation in the grid - the required stripes', () => {
    it('expect an empty required cell to be striped, 0 in a number field too, until it has a value', async () => {
        const { element } = await mountGrid(config(), data(), fields());

        expect(backgroundOf(element, 'name', 1).className).toContain('simple-html-mandatory');
        expect(backgroundOf(element, 'age', 1).className).toContain('simple-html-mandatory');
        expect(backgroundOf(element, 'name', 0).className).not.toContain('simple-html-mandatory');
        expect(backgroundOf(element, 'age', 0).className).not.toContain('simple-html-mandatory');
    });

    it('expect no stripes without the rule, in a readonly grid, or on a readonly cell', async () => {
        const noRules = await mountGrid(config(), data(), { key: 'id', fields: { age: 'number' } });
        expect(noRules.element.querySelectorAll('.simple-html-mandatory')).toHaveLength(0);
        noRules.element.remove();

        const readonlyGrid = await mountGrid({ ...config(), readonly: true }, data(), fields());
        expect(readonlyGrid.element.querySelectorAll('.simple-html-mandatory')).toHaveLength(0);
        readonlyGrid.element.remove();

        const readonlyCell = await mountGrid({ ...config(), columns: { name: { readonly: true } } }, data(), fields());
        expect(backgroundOf(readonlyCell.element, 'name', 1).className).toContain('simple-html-readonly');
        expect(backgroundOf(readonlyCell.element, 'name', 1).className).not.toContain('simple-html-mandatory');
    });

    it('expect a column with mandatory (v5, plain js or a stored config) to throw a TypeError naming the rule', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), data(), fields());
        // plain js, or a config stored before v6
        const name: ColumnConfig = { label: 'Name' };
        Reflect.set(name, 'mandatory', true);
        const withMandatory: GridConfig = { ...config(), columns: { name } };

        expect(() => new GridInterface(withMandatory, datasource)).toThrow(
            "GridConfig: columns.name.mandatory is gone in v6, it is the required rule of the datasource field: new Datasource({ fields: { name: { validate: ['required'] } } })"
        );
        expect(() => gridInterface.updateConfig({ columns: withMandatory.columns })).toThrow(TypeError);
    });
});

describe('validation in the grid - an edit', () => {
    it('expect typing an invalid value to show the error on the cell and the row selector at once', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());

        typeInCell(element, 'name', 0, 'Annabelle');

        expect(datasource.getErrors().map((error) => error.field)).toEqual(['name']);
        const cell = cellOf(element, 'name', 0);
        expect(cell.classList.contains('simple-html-cell-error')).toBe(true);
        expect(cell.getAttribute('data-tooltip')).toEqual('Must be at most 5 characters');
        // the input is not rendered again while the user types
        expect(cellInput(element, 'name', 0).value).toEqual('Annabelle');

        const selector = selectorOf(element, 0);
        expect(selector.classList.contains('simple-html-row-error')).toBe(true);
        expect(selector.getAttribute('data-tooltip')).toEqual('Name: Must be at most 5 characters');
    });

    it('expect typing a valid value again to clear both', async () => {
        const { element } = await mountGrid(config(), data(), fields());
        typeInCell(element, 'name', 0, 'Annabelle');
        typeInCell(element, 'name', 0, 'Anna');

        expect(cellOf(element, 'name', 0).classList.contains('simple-html-cell-error')).toBe(false);
        expect(cellOf(element, 'name', 0).hasAttribute('data-tooltip')).toBe(false);
        expect(selectorOf(element, 0).classList.contains('simple-html-row-error')).toBe(false);
        expect(selectorOf(element, 0).hasAttribute('data-tooltip')).toBe(false);
    });

    it('expect the change event (blur, enter) to validate too', async () => {
        const { element } = await mountGrid(config(), data(), fields());
        const input = cellInput(element, 'age', 0);
        input.value = '200';
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(cellOf(element, 'age', 0).getAttribute('data-tooltip')).toEqual('at most 120');
    });

    it('expect an edit from code to show after refresh(), like the value', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields());
        datasource.getDataRows()[2].name = '';
        gridInterface.refresh();

        expect(cellOf(element, 'name', 2).getAttribute('data-tooltip')).toEqual('Required');
    });
});

describe('validation in the grid - validate()', () => {
    it('expect the errors to show without a refresh(): the grid follows the validate event', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());
        expect(element.querySelectorAll('.simple-html-cell-error')).toHaveLength(0);

        datasource.validate();

        expect(cellOf(element, 'name', 1).getAttribute('data-tooltip')).toEqual('Required');
        expect(cellOf(element, 'age', 1).getAttribute('data-tooltip')).toEqual('Required');
        expect(element.querySelectorAll('.simple-html-cell-error')).toHaveLength(2);
        expect(selectorOf(element, 1).getAttribute('data-tooltip')).toEqual('Name: Required\nAge: Required');
    });

    it('expect acceptChanges() to take the errors off the grid', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());
        datasource.validate();

        datasource.acceptChanges();

        expect(element.querySelectorAll('.simple-html-cell-error, .simple-html-row-error')).toHaveLength(0);
    });

    it('expect a row marked for deletion to show no validation errors', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());
        datasource.validate();

        datasource.markForDeletion(datasource.getDataRows()[1]);

        expect(element.querySelectorAll('.simple-html-cell-error, .simple-html-row-error')).toHaveLength(0);
    });
});

describe('validation in the grid - the errors of a server', () => {
    it('expect the row selector to show a server error, the cells not', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields());
        datasource.getDataContainer().setErrors(new Map([['1', 'The name is taken']]));
        gridInterface.refresh();

        expect(selectorOf(element, 0).classList.contains('simple-html-row-error')).toBe(true);
        expect(selectorOf(element, 0).getAttribute('data-tooltip')).toEqual('The name is taken');
        expect(element.querySelectorAll('.simple-html-cell-error')).toHaveLength(0);
    });

    it('expect both on one row: the server error first, then the validation errors', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());
        datasource.getDataContainer().setErrors(new Map([['2', 'Refused by the server']]));
        datasource.validate();

        expect(selectorOf(element, 1).getAttribute('data-tooltip')).toEqual(
            'Refused by the server\nName: Required\nAge: Required'
        );
    });
});

describe('validation in the grid - the tooltip', () => {
    const hover = (target: HTMLElement) => target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const tooltip = () => document.querySelector('.simple-html-grid-tooltip') as HTMLElement | null;

    it("expect hovering a cell with an error to show the grid's tooltip with its messages", async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields());
        datasource.validate();

        hover(cellInput(element, 'name', 1));

        expect(tooltip()?.style.display).toEqual('block');
        expect(tooltip()?.textContent).toEqual('Required');
    });

    it('expect tooltips: false to show none, the data-tooltip is still written', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields());
        gridInterface.updateConfig({ tooltips: false });
        datasource.validate();

        hover(cellInput(element, 'name', 1));

        expect(tooltip()?.style.display ?? 'none').toEqual('none');
        expect(cellOf(element, 'name', 1).getAttribute('data-tooltip')).toEqual('Required');
    });
});

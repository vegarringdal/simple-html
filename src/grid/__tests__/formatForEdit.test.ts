// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Formatter } from '../../datasource/formatter';
import { registerFormatter } from '../../datasource/formatterRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * Formatter.formatForEdit: what a cell shows while it is edited - its input has the focus - the plain
 * value to type over instead of the formatted text ('25008.76' for '25 008.76'). The cell shows the
 * formatted text again when it loses the focus. Left out, format is used.
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

// two decimals, a space between the thousands; edited as the plain number
const money: Formatter = {
    format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
    formatForEdit: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text) => (text.trim() === '' ? null : Number(text.replaceAll(' ', '')))
};
registerFormatter('test-money', money);
registerFormatter('test-money-no-edit', { format: money.format, parse: money.parse });

const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['price'], width: 100 }
        ]
    },
    ...options
});

const mount = (formatter = 'test-money', options: Partial<GridConfig> = {}) =>
    mountGrid(
        config(options),
        [
            { id: 1, name: 'a', price: 25008.76 },
            { id: 2, name: 'b', price: null }
        ],
        {
            key: 'id',
            fields: { id: 'number', price: { type: 'number', formatter } }
        }
    );

/** the input of a body cell: its field and its row in the displayed rows, 0 based */
function cellInput(element: GridElement, field: string, row: number): HTMLInputElement {
    return Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
}

/** types into an input as the user does: the text, then an input event */
function type(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('formatForEdit', () => {
    it('expect the formatted text, the plain value while the cell has the focus, the formatted text again after', async () => {
        const { element } = await mount();
        const input = () => cellInput(element, 'price', 0);
        expect(input().value).toEqual('25 008.76');

        input().focus();
        expect(input().value).toEqual('25008.76');

        input().blur();
        expect(input().value).toEqual('25 008.76');
    });

    it('expect what is typed over it parsed and stored, and shown formatted after', async () => {
        const { element, datasource } = await mount();
        const input = cellInput(element, 'price', 0);

        input.focus();
        type(input, '30000.5');
        expect(datasource.getDataRows()[0].price).toEqual(30000.5);
        input.blur();

        expect(cellInput(element, 'price', 0).value).toEqual('30 000.50');
    });

    it('expect a blank as blank', async () => {
        const { element } = await mount();
        const input = cellInput(element, 'price', 1);

        input.focus();
        expect(input.value).toEqual('');
    });

    it('expect the formatted text in a cell that can not be edited: a readonly grid', async () => {
        const { element } = await mount('test-money', { readonly: true });
        const input = cellInput(element, 'price', 0);

        input.focus();
        expect(input.value).toEqual('25 008.76');
    });

    it('expect format in the focus too without formatForEdit, as before', async () => {
        const { element } = await mount('test-money-no-edit');
        const input = cellInput(element, 'price', 0);

        input.focus();
        expect(input.value).toEqual('25 008.76');
    });
});

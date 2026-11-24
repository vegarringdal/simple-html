// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * A grid on a datasource whose fields change (datasource.setFields()): the cells by the new types, the
 * display formats the new types do not take dropped
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

const config = (): GridConfig => ({
    columns: { born: { format: { date: 'norwegian', label: 'Born' } }, amount: {} },
    layout: { center: ['born', 'amount'].map((field) => ({ fields: [field], width: 100 })) }
});

const rows = () => [{ id: 1, born: new Date(2026, 10, 22), amount: 1234.5 }];

describe('setFields under a grid', () => {
    it('expect the cells shown by the new types', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), rows(), { key: 'id', fields: { born: 'date' } });
        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026']);
        gridInterface.setState({ typeFormats: { number: { decimals: 2, thousands: ' ', decimal: ',' } } });
        expect(renderedColumn(element, 'amount')).toEqual(['1234.5']);

        datasource.setFields({ born: 'date', amount: 'number' });
        expect(renderedColumn(element, 'amount')).toEqual(['1 234,50']);
    });

    it("expect a format the new type does not take dropped, with a warning - the rest of the column's format kept", async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { datasource, gridInterface } = await mountGrid(config(), rows(), { key: 'id', fields: { born: 'date' } });

        datasource.setFields({ born: 'text' });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain("the format of 'born' is dropped");
        expect(gridInterface.getState().formats).toEqual({ born: { label: 'Born' } });
        // and resetState does not bring it back
        gridInterface.resetState();
        expect(gridInterface.getState().formats).toEqual({ born: { label: 'Born' } });
    });

    it('expect a grid not on the page to check its formats when it is put back', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { element, datasource, gridInterface } = await mountGrid(config(), rows(), { key: 'id', fields: { born: 'date' } });
        element.remove();
        datasource.setFields({ born: 'text' });
        expect(warn).not.toHaveBeenCalled();
        document.body.appendChild(element);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(gridInterface.getState().formats).toEqual({ born: { label: 'Born' } });
    });

    it('expect nothing from the datasource after the grid is destroyed', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { datasource, gridInterface } = await mountGrid(config(), rows(), { key: 'id', fields: { born: 'date' } });
        gridInterface.destroy();
        datasource.setFields({ born: 'text' });
        expect(warn).not.toHaveBeenCalled();
    });
});

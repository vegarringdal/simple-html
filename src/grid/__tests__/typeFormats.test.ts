// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isGroupRow } from '../../datasource/entity';
import { type TypeFormats, withTypeFormat } from '../columnFormat';
import type { GridConfig } from '../gridConfig';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openLabelMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The formats by type (`GridConfig.typeFormats`, `GridState.typeFormats`, TypeFormats in
 * columnFormat.ts): every date, datetime and number column without a format of its own shows its
 * type's. And the Defaults tab of the grid config dialog (gridDefaultsSettings.ts): the formats by type
 * and the default view.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { name: 'Ann', born: new Date(2026, 10, 22), seen: new Date(2026, 10, 22, 13, 45), balance: 1234.5, code: 0 },
    { name: 'Bob', born: new Date(2026, 11, 1), seen: new Date(2026, 11, 1, 8, 5), balance: 0, code: 1 }
];

const fields = () => ({
    fields: { born: 'date' as const, seen: 'datetime' as const, balance: 'number' as const, code: 'number' as const }
});

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        name: { label: 'Name' },
        born: { label: 'Born' },
        seen: { label: 'Seen' },
        balance: { label: 'Balance' },
        code: { label: 'Code' }
    },
    layout: { center: ['name', 'born', 'seen', 'balance', 'code'].map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const norwegian: TypeFormats = {
    date: 'norwegian',
    datetime: 'norwegianTime',
    number: { decimals: 2, thousands: ' ', decimal: ',' }
};

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const tab = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLElement>(':scope > [role="tablist"] [role="tab"]')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLElement;
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const typePicker = (type: string) => dialog().querySelector(`.grid-defaults-format[data-type="${type}"]`) as HTMLButtonElement;
const viewPicker = () => dialog().querySelector('.grid-defaults-view') as HTMLButtonElement;
const columnPicker = () => dialog().querySelector('.column-settings-body .column-settings-format') as HTMLButtonElement;
const previewCell = () => dialog().querySelector('.column-settings-preview-cell') as HTMLElement;

describe('withTypeFormat', () => {
    it("expect the type's format for a column without a date or number format of its own, the rest of its format kept", () => {
        expect(withTypeFormat(undefined, 'date', norwegian)).toEqual({ date: 'norwegian' });
        expect(withTypeFormat({ label: 'Born' }, 'date', norwegian)).toEqual({ label: 'Born', date: 'norwegian' });
        expect(withTypeFormat(undefined, 'datetime', norwegian)).toEqual({ date: 'norwegianTime' });
        expect(withTypeFormat({ numberOverride: 'ZERO_TO_BLANK' }, 'number', norwegian)).toEqual({
            numberOverride: 'ZERO_TO_BLANK',
            number: norwegian.number
        });
    });

    it('expect the own format to win, and none for a checkbox, a lookup column, a text and a type without one', () => {
        expect(withTypeFormat({ date: 'iso' }, 'date', norwegian)).toEqual({ date: 'iso' });
        expect(withTypeFormat({ checkbox: {} }, 'number', norwegian)).toEqual({ checkbox: {} });
        expect(withTypeFormat(undefined, 'number', norwegian, true)).toBeUndefined();
        expect(withTypeFormat(undefined, 'text', norwegian)).toBeUndefined();
        expect(withTypeFormat(undefined, 'date', { number: { decimals: 1 } })).toBeUndefined();
    });
});

describe('the formats by type in the grid', () => {
    it("expect every column of a type to show the type's format, a column's own to win", async () => {
        const { element } = await mountGrid(
            config({ typeFormats: norwegian, columns: { ...config().columns, code: { format: { number: { decimals: 0 } } } } }),
            rows(),
            fields()
        );
        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026', '01.12.2026']);
        expect(renderedColumn(element, 'seen')).toEqual(['22.11.2026 13:45', '01.12.2026 08:05']);
        expect(renderedColumn(element, 'balance')).toEqual(['1 234,50', '0,00']);
        expect(renderedColumn(element, 'code')).toEqual(['0', '1']);
    });

    it('expect it in the state: getState, setState, resetState and a view keep it', async () => {
        const { element, gridInterface } = await mountGrid(config({ typeFormats: { date: 'norwegian' } }), rows(), fields());
        expect(gridInterface.getState().typeFormats).toEqual({ date: 'norwegian' });

        gridInterface.setState({ typeFormats: { date: 'month' } });
        expect(renderedColumn(element, 'born')).toEqual(['2026-11', '2026-12']);
        const view = gridInterface.saveViewAs('Months');
        expect(view.state.typeFormats).toEqual({ date: 'month' });

        gridInterface.resetState();
        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026', '01.12.2026']);
        gridInterface.applyView(view.id);
        expect(renderedColumn(element, 'born')).toEqual(['2026-11', '2026-12']);
        expect(gridInterface.exportConfig().state?.typeFormats).toEqual({ date: 'month' });
    });

    it('expect a format a type does not take to throw a TypeError', async () => {
        await expect(mountGrid(config({ typeFormats: { date: 'isoTime' } }), rows(), fields())).rejects.toThrow(
            /it shows the time of day/
        );
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        expect(() => gridInterface.setState({ typeFormats: { text: 'iso' } as unknown as TypeFormats })).toThrow(
            "setState: typeFormats has 'text', it has date, datetime, number"
        );
        expect(() => gridInterface.setState({ typeFormats: { number: { decimals: 9 } } as unknown as TypeFormats })).toThrow(
            TypeError
        );
        expect(() => gridInterface.updateConfig({ typeFormats: 'iso' as unknown as TypeFormats })).toThrow(TypeError);
    });

    it("expect updateConfig to set it, and a date column grouped by its type's period", async () => {
        const { element, gridInterface, datasource } = await mountGrid(config(), rows(), fields());
        gridInterface.updateConfig({ typeFormats: { date: 'quarter' } });
        expect(renderedColumn(element, 'born')).toEqual(['2026 Q4', '2026 Q4']);
        datasource.group([{ attribute: 'born', title: 'Born' }]);
        expect(
            datasource
                .getRows()
                .filter(isGroupRow)
                .map((row) => row.__groupName)
        ).toEqual(['Born: 2026 Q4']);
    });

    it("expect a header filter as shown on the type's format: a week typed is the week", async () => {
        const { element, datasource } = await mountGrid(config({ typeFormats: { date: 'weekIso' } }), rows(), fields());
        // a date filters from (≥) the start of the week: Monday 30 November, not Sunday 22
        typeInHeaderFilter(element, 'born', '2026-W49');
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Bob']);
    });

    it("expect Default in Format › to show the type's format as its example", async () => {
        const { element } = await mountGrid(config({ typeFormats: { date: 'year' } }), rows(), fields());
        openLabelMenu(element, 'born');
        menuEntry('header.format').click();
        const entry = menuEntry('header.format.default');
        expect(entry.getAttribute('aria-checked')).toEqual('true');
        expect(entry.textContent).toContain(String(new Date().getFullYear()));
    });
});

describe('the Defaults tab of the grid config dialog', () => {
    it("expect a picker of each type's format, the pick shown in a column's picker and preview, the grid changed on Apply", async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('born');
        tab('Defaults').click();

        expect(typePicker('date').textContent?.trim()).toEqual('Default');
        expect(typePicker('datetime').textContent?.trim()).toEqual('Default');
        expect(typePicker('number').textContent?.trim()).toEqual('Default');
        typePicker('date').click();
        // a date: no time of day
        const time = menuEntry('header.format.date.isoTime');
        expect(time === null || time.hidden).toBe(true);
        menuEntry('header.format.date.norwegian').click();
        expect(typePicker('date').textContent?.trim()).toEqual('Norwegian');
        expect(typePicker('date').getAttribute('aria-label')).toEqual('Date: Norwegian');

        // the Columns tab: the column's picker says Default and the type's format, the preview shows it
        tab('Columns').click();
        expect(columnPicker().textContent?.trim()).toEqual('Default: Norwegian');
        expect(previewCell().textContent?.trim()).toEqual('22.11.2026');
        expect(renderedColumn(element, 'born')).toEqual(['2026-11-22', '2026-12-01']);

        button('Apply').click();
        expect(gridInterface.getState().typeFormats).toEqual({ date: 'norwegian' });
        // not the column's own format
        expect(gridInterface.getState().formats).toEqual({});
        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026', '01.12.2026']);
    });

    it('expect a number format of the type, Default to take it out, Reset formats to go back to the config', async () => {
        const { gridInterface } = await mountGrid(config({ typeFormats: { date: 'us' } }), rows(), fields());
        gridInterface.openColumnSettings();
        tab('Defaults').click();
        expect(typePicker('date').textContent?.trim()).toEqual('US');

        typePicker('number').click();
        menuEntry('header.format.number.norwegian').click();
        expect(typePicker('number').textContent?.trim()).toEqual('1 234 567,891');
        typePicker('date').click();
        menuEntry('header.format.default').click();
        expect(typePicker('date').textContent?.trim()).toEqual('Default');
        button('Apply').click();
        expect(gridInterface.getState().typeFormats).toEqual({ number: { thousands: ' ', decimal: ',' } });

        button('Reset formats').click();
        expect(typePicker('date').textContent?.trim()).toEqual('US');
        expect(typePicker('number').textContent?.trim()).toEqual('Default');
        button('Cancel').click();
        expect(gridInterface.getState().typeFormats).toEqual({ number: { thousands: ' ', decimal: ',' } });
    });

    it('expect the default view to be picked from Standard and the views, set on Apply', async () => {
        const views = [
            { id: 'a', name: 'Open', state: {} },
            { id: 'b', name: 'Closed', state: {}, default: true }
        ];
        const { gridInterface } = await mountGrid(config({ views }), rows(), fields());
        gridInterface.openColumnSettings();
        tab('Defaults').click();

        expect(viewPicker().textContent?.trim()).toEqual('Closed');
        expect(viewPicker().getAttribute('aria-label')).toEqual('Default view: Closed');
        expect(viewPicker().disabled).toBe(false);
        viewPicker().click();
        // Standard and the views, the default checked
        expect(menuEntry('columnSettings.defaults.defaultView.').textContent).toContain('Standard');
        expect(menuEntry('columnSettings.defaults.defaultView.a').textContent).toContain('Open');
        expect(menuEntry('columnSettings.defaults.defaultView.b').getAttribute('aria-checked')).toEqual('true');
        menuEntry('columnSettings.defaults.defaultView.a').click();

        expect(viewPicker().textContent?.trim()).toEqual('Open');
        // not set before Apply
        expect(gridInterface.getViews().find((view) => view.default)?.id).toEqual('b');
        button('Apply').click();
        expect(gridInterface.getViews().find((view) => view.default)?.id).toEqual('a');

        viewPicker().click();
        menuEntry('columnSettings.defaults.defaultView.').click();
        button('Apply').click();
        expect(gridInterface.getViews().some((view) => view.default)).toBe(false);
    });

    it('expect the default view greyed out without views, the hint saying how to save one', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings();
        tab('Defaults').click();
        expect(viewPicker().disabled).toBe(true);
        expect(viewPicker().textContent?.trim()).toEqual('Standard');
        const hint = document.getElementById(viewPicker().getAttribute('aria-describedby') as string);
        expect(hint?.textContent?.trim()).toEqual('No views saved yet: save one from the views button');
    });
});

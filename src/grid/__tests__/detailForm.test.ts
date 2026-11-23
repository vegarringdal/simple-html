// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import type { DetailForm, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { tabPastRows } from '../gridFunctions/tabExit';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, pointerEvent, sleep } from './interactionTestHelpers';

/**
 * The detail form (detailForm.ts): the state's part (`GridState.detailForm`, `GridConfig.detailForm`) -
 * getState / setState / resetState / updateConfig, JSON, the checks - where it is laid out (at the right
 * of the rows, under them in a narrow grid), what it shows (the current row's values as the cells show
 * them, a textarea for text of several lines, a checkbox, a lookup's label, a link, the errors), when it
 * is rendered again (another current row, a value changed, a filter, a sort), editing in it (the cells'
 * readonly rules, the formatter, the undo history), its keys (Shift+Tab, undo), collapsed and expanded
 * (`expanded`, the button of its title), its least and most width (`minWidth`, `maxWidth`) and the
 * splitter of its edge (detailFormResize.ts: a drag, its keys). happy-dom lays nothing out: the sizes are
 * stubbed (stubElementSizes, 1000 x 600), the browser check looks at it.
 */

const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const CODES = new Datasource();
CODES.setData([
    { code: 1, label: 'One' },
    { code: 2, label: 'Two' }
]);
registerLookup('detail-form-test-codes', { datasource: CODES, valueField: 'code', labelField: 'label' });

const NOTES = 'First line\nSecond line\nThird line';

const rows = () => [
    { id: 1, name: 'Ann', notes: NOTES, born: new Date(2026, 10, 22), balance: 1234.5, active: true, code: 1, site: 'acme.com' },
    { id: 2, name: 'Bob', notes: 'One line', born: null, balance: 0, active: false, code: 2, site: '' },
    { id: 3, name: 'Cid', notes: '', born: null, balance: 7, active: false, code: null, site: 'cid.org' }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: {
        id: 'number',
        name: { validate: ['required'] },
        notes: { multiline: true },
        born: 'date',
        balance: 'number',
        active: 'boolean',
        code: 'number'
    }
});

const FORM: DetailForm = { show: true, fields: ['name', 'notes', 'born', 'balance', 'active', 'code', 'site'] };

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        name: { label: 'Name' },
        notes: { label: 'Notes' },
        born: { label: 'Born', format: { date: 'norwegian' } },
        code: { label: 'Code', editor: { type: 'select', lookup: 'detail-form-test-codes' } },
        site: { label: 'Site', format: { link: { url: 'https://{site}', newTab: true } } }
    },
    // notes is no column of the layout: the form shows it anyway
    layout: { center: ['name', 'born', 'balance', 'active', 'code', 'site'].map((field) => ({ fields: [field], width: 100 })) },
    detailForm: FORM,
    ...more
});

const mount = async (more: Partial<GridConfig> = {}, current: number | null = 0) => {
    const mounted = await mountGrid(config(more), rows(), fields());
    if (current !== null) {
        mounted.datasource.setRowAsCurrentEntity(current);
    }
    return mounted;
};

const form = (element: GridElement) => element.querySelector('.simple-html-grid-detail-form') as HTMLElement;
const byClass = (element: GridElement, name: string) => element.querySelector(`.simple-html-grid-${name}`) as HTMLElement;
/** the form's fields: their label, and the value of their control */
const formFields = (element: GridElement) =>
    Array.from(form(element).querySelectorAll<HTMLElement>('.simple-html-grid-detail-form-field'), (field) => {
        const control = field.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
        return {
            field: field.dataset.field,
            label: field.querySelector('label')?.textContent?.trim(),
            value: control instanceof HTMLInputElement && control.type === 'checkbox' ? control.checked : control.value
        };
    });
/** the control of a field */
const control = (element: GridElement, field: string) =>
    form(element).querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea`) as HTMLInputElement;
/** the text of the form without a row or fields */
const emptyText = (element: GridElement) =>
    form(element).querySelector('.simple-html-grid-detail-form-empty')?.textContent?.trim();
/** the button of the form's title: it collapses and expands the form */
const toggle = (element: GridElement) => form(element).querySelector('.simple-html-grid-detail-form-toggle') as HTMLButtonElement;
/** the splitter of the form's left edge, null without one */
const splitter = (element: GridElement) => form(element).querySelector('[role="separator"]') as HTMLElement;

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** types into a field as the user does: the focus once, then the text and an input event */
function typeIn(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
    if (document.activeElement !== input) {
        input.focus();
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('detail form - the state', () => {
    it('expect none by default: not shown, no fields - and no form element shown', async () => {
        const { element, gridInterface } = await mountGrid(config({ detailForm: undefined }), rows(), fields());
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: [] });
        expect(form(element).hidden).toBe(true);
        expect(form(element).children).toHaveLength(0);
    });

    it('expect the config to be where it starts, a copy - and initialState to win over it', async () => {
        const detailForm: DetailForm = { show: true, fields: ['name', 'notes'], width: 320 };
        const { gridInterface } = await mount({ detailForm });
        expect(gridInterface.getState().detailForm).toEqual(detailForm);
        detailForm.fields.push('born');
        expect(gridInterface.getState().detailForm.fields).toEqual(['name', 'notes']);
        // a copy each time
        gridInterface.getState().detailForm.fields.push('born');
        expect(gridInterface.getState().detailForm.fields).toEqual(['name', 'notes']);

        const started = new GridInterface(
            config({ initialState: { detailForm: { show: false, fields: ['born'] } } }),
            new Datasource(fields())
        );
        expect(started.getState().detailForm).toEqual({ show: false, fields: ['born'] });
    });

    it('expect setState to set it, resetState to go back, and JSON to keep it as it was', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setState({ detailForm: { show: true, fields: ['notes', 'name', 'notes'], width: 250 } });
        // each field once
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['notes', 'name'], width: 250 });
        expect(formFields(element).map((field) => field.field)).toEqual(['notes', 'name']);

        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.resetState();
        expect(gridInterface.getState().detailForm).toEqual(FORM);
        gridInterface.setState(saved);
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['notes', 'name'], width: 250 });

        // the other parts keep it
        gridInterface.setState({ sorting: [{ attribute: 'name', ascending: false }] });
        expect(gridInterface.getState().detailForm.width).toEqual(250);
    });

    it('expect a detail form that is none to throw a TypeError before anything changes', async () => {
        const { gridInterface } = await mount();
        for (const wrong of [
            null,
            [],
            { show: 'yes', fields: [] },
            { show: true },
            { show: true, fields: [1] },
            { show: true, fields: [], width: 0 }
        ]) {
            expect(() =>
                gridInterface.setState({ detailForm: wrong as any, sorting: [{ attribute: 'name', ascending: false }] })
            ).toThrow(TypeError);
        }
        expect(gridInterface.getState().sorting).toEqual([]);
        expect(gridInterface.getState().detailForm).toEqual(FORM);
        expect(
            () => new GridInterface(config({ detailForm: { show: true, fields: 'name' } as any }), new Datasource(fields()))
        ).toThrow(/GridConfig: detailForm.fields/);
        expect(() => gridInterface.updateConfig({ detailForm: { show: 1 } as any })).toThrow(TypeError);
    });

    it('expect updateConfig() to keep the state of it, unless detailForm is given', async () => {
        const { gridInterface } = await mount();
        gridInterface.setState({ detailForm: { show: false, fields: ['name'] } });
        gridInterface.updateConfig({ readonly: true });
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: ['name'] });
        gridInterface.updateConfig({ detailForm: { show: true, fields: ['born'] } });
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['born'] });
        gridInterface.updateConfig({ detailForm: undefined });
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: [] });
    });
});

describe('detail form - where it is', () => {
    it('expect it at the right of the rows: the header, the rows, the scrollbars and the totals row end before it', async () => {
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, width: 280 }, totalsRow: true });
        const parsed = gridInterface.__getGridConfig();
        const scrollbar = parsed.__scrollbarSize;

        expect(form(element).hidden).toBe(false);
        expect(form(element).style.width).toEqual('280px');
        expect(form(element).style.right).toEqual('0px');
        expect(form(element).style.top).toEqual(`${parsed.panelHeight}px`);
        expect(form(element).style.bottom).toEqual(`${parsed.footerHeight}px`);
        expect(byClass(element, 'header').style.right).toEqual('280px');
        expect(byClass(element, 'body').style.right).toEqual(`${scrollbar + 280}px`);
        expect(byClass(element, 'body-scroller').style.right).toEqual('280px');
        expect(byClass(element, 'middle-scroller').style.right).toEqual(`${parsed.__rightWidth + scrollbar + 280}px`);
        expect(byClass(element, 'totals').style.right).toEqual(`${scrollbar + 280}px`);
        // the footer and the grouping panel: as wide as the grid
        expect(byClass(element, 'footer').style.right).toEqual('');
        expect(byClass(element, 'panel').style.right).toEqual('');

        gridInterface.setState({ detailForm: { ...FORM, show: false } });
        expect(form(element).hidden).toBe(true);
        expect(byClass(element, 'header').style.right).toEqual('0px');
        expect(byClass(element, 'body').style.right).toEqual(`${scrollbar}px`);
    });

    it('expect it under the rows where the scrolling columns would get less than 150px beside it', async () => {
        // 1000px wide: 700px for the rows, the pinned columns take 570px of them
        const { element, gridInterface } = await mount({
            layout: {
                left: [{ fields: ['name'], width: 300 }],
                center: [{ fields: ['born'], width: 100 }],
                right: [{ fields: ['balance'], width: 270 }]
            }
        });
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(true);
        // narrower pinned columns: room for the scrolling ones, the form at the right
        gridInterface.setState({
            layout: { left: [{ fields: ['name'], width: 100 }], center: [{ fields: ['born'], width: 100 }], right: [] }
        });
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(false);
        expect(form(element).style.width).toEqual('300px');
        // no scrolling columns: the pinned ones only need their room
        gridInterface.setState({
            layout: { left: [{ fields: ['name'], width: 300 }], center: [], right: [{ fields: ['balance'], width: 300 }] }
        });
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(false);
    });

    it('expect the default width 300, at least 150', async () => {
        const { element, gridInterface } = await mount();
        expect(form(element).style.width).toEqual('300px');
        gridInterface.setState({ detailForm: { ...FORM, width: 20 } });
        expect(form(element).style.width).toEqual('150px');
        // the state keeps what it was given
        expect(gridInterface.getState().detailForm.width).toEqual(20);
    });

    it('expect it under the rows where they would get less room than it beside it: 40 % of the height, over the footer', async () => {
        // 1000px wide: a form of 600px does not fit at the right
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, width: 600 } });
        const parsed = gridInterface.__getGridConfig();
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(true);
        expect(form(element).style.height).toEqual('240px');
        expect(form(element).style.left).toEqual('0px');
        expect(form(element).style.bottom).toEqual(`${parsed.footerHeight}px`);
        expect(byClass(element, 'body').style.right).toEqual(`${parsed.__scrollbarSize}px`);
        expect(byClass(element, 'body').style.bottom).toEqual(`${parsed.footerHeight + 240}px`);
        expect(byClass(element, 'body-scroller').style.bottom).toEqual(`${parsed.footerHeight + 240}px`);
    });

    it('expect it last in the grid element, but for the end Tab leaves the grid from', async () => {
        const { element } = await mount();
        expect(element.lastElementChild).toBe(gridOf(element).tabExitEnd);
        expect(element.lastElementChild?.previousElementSibling).toBe(form(element));
        expect(gridOf(element).detailForm).toBe(form(element));
    });
});

describe('detail form - what it shows', () => {
    it('expect a region named by its title, the row number, a label tied to each value - as the cells show them', async () => {
        const { element } = await mount();
        expect(form(element).getAttribute('role')).toEqual('region');
        const title = document.getElementById(form(element).getAttribute('aria-labelledby') as string);
        expect(title?.textContent?.trim()).toEqual('Details');
        expect(byClass(element, 'detail-form-row').textContent?.trim()).toEqual('Row 1');

        expect(formFields(element)).toEqual([
            { field: 'name', label: 'Name', value: 'Ann' },
            { field: 'notes', label: 'Notes', value: NOTES },
            // the display format
            { field: 'born', label: 'Born', value: '22.11.2026' },
            { field: 'balance', label: 'Balance', value: '1234.5' },
            { field: 'active', label: 'Active', value: true },
            // the lookup's label
            { field: 'code', label: 'Code', value: 'One' },
            { field: 'site', label: 'Site', value: 'acme.com' }
        ]);
        for (const label of form(element).querySelectorAll('label')) {
            expect(document.getElementById(label.htmlFor)?.closest('.simple-html-grid-detail-form-field')).toBe(
                label.parentElement
            );
        }
    });

    it('expect text of several lines in a textarea with all of it, a row per line', async () => {
        const { element } = await mount();
        const notes = control(element, 'notes') as unknown as HTMLTextAreaElement;
        expect(notes.tagName).toEqual('TEXTAREA');
        expect(notes.value).toEqual(NOTES);
        expect(notes.getAttribute('rows')).toEqual('4');
        // a field that is not multiline, with a line break in its value: a textarea too
        expect(control(element, 'name').tagName).toEqual('INPUT');
    });

    it('expect a link of the row after its value, in a new tab - none for a row without an address', async () => {
        const { element, datasource } = await mount();
        const link = form(element).querySelector('[data-field="site"] a') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toEqual('https://acme.com/');
        expect(link.target).toEqual('_blank');
        expect(link.rel).toEqual('noopener noreferrer');

        datasource.setRowAsCurrentEntity(1);
        expect(form(element).querySelector('[data-field="site"] a')).toBeNull();
    });

    it('expect "No row" without a current row, and for a group row', async () => {
        const { element, datasource } = await mount({}, null);
        expect(emptyText(element)).toEqual('No row');
        expect(byClass(element, 'detail-form-row')).toBeNull();

        datasource.group([{ attribute: 'name', title: 'Name' }]);
        datasource.setRowAsCurrentEntity(0);
        expect(emptyText(element)).toEqual('No row');
    });

    it('expect a text without fields', async () => {
        const { element } = await mount({ detailForm: { show: true, fields: [] } });
        expect(emptyText(element)).toEqual('No fields: pick them with the gear in the footer, tab Detail form');
    });

    it('expect the texts of the grid: its texts option', async () => {
        const { element } = await mount({ texts: { 'detailForm.title': 'Detaljer', 'detailForm.row': 'Rad {row}' } });
        expect(byClass(element, 'detail-form-title').textContent?.trim()).toEqual('Detaljer');
        expect(byClass(element, 'detail-form-row').textContent?.trim()).toEqual('Rad 1');
    });
});

describe('detail form - it follows the grid', () => {
    it('expect another current row to show', async () => {
        const { element, datasource } = await mount();
        datasource.setRowAsCurrentEntity(2);
        expect(formFields(element)[0].value).toEqual('Cid');
        expect(byClass(element, 'detail-form-row').textContent?.trim()).toEqual('Row 3');
    });

    it('expect a value set from code, and undo, to show in the next frame', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anne';
        await frame();
        expect(formFields(element)[0].value).toEqual('Anne');
        await sleep(0);
        datasource.undo();
        expect(formFields(element)[0].value).toEqual('Ann');
    });

    it('expect a sort to keep the row with its new number, and a filter that hides it to say "No row"', async () => {
        const { element, datasource } = await mount();
        datasource.sort([{ attribute: 'name', ascending: false }]);
        expect(formFields(element)[0].value).toEqual('Ann');
        expect(byClass(element, 'detail-form-row').textContent?.trim()).toEqual('Row 3');

        datasource.filter(where('name', 'EQUAL', 'Bob'));
        expect(emptyText(element)).toEqual('No row');
    });
});

describe('detail form - editing', () => {
    it('expect what is typed to be written to the row through the formatter, one step of the undo history', async () => {
        const { element, datasource } = await mount();
        const balance = control(element, 'balance');
        typeIn(balance, '12');
        typeIn(balance, '12,5');
        expect(datasource.getDataRows()[0].balance).toEqual(12.5);
        balance.blur();
        expect(datasource.undo()).toBe(true);
        expect(datasource.getDataRows()[0].balance).toEqual(1234.5);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect the text typed kept while the rows render again, the cells to follow', async () => {
        const { element, datasource } = await mount();
        const name = control(element, 'name');
        typeIn(name, 'An');
        await frame();
        expect(name.value).toEqual('An');
        expect(document.activeElement).toBe(name);
        const cell = element.querySelector('input[data-attribute="name"]') as HTMLInputElement;
        expect(cell.value).toEqual('An');
        expect(datasource.getDataRows()[0].name).toEqual('An');
    });

    it('expect a render that takes the field with the focus away to work: the blur it gives renders nothing inside it', async () => {
        const { element, gridInterface } = await mount();
        const name = control(element, 'name');
        name.focus();
        // as a browser does: the focused field gets a blur when the element it is in is removed (happy-dom
        // sends none). Its blur renders the form - it must not inside the render that removes it
        const body = form(element).querySelector('.simple-html-grid-detail-form-body') as HTMLElement;
        body.remove = function (this: HTMLElement) {
            name.dispatchEvent(new FocusEvent('blur'));
            Element.prototype.remove.call(this);
        };
        expect(() => gridInterface.resetState()).not.toThrow();
        expect(() => gridInterface.setState({ detailForm: { ...FORM, show: false } })).not.toThrow();
        expect(form(element).hidden).toBe(true);
        expect(form(element).querySelector('input, textarea')).toBeNull();
    });

    it('expect the plain value while a field has the focus (formatForEdit), the display format again after', async () => {
        const { element } = await mount();
        const born = control(element, 'born');
        born.focus();
        expect(control(element, 'born').value).toEqual('2026-11-22');
        born.blur();
        expect(control(element, 'born').value).toEqual('22.11.2026');
    });

    it('expect the line breaks of a textarea written as LF', async () => {
        const { element, datasource } = await mount();
        typeIn(control(element, 'notes'), 'a\r\nb');
        expect(datasource.getDataRows()[0].notes).toEqual('a\nb');
    });

    it('expect a checkbox to write a boolean', async () => {
        const { element, datasource } = await mount();
        const active = control(element, 'active');
        active.checked = false;
        active.dispatchEvent(new Event('change', { bubbles: true }));
        expect(datasource.getDataRows()[0].active).toBe(false);
    });

    it('expect the errors of the field under it, the field marked invalid and described by them', async () => {
        const { element } = await mount();
        const name = control(element, 'name');
        expect(name.getAttribute('aria-required')).toEqual('true');
        typeIn(name, '');
        await frame();
        const invalid = control(element, 'name');
        expect(invalid).toBe(name);
        expect(invalid.value).toEqual('');
        expect(invalid.getAttribute('aria-invalid')).toEqual('true');
        const errors = document.getElementById(invalid.getAttribute('aria-describedby') as string);
        expect(errors?.textContent?.trim()).not.toEqual('');
    });

    it('expect readonly where the cell is: a readonly grid, a readonly column, the hook, a lookup, allowPasteClearOnly', async () => {
        const readonlyGrid = await mount({ readonly: true });
        for (const field of ['name', 'notes', 'born', 'balance', 'code', 'site']) {
            expect(control(readonlyGrid.element, field).readOnly).toBe(true);
        }
        const active = control(readonlyGrid.element, 'active');
        expect(active.getAttribute('aria-readonly')).toEqual('true');
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        active.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(true);
        typeIn(control(readonlyGrid.element, 'name'), 'nobody');
        expect(readonlyGrid.datasource.getDataRows()[0].name).toEqual('Ann');

        document.body.innerHTML = '';
        const columns = config().columns ?? {};
        const { element } = await mountGrid(
            config({
                columns: {
                    ...columns,
                    name: { ...columns.name, readonly: true },
                    balance: { allowPasteClearOnly: true }
                }
            }),
            rows(),
            fields(),
            { isReadonly: (_row, field) => (field === 'notes' ? true : null) }
        );
        gridOf(element).gridInterface.getDatasource().setRowAsCurrentEntity(0);
        expect(control(element, 'name').readOnly).toBe(true);
        expect(control(element, 'notes').readOnly).toBe(true);
        expect(control(element, 'balance').readOnly).toBe(true);
        expect(control(element, 'code').readOnly).toBe(true);
        expect(control(element, 'born').readOnly).toBe(false);
    });

    it('expect Ctrl+Z in a field to undo the last step, the focus staying - the typing in it is the browser’s', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].balance = 5;
        await sleep(0);
        const name = control(element, 'name');
        name.focus();
        const undo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
        name.dispatchEvent(undo);
        expect(undo.defaultPrevented).toBe(true);
        expect(datasource.getDataRows()[0].balance).toEqual(1234.5);
        expect(document.activeElement).toBe(control(element, 'name'));

        typeIn(control(element, 'name'), 'An');
        const typing = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
        control(element, 'name').dispatchEvent(typing);
        expect(typing.defaultPrevented).toBe(false);
    });
});

describe('detail form - the keys and the wheel', () => {
    it('expect Tab from the last button of the footer to go into the form - its title button - from its last field out of the grid', async () => {
        const { element } = await mount();
        const gear = element.querySelector('.footer-settings') as HTMLElement;
        gear.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        gear.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(toggle(element));
        // the stops in their order: the title's button, the splitter, the fields
        const stops = Array.from(form(element).querySelectorAll('button, [tabindex="0"], input, textarea, a[href]'));
        expect(stops.slice(0, 3)).toEqual([toggle(element), splitter(element), control(element, 'name')]);
        // nothing focusable after its last stop in the grid: the browser's Tab leaves it
        const all = Array.from(element.querySelectorAll('input, textarea, a[href], button'));
        expect(all.at(-1)).toBe(form(element).querySelector('[data-field="site"] a'));
    });

    it('expect Tab past the last cell into the form when the footer has no height', async () => {
        const { element } = await mount({ footerHeight: 0 });
        // what Tab on the last cell of the last row calls
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        tabPastRows(gridOf(element), event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(toggle(element));
    });

    it('expect Shift+Tab on its first stop to go back to the last button of the footer', async () => {
        const { element } = await mount();
        toggle(element).focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        toggle(element).dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(element.querySelector('.footer-settings'));

        // Shift+Tab on a field is the browser's
        const second = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        control(element, 'name').dispatchEvent(second);
        expect(second.defaultPrevented).toBe(false);
    });

    it('expect the wheel over it to be the browser’s: the form scrolls, not the rows', async () => {
        const { element } = await mount();
        const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        control(element, 'notes').dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        expect((element.querySelector('.simple-html-grid-body-scroller') as HTMLElement).scrollTop).toEqual(0);

        const overRows = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        element.querySelector('.simple-html-grid-body')?.dispatchEvent(overRows);
        expect(overRows.defaultPrevented).toBe(true);
    });
});

describe('detail form - collapsed and expanded', () => {
    it('expect it expanded by default; the button of its title to collapse it to a strip at the right, and to expand it again', async () => {
        const { element, gridInterface } = await mount();
        const parsed = gridInterface.__getGridConfig();
        const body = form(element).querySelector('.simple-html-grid-detail-form-body') as HTMLElement;
        expect(toggle(element).getAttribute('aria-expanded')).toEqual('true');
        expect(toggle(element).getAttribute('aria-controls')).toEqual(body.id);
        expect(toggle(element).getAttribute('data-tooltip')).toEqual('Collapse the details');
        // the title is in the button: the region is named by it
        expect(toggle(element).textContent?.trim()).toEqual('Details');

        toggle(element).focus();
        toggle(element).click();
        expect(gridInterface.getState().detailForm.expanded).toBe(false);
        expect(toggle(element).getAttribute('aria-expanded')).toEqual('false');
        expect(toggle(element).getAttribute('data-tooltip')).toEqual('Expand the details');
        // the same button: the focus stays on it
        expect(document.activeElement).toBe(toggle(element));
        expect(form(element).classList.contains('simple-html-grid-detail-form-collapsed')).toBe(true);
        expect(form(element).style.width).toEqual('24px');
        expect(byClass(element, 'body').style.right).toEqual(`${parsed.__scrollbarSize + 24}px`);
        expect(byClass(element, 'header').style.right).toEqual('24px');
        // the title bar only: no fields, no row number, no splitter
        expect(body.hidden).toBe(true);
        expect(formFields(element)).toEqual([]);
        expect(byClass(element, 'detail-form-row')).toBeNull();
        expect(splitter(element)).toBeNull();

        toggle(element).click();
        expect(gridInterface.getState().detailForm.expanded).toBe(true);
        expect(form(element).style.width).toEqual('300px');
        expect(formFields(element)[0].value).toEqual('Ann');
        expect(form(element).classList.contains('simple-html-grid-detail-form-collapsed')).toBe(false);
    });

    it('expect expanded: false of the config to start it collapsed, resetState to go back, JSON to keep it', async () => {
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, expanded: false } });
        expect(toggle(element).getAttribute('aria-expanded')).toEqual('false');
        toggle(element).click();
        expect(gridInterface.getState().detailForm.expanded).toBe(true);

        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.resetState();
        expect(gridInterface.getState().detailForm.expanded).toBe(false);
        gridInterface.setState(saved);
        expect(gridInterface.getState().detailForm.expanded).toBe(true);
        expect(toggle(element).getAttribute('aria-expanded')).toEqual('true');
    });

    it('expect it collapsed under the rows as a bar of 24px over the footer, where it is expanded too', async () => {
        // 1000px wide: a form of 600px does not fit at the right
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, width: 600, expanded: false } });
        const parsed = gridInterface.__getGridConfig();
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(true);
        expect(form(element).style.height).toEqual('24px');
        expect(byClass(element, 'body').style.bottom).toEqual(`${parsed.footerHeight + 24}px`);
        expect(byClass(element, 'body').style.right).toEqual(`${parsed.__scrollbarSize}px`);
    });

    it('expect the tooltip of the button when the pointer rests on it - none with the tooltips option off', async () => {
        const { element, gridInterface } = await mount();
        toggle(element).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const shown = document.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown.style.display).toEqual('block');
        expect(shown.textContent).toEqual('Collapse the details');
        toggle(element).dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        expect(shown.style.display).toEqual('none');

        gridInterface.updateConfig({ tooltips: false });
        toggle(element).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(shown.style.display).toEqual('none');
    });

    it('expect the button its only stop of Tab while it is collapsed', async () => {
        const { element } = await mount({ detailForm: { ...FORM, expanded: false } });
        const gear = element.querySelector('.footer-settings') as HTMLElement;
        gear.focus();
        gear.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(toggle(element));
        expect(Array.from(form(element).querySelectorAll('button, [tabindex="0"], input, textarea, a[href]'))).toEqual([
            toggle(element)
        ]);
    });
});

describe('detail form - its least and most width', () => {
    it('expect the width laid out between minWidth and maxWidth - at least 150 - the state keeping what it was given', async () => {
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, width: 100, minWidth: 200, maxWidth: 400 } });
        expect(form(element).style.width).toEqual('200px');
        gridInterface.setState({ detailForm: { ...FORM, width: 450, minWidth: 200, maxWidth: 400 } });
        expect(form(element).style.width).toEqual('400px');
        // a least width under 150: 150
        gridInterface.setState({ detailForm: { ...FORM, width: 100, minWidth: 50 } });
        expect(form(element).style.width).toEqual('150px');
        expect(gridInterface.getState().detailForm).toEqual({ ...FORM, width: 100, minWidth: 50 });
        // a most width under the least: the least
        gridInterface.setState({ detailForm: { ...FORM, width: 300, maxWidth: 120 } });
        expect(form(element).style.width).toEqual('150px');
    });

    it('expect a minWidth more than its maxWidth, a width that is no number of px, an expanded that is no boolean to throw a TypeError', async () => {
        const { gridInterface } = await mount();
        for (const wrong of [
            { ...FORM, minWidth: 400, maxWidth: 300 },
            { ...FORM, minWidth: 0 },
            { ...FORM, maxWidth: '300' },
            { ...FORM, expanded: 'no' }
        ]) {
            expect(() => gridInterface.setState({ detailForm: wrong as any })).toThrow(TypeError);
        }
        expect(() => gridInterface.setState({ detailForm: { ...FORM, minWidth: 400, maxWidth: 300 } })).toThrow(
            /minWidth \(400\) is more than its maxWidth \(300\)/
        );
        expect(gridInterface.getState().detailForm).toEqual(FORM);
    });
});

describe('detail form - the splitter of its edge', () => {
    it('expect a splitter at its left edge: focusable, named, its value the width, its limits the min and the room the rows leave', async () => {
        const { element, gridInterface } = await mount();
        expect(splitter(element).tabIndex).toEqual(0);
        expect(splitter(element).getAttribute('aria-orientation')).toEqual('vertical');
        expect(splitter(element).getAttribute('aria-label')).toEqual('Width of the details');
        expect(splitter(element).getAttribute('aria-controls')).toEqual(form(element).id);
        expect(splitter(element).getAttribute('aria-valuenow')).toEqual('300');
        expect(splitter(element).getAttribute('aria-valuemin')).toEqual('150');
        // half the grid: the rows keep as much room as the form
        expect(splitter(element).getAttribute('aria-valuemax')).toEqual('500');

        gridInterface.setState({ detailForm: { ...FORM, minWidth: 200, maxWidth: 400 } });
        expect(splitter(element).getAttribute('aria-valuemin')).toEqual('200');
        expect(splitter(element).getAttribute('aria-valuemax')).toEqual('400');
    });

    it('expect a drag to the left to make it wider, to the right narrower - the rows following at once - the state to keep it', async () => {
        const { element, gridInterface } = await mount({ totalsRow: true });
        const scrollbar = gridInterface.__getGridConfig().__scrollbarSize;
        splitter(element).dispatchEvent(pointerEvent('pointerdown', { clientX: 700 }));
        expect(splitter(element).classList.contains('simple-html-grid-detail-form-resize-dragged')).toBe(true);
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 650 }));
        // laid out in the next frame
        await frame();
        expect(form(element).style.width).toEqual('350px');
        expect(byClass(element, 'body').style.right).toEqual(`${scrollbar + 350}px`);
        expect(byClass(element, 'header').style.right).toEqual('350px');
        expect(byClass(element, 'totals').style.right).toEqual(`${scrollbar + 350}px`);
        expect(splitter(element).getAttribute('aria-valuenow')).toEqual('350');

        document.dispatchEvent(pointerEvent('pointermove', { clientX: 760 }));
        document.dispatchEvent(pointerEvent('pointerup', { clientX: 760 }));
        expect(form(element).style.width).toEqual('240px');
        expect(gridInterface.getState().detailForm.width).toEqual(240);
        expect(splitter(element).classList.contains('simple-html-grid-detail-form-resize-dragged')).toBe(false);
    });

    it('expect a drag to stop at the least width and at the most - the room the rows leave, or maxWidth', async () => {
        const { element, gridInterface } = await mount();
        const drag = (from: number, to: number) => {
            splitter(element).dispatchEvent(pointerEvent('pointerdown', { clientX: from }));
            document.dispatchEvent(pointerEvent('pointermove', { clientX: to }));
            document.dispatchEvent(pointerEvent('pointerup', { clientX: to }));
        };
        drag(700, 950);
        expect(gridInterface.getState().detailForm.width).toEqual(150);
        drag(850, 0);
        // not under the rows: half the grid at most
        expect(gridInterface.getState().detailForm.width).toEqual(500);
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(false);

        gridInterface.setState({ detailForm: { ...FORM, maxWidth: 320 } });
        drag(700, 0);
        expect(gridInterface.getState().detailForm.width).toEqual(320);
    });

    it('expect pointercancel to give it its width back, a press that does not move to change nothing', async () => {
        const { element, gridInterface } = await mount();
        splitter(element).dispatchEvent(pointerEvent('pointerdown', { clientX: 700 }));
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }));
        await frame();
        expect(form(element).style.width).toEqual('400px');
        document.dispatchEvent(pointerEvent('pointercancel'));
        expect(form(element).style.width).toEqual('300px');
        // the state has no width it was not given
        expect(gridInterface.getState().detailForm).toEqual(FORM);

        splitter(element).dispatchEvent(pointerEvent('pointerdown', { clientX: 700 }));
        document.dispatchEvent(pointerEvent('pointerup', { clientX: 700 }));
        expect(gridInterface.getState().detailForm).toEqual(FORM);
        // not the main button
        splitter(element).dispatchEvent(pointerEvent('pointerdown', { clientX: 700, button: 2 }));
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }));
        document.dispatchEvent(pointerEvent('pointerup', { clientX: 600 }));
        expect(gridInterface.getState().detailForm).toEqual(FORM);
    });

    it('expect ArrowLeft to make it 10px wider, ArrowRight narrower, within its limits - the focus staying', async () => {
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, width: 160, maxWidth: 175 } });
        const press = (key: string, more: KeyboardEventInit = {}) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more });
            splitter(element).dispatchEvent(event);
            return event;
        };
        splitter(element).focus();
        expect(press('ArrowLeft').defaultPrevented).toBe(true);
        expect(gridInterface.getState().detailForm.width).toEqual(170);
        expect(form(element).style.width).toEqual('170px');
        expect(splitter(element).getAttribute('aria-valuenow')).toEqual('170');
        expect(document.activeElement).toBe(splitter(element));
        press('ArrowLeft');
        expect(gridInterface.getState().detailForm.width).toEqual(175);
        press('ArrowRight');
        press('ArrowRight');
        press('ArrowRight');
        expect(gridInterface.getState().detailForm.width).toEqual(150);
        // other keys are not the splitter's
        expect(press('ArrowUp').defaultPrevented).toBe(false);
        expect(press('ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(gridInterface.getState().detailForm.width).toEqual(150);
    });

    it('expect a rebuild when the scrolling columns get more room than they have elements for', async () => {
        const { element } = await mount();
        const grid = gridOf(element);
        // fewer column elements than the room needs, as after a narrower window
        grid.containerMiddleColumnCache.splice(2);
        const rebuild = vi.spyOn(grid, 'rebuild');
        splitter(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(grid.containerMiddleColumnCache).toHaveLength(6);
        // enough of them: none
        splitter(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('expect none while it is collapsed, and the class that hides it under the rows', async () => {
        const { element, gridInterface } = await mount({ detailForm: { ...FORM, expanded: false } });
        expect(splitter(element)).toBeNull();
        gridInterface.setState({ detailForm: { ...FORM, width: 600 } });
        expect(form(element).classList.contains('simple-html-grid-detail-form-below')).toBe(true);
        expect(splitter(element)).not.toBeNull();
    });
});

describe('detail form - sections (DetailFormSection) and the options of a field (DetailForm.fieldOptions)', () => {
    const SECTIONS: DetailForm = {
        show: true,
        fields: [
            'name',
            { section: 'More', paddingTop: 12, paddingBottom: 3 },
            'notes',
            'born',
            { section: 'Money', panel: true, collapsed: true },
            'balance'
        ],
        fieldOptions: { notes: { minRows: 6 }, name: { paddingTop: 4, paddingBottom: 5 }, balance: { paddingBottom: 8 } }
    };
    const sections = (element: GridElement) =>
        Array.from(form(element).querySelectorAll<HTMLElement>('.simple-html-grid-detail-form-section'), (section) => {
            const header = section.querySelector('.simple-html-grid-detail-form-section-header') as HTMLButtonElement;
            const group = section.querySelector('[role="group"]') as HTMLElement;
            return {
                title: header.textContent?.trim(),
                panel: section.classList.contains('simple-html-grid-detail-form-panel'),
                expanded: header.getAttribute('aria-expanded'),
                controls: header.getAttribute('aria-controls') === group.id,
                named: group.getAttribute('aria-labelledby') === header.id,
                hidden: group.hidden,
                fields: Array.from(
                    group.querySelectorAll<HTMLElement>('.simple-html-grid-detail-form-field'),
                    (f) => f.dataset.field
                )
            };
        });
    const header = (element: GridElement, title: string) =>
        Array.from(form(element).querySelectorAll<HTMLButtonElement>('.simple-html-grid-detail-form-section-header')).find(
            (button) => button.textContent?.trim() === title
        ) as HTMLButtonElement;

    it('expect a section per entry: its fields up to the next one, the ones before it in none, a collapsed one empty', async () => {
        const { element } = await mount({ detailForm: SECTIONS });
        const loose = Array.from(
            form(element).querySelectorAll<HTMLElement>(
                '.simple-html-grid-detail-form-body > .simple-html-grid-detail-form-field'
            )
        );
        expect(loose.map((f) => f.dataset.field)).toEqual(['name']);
        expect(sections(element)).toEqual([
            {
                title: 'More',
                panel: false,
                expanded: 'true',
                controls: true,
                named: true,
                hidden: false,
                fields: ['notes', 'born']
            },
            { title: 'Money', panel: true, expanded: 'false', controls: true, named: true, hidden: true, fields: [] }
        ]);
    });

    it("expect the header to open and close its section - the user's, its collapsed the default it starts with", async () => {
        const { element, gridInterface, datasource } = await mount({ detailForm: SECTIONS });
        header(element, 'More').click();
        expect(sections(element).map((s) => [s.title, s.expanded, s.fields])).toEqual([
            ['More', 'false', []],
            ['Money', 'false', []]
        ]);
        header(element, 'Money').click();
        expect(sections(element)[1]).toMatchObject({ expanded: 'true', hidden: false, fields: ['balance'] });
        // the defaults in the state stay as they were
        expect(gridInterface.getState().detailForm.fields).toEqual(SECTIONS.fields);
        // kept with another row, a width dragged, the form collapsed and expanded
        datasource.setRowAsCurrentEntity(1);
        gridInterface.setState({ detailForm: { ...gridInterface.getState().detailForm, width: 320 } });
        toggle(element).click();
        toggle(element).click();
        expect(sections(element).map((s) => s.expanded)).toEqual(['false', 'true']);
        // other sections: from their defaults again
        gridInterface.setState({ detailForm: { ...SECTIONS, fields: [...SECTIONS.fields, 'site'] } });
        expect(sections(element).map((s) => s.expanded)).toEqual(['true', 'false']);
        // and resetState() too
        header(element, 'More').click();
        gridInterface.resetState();
        gridInterface.setState({ detailForm: SECTIONS });
        expect(sections(element).map((s) => s.expanded)).toEqual(['true', 'false']);
    });

    it('expect minRows on a textarea - its rows and the min height - and nothing on a field of one line', async () => {
        const { element } = await mount({ detailForm: SECTIONS });
        const notes = control(element, 'notes');
        expect(notes.tagName).toBe('TEXTAREA');
        // 3 lines of text + 1 is less than 6
        expect(notes.getAttribute('rows')).toBe('6');
        expect(notes.style.getPropertyValue('--simple-html-grid-detail-form-min-rows')).toBe('6');
        const { element: plain } = await mount();
        expect(control(plain, 'notes').getAttribute('rows')).toBe('4');
        expect(control(plain, 'notes').style.getPropertyValue('--simple-html-grid-detail-form-min-rows')).toBe('');
    });

    it('expect the room above and under a field and a section', async () => {
        const { element } = await mount({ detailForm: SECTIONS });
        const field = (name: string) => form(element).querySelector(`[data-field="${name}"]`) as HTMLElement;
        expect([field('name').style.paddingTop, field('name').style.paddingBottom]).toEqual(['4px', '5px']);
        const more = form(element).querySelector('.simple-html-grid-detail-form-section') as HTMLElement;
        expect([more.style.marginTop, more.style.marginBottom]).toEqual(['12px', '3px']);
    });

    it('expect the state to keep each field once, each section, and only the options given', async () => {
        const { gridInterface } = await mount({
            detailForm: {
                show: true,
                fields: ['name', { section: 'A' }, 'name', { section: 'A', panel: undefined }],
                fieldOptions: { name: {} }
            }
        });
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['name', { section: 'A' }, { section: 'A' }] });
    });

    it('expect a column taken out of the config to leave the form, its sections to stay', async () => {
        const { gridInterface } = await mount({ detailForm: SECTIONS });
        gridInterface.updateConfig({ columns: {}, layout: { center: [{ fields: ['name'], width: 100 }] } });
        expect(gridInterface.getState().detailForm.fields).toEqual(SECTIONS.fields);
    });

    it('expect an entry or an option that does not fit to throw a TypeError that says which', async () => {
        const { gridInterface } = await mount();
        const set = (more: Partial<DetailForm>) => () =>
            gridInterface.setState({ detailForm: { ...FORM, ...more } as DetailForm });
        expect(set({ fields: [5] as any })).toThrow(/detailForm.fields\[0\] is a field name or a section/);
        expect(set({ fields: [{ panel: true }] as any })).toThrow(/fields\[0\].section is the name of the section, a text/);
        expect(set({ fields: [{ section: 'A', panel: 'yes' }] as any })).toThrow(/fields\[0\].panel is true or false/);
        expect(set({ fields: [{ section: 'A', minRows: 3 }] as any })).toThrow(/fields\[0\].minRows is no option of a section/);
        expect(set({ fields: [{ section: 'A', paddingTop: -1 }] as any })).toThrow(/paddingTop is a number of px, 0 or more/);
        expect(set({ fieldOptions: [] as any })).toThrow(/detailForm.fieldOptions is an object/);
        expect(set({ fieldOptions: { notes: 'x' } as any })).toThrow(/fieldOptions.notes is an object/);
        expect(set({ fieldOptions: { notes: { minRows: 0 } } })).toThrow(/notes.minRows is a whole number from 1 to 30/);
        expect(set({ fieldOptions: { notes: { minRows: 2.5 } } })).toThrow(TypeError);
        expect(set({ fieldOptions: { notes: { minRows: 31 } } })).toThrow(TypeError);
        expect(set({ fieldOptions: { notes: { section: 'A' } as any } })).toThrow(/notes.section is no option of a field/);
        expect(
            set({
                fields: ['name', { section: 'A', panel: false, collapsed: false, paddingTop: 0, paddingBottom: 2.5 }],
                fieldOptions: { notes: { minRows: 30, paddingTop: 0, paddingBottom: 2.5 } }
            })
        ).not.toThrow();
    });
});

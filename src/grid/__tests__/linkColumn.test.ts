// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { ColumnConfig, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { openFilterMenu, sleep, valueRow } from './interactionTestHelpers';
import { parseXml, readParts } from './zipTestHelpers';

/**
 * The templates and links of a text column in the grid (ColumnFormat.text and .link, linkCell.ts): the
 * cells - the <a>, its text, address, target and rel, no link for an address that is not allowed - hostile
 * values in the data, clicking a link and editing its cell, Alt+Enter, the keys of the cell, copy, the
 * CSV and Excel export (the value), Find, sorting and the value list, the state and the config. The
 * templates themselves are tested in cellTemplate.test.ts, the dialog in columnSettings.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

/** what each click on a link did: whether something canceled it (no navigation) */
let clicks: { href: string | null; prevented: boolean }[] = [];
/**
 * the clicks on the links, at the window after everyone else: what they would do, then canceled - a
 * link followed would make happy-dom load the page
 */
const recordClick = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest?.('a');
    if (link) {
        clicks.push({ href: link.getAttribute('href'), prevented: event.defaultPrevented });
        event.preventDefault();
    }
};

beforeEach(() => {
    document.body.innerHTML = '';
    clicks = [];
    window.addEventListener('click', recordClick);
});

afterEach(() => {
    window.removeEventListener('click', recordClick);
    vi.restoreAllMocks();
});

const COLUMNS = ['id', 'company', 'email', 'website', 'name'];

const rows = () => [
    { id: 12, company: 'Acme & Co', email: 'ann@example.com', website: 'https://acme.example.com', name: 'Ann' },
    { id: 13, company: 'Globex', email: '', website: 'javascript:alert(1)', name: '<img src=x onerror=alert(1)>' },
    {
        id: null,
        company: '" onmouseover="alert(1)',
        email: 'bob@example.com?bcc=eve@evil.com',
        website: 'data:text/html,<script>alert(1)</script>',
        name: 'Bob'
    }
];

const fields = (): DatasourceOptions => ({ fields: { id: 'number' } });

/** the columns with their formats: company a link with a text, email mailto, website a whole address, name a text */
const columns = (): Record<string, ColumnConfig> => ({
    company: {
        label: 'Company',
        format: { text: '{company} ({id})', link: { url: 'https://crm.example.com/customer/{id}', newTab: true } }
    },
    email: { format: { link: { url: 'mailto:{email}' } } },
    website: { format: { link: { url: '{website}' } } },
    name: { format: { text: '{name} #{id}' } }
});

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: columns(),
    layout: { center: COLUMNS.map((field) => ({ fields: [field], width: 120 })) },
    ...more
});

/** the host of a link cell on screen, by its field and displayed row */
const hostOf = (element: GridElement, field: string, row = 0) =>
    element.querySelector(
        `.simple-html-grid-cell-custom.cellpos-middle-pinned-${row}-${COLUMNS.indexOf(field)}-0`
    ) as HTMLElement;

/** the <a> of a link cell */
const linkOf = (element: GridElement, field: string, row = 0) =>
    hostOf(element, field, row).querySelector('a.simple-html-grid-cell-link') as HTMLAnchorElement;

/** the input of a default cell */
const inputOf = (element: GridElement, field: string, row = 0) =>
    element.querySelector(`input.cellpos-middle-pinned-${row}-${COLUMNS.indexOf(field)}-0`) as HTMLInputElement;

/** a keydown on an element, returns the event */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** a mouse event on an element, returns it */
function mouse(target: Element, type: string, init: MouseEventInit = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
    target.dispatchEvent(event);
    return event;
}

const editorInput = () => document.querySelector('.simple-html-grid-text-editor input') as HTMLInputElement | null;

describe('links in the grid - the cells', () => {
    it('expect a link column drawn as a custom cell: the host the stop of Tab, the <a> in it out of the tab order', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const host = hostOf(element, 'company');

        expect(host.getAttribute('tabindex')).toEqual('0');
        expect(host.getAttribute('aria-keyshortcuts')).toEqual('Alt+Enter');
        expect(host.children.length).toBe(1);
        const link = linkOf(element, 'company');
        expect(link.tabIndex).toBe(-1);
        expect(link.draggable).toBe(false);
        // the default cells of the other columns are inputs
        expect(inputOf(element, 'id')).not.toBeNull();
        expect(inputOf(element, 'name')).not.toBeNull();
    });

    it('expect the text of the template, the address with the values encoded, a new tab with noopener noreferrer', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const link = linkOf(element, 'company');

        expect(link.textContent).toEqual('Acme & Co (12)');
        expect(link.getAttribute('href')).toEqual('https://crm.example.com/customer/12');
        expect(link.getAttribute('target')).toEqual('_blank');
        expect(link.getAttribute('rel')).toEqual('noopener noreferrer');
    });

    it('expect a link without newTab in this tab: no target, no rel', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const link = linkOf(element, 'email');

        expect(link.textContent).toEqual('ann@example.com');
        expect(link.getAttribute('href')).toEqual('mailto:ann@example.com');
        expect(link.hasAttribute('target')).toBe(false);
        expect(link.hasAttribute('rel')).toBe(false);
    });

    it('expect no link for an empty value and an address that is not allowed: the text, no href', async () => {
        const { element } = await mountGrid(config(), rows(), fields());

        // the email is empty, the website javascript: and data:, the id of the third row empty
        expect(linkOf(element, 'email', 1).hasAttribute('href')).toBe(false);
        expect(linkOf(element, 'website', 1).hasAttribute('href')).toBe(false);
        expect(linkOf(element, 'website', 1).textContent).toEqual('javascript:alert(1)');
        expect(linkOf(element, 'website', 2).hasAttribute('href')).toBe(false);
        expect(linkOf(element, 'company', 2).hasAttribute('href')).toBe(false);
        expect(linkOf(element, 'company', 2).hasAttribute('target')).toBe(false);
        // a whole address of an allowed scheme
        expect(linkOf(element, 'website').getAttribute('href')).toEqual('https://acme.example.com/');
    });

    it('expect hostile values to stay text: no element made, no attribute added, the mailto has no header', async () => {
        const { element } = await mountGrid(config(), rows(), fields());

        expect(element.querySelector('img')).toBeNull();
        expect(inputOf(element, 'name', 1).value).toEqual('<img src=x onerror=alert(1)> #13');
        const quoted = linkOf(element, 'company', 2);
        expect(quoted.textContent).toEqual('" onmouseover="alert(1) ()');
        expect(quoted.hasAttribute('onmouseover')).toBe(false);
        expect(element.querySelector('[onmouseover]')).toBeNull();
        expect(linkOf(element, 'email', 2).getAttribute('href')).toEqual('mailto:bob@example.com%3Fbcc%3Deve@evil.com');
        expect(element.querySelector('script')).toBeNull();
    });

    it('expect a link to follow its row: another value, then no address, then one again', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields());
        const row = datasource.getRows()[0];

        row.id = 99;
        await sleep(30);
        expect(linkOf(element, 'company').getAttribute('href')).toEqual('https://crm.example.com/customer/99');
        expect(linkOf(element, 'company').textContent).toEqual('Acme & Co (99)');
        row.id = null;
        await sleep(30);
        expect(linkOf(element, 'company').hasAttribute('href')).toBe(false);
        row.id = 1;
        await sleep(30);
        expect(linkOf(element, 'company').getAttribute('target')).toEqual('_blank');
    });

    it('expect links in a readonly grid too', async () => {
        const { element } = await mountGrid(config({ readonly: true }), rows(), fields());
        expect(linkOf(element, 'company').getAttribute('href')).toEqual('https://crm.example.com/customer/12');
    });

    it('expect a renderer of your own to draw the cell: it gets the text of the template, no link', async () => {
        registerCellRenderer('link-test-own', (host) => ({
            update({ text }) {
                host.textContent = text;
            }
        }));
        const own = config();
        own.columns = { ...columns(), company: { ...columns().company, renderer: 'link-test-own' } };
        const { element } = await mountGrid(own, rows(), fields());

        expect(hostOf(element, 'company').textContent).toEqual('Acme & Co (12)');
        expect(hostOf(element, 'company').querySelector('a')).toBeNull();
    });
});

describe('links in the grid - a click and the keys', () => {
    it('expect a press on the text to focus the cell, not the link, and a plain click to open it', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields());
        const link = linkOf(element, 'company', 1);

        const down = mouse(link, 'mousedown');
        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(hostOf(element, 'company', 1));
        mouse(link, 'click', { detail: 1 });

        expect(clicks).toEqual([{ href: 'https://crm.example.com/customer/13', prevented: false }]);
        // the row is the current row, as a click on any cell makes it
        expect(datasource.currentEntity).toBe(datasource.getRows()[1]);
    });

    it('expect Ctrl/Cmd+click to open it (a new tab, the browser): no range of cells', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        hostOf(element, 'email').focus();
        const link = linkOf(element, 'company');

        link.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true, isPrimary: true, pointerType: 'mouse' })
        );
        mouse(link, 'click', { ctrlKey: true, detail: 1 });
        mouse(link, 'click', { metaKey: true, detail: 1 });

        expect(gridInterface.getRanges()).toEqual([]);
        expect(clicks.map((click) => click.prevented)).toEqual([false, false]);
    });

    it('expect Shift+click, Alt+click and the second click of a double click not to open it', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const link = linkOf(element, 'company');

        mouse(link, 'click', { shiftKey: true, detail: 1 });
        mouse(link, 'click', { altKey: true, detail: 1 });
        mouse(link, 'click', { detail: 2 });

        expect(clicks.map((click) => click.prevented)).toEqual([true, true, true]);
    });

    it('expect a right click to open the row menu, the link not focused', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const link = linkOf(element, 'company');

        expect(mouse(link, 'mousedown', { button: 2 }).defaultPrevented).toBe(true);
        expect(document.activeElement).not.toBe(link);
        mouse(link, 'contextmenu', { button: 2 });
        expect(document.querySelector('[data-menu-id="row.copy"]')).not.toBeNull();
    });

    it('expect Alt+Enter to open the link, as a click on it; a cell without an address does nothing', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const host = hostOf(element, 'company');
        host.focus();

        expect(press(host, 'Enter', { altKey: true }).defaultPrevented).toBe(true);
        expect(clicks).toEqual([{ href: 'https://crm.example.com/customer/12', prevented: false }]);
        expect(editorInput()).toBeNull();

        hostOf(element, 'website', 1).focus();
        expect(press(hostOf(element, 'website', 1), 'Enter', { altKey: true }).defaultPrevented).toBe(true);
        expect(clicks.length).toBe(1);
    });

    it('expect Enter, F2 and a character typed to edit the value, not the text of the template', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields());
        const host = hostOf(element, 'company');
        host.focus();

        expect(press(host, 'Enter').defaultPrevented).toBe(true);
        expect(editorInput()?.value).toEqual('Acme & Co');
        (editorInput() as HTMLInputElement).value = 'Initech';
        press(editorInput() as HTMLInputElement, 'Enter');
        expect(datasource.getRows()[0].company).toEqual('Initech');
        await sleep(30);
        expect(linkOf(element, 'company').textContent).toEqual('Initech (12)');
        expect(clicks).toEqual([]);

        press(host, 'F2');
        expect(editorInput()?.value).toEqual('Initech');
        press(editorInput() as HTMLInputElement, 'Escape');
        press(host, 'x');
        expect(editorInput()?.value).toEqual('Initechx');
        press(editorInput() as HTMLInputElement, 'Escape');
    });

    it('expect a double click beside the text to edit, one on the text not (its click opened the link)', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const host = hostOf(element, 'company');
        host.focus();

        mouse(linkOf(element, 'company'), 'dblclick');
        expect(editorInput()).toBeNull();
        mouse(host, 'dblclick');
        expect(editorInput()?.value).toEqual('Acme & Co');
    });

    it('expect nothing to edit in a readonly grid: Enter is not taken, the link stays', async () => {
        const { element } = await mountGrid(config({ readonly: true }), rows(), fields());
        const host = hostOf(element, 'company');
        host.focus();

        press(host, 'F2');
        expect(editorInput()).toBeNull();
        press(host, 'Enter', { altKey: true });
        expect(clicks.length).toBe(1);
    });

    it('expect the arrows to move from a link cell to the next cell, as from any custom cell', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const host = hostOf(element, 'company');
        host.focus();

        press(host, 'ArrowRight');
        await sleep(150);
        expect(document.activeElement).toBe(hostOf(element, 'email'));
        press(hostOf(element, 'email'), 'ArrowDown');
        await sleep(150);
        expect(document.activeElement).toBe(hostOf(element, 'email', 1));
    });

    it('expect a cell with a text template (no link) to be an input: edited as the value, the template after', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields());
        const input = inputOf(element, 'name');
        expect(input.value).toEqual('Ann #12');

        input.focus();
        expect(inputOf(element, 'name').value).toEqual('Ann');
        inputOf(element, 'name').value = 'Anna';
        inputOf(element, 'name').dispatchEvent(new Event('input', { bubbles: true }));
        expect(datasource.getRows()[0].name).toEqual('Anna');
        inputOf(element, 'name').blur();
        expect(inputOf(element, 'name').value).toEqual('Anna #12');
    });
});

describe('links in the grid - copy, export, Find, sorting, the value list', () => {
    it('expect copy to copy the value, not the text of the template', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        hostOf(element, 'company').focus();

        const clipboardData = new DataTransfer();
        document.activeElement?.dispatchEvent(
            new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true })
        );

        expect(clipboardData.getData('text/plain')).toEqual('Acme & Co');
    });

    it('expect the CSV export to have the values', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const csv = gridInterface.getCsv({ fields: ['company', 'website', 'name'] });

        expect(csv.split('\r\n').slice(0, 3)).toEqual([
            'Company,Website,Name',
            'Acme & Co,https://acme.example.com,Ann',
            'Globex,javascript:alert(1),<img src=x onerror=alert(1)>'
        ]);
    });

    it('expect the Excel export to have the values as text, no formula, no hyperlink', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const blob = await gridInterface.getExcel({ fields: ['company', 'email'] });
        const parts = readParts(new Uint8Array(await blob.arrayBuffer()));
        const sheet = parseXml(parts['xl/worksheets/sheet1.xml']);

        const texts = Array.from(sheet.querySelectorAll('row:nth-child(2) c'), (c) => c.querySelector('is > t')?.textContent);
        expect(texts).toEqual(['Acme & Co', 'ann@example.com']);
        expect(sheet.querySelector('f')).toBeNull();
        expect(sheet.querySelector('hyperlinks')).toBeNull();
    });

    it('expect Find to find the text the cells show: the template', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());

        expect(gridInterface.find('(12)')).toBe(1);
        expect(gridInterface.find('#13')).toBe(1);
        gridInterface.closeFind();
    });

    it('expect sorting on the value, not the text of the template', async () => {
        const { datasource } = await mountGrid(config(), rows(), fields());
        datasource.sort([{ attribute: 'company', ascending: true }]);

        expect(datasource.getRows().map((row) => row.company)).toEqual(['" onmouseover="alert(1)', 'Acme & Co', 'Globex']);
    });

    it('expect the value list of the filter menu to list the texts of the template: the column is filtered on what it shows', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        openFilterMenu(element, 'company');

        expect(valueRow('Acme & Co (12)')).toBeTruthy();
        expect(valueRow('Acme & Co')).toBeUndefined();
    });

    it('expect the values with filterAsShown: false - the column filtered on its value', async () => {
        const columns = config().columns ?? {};
        const { element } = await mountGrid(
            {
                ...config(),
                columns: {
                    ...columns,
                    company: { ...columns.company, format: { ...columns.company?.format, filterAsShown: false } }
                }
            },
            rows(),
            fields()
        );
        openFilterMenu(element, 'company');

        expect(valueRow('Acme & Co')).toBeTruthy();
        expect(valueRow('Acme & Co (12)')).toBeUndefined();
    });
});

describe('links in the grid - the state and the config', () => {
    it('expect the formats in getState(), the same after JSON in another grid', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));

        expect(saved.formats.company).toEqual({
            text: '{company} ({id})',
            link: { url: 'https://crm.example.com/customer/{id}', newTab: true }
        });
        const other = await mountGrid({ ...config(), columns: {} }, rows(), fields());
        other.gridInterface.setState(saved);
        expect(other.gridInterface.getState().formats).toEqual(saved.formats);
    });

    it('expect setState() to throw a TypeError for an address that is not allowed, and to change nothing', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const before = gridInterface.getState().formats;

        expect(() => gridInterface.setState({ formats: { email: { link: { url: 'javascript:alert(1)' } } } })).toThrow(
            /setState: formats.email.link.url is "javascript:alert\(1\)": a link to javascript: is not allowed/
        );
        expect(() => gridInterface.setState({ formats: { company: { date: 'iso' } } })).toThrow(
            /formats.company.date is for a date or datetime field/
        );
        expect(gridInterface.getState().formats).toEqual(before);
    });

    it('expect a link set with setState() in the cells, and resetState() to go back to the config', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());

        gridInterface.setState({ formats: { company: { link: { url: 'https://duckduckgo.com/?q={company}' } } } });
        expect(linkOf(element, 'company').getAttribute('href')).toEqual('https://duckduckgo.com/?q=Acme%20%26%20Co');
        expect(linkOf(element, 'company').textContent).toEqual('Acme & Co');
        expect(inputOf(element, 'email')).not.toBeNull();

        gridInterface.resetState();
        expect(linkOf(element, 'company').textContent).toEqual('Acme & Co (12)');
        expect(linkOf(element, 'email').getAttribute('href')).toEqual('mailto:ann@example.com');
    });

    it('expect the constructor and updateConfig() to throw a TypeError for a link that does not fit', () => {
        const datasource = new Datasource(fields());
        const bad = (format: unknown): GridConfig => ({ ...config(), columns: { company: { format: format as never } } });

        expect(() => new GridInterface(bad({ link: { url: '/customer/{id}' } }), datasource)).toThrow(
            /GridConfig: columns.company.format.link.url is "\/customer\/\{id\}": it starts with https:/
        );
        const gridInterface = new GridInterface(config(), datasource);
        expect(() => gridInterface.updateConfig(bad({ link: { url: 'data:text/html,{x}' } }))).toThrow(TypeError);
        expect(() => gridInterface.updateConfig(bad({ text: '' }))).toThrow(TypeError);
    });
});

describe('templates and links on a number and a date column', () => {
    const NUMBER_COLUMNS = ['weight', 'order', 'born'];
    const numberRows = () => [{ weight: 1234.56, order: 1042, born: new Date(2001, 4, 17) }];
    const numberFields = (): DatasourceOptions => ({ fields: { weight: 'number', order: 'number', born: 'date' } });
    const numberConfig = (): GridConfig => ({
        readonly: false,
        columns: {
            weight: { format: { number: { decimals: 1, thousands: ' ', decimal: ',' }, text: '{value} kg' } },
            order: { format: { text: 'order {value}', link: { url: 'https://shop.example.com/order/{value}' } } },
            born: { format: { date: 'norwegian', text: 'born {value}' } }
        },
        layout: { center: NUMBER_COLUMNS.map((field) => ({ fields: [field], width: 120 })) }
    });
    const input = (element: GridElement, field: string) =>
        element.querySelector(`input.cellpos-middle-pinned-0-${NUMBER_COLUMNS.indexOf(field)}-0`) as HTMLInputElement;
    const host = (element: GridElement, field: string) =>
        element.querySelector(
            `.simple-html-grid-cell-custom.cellpos-middle-pinned-0-${NUMBER_COLUMNS.indexOf(field)}-0`
        ) as HTMLElement;

    it('expect {value} in the number or date format of the column, the template around it', async () => {
        const { element } = await mountGrid(numberConfig(), numberRows(), numberFields());
        expect(input(element, 'weight').value).toEqual('1 234,6 kg');
        expect(input(element, 'born').value).toEqual('born 17.05.2001');
    });

    it('expect a number edited as the value, the template after', async () => {
        const { element, datasource } = await mountGrid(numberConfig(), numberRows(), numberFields());
        input(element, 'weight').focus();
        expect(input(element, 'weight').value).not.toContain('kg');
        input(element, 'weight').value = '80';
        input(element, 'weight').dispatchEvent(new Event('input', { bubbles: true }));
        expect(datasource.getRows()[0].weight).toEqual(80);
        input(element, 'weight').blur();
        expect(input(element, 'weight').value).toEqual('80,0 kg');
    });

    it('expect a number column with a link to be a link cell: its text the template, its address the number', async () => {
        const { element } = await mountGrid(numberConfig(), numberRows(), numberFields());
        const link = host(element, 'order').querySelector('a.simple-html-grid-cell-link') as HTMLAnchorElement;
        expect(link.textContent).toEqual('order 1042');
        expect(link.getAttribute('href')).toEqual('https://shop.example.com/order/1042');
    });

    it('expect sorting on the number, not the text of the template', async () => {
        const rows = [
            { weight: 9, order: 1, born: null },
            { weight: 10, order: 2, born: null }
        ];
        const { datasource } = await mountGrid(numberConfig(), rows, numberFields());
        datasource.sort([{ attribute: 'weight', ascending: true }]);
        // as text '10,0 kg' would come before '9,0 kg'
        expect(datasource.getRows().map((row: any) => row.weight)).toEqual([9, 10]);
    });
});

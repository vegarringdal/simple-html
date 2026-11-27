// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { buildXlsx } from '../xlsx';
import { zip } from '../zip';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openLabelMenu, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * The import dialog (importDialog.ts) in a mounted grid: pasted rows and files, the header found and the
 * fields matched, a field picked by hand, the options, the problems and the rows with problems skipped,
 * Import and its undo, the errors of a file, and how it is opened - the menus, a drop, a paste
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});
beforeEach(() => {
    document.body.innerHTML = '';
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const config = (): GridConfig => ({
    readonly: false,
    importMenu: true,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['age'], width: 100 },
            { fields: ['born'], width: 100 }
        ]
    },
    columns: { name: { label: 'Name' }, age: { label: 'Age' }, born: { label: 'Born' } }
});

const options = () => ({
    key: 'id',
    fields: { age: { type: 'number' as const, validate: [{ id: 'min', value: 0 }] }, born: 'date' as const }
});

async function mount() {
    return mountGrid(config(), [{ id: 1, name: 'Old', age: 50 }], options());
}

const dialog = () => document.querySelector('.import-dialog') as HTMLDialogElement | null;
const textOf = (selector: string) => dialog()?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const importButton = () => dialog()?.querySelector('.import-button') as HTMLButtonElement;
const fieldPickers = () => Array.from(dialog()?.querySelectorAll<HTMLSelectElement>('.import-field') ?? []);
const previewRows = () =>
    Array.from(dialog()?.querySelectorAll('.import-table tbody tr') ?? []).map((row) =>
        Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())
    );

/** picks a value of a select, as the user does */
function pick(select: HTMLSelectElement, value: string) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** the selects of the options, by their label */
function option(label: string): HTMLSelectElement {
    const found = Array.from(dialog()?.querySelectorAll('.import-option') ?? []).find(
        (each) => each.querySelector('.import-option-label')?.textContent?.trim() === label
    );
    return found?.querySelector('select') as HTMLSelectElement;
}

/** waits for a file to be read */
async function read() {
    for (let i = 0; i < 50 && dialog()?.querySelector('.import-body [role="status"]')?.textContent?.includes('Reading'); i++) {
        await sleep(10);
    }
    await sleep(10);
}

describe('import dialog - pasted rows', () => {
    it('expect the header found, the fields matched by name, the first rows, the problems, Import', async () => {
        const { datasource, gridInterface } = await mount();
        gridInterface.openImport('Age\tName\tNotes\r\n36\tAnn\tx\r\nold\tBob\t\r\n\r\n-2\tCid\ty\r\n');
        expect(dialog()?.open).toBe(true);
        expect(textOf('.import-source-name')).toBe('Pasted rows');
        expect(textOf('.import-hint')).toBe('The first row names the columns: they are matched to the fields by name');
        expect(fieldPickers().map((select) => select.value)).toEqual(['age', 'name', '']);
        expect(previewRows()).toEqual([
            ['36', 'Ann', 'x'],
            ['old', 'Bob', ''],
            ['-2', 'Cid', 'y']
        ]);
        // the cells with a problem marked, their message the tooltip
        const marked = dialog()?.querySelectorAll('.import-cell-problem') ?? [];
        expect(Array.from(marked, (cell) => cell.getAttribute('data-tooltip'))).toEqual([
            'Not a number: old',
            'Must be at least 0'
        ]);
        expect(textOf('.import-summary')).toBe('3 rows, 2 with problems');
        expect(Array.from(dialog()?.querySelectorAll('.import-problems li') ?? [], (li) => li.textContent?.trim())).toEqual([
            'Row 3, Age: Not a number: old',
            'Row 5, Age: Must be at least 0'
        ]);
        expect(importButton().textContent?.trim()).toBe('Import 3 rows');

        importButton().click();
        expect(dialog()).toBeNull();
        // the rows themselves: getChanges() has copies
        const added = datasource.getAllData().filter((row) => row.__rowState === 'N');
        expect(added.map((row) => [row.name, row.age])).toEqual([
            ['Ann', 36],
            ['Bob', null],
            ['Cid', -2]
        ]);
        expect(added[1].__rowError).toBe('Not imported: Age: Not a number: old');
        expect(datasource.getErrors(added).map((error) => error.field)).toEqual(['age']);
        // one step: undo takes them all out
        await sleep(0);
        datasource.undo();
        expect(datasource.getChanges().newEntities).toEqual([]);
    });

    it('expect a field picked by hand: taken off the column it was on, the rows read again', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport('Age\tName\r\nold\tAnn\r\n');
        pick(fieldPickers()[0], 'name');
        expect(fieldPickers().map((select) => select.value)).toEqual(['name', '']);
        expect(textOf('.import-summary')).toBe('1 rows');
        expect(dialog()?.querySelector('.import-problems')).toBeNull();
        pick(fieldPickers()[0], '');
        expect(textOf('.import-error')).toBe('Pick a field for at least one column');
        expect(importButton().getAttribute('aria-disabled')).toBe('true');
        importButton().click();
        expect(dialog()).not.toBeNull();
    });

    it('expect no header: the columns by position, the header turned on and off by hand', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport('Ann\t36\r\nBob\t41\r\n');
        expect(textOf('.import-hint')).toBe('The columns are matched to the fields by position, from Name');
        expect(fieldPickers().map((select) => select.value)).toEqual(['name', 'age']);
        const header = dialog()?.querySelector('.import-options input[type="checkbox"]') as HTMLInputElement;
        expect(header.checked).toBe(false);
        header.checked = true;
        header.dispatchEvent(new Event('change'));
        // Ann and 36 name no field: still by position, the first row not imported
        expect(textOf('.import-summary')).toBe('1 rows');
        expect(Array.from(dialog()?.querySelectorAll('.import-header-row th') ?? [], (th) => th.textContent?.trim())).toEqual([
            'Ann',
            '36'
        ]);
    });

    it('expect the rows with problems skipped when picked, the button counting the rows left', async () => {
        const { datasource, gridInterface } = await mount();
        gridInterface.openImport('Name\tAge\r\nAnn\t1\r\nBob\tx\r\n');
        pick(option('Rows with problems'), 'skip');
        expect(importButton().textContent?.trim()).toBe('Import 1 rows');
        importButton().click();
        expect(datasource.getChanges().newEntities.map((row) => row.name)).toEqual(['Ann']);
    });

    it('expect the decimal mark and the order of dates with / when such a field is picked', async () => {
        const { datasource, gridInterface } = await mount();
        gridInterface.openImport('Name\tAge\tBorn\r\nAnn\t1.500\t02/03/2001\r\n');
        expect(option('Decimal mark').value).toBe('auto');
        pick(option('Decimal mark'), ',');
        pick(option('Dates with /'), 'MDY');
        importButton().click();
        const [ann] = datasource.getChanges().newEntities;
        expect(ann.age).toBe(1500);
        expect(ann.born).toEqual(new Date(2001, 1, 3));
    });

    it('expect the separator found, and picked: the rows read again', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport('Name;Age\r\nAnn;3\r\n');
        const separator = option('Separator');
        expect(separator.selectedOptions[0].textContent?.trim()).toBe('Found: Semicolon');
        pick(separator, ',');
        expect(fieldPickers()).toHaveLength(1);
        // Name;Age names no field: no header now
        expect(previewRows()).toEqual([['Name;Age'], ['Ann;3']]);
    });

    it('expect empty text to say the clipboard has no rows, Cancel and Esc to close', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport('  \r\n');
        expect(textOf('.import-error')).toBe('No rows on the clipboard: copy them in a spreadsheet, then paste them here');
        (Array.from(dialog()?.querySelectorAll('.filter-editor-footer button') ?? [])[0] as HTMLButtonElement).click();
        expect(dialog()).toBeNull();
        gridInterface.openImport();
        dialog()?.close();
        dialog()?.dispatchEvent(new Event('close'));
        expect(dialog()).toBeNull();
    });

    it('expect rows pasted into the dialog and text dropped on it to be read', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport();
        const body = dialog()?.querySelector('.import-body') as HTMLElement;
        const paste = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'Name\r\nAnn\r\nBob' } });
        body.dispatchEvent(paste);
        expect(paste.defaultPrevented).toBe(true);
        expect(textOf('.import-summary')).toBe('2 rows');

        const drop = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(drop, 'dataTransfer', { value: { files: [], getData: () => 'Name\r\nCid' } });
        body.dispatchEvent(drop);
        expect(textOf('.import-summary')).toBe('1 rows');
    });

    it('expect the dialog to close when the grid leaves the page', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.openImport('a');
        element.remove();
        expect(dialog()).toBeNull();
    });
});

describe('import dialog - files', () => {
    it('expect a file dropped on the dialog to be read: its name, its rows', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport();
        const drop = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(drop, 'dataTransfer', {
            value: { files: [new File(['Name,Age\r\nAnn,3\r\n'], 'people.csv')], getData: () => '' }
        });
        dialog()?.querySelector('.import-body')?.dispatchEvent(drop);
        await read();
        expect(textOf('.import-source-name')).toBe('people.csv');
        expect(textOf('.import-summary')).toBe('1 rows');
    });

    it('expect a file picked with Choose file… to be read', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport();
        const input = dialog()?.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(input, 'files', { configurable: true, value: [new File(['Name\nAnn\nBob\n'], 'names.txt')] });
        input.dispatchEvent(new Event('change'));
        await read();
        expect(textOf('.import-summary')).toBe('2 rows');
    });

    it('expect a workbook of two sheets: the first read, the other picked', async () => {
        const { gridInterface } = await mount();
        const xml = '<?xml version="1.0" encoding="UTF-8"?>';
        const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
        const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const parts: Record<string, string> = {
            'xl/workbook.xml': `${xml}<workbook ${ns} xmlns:r="${rel}"><sheets><sheet name="One" sheetId="1" r:id="r1"/><sheet name="Two" sheetId="2" r:id="r2"/></sheets></workbook>`,
            'xl/_rels/workbook.xml.rels': `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="${rel}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
            'xl/worksheets/sheet1.xml': `${xml}<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Ann</t></is></c></row></sheetData></worksheet>`,
            'xl/worksheets/sheet2.xml': `${xml}<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Bob</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Cid</t></is></c></row></sheetData></worksheet>`
        };
        const workbook = await zip(Object.entries(parts).map(([name, text]) => ({ name, data: new TextEncoder().encode(text) })));
        gridInterface.openImport(new File([workbook], 'two.xlsx'));
        await read();
        expect(option('Sheet').selectedOptions[0].textContent?.trim()).toBe('One');
        expect(previewRows()).toEqual([['Ann']]);
        pick(option('Sheet'), '1');
        await read();
        expect(previewRows()).toEqual([['Bob'], ['Cid']]);
        expect(option('Sheet').value).toBe('1');
    });

    it('expect a workbook of the grid: the dates typed, imported as dates', async () => {
        const { gridInterface } = await mount();
        const bytes = await buildXlsx({
            name: 'People',
            columns: [{ label: 'Name' }, { label: 'Born' }],
            rows: [['Ann', { date: new Date(2001, 4, 17), time: false, order: 'YMD' }]]
        });
        gridInterface.openImport(new File([bytes], 'people.xlsx'));
        await read();
        expect(textOf('.import-source-name')).toBe('people.xlsx');
        expect(option('Sheet')).toBeUndefined();
        expect(previewRows()).toEqual([['Ann', '2001-05-17']]);
        importButton().click();
        expect(gridInterface.getDatasource().getChanges().newEntities[0].born).toEqual(new Date(2001, 4, 17));
    });

    it('expect a file it does not read to be said in words: .xls, damaged, too large', async () => {
        const { gridInterface } = await mount();
        gridInterface.openImport(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])]));
        await read();
        expect(textOf('.import-error')).toBe(
            'An Excel 97-2003 file (.xls), or one protected by a password, can not be read: save it as .xlsx or CSV'
        );
        gridInterface.openImport(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])]));
        await read();
        expect(textOf('.import-error')).toBe(
            'The file can not be read: it is not CSV or an Excel workbook (.xlsx), or it is damaged'
        );
        gridInterface.openImport(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]));
        await read();
        expect(textOf('.import-error')).toBe(
            'The file is too large to import: at most 20 MB, 100000 rows, 1000 columns and 1000000 cells'
        );
    });
});

describe('import dialog - from the menus', () => {
    it("expect Paste › As new rows… to open it with the clipboard's rows, the columns from the cell's column", async () => {
        const { element } = await mount();
        vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => '7\t2001-01-02\r\n' } });
        openRowMenu(element, 'age');
        menuEntry('row.paste.newRows').click();
        await sleep(10);
        expect(textOf('.import-hint')).toBe('The columns are matched to the fields by position, from Age');
        expect(fieldPickers().map((select) => select.value)).toEqual(['age', 'born']);
    });

    it('expect Paste › As new rows… with a clipboard it may not read to ask for a paste', async () => {
        const { element } = await mount();
        vi.stubGlobal('navigator', {
            ...navigator,
            clipboard: {
                readText: async () => {
                    throw new Error('denied');
                }
            }
        });
        openRowMenu(element, 'name');
        menuEntry('row.paste.newRows').click();
        await sleep(10);
        expect(textOf('.import-error')).toBe('No rows on the clipboard: copy them in a spreadsheet, then paste them here');
    });

    it('expect Import rows… in the header menu to open it empty: a file to pick', async () => {
        const { element } = await mount();
        openLabelMenu(element, 'name');
        menuEntry('header.import').click();
        expect(dialog()?.open).toBe(true);
        expect(textOf('.import-drop')).toBe('Drop a CSV or Excel (.xlsx) file here, or paste rows copied from a spreadsheet');
        expect(importButton().getAttribute('aria-disabled')).toBe('true');
    });
});

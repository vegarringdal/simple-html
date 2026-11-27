// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { columnChooserFields, renameColumn } from '../gridFunctions/contextMenuColumnChooser';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuItem, openLabelMenu, pointerEvent } from './interactionTestHelpers';

/**
 * The column chooser (contextMenuColumnChooser.ts): its search - framed as an input, it finds a field by
 * its name or its label - the drag handle in front of each field, and the ✎ of a field that gives the
 * column a label of the user's (`ColumnFormat.label` in the state's formats, as the grid config dialog's
 * *Label*). The popover itself (open, close, Esc) is in gridMenus.test.ts, a field dragged into the header
 * in columnDragDrop.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { first_name: 'Ann', company: 'Acme', age: 30, phone: '123' },
    { first_name: 'Bob', company: 'Bits', age: 40, phone: '456' }
];

const fields = (): DatasourceOptions => ({ fields: { age: 'number' } });

const config = (): GridConfig => ({
    columns: {
        // a label of the config: the chooser finds Firm, and company
        company: { label: 'Firm' },
        // a number format: a rename keeps it
        age: { label: 'Age', format: { number: { decimals: 2 } } },
        // not in the layout: the chooser lists it to be added
        phone: { label: 'Phone' }
    },
    layout: { center: ['first_name', 'company', 'age'].map((field) => ({ fields: [field], width: 100 })) }
});

/** the chooser's popover, opened from the header menu */
let chooser: HTMLElement;

async function openChooser() {
    const mounted = await mountGrid(config(), rows(), fields());
    openLabelMenu(mounted.element, 'age');
    menuItem('Column chooser').click();
    chooser = gridOf(mounted.element).columnChooserMenu as HTMLElement;
    return mounted;
}

const search = () => chooser.querySelector('.simple-html-grid-chooser-search input') as HTMLInputElement;
const fieldRows = () =>
    Array.from(chooser.querySelectorAll<HTMLCellElement>('.simple-html-grid-menu-sub .simple-html-grid-menu-item'));
/** the labels of the list, in its order */
const labels = () => fieldRows().map((row) => row.textContent?.trim());
const row = (field: string) => fieldRows().find((each) => each.$attribute === field) as HTMLCellElement;
const pencil = (field: string) => row(field).querySelector('.simple-html-grid-chooser-rename') as HTMLButtonElement;
const labelInput = () => chooser.querySelector('.simple-html-grid-chooser-label-input') as HTMLInputElement;
const headerLabel = (element: GridElement, field: string) =>
    element.querySelector(`[data-attribute-header="${field}"]`)?.textContent?.trim();

function typeSearch(text: string) {
    search().value = text;
    search().dispatchEvent(new Event('input', { bubbles: true }));
}

function press(target: Element, key: string) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

// the search is kept from one opening to the next (one for the page): empty for the next test
afterEach(() => {
    if (chooser?.isConnected) {
        typeSearch('');
    }
});

describe('column chooser - the search', () => {
    it('expect it framed as an input: a magnifying glass in front, the placeholder and the name Search', async () => {
        await openChooser();
        const frame = chooser.querySelector('.simple-html-grid-chooser-search') as HTMLElement;
        expect(frame.tagName).toEqual('LABEL');
        expect(frame.querySelector('svg')?.getAttribute('aria-hidden')).toEqual('true');
        expect(search().placeholder).toEqual('Search');
        expect(search().getAttribute('aria-label')).toEqual('Search');
        // the first input of the chooser
        expect(chooser.querySelector('input')).toBe(search());
    });

    it('expect every column listed by its label, in the order of the labels', async () => {
        await openChooser();
        expect(labels()).toEqual(['Age', 'Firm', 'First Name', 'Phone']);
    });

    it('expect it to find a field by its label, and by its name', async () => {
        await openChooser();
        typeSearch('irm');
        expect(labels()).toEqual(['Firm']);
        typeSearch('COMP');
        expect(labels()).toEqual(['Firm']);
        // the name, not the label (First Name)
        typeSearch('first_');
        expect(labels()).toEqual(['First Name']);
        typeSearch('xyz');
        expect(labels()).toEqual([]);
        typeSearch('');
        expect(labels()).toEqual(['Age', 'Firm', 'First Name', 'Phone']);
    });

    it('expect it to find a label of the user: the state’s format', async () => {
        const { gridInterface } = await openChooser();
        gridInterface.setState({ formats: { phone: { label: 'Mobile' } } });
        typeSearch('mob');
        expect(labels()).toEqual(['Mobile']);
        expect(columnChooserFields({ gridInterface }, ' MOB ')).toEqual([{ field: 'phone', label: 'Mobile' }]);
    });
});

describe('column chooser - a field', () => {
    it('expect a drag handle in front of its label - the same as the Detail form tab’s - the whole row dragged', async () => {
        await openChooser();
        for (const each of fieldRows()) {
            const handle = each.firstElementChild as HTMLElement;
            expect(handle.classList.contains('simple-html-grid-drag-handle')).toBe(true);
            expect(handle.getAttribute('aria-hidden')).toEqual('true');
            expect(handle.getAttribute('data-tooltip')).toEqual('Drag it into the header to add the column');
            expect(handle.querySelector('svg.simple-html-grid-drag-handle-icon')).not.toBeNull();
            expect(each.style.touchAction).toEqual('pan-y');
        }
    });

    it('expect the tooltips of the handle and the ✎ in the chooser when the pointer rests on them', async () => {
        await openChooser();
        const handle = row('phone').firstElementChild as HTMLElement;
        handle.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const shown = document.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(shown.style.display).toEqual('block');
        expect(shown.textContent).toEqual('Drag it into the header to add the column');
        // in the chooser: a popover is in the top layer
        expect(chooser.contains(shown)).toBe(true);
        // a press hides it: the field dragged does not take it along
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(shown.style.display).toEqual('none');
        pencil('phone').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(document.querySelector('.simple-html-grid-tooltip')?.textContent).toEqual('Rename Phone');
    });

    it('expect a press on the ✎ not to drag the field', async () => {
        await openChooser();
        pencil('phone').dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 60 }));
        expect(document.querySelector('.simple-html-draggable-element')).toBeNull();
        document.dispatchEvent(pointerEvent('pointerup', { clientX: 60, clientY: 60 }));

        // a press on the row is a drag
        row('phone').dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 60 }));
        expect(document.querySelector('.simple-html-draggable-element')).not.toBeNull();
        document.dispatchEvent(pointerEvent('pointercancel'));
    });
});

describe('column chooser - rename a column', () => {
    it('expect a ✎ on each field, a button named by the field', async () => {
        await openChooser();
        expect(pencil('company').tagName).toEqual('BUTTON');
        expect(pencil('company').getAttribute('aria-label')).toEqual('Rename Firm');
        expect(pencil('company').getAttribute('data-tooltip')).toEqual('Rename Firm');
    });

    it('expect the ✎ to turn the label into an input with it, the focus in it - Enter to give the column that label', async () => {
        const { element, gridInterface } = await openChooser();
        pencil('company').click();
        expect(labelInput().value).toEqual('Firm');
        expect(document.activeElement).toBe(labelInput());
        // what empty gives: the column's own label
        expect(labelInput().placeholder).toEqual('Firm');
        expect(labelInput().getAttribute('aria-label')).toEqual('Label of Firm');

        labelInput().value = '  Supplier ';
        const enter = press(labelInput(), 'Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(gridInterface.getState().formats.company).toEqual({ label: 'Supplier' });
        expect(headerLabel(element, 'company')).toEqual('Supplier');
        expect(labelInput()).toBeNull();
        expect(labels()).toEqual(['Age', 'First Name', 'Phone', 'Supplier']);
        // the focus back on its ✎
        expect(document.activeElement).toBe(pencil('company'));
        expect(chooser.isConnected).toBe(true);
    });

    it('expect Esc to leave the label as it was, the chooser open', async () => {
        const { gridInterface } = await openChooser();
        pencil('phone').click();
        labelInput().value = 'Mobile';
        const esc = press(labelInput(), 'Escape');
        expect(esc.defaultPrevented).toBe(true);
        expect(chooser.isConnected).toBe(true);
        expect(gridInterface.getState().formats.phone).toBeUndefined();
        expect(labels()).toEqual(['Age', 'Firm', 'First Name', 'Phone']);
        expect(document.activeElement).toBe(pencil('phone'));
    });

    it('expect leaving the input to save it, the focus where it went', async () => {
        const { gridInterface } = await openChooser();
        pencil('phone').click();
        labelInput().value = 'Mobile';
        search().focus();
        expect(gridInterface.getState().formats.phone).toEqual({ label: 'Mobile' });
        expect(document.activeElement).toBe(search());
    });

    it('expect an empty label to give the column its own again - the other parts of its format kept', async () => {
        const { element, gridInterface } = await openChooser();
        pencil('age').click();
        labelInput().value = 'Years';
        press(labelInput(), 'Enter');
        expect(gridInterface.getState().formats.age).toEqual({ number: { decimals: 2 }, label: 'Years' });

        pencil('age').click();
        labelInput().value = '   ';
        press(labelInput(), 'Enter');
        expect(gridInterface.getState().formats.age).toEqual({ number: { decimals: 2 } });
        expect(headerLabel(element, 'age')).toEqual('Age');
    });

    it('expect renameColumn to take a format of only a label out, and to change nothing for the label it has', async () => {
        const { gridInterface } = await openChooser();
        renameColumn({ gridInterface }, 'phone', 'Mobile');
        expect(gridInterface.getState().formats.phone).toEqual({ label: 'Mobile' });
        const before = gridInterface.getState();
        renameColumn({ gridInterface }, 'phone', ' Mobile ');
        expect(gridInterface.getState()).toEqual(before);
        renameColumn({ gridInterface }, 'phone', '');
        expect('phone' in gridInterface.getState().formats).toBe(false);
        // the same as the grid config dialog's Label: resetState takes it away
        renameColumn({ gridInterface }, 'company', 'Supplier');
        gridInterface.resetState();
        expect(gridInterface.getState().formats.company).toBeUndefined();
    });
});

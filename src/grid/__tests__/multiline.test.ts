// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import { firstLine, hasLineBreak, normalizeLineBreaks, tooltipText } from '../gridFunctions/multilineText';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuItemsExact, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * Text of several lines in a cell: `FieldConfig.multiline`, or a value with a line break. The cell
 * shows the first line, readonly, with a marker and the whole text as its tooltip; the editor over
 * the cell (a textarea in a popover) edits it. happy-dom does no layout: where the editor goes is
 * checked with stubbed sizes here, and in a browser.
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

const data = () => [
    { name: 'a', notes: 'line 1\nline 2', age: 1 },
    { name: 'b', notes: 'one line', age: 2 },
    { name: 'c', notes: 'crlf 1\r\ncrlf 2\rcr 3', age: 3 }
];

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['notes'], width: 100 },
            { fields: ['age'], width: 100 }
        ]
    },
    ...more
});

/** notes has the option: a value without a line break is multiline too */
const multilineFields = (): DatasourceOptions => ({ fields: { age: 'number', notes: { multiline: true, label: 'Notes' } } });
/** notes without the option: multiline for a value with a line break only */
const plainFields = (): DatasourceOptions => ({ fields: { age: 'number' } });

const COLUMNS = ['name', 'notes', 'age'];

/** the input of a body cell, by the row it shows */
const cellInput = (element: HTMLElement, attribute: string, row = 0) =>
    element.querySelector(`input.cellpos-middle-pinned-${row}-${COLUMNS.indexOf(attribute)}-0`) as HTMLInputElement;

/** the cell element of a body cell */
const cellOf = (element: HTMLElement, attribute: string, row = 0) =>
    cellInput(element, attribute, row).closest('.simple-html-grid-col-cell') as HTMLElement;

const editor = () => document.querySelector('.simple-html-grid-text-editor') as HTMLElement | null;
const textarea = () => editor()?.querySelector('textarea') as HTMLTextAreaElement;
const hint = () => editor()?.querySelector('.simple-html-grid-text-editor-hint')?.textContent?.trim();

/** a keydown on an element, returns the event */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
        key,
        code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
        bubbles: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
}

/** focuses a cell input as a click or Tab does, and opens its editor with Enter */
function openWithEnter(element: HTMLElement, attribute = 'notes', row = 0) {
    const input = cellInput(element, attribute, row);
    input.focus();
    press(input, 'Enter');
    return input;
}

/** what the user types in the editor: the value, and the input event */
function typeInEditor(value: string) {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
}

const notes = (datasource: { getAllData(): { notes?: unknown }[] }) => datasource.getAllData().map((row) => row.notes);

describe('multiline - the text', () => {
    it('expect a line break to be CR LF, CR or LF', () => {
        expect(hasLineBreak('a\nb')).toBe(true);
        expect(hasLineBreak('a\r\nb')).toBe(true);
        expect(hasLineBreak('a\rb')).toBe(true);
        expect(hasLineBreak('a b')).toBe(false);
        expect(firstLine('one\r\ntwo\nthree')).toEqual('one');
        expect(firstLine('one\rtwo')).toEqual('one');
        expect(firstLine('\nsecond')).toEqual('');
        expect(firstLine('all of it')).toEqual('all of it');
        expect(normalizeLineBreaks('a\r\nb\rc\nd')).toEqual('a\nb\nc\nd');
    });

    it('expect the tooltip text to be cut after 15 lines and 600 characters, … where it is cut', () => {
        const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
        expect(tooltipText(lines.join('\r\n'))).toEqual(`${lines.slice(0, 15).join('\n')}…`);
        expect(tooltipText('x'.repeat(601))).toEqual(`${'x'.repeat(600)}…`);
        expect(tooltipText('x'.repeat(600))).toEqual('x'.repeat(600));
        // an emoji is one character, never cut in two
        expect(tooltipText('😀'.repeat(601))).toEqual(`${'😀'.repeat(600)}…`);
    });

    it('expect the value of a text input to hold no line break: the browser strips them', () => {
        // the HTML spec, the Text state of input: "Strip newlines from the value". The reason a
        // multiline cell is not edited in its input
        const input = document.createElement('input');
        input.value = 'a\nb\r\nc';
        expect(input.value).toEqual('abc');
    });
});

describe('multiline - the cell', () => {
    it('expect a text cell with a line break to show its first line, a marker and the whole text as tooltip', async () => {
        const { element } = await mountGrid(config(), data(), plainFields());

        const input = cellInput(element, 'notes', 0);
        expect(input.value).toEqual('line 1');
        expect(input.readOnly).toBe(true);
        const marker = cellOf(element, 'notes', 0).querySelector('.simple-html-grid-cell-more') as HTMLElement;
        expect(marker).not.toBeNull();
        expect(marker.getAttribute('aria-hidden')).toEqual('true');
        // the marker describes the input for a screen reader
        expect(input.getAttribute('aria-describedby')).toEqual(marker.id);
        expect(marker.textContent?.trim()).toEqual('More lines, Enter shows all');
        expect(cellOf(element, 'notes', 0).getAttribute('data-tooltip')).toEqual('line 1\nline 2');

        // CR LF and CR are line breaks too, the tooltip shows a line per LF
        expect(cellInput(element, 'notes', 2).value).toEqual('crlf 1');
        expect(cellOf(element, 'notes', 2).getAttribute('data-tooltip')).toEqual('crlf 1\ncrlf 2\ncr 3');
    });

    it('expect a text cell without a line break, and no option, to be an input as before', async () => {
        const { element } = await mountGrid(config(), data(), plainFields());

        const input = cellInput(element, 'notes', 1);
        expect(input.value).toEqual('one line');
        expect(input.readOnly).toBe(false);
        expect(input.hasAttribute('aria-describedby')).toBe(false);
        expect(cellOf(element, 'notes', 1).querySelector('.simple-html-grid-cell-more')).toBeNull();
        expect(cellOf(element, 'notes', 1).hasAttribute('data-tooltip')).toBe(false);
    });

    it('expect a field with the option to be multiline also for a value of one line: readonly, no marker', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());

        const input = cellInput(element, 'notes', 1);
        expect(input.value).toEqual('one line');
        expect(input.readOnly).toBe(true);
        expect(cellOf(element, 'notes', 1).querySelector('.simple-html-grid-cell-more')).toBeNull();
        expect(cellOf(element, 'notes', 1).hasAttribute('data-tooltip')).toBe(false);

        openWithEnter(element, 'notes', 1);
        expect(textarea().value).toEqual('one line');
    });

    it('expect a cell shown as another type (dynamicCellTypeColumn) not to be multiline', async () => {
        const rows = [{ name: 'a', notes: '12', kind: 'number', age: 1 }];
        const { element } = await mountGrid(
            config({ columns: { notes: { dynamicCellTypeColumn: 'kind' } } }),
            rows,
            multilineFields()
        );

        expect(cellInput(element, 'notes', 0).readOnly).toBe(false);
    });

    it('expect the errors first in the tooltip, an empty line, then the text', async () => {
        const fields: DatasourceOptions = {
            fields: { notes: { multiline: true, validate: [{ id: 'maxLength', value: 5, message: 'Too long' }] } }
        };
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields);
        datasource.validate();
        gridInterface.refresh();

        expect(cellOf(element, 'notes', 0).classList.contains('simple-html-cell-error')).toBe(true);
        expect(cellOf(element, 'notes', 0).getAttribute('data-tooltip')).toEqual('Too long\n\nline 1\nline 2');
        // one line: the errors only, the cell shows all of the text
        expect(cellOf(element, 'notes', 1).getAttribute('data-tooltip')).toEqual('Too long');
    });

    it('expect a value with line breaks never to be written back from the input: focus, input, change, blur', async () => {
        const { element, datasource } = await mountGrid(config(), data(), plainFields());
        const input = cellInput(element, 'notes', 0);

        input.dispatchEvent(new FocusEvent('focus'));
        // what an input event from the input would write: its value, without the line breaks
        input.value = 'line 1line 2';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('blur'));
        await sleep(0);

        expect(notes(datasource)[0]).toEqual('line 1\nline 2');
        expect(datasource.getAllData()[0].__rowState).toBeUndefined();
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect the original value of a long text cut in the tooltip of the edited marker too', async () => {
        const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
        const rows = [{ name: 'a', notes: lines.join('\n'), age: 1 }];
        const { element, datasource, gridInterface } = await mountGrid(config(), rows, multilineFields());

        datasource.getAllData()[0].notes = 'short';
        gridInterface.refresh();

        const marker = cellOf(element, 'notes', 0).querySelector('.simple-html-cell-edited-marker');
        expect(marker?.getAttribute('data-tooltip')).toEqual(
            `Original value: ${lines.slice(0, 15).join('\n')}…\nClick to revert`
        );
    });

    it('expect the row menu paste to keep the line breaks of the clipboard text', async () => {
        const { element, datasource } = await mountGrid(config(), data(), plainFields());
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('pasted 1\npasted 2');
        datasource.selectAll();

        openRowMenu(element, 'notes', 1);
        menuItemsExact('Paste cell (selected rows)')[0].click();
        await sleep(0);

        expect(notes(datasource)).toEqual(['pasted 1\npasted 2', 'pasted 1\npasted 2', 'pasted 1\npasted 2']);
        // a cell of several lines now
        expect(cellInput(element, 'notes', 1).value).toEqual('pasted 1');
        expect(cellInput(element, 'notes', 1).readOnly).toBe(true);
    });
});

describe('multiline - opening the editor', () => {
    it('expect Enter to open the editor with the text, focused, labelled, the caret at the end', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        const input = cellInput(element, 'notes', 0);
        input.focus();

        const event = press(input, 'Enter');

        expect(event.defaultPrevented).toBe(true);
        expect(editor()).not.toBeNull();
        expect(isPopoverShown(editor())).toBe(true);
        expect(editor()?.parentElement).toBe(document.body);
        expect(textarea().value).toEqual('line 1\nline 2');
        expect(textarea().readOnly).toBe(false);
        expect(document.activeElement).toBe(textarea());
        expect(textarea().selectionStart).toEqual('line 1\nline 2'.length);
        expect(textarea().getAttribute('aria-label')).toEqual('Notes');
        expect(hint()).toEqual('Ctrl+Enter to save, Esc to cancel');
        expect(textarea().getAttribute('aria-describedby')).toEqual(
            editor()?.querySelector('.simple-html-grid-text-editor-hint')?.id
        );
    });

    it('expect F2 and a double click to open it, and Enter not to move to the cell below', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());

        const input = cellInput(element, 'notes', 0);
        input.focus();
        press(input, 'F2');
        expect(textarea().value).toEqual('line 1\nline 2');
        press(textarea(), 'Escape');
        expect(editor()).toBeNull();

        cellInput(element, 'notes', 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(textarea().value).toEqual('one line');
        press(textarea(), 'Escape');

        // the Enter of a text cell goes down after 100ms
        openWithEnter(element, 'notes', 0);
        press(textarea(), 'Escape');
        await sleep(150);
        expect(document.activeElement).toBe(cellInput(element, 'notes', 0));
    });

    it('expect a typed character to open it, at the end of the text', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        const input = cellInput(element, 'notes', 0);
        input.focus();

        const event = press(input, 'x');

        // canceled: the character is not typed a second time, into the textarea that has the focus now
        expect(event.defaultPrevented).toBe(true);
        expect(textarea().value).toEqual('line 1\nline 2x');
        expect(textarea().selectionStart).toEqual('line 1\nline 2x'.length);
    });

    it('expect AltGr (Ctrl+Alt) to type a character, and Ctrl, Alt and Cmd shortcuts not to open it', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        const input = cellInput(element, 'notes', 0);
        input.focus();

        press(input, 'c', { ctrlKey: true });
        press(input, 'f', { altKey: true });
        press(input, 'v', { metaKey: true });
        press(input, 'Shift', { shiftKey: true });
        expect(editor()).toBeNull();

        press(input, '@', { ctrlKey: true, altKey: true, code: 'Digit2' });
        expect(textarea().value).toEqual('line 1\nline 2@');
    });

    it('expect Space in a cell with a focus button to be the button, not a character', async () => {
        const { element, gridInterface } = await mountGrid(
            config({ columns: { notes: { focusButton: 'ALWAYS' } } }),
            data(),
            multilineFields()
        );
        const clicks = vi.fn();
        gridInterface.on('cell-focus-button-click', clicks);
        const input = cellInput(element, 'notes', 0);
        input.focus();

        press(input, ' ', { code: 'Space' });

        expect(clicks).toHaveBeenCalledTimes(1);
        expect(editor()).toBeNull();
    });

    it('expect Space to type a space without a focus button', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        const input = cellInput(element, 'notes', 1);
        input.focus();

        press(input, ' ', { code: 'Space' });

        expect(textarea().value).toEqual('one line ');
    });

    it('expect one editor at a time: opening another saves the one open', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('first');

        cellInput(element, 'notes', 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

        expect(document.querySelectorAll('.simple-html-grid-text-editor')).toHaveLength(1);
        expect(textarea().value).toEqual('one line');
        expect(notes(datasource)[0]).toEqual('first');
    });

    it('expect a menu to save and close it', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('changed');

        openRowMenu(element, 'age', 1);

        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('changed');
        expect(document.querySelector('.simple-html-grid-menu')).not.toBeNull();
    });

    it('expect the editor in the dialog the grid is in', async () => {
        const dialog = document.createElement('dialog');
        document.body.appendChild(dialog);
        const { element } = await mountGrid(config(), data(), multilineFields());
        dialog.appendChild(element);
        await sleep(0);

        openWithEnter(element, 'notes', 0);

        expect(editor()?.parentElement).toBe(dialog);
        // closed before the dialog is removed: happy-dom calls disconnectedCallback while it takes the
        // dialog out, removing the editor from the dialog then breaks its walk of the tree (a browser
        // calls it when the removal is done)
        press(textarea(), 'Escape');
        dialog.remove();
    });
});

describe('multiline - closing the editor', () => {
    it('expect Esc to cancel: no write, no undo step, the focus back in the cell', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        const input = openWithEnter(element, 'notes', 0);
        typeInEditor('changed\ntext');

        const event = press(textarea(), 'Escape');

        // canceled: a modal dialog the grid is in does not close on it
        expect(event.defaultPrevented).toBe(true);
        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('line 1\nline 2');
        expect(datasource.canUndo()).toBe(false);
        expect(document.activeElement).toBe(input);
    });

    it('expect Ctrl+Enter to save once: one undo step, the cell shows it, Ctrl+Z in the cell takes it back', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        const input = openWithEnter(element, 'notes', 1);
        const steps = vi.fn();
        datasource.on('history-changed', steps);

        typeInEditor('new first\nnew second');
        const event = press(textarea(), 'Enter', { ctrlKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(editor()).toBeNull();
        expect(notes(datasource)[1]).toEqual('new first\nnew second');
        expect(document.activeElement).toBe(input);
        expect(cellInput(element, 'notes', 1).value).toEqual('new first');
        // the marker and the tooltip, the edited cell, the row state
        expect(cellOf(element, 'notes', 1).querySelector('.simple-html-grid-cell-more')).not.toBeNull();
        expect(cellOf(element, 'notes', 1).getAttribute('data-tooltip')).toEqual('new first\nnew second');
        expect(cellOf(element, 'notes', 1).classList.contains('simple-html-cell-edited')).toBe(true);
        expect(datasource.getAllData()[1].__rowState).toEqual('M');

        // the step is recorded at the end of the run of code
        await sleep(0);
        expect(steps).toHaveBeenCalledTimes(1);

        press(cellInput(element, 'notes', 1), 'z', { ctrlKey: true });
        expect(notes(datasource)[1]).toEqual('one line');
        expect(cellInput(element, 'notes', 1).value).toEqual('one line');
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect Cmd+Enter to save too, and Enter to be a new line', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 1);

        const enter = press(textarea(), 'Enter');
        expect(enter.defaultPrevented).toBe(false);
        expect(editor()).not.toBeNull();

        typeInEditor('one line\nmore');
        press(textarea(), 'Enter', { metaKey: true });
        expect(notes(datasource)[1]).toEqual('one line\nmore');
    });

    it('expect the keys of an input method to be its own while it composes', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 1);

        press(textarea(), 'Escape', { isComposing: true });

        expect(editor()).not.toBeNull();
    });

    it('expect no write when the text did not change: CR LF stays as it is', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 2);

        press(textarea(), 'Enter', { ctrlKey: true });

        expect(notes(datasource)[2]).toEqual('crlf 1\r\ncrlf 2\rcr 3');
        expect(datasource.canUndo()).toBe(false);
        expect(datasource.getAllData()[2].__rowState).toBeUndefined();
    });

    it('expect the saved text to have its line breaks as LF, as a textarea gives them', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 2);

        typeInEditor('crlf 1\r\ncrlf 2\rcr 3 and more');
        press(textarea(), 'Enter', { ctrlKey: true });

        expect(notes(datasource)[2]).toEqual('crlf 1\ncrlf 2\ncr 3 and more');
    });

    it('expect a click outside to save and close it, a click in it not to', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('clicked away');

        textarea().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(editor()).not.toBeNull();

        cellInput(element, 'age', 2).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('clicked away');
    });

    it('expect Tab to save and go on to the next cell, Shift+Tab to the one before', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('tabbed');

        const tab = press(textarea(), 'Tab');

        // the grid moves the focus itself: the browser's Tab is canceled
        expect(tab.defaultPrevented).toBe(true);
        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('tabbed');
        await sleep(150);
        expect(document.activeElement).toBe(cellInput(element, 'age', 0));

        openWithEnter(element, 'notes', 1);
        press(textarea(), 'Tab', { shiftKey: true });
        await sleep(150);
        expect(document.activeElement).toBe(cellInput(element, 'name', 1));
    });

    it('expect scrolling the grid to save and close it: the scrollbars, the wheel', async () => {
        const { element, datasource } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('scrolled');

        // a scroll event does not bubble
        element.querySelector('.simple-html-grid-body-scroller')?.dispatchEvent(new Event('scroll'));
        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('scrolled');

        openWithEnter(element, 'notes', 1);
        typeInEditor('wheeled');
        element.querySelector('.simple-html-grid-body')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        expect(editor()).toBeNull();
        expect(notes(datasource)[1]).toEqual('wheeled');
    });

    it('expect destroy() to save and remove it, and its listeners to be gone', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), multilineFields());
        openWithEnter(element, 'notes', 0);
        typeInEditor('destroyed');

        gridInterface.destroy();

        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('destroyed');
        expect((element as any).grid.textEditor).toBeNull();
        // no listener left on the document that writes
        datasource.getAllData()[0].notes = 'later';
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(notes(datasource)[0]).toEqual('later');
    });
});

describe('multiline - readonly', () => {
    it('expect a readonly grid to open it read-only on Enter, F2 and a double click, typing not', async () => {
        const { element, datasource } = await mountGrid(config({ readonly: true }), data(), multilineFields());
        const input = cellInput(element, 'notes', 0);
        input.focus();

        press(input, 'x');
        expect(editor()).toBeNull();

        press(input, 'Enter');
        expect(textarea().readOnly).toBe(true);
        expect(textarea().value).toEqual('line 1\nline 2');
        expect(hint()).toEqual('Esc to close');

        // nothing is saved from a readonly editor, also when its value was changed from code
        textarea().value = 'changed';
        press(textarea(), 'Enter', { ctrlKey: true });
        expect(editor()).toBeNull();
        expect(notes(datasource)[0]).toEqual('line 1\nline 2');
        expect(document.activeElement).toBe(input);

        press(input, 'F2');
        expect(textarea().readOnly).toBe(true);
        press(textarea(), 'Escape');
        input.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(textarea().readOnly).toBe(true);
    });

    it('expect a readonly cell of an editable grid, and allowPasteClearOnly, to open it read-only', async () => {
        const { element } = await mountGrid(
            config({ columns: { notes: { readonly: true }, name: {} } }),
            data(),
            multilineFields()
        );
        openWithEnter(element, 'notes', 0);
        expect(textarea().readOnly).toBe(true);
        press(textarea(), 'Escape');

        const pasteOnly = await mountGrid(
            config({ columns: { notes: { allowPasteClearOnly: true } } }),
            data(),
            multilineFields()
        );
        const input = cellInput(pasteOnly.element, 'notes', 0);
        input.focus();
        press(input, 'x');
        expect(editor()).toBeNull();
        press(input, 'Enter');
        expect(textarea().readOnly).toBe(true);
    });
});

describe('multiline - where the editor goes', () => {
    /** the sizes: the cell's, the editor's - every other element is the window, see stubElementSizes */
    function stubRects(cellRect: Partial<DOMRect>, editorSize: { width: number; height: number }) {
        const original = HTMLElement.prototype.getBoundingClientRect;
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('simple-html-grid-text-editor')) {
                const left = Number.parseFloat(this.style.left);
                const top = Number.parseFloat(this.style.top);
                return { left, top, right: left + editorSize.width, bottom: top + editorSize.height, ...editorSize } as DOMRect;
            }
            if (this.classList.contains('simple-html-grid-col-cell') && this.querySelector('input[data-attribute="notes"]')) {
                return cellRect as DOMRect;
            }
            return original.call(this);
        });
    }

    it('expect it over the cell, its top left corner on the cell, at least 300px wide', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        stubRects({ left: 100, top: 50, right: 200, bottom: 72, width: 100, height: 22 }, { width: 302, height: 120 });

        openWithEnter(element, 'notes', 0);

        expect(editor()?.style.left).toEqual(`${100 + window.scrollX}px`);
        expect(editor()?.style.top).toEqual(`${50 + window.scrollY}px`);
        expect(textarea().style.width).toEqual('300px');
    });

    it('expect it moved left at the right edge of the window, and up at the bottom', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        // the window is 1000 x 600 (stubElementSizes)
        stubRects({ left: 850, top: 560, right: 950, bottom: 582, width: 100, height: 22 }, { width: 302, height: 120 });

        openWithEnter(element, 'notes', 0);

        expect(editor()?.style.left).toEqual(`${1000 - 302}px`);
        // its bottom on the cell's bottom
        expect(editor()?.style.top).toEqual(`${582 - 120}px`);
    });

    it('expect it as wide as a cell wider than 300px', async () => {
        const { element } = await mountGrid(config(), data(), multilineFields());
        stubRects({ left: 0, top: 0, right: 450, bottom: 22, width: 450, height: 22 }, { width: 452, height: 120 });

        openWithEnter(element, 'notes', 0);

        expect(textarea().style.width).toEqual('450px');
    });
});

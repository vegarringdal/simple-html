// @vitest-environment happy-dom
// reads the guide (TS 6 includes no @types by default)
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { TEXTS, type TextId } from '../../texts';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { KEY_NAMES, KEY_SYMBOLS, SHORTCUT_GROUPS, shortcutKeys } from '../gridFunctions/shortcutList';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, selectorRowOf, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, labelCell, menuEntry, openLabelMenu, openMenus, openRowMenu } from './interactionTestHelpers';
import { guideKeys, shortcutTablesMarkdown } from './shortcutDocs';

/**
 * The keyboard shortcuts help (shortcutHelp.ts, its list shortcutList.ts): the keys that open it - `?`
 * where it types nothing, Ctrl+/ (Cmd+/) anywhere in the grid - and `GridConfig.shortcutHelp`, the
 * header menu's entry and `openShortcutHelp()`; the dialog - its groups, the keys of an editable and a
 * readonly grid, a Mac's keys, the search, closing it; and the list - its texts, the guide's table made
 * from it, each of its keys in the guide's keyboard section. happy-dom has the dialog's showModal() and
 * close(), not the browser's focus around them: the browser check has those.
 */

const ROOT = path.resolve(__dirname, '../../..');

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

const CODES = new Datasource();
CODES.setData([{ code: 1, label: 'One' }]);
registerLookup('shortcut-help-codes', { datasource: CODES, valueField: 'code', labelField: 'label' });

const rows = () => [
    { name: 'Ann', active: true, code: 1 },
    { name: 'Bob', active: false, code: null }
];

const fields = () => ({ fields: { active: 'boolean' as const, code: 'number' as const } });

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        name: { label: 'Name' },
        active: { label: 'Active' },
        code: { label: 'Code', editor: { type: 'select', lookup: 'shortcut-help-codes' } }
    },
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['code'], width: 100 }
        ]
    },
    ...more
});

const mount = (more: Partial<GridConfig> = {}) => mountGrid(config(more), rows(), fields());

/** presses a key on an element, the way a browser sends it: the event, to see whether it was used */
function press(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** `?`: Shift+/ on a US keyboard */
const questionMark = (target: EventTarget, init: KeyboardEventInit = {}) =>
    press(target, '?', { code: 'Slash', shiftKey: true, ...init });

/** the input of a body cell */
const cellInput = (element: GridElement, field: string, row = 0) =>
    element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)[row];

const dialog = () => document.querySelector<HTMLDialogElement>('dialog.shortcut-help');
const search = () => dialog()?.querySelector<HTMLInputElement>('.shortcut-help-search') as HTMLInputElement;
const captions = () => Array.from(dialog()?.querySelectorAll('caption') ?? [], (caption) => caption.textContent?.trim());
/** the rows of the help: its keys and what they do, as text */
const helpRows = () =>
    Array.from(dialog()?.querySelectorAll('tbody tr') ?? [], (row) => ({
        keys: row.querySelector('th')?.textContent?.replace(/\s+/g, ' ').trim(),
        does: row.querySelector('td')?.textContent?.trim()
    }));
const typeSearch = (text: string) => {
    search().value = text;
    search().dispatchEvent(new Event('input', { bubbles: true }));
};
/** a click on the ✕ of the help: it is open, and closed after */
const closeHelp = () => {
    const close = dialog()?.querySelector<HTMLElement>('.filter-editor-close');
    expect(close).toBeTruthy();
    close?.click();
    expect(dialog()).toBeNull();
};

/** the entries of the list, with a condition or without */
const entries = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts);

describe('shortcut help - the keys that open it', () => {
    it('expect ? on a cell of a readonly grid to open it, the key used and the focus in its search', async () => {
        const { element } = await mount({ readonly: true });
        const input = cellInput(element, 'name');
        input.focus();

        const event = questionMark(input);

        expect(event.defaultPrevented).toBe(true);
        expect(dialog()?.open).toBe(true);
        expect(document.activeElement).toBe(search());
    });

    it('expect ? in a cell that can be typed in to be typed: no help', async () => {
        const { element } = await mount();

        const event = questionMark(cellInput(element, 'name'));

        expect(event.defaultPrevented).toBe(false);
        expect(dialog()).toBeNull();
    });

    it('expect ? in a header filter, the find bar and a textarea of a cell to be typed: no help', async () => {
        const { element, gridInterface } = await mount({ readonly: true });
        expect(questionMark(headerFilterInput(element, 'name')).defaultPrevented).toBe(false);

        gridInterface.openFind();
        expect(questionMark(element.querySelector('.simple-html-grid-find-input') as HTMLElement).defaultPrevented).toBe(false);

        // a control a custom cell renders: what types text, in the grid
        const textarea = document.createElement('textarea');
        element.querySelector('.simple-html-grid-body')?.appendChild(textarea);
        expect(questionMark(textarea).defaultPrevented).toBe(false);
        expect(dialog()).toBeNull();
    });

    it('expect ? where it types nothing to open it: a checkbox, a column header, a row number', async () => {
        const { element } = await mount();
        const targets = [
            cellInput(element, 'active'),
            labelCell(element, 'name'),
            selectorRowOf(element, 0)?.firstElementChild as HTMLElement
        ];
        for (const target of targets) {
            expect(questionMark(target).defaultPrevented).toBe(true);
            expect(dialog()?.open).toBe(true);
            closeHelp();
        }
    });

    it('expect Ctrl+/ and Cmd+/ to open it anywhere in the grid: while typing in a cell, in a header filter', async () => {
        const { element } = await mount();

        expect(press(cellInput(element, 'name'), '/', { code: 'Slash', ctrlKey: true }).defaultPrevented).toBe(true);
        expect(dialog()?.open).toBe(true);
        closeHelp();

        press(headerFilterInput(element, 'name'), '/', { code: 'Slash', metaKey: true });
        expect(dialog()?.open).toBe(true);
        closeHelp();

        // with Shift on a US keyboard the key gives ?
        press(cellInput(element, 'name'), '?', { code: 'Slash', ctrlKey: true, shiftKey: true });
        expect(dialog()?.open).toBe(true);
    });

    it('expect ? in a lookup cell that can be edited to open its list with ? as the search, not the help', async () => {
        const { element } = await mount();
        const input = cellInput(element, 'code');
        input.focus();

        questionMark(input);

        expect(dialog()).toBeNull();
        expect((document.querySelector('.simple-html-grid-lookup-search') as HTMLInputElement).value).toEqual('?');
    });

    it('expect no help for Alt and for AltGr (Ctrl+Alt) with the key, nor for a key used already', async () => {
        const { element } = await mount({ readonly: true });
        const input = cellInput(element, 'name');

        questionMark(input, { altKey: true });
        press(input, '/', { code: 'Slash', ctrlKey: true, altKey: true });
        input.addEventListener('keydown', (event) => event.preventDefault());
        questionMark(input);

        expect(dialog()).toBeNull();
    });

    it('expect shortcutHelp: false to turn the keys and the menu entry off - openShortcutHelp() opens it, without its keys', async () => {
        const { element, gridInterface } = await mount({ readonly: true, shortcutHelp: false });

        expect(questionMark(cellInput(element, 'name')).defaultPrevented).toBe(false);
        press(cellInput(element, 'name'), '/', { code: 'Slash', ctrlKey: true });
        expect(dialog()).toBeNull();
        openLabelMenu(element, 'name');
        expect(document.querySelector('[data-menu-id="header.shortcuts"]')).toBeNull();
        gridInterface.closeMenu();

        gridInterface.openShortcutHelp();
        expect(dialog()?.open).toBe(true);
        const texts = helpRows().map((row) => row.does);
        expect(texts).not.toContain(TEXTS['shortcuts.dialogs.help']);
        expect(texts).not.toContain(TEXTS['shortcuts.dialogs.helpAnywhere']);
    });

    it('expect updateConfig({ shortcutHelp }) to turn the keys on and off', async () => {
        const { element, gridInterface } = await mount({ readonly: true });
        gridInterface.updateConfig({ shortcutHelp: false });
        questionMark(cellInput(element, 'name'));
        expect(dialog()).toBeNull();

        gridInterface.updateConfig({ shortcutHelp: true });
        questionMark(cellInput(element, 'name'));
        expect(dialog()?.open).toBe(true);
    });
});

describe('shortcut help - the dialog', () => {
    it('expect a modal dialog named by its title: a table per group, its caption the title, a row per entry', async () => {
        const { gridInterface } = await mount();

        gridInterface.openShortcutHelp();

        const help = dialog() as HTMLDialogElement;
        expect(help.open).toBe(true);
        expect(document.getElementById(help.getAttribute('aria-labelledby') as string)?.textContent).toEqual(
            'Keyboard shortcuts'
        );
        expect(captions()).toEqual(SHORTCUT_GROUPS.map((group) => TEXTS[group.title]));
        // an editable grid, not a Mac: every entry but the ones of a Mac
        expect(helpRows()).toHaveLength(entries.length);
        expect(helpRows()[0]).toEqual({ keys: 'Tab / Shift+Tab', does: 'The next / previous cell' });
        // each key a <kbd> in the <kbd> of its combination
        const keys = help.querySelector('tbody th .shortcut-help-keys:nth-of-type(2)') as HTMLElement;
        expect(Array.from(keys.querySelectorAll('kbd'), (kbd) => kbd.textContent)).toEqual(['Shift', 'Tab']);
        expect(helpRows().find((row) => row.does === TEXTS['shortcuts.select.cell'])?.keys).toEqual('Alt+Shift+↑↓←→');
        // the hint describes the search
        expect(document.getElementById(search().getAttribute('aria-describedby') as string)?.textContent).toEqual(
            TEXTS['shortcuts.hint']
        );
    });

    it('expect a readonly grid to leave out the keys of an editable grid', async () => {
        const { gridInterface } = await mount({ readonly: true });

        gridInterface.openShortcutHelp();

        expect(helpRows()).toHaveLength(entries.filter((entry) => entry.when !== 'editable').length);
        // every key of the group is one of an editable grid: the group is left out
        expect(captions()).not.toContain(TEXTS['shortcuts.group.edit']);
        expect(helpRows().map((row) => row.does)).not.toContain(TEXTS['shortcuts.clipboard.paste']);
    });

    it('expect F4 of a header filter left out with filterOperatorIndicator: false', async () => {
        const { gridInterface } = await mount({ filterOperatorIndicator: false });
        gridInterface.openShortcutHelp();
        expect(helpRows().map((row) => row.does)).not.toContain(TEXTS['shortcuts.header.operator']);
    });

    it('expect the focus on the dialog itself when it is not opened by a key: no keyboard of a phone', async () => {
        const { gridInterface } = await mount();
        // a press of a pointer was the last input
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        gridInterface.openShortcutHelp();

        expect(document.activeElement).toBe(dialog());
    });

    it('expect the search to keep the entries that have the text - in what they do, their keys, their group - else to say none does', async () => {
        const { gridInterface } = await mount();
        gridInterface.openShortcutHelp();

        typeSearch('UNDO');
        expect(helpRows().map((row) => row.does)).toEqual([TEXTS['shortcuts.edit.undo'], TEXTS['shortcuts.dialogs.undo']]);

        typeSearch('f3');
        expect(helpRows().map((row) => row.keys)).toEqual(['Enter / F3', 'Shift+Enter / Shift+F3']);

        // a group's title: all of its keys
        typeSearch('menus');
        expect(captions()).toEqual([TEXTS['shortcuts.group.menus']]);
        expect(dialog()?.querySelector('[role="status"]')?.textContent).toEqual('');

        typeSearch('zzz');
        expect(helpRows()).toEqual([]);
        expect(dialog()?.querySelector('[role="status"]')?.textContent).toEqual(TEXTS['shortcuts.none']);

        typeSearch(' ');
        expect(helpRows()).toHaveLength(entries.length);
    });

    it('expect a Mac to show ⌘ ⌥ ⇧ in the order of its menus and without the +, and no Alt+C', async () => {
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        const { gridInterface } = await mount();

        gridInterface.openShortcutHelp();

        const keysOf = (text: TextId) => helpRows().find((row) => row.does === TEXTS[text])?.keys;
        expect(keysOf('shortcuts.edit.redo')).toEqual('⌘Y / ⇧⌘Z');
        expect(keysOf('shortcuts.select.row')).toEqual('⌥⇧Home / ⌥⇧End');
        expect(keysOf('shortcuts.find.matchCase')).toBeUndefined();
        expect(helpRows()).toHaveLength(entries.length - 1);
        expect(dialog()?.querySelector('.shortcut-help-hint')?.textContent).toEqual(TEXTS['shortcuts.hint.mac']);
        // a Mac user can search for what the keys are called elsewhere too
        typeSearch('ctrl+d');
        expect(helpRows().map((row) => row.keys)).toEqual(['⌘D']);
    });

    it('expect the texts of the grid: the names of the keys translated', async () => {
        const { gridInterface } = await mount({
            texts: { 'shortcuts.key.ctrl': 'Strg', 'shortcuts.move.grid': 'Erste / letzte Zelle' }
        });

        gridInterface.openShortcutHelp();

        expect(helpRows()).toContainEqual({ keys: 'Strg+Home / Strg+End', does: 'Erste / letzte Zelle' });
    });

    it('expect its ✕ and Esc (the browser closes the dialog) to close it, taken off the page', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.openShortcutHelp();

        closeHelp();
        expect(dialog()).toBeNull();

        gridInterface.openShortcutHelp();
        (dialog() as HTMLDialogElement).close();
        expect(dialog()).toBeNull();

        // and opened again by its key after that
        press(cellInput(element, 'name'), '/', { ctrlKey: true });
        expect(dialog()?.open).toBe(true);
    });

    it('expect one help: opened again it is the same dialog', async () => {
        const { gridInterface } = await mount();
        gridInterface.openShortcutHelp();
        typeSearch('undo');

        gridInterface.openShortcutHelp();

        expect(document.querySelectorAll('dialog.shortcut-help')).toHaveLength(1);
        expect(search().value).toEqual('undo');
        expect(document.activeElement).toBe(dialog());
    });

    it('expect it to close an open menu, and to close when the grid leaves the page', async () => {
        const { element, gridInterface } = await mount();
        openRowMenu(element, 'name');
        expect(openMenus()).not.toHaveLength(0);

        gridInterface.openShortcutHelp();
        expect(openMenus()).toHaveLength(0);

        element.remove();
        expect(dialog()).toBeNull();
    });

    it('expect nothing before the grid is on the page', () => {
        const datasource = new Datasource(fields());
        const gridInterface = new GridInterface(config(), datasource);

        gridInterface.openShortcutHelp();

        expect(dialog()).toBeNull();
    });
});

describe('shortcut help - the header menu', () => {
    it('expect Keyboard shortcuts… after Column settings…, its hint the key, to open it', async () => {
        const { element } = await mount();
        openLabelMenu(element, 'name');

        expect(menuEntry('header.shortcuts').textContent?.replace(/\s+/g, ' ').trim()).toEqual('Keyboard shortcuts… (Ctrl+/)');
        menuEntry('header.shortcuts').click();

        expect(dialog()?.open).toBe(true);
        expect(openMenus()).toHaveLength(0);
    });

    it('expect its hint on a Mac: ⌘/', async () => {
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        const { element } = await mount();
        openLabelMenu(element, 'name');
        expect(menuEntry('header.shortcuts').textContent).toContain('(⌘/)');
    });
});

describe('shortcut help - the list', () => {
    it('expect each entry to have a text of its own, and every shortcuts.* text to be used', () => {
        const texts = entries.map((entry) => entry.text);
        expect(new Set(texts).size).toEqual(texts.length);

        const dialogTexts = ['title', 'title.tooltip', 'close', 'search', 'none', 'hint', 'hint.mac'].map(
            (id) => `shortcuts.${id}`
        );
        const keyNames = Object.values(KEY_NAMES).flatMap((id) => [id, `${id}.mac`]);
        const used = new Set<string>([...texts, ...SHORTCUT_GROUPS.map((group) => group.title), ...dialogTexts, ...keyNames]);
        const shortcutTexts = Object.keys(TEXTS).filter((id) => id.startsWith('shortcuts.'));
        expect(shortcutTexts.filter((id) => !used.has(id))).toEqual([]);
    });

    it('expect every key to be one the help can show: a named key, an arrow, a function key or a character', () => {
        const unknown = entries
            .flatMap((entry) => entry.keys)
            .flatMap((combination) => combination.split('+'))
            .filter((key) => !KEY_NAMES[key] && !KEY_SYMBOLS[key] && !/^F\d{1,2}$/.test(key) && Array.from(key).length !== 1);
        expect(unknown).toEqual([]);
    });

    it("expect a Mac's order of the modifiers: ⌥ ⇧ ⌘, the key last", () => {
        expect(shortcutKeys('Ctrl+Shift+Z', true)).toEqual(['Shift', 'Ctrl', 'Z']);
        expect(shortcutKeys('Ctrl+Shift+Z', false)).toEqual(['Ctrl', 'Shift', 'Z']);
        expect(shortcutKeys('Alt+Shift+Arrows', true)).toEqual(['Alt', 'Shift', 'Arrows']);
        expect(shortcutKeys('Ctrl+/', true)).toEqual(['Ctrl', '/']);
    });

    const guide = fs.readFileSync(path.join(ROOT, 'guides/14-accessibility.md'), 'utf8');

    it('expect the accessibility guide to have the list as it is: "Every key of the help"', () => {
        const start = guide.indexOf('\n### Every key of the help\n');
        expect(start).not.toBe(-1);
        const end = guide.indexOf('\n## ', start);
        const section = guide.slice(guide.indexOf('\n#### ', start) + 1, end).trim();
        // if this fails after a change of the list: shortcutDocs.ts says how to make the tables again
        expect(section).toEqual(shortcutTablesMarkdown());
    });

    it('expect every key of the list in the keyboard section of the guide, where it is described in full', () => {
        const start = guide.indexOf('\n## The keyboard\n');
        const keyboard = guide.slice(start, guide.indexOf('\n## ', start + 1));
        const missing = entries.flatMap((entry) => entry.keys.map(guideKeys)).filter((keys) => !keyboard.includes(keys));
        expect(missing).toEqual([]);
    });
});

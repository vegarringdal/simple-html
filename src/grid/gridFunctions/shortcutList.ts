import type { TextId } from '../../texts';
import type { ParsedGridConfig } from '../gridConfig';
import type { KeyTextId } from './keyText';

/**
 * The list of the keyboard shortcuts help (shortcutHelp.ts): the keys of the grid in groups, each with
 * the text that says what it does. One list for the dialog and the docs - the help's table in
 * guides/14-accessibility.md is made from it, and a test checks the guide has it as it is here, and that
 * every key here is in that guide's keyboard section, where each key is described in full (and its
 * tests check what it does).
 *
 * A key is written as the guide writes it, the modifiers first and `+` between: `Ctrl+Shift+Home`,
 * `Alt+ArrowDown`, `Shift+F10`. Ctrl is Ctrl or Cmd: the grid takes both, a Mac shows ⌘ (shortcutKeys).
 * `Arrows` is the four arrow keys, `Menu` the menu key. The keys of an entry are the ones that do what
 * its text says: `['Tab', 'Shift+Tab']` with "The next / previous cell".
 */

/**
 * When an entry is shown, left out it is shown in every grid:
 * - `editable`: in an editable grid (`readonly: false`), the key changes values or opens an editor
 * - `operatorIndicator`: with the operator indicators of the header filters (`filterOperatorIndicator`)
 * - `shortcutHelp`: with the help's keys (`shortcutHelp`, the help can be opened from code without them)
 * - `notMac`: not on a Mac - Alt+C: Option+C types `ç` there
 */
export type ShortcutCondition = 'editable' | 'operatorIndicator' | 'shortcutHelp' | 'notMac';

/** a line of the help: keys and what they do */
export interface Shortcut {
    /** the keys, each a key or a combination of keys */
    keys: readonly string[];
    /** what they do */
    text: TextId;
    /** shown only where the keys do something, see ShortcutCondition */
    when?: ShortcutCondition;
}

/** a group of the help: its title and its keys */
export interface ShortcutGroup {
    title: TextId;
    shortcuts: readonly Shortcut[];
}

/**
 * Every key of the help, in the order shown. Each is in guides/14-accessibility.md, "The keyboard"
 */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
    {
        title: 'shortcuts.group.move',
        shortcuts: [
            { keys: ['Tab', 'Shift+Tab'], text: 'shortcuts.move.tab' },
            { keys: ['Alt+ArrowLeft', 'Alt+ArrowRight'], text: 'shortcuts.move.sideways' },
            { keys: ['Alt+ArrowUp', 'Alt+ArrowDown'], text: 'shortcuts.move.upDown' },
            { keys: ['Enter'], text: 'shortcuts.move.enter', when: 'editable' },
            { keys: ['Alt+Home', 'Alt+End'], text: 'shortcuts.move.row' },
            { keys: ['Ctrl+Home', 'Ctrl+End'], text: 'shortcuts.move.grid' },
            { keys: ['PageUp', 'PageDown'], text: 'shortcuts.move.page' },
            { keys: ['Alt+PageUp', 'Alt+PageDown'], text: 'shortcuts.move.columns' },
            { keys: ['Ctrl+ArrowUp', 'Ctrl+ArrowDown'], text: 'shortcuts.move.edge' }
        ]
    },
    {
        title: 'shortcuts.group.select',
        shortcuts: [
            { keys: ['Alt+Shift+Arrows'], text: 'shortcuts.select.cell' },
            { keys: ['Shift+PageUp', 'Shift+PageDown'], text: 'shortcuts.select.page' },
            { keys: ['Alt+Shift+Home', 'Alt+Shift+End'], text: 'shortcuts.select.row' },
            { keys: ['Ctrl+Shift+Home', 'Ctrl+Shift+End'], text: 'shortcuts.select.grid' },
            { keys: ['Ctrl+Shift+ArrowUp', 'Ctrl+Shift+ArrowDown'], text: 'shortcuts.select.edge' },
            { keys: ['Esc'], text: 'shortcuts.select.clear' }
        ]
    },
    {
        title: 'shortcuts.group.cell',
        shortcuts: [
            { keys: ['Enter', 'F2'], text: 'shortcuts.cell.editor' },
            { keys: ['Ctrl+Enter'], text: 'shortcuts.cell.save', when: 'editable' },
            { keys: ['Esc'], text: 'shortcuts.cell.cancel' },
            { keys: ['Alt+ArrowDown', 'F4'], text: 'shortcuts.cell.list', when: 'editable' },
            { keys: ['Space'], text: 'shortcuts.cell.check', when: 'editable' },
            { keys: ['Alt+Enter'], text: 'shortcuts.cell.link' }
        ]
    },
    {
        title: 'shortcuts.group.edit',
        shortcuts: [
            { keys: ['Ctrl+Z'], text: 'shortcuts.edit.undo', when: 'editable' },
            { keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], text: 'shortcuts.edit.redo', when: 'editable' },
            { keys: ['Ctrl+D'], text: 'shortcuts.edit.fillDown', when: 'editable' },
            { keys: ['Delete', 'Backspace'], text: 'shortcuts.edit.clear', when: 'editable' },
            { keys: ['Delete', 'Backspace'], text: 'shortcuts.edit.deleteRows', when: 'editable' }
        ]
    },
    {
        title: 'shortcuts.group.clipboard',
        shortcuts: [
            { keys: ['Ctrl+C'], text: 'shortcuts.clipboard.copy' },
            { keys: ['Ctrl+V'], text: 'shortcuts.clipboard.paste', when: 'editable' },
            { keys: ['Ctrl+C'], text: 'shortcuts.clipboard.columns' }
        ]
    },
    {
        title: 'shortcuts.group.find',
        shortcuts: [
            { keys: ['Ctrl+F'], text: 'shortcuts.find.open' },
            { keys: ['Enter', 'F3'], text: 'shortcuts.find.next' },
            { keys: ['Shift+Enter', 'Shift+F3'], text: 'shortcuts.find.previous' },
            { keys: ['Alt+C'], text: 'shortcuts.find.matchCase', when: 'notMac' },
            { keys: ['Esc'], text: 'shortcuts.find.close' }
        ]
    },
    {
        title: 'shortcuts.group.header',
        shortcuts: [
            { keys: ['Enter'], text: 'shortcuts.header.filter' },
            { keys: ['F4'], text: 'shortcuts.header.operator', when: 'operatorIndicator' },
            { keys: ['Alt+ArrowUp'], text: 'shortcuts.header.label' },
            { keys: ['Enter', 'Space'], text: 'shortcuts.header.sort' },
            { keys: ['Shift+Enter', 'Shift+Space'], text: 'shortcuts.header.addSort' },
            { keys: ['Enter', 'Space'], text: 'shortcuts.header.group' }
        ]
    },
    {
        title: 'shortcuts.group.menus',
        shortcuts: [
            { keys: ['Shift+F10', 'Menu'], text: 'shortcuts.menus.open' },
            { keys: ['ArrowDown', 'ArrowUp'], text: 'shortcuts.menus.move' },
            { keys: ['Enter', 'Space'], text: 'shortcuts.menus.use' },
            { keys: ['ArrowRight', 'ArrowLeft'], text: 'shortcuts.menus.submenu' },
            { keys: ['Esc'], text: 'shortcuts.menus.close' }
        ]
    },
    {
        title: 'shortcuts.group.dialogs',
        shortcuts: [
            { keys: ['?'], text: 'shortcuts.dialogs.help', when: 'shortcutHelp' },
            { keys: ['Ctrl+/'], text: 'shortcuts.dialogs.helpAnywhere', when: 'shortcutHelp' },
            { keys: ['Esc'], text: 'shortcuts.dialogs.close' },
            { keys: ['Ctrl+Z', 'Ctrl+Y'], text: 'shortcuts.dialogs.undo' },
            { keys: ['ArrowLeft', 'ArrowRight'], text: 'shortcuts.dialogs.tabs' },
            { keys: ['Alt+ArrowUp', 'Alt+ArrowDown'], text: 'shortcuts.dialogs.moveField' },
            { keys: ['Space'], text: 'shortcuts.dialogs.toggleField' }
        ]
    }
];

/**
 * true when the help shows the entry in this grid, see ShortcutCondition
 * @param mac true on a Mac (isMacPlatform)
 */
export function showsShortcut(shortcut: Shortcut, config: ParsedGridConfig, mac: boolean): boolean {
    switch (shortcut.when) {
        case 'editable':
            return !config.readonly;
        case 'operatorIndicator':
            return config.filterOperatorIndicator;
        case 'shortcutHelp':
            return config.shortcutHelp;
        case 'notMac':
            return !mac;
        default:
            return true;
    }
}

/**
 * The keys with a name of their own: a text each, so a translation can name them as its keyboards do
 * (Strg, Entf). The modifiers have a text for a Mac (`<id>.mac`, keyText): ⌘ ⌥ ⇧
 */
export const KEY_NAMES: Readonly<Record<string, TextId>> = {
    Ctrl: 'shortcuts.key.ctrl',
    Alt: 'shortcuts.key.alt',
    Shift: 'shortcuts.key.shift',
    Enter: 'shortcuts.key.enter',
    Esc: 'shortcuts.key.esc',
    Tab: 'shortcuts.key.tab',
    Space: 'shortcuts.key.space',
    Home: 'shortcuts.key.home',
    End: 'shortcuts.key.end',
    PageUp: 'shortcuts.key.pageUp',
    PageDown: 'shortcuts.key.pageDown',
    Delete: 'shortcuts.key.delete',
    Backspace: 'shortcuts.key.backspace',
    Menu: 'shortcuts.key.menu'
};

/** the modifiers that have a text for a Mac, see KEY_NAMES */
export const MAC_KEY_NAMES: ReadonlySet<string> = new Set<KeyTextId>([
    'shortcuts.key.ctrl',
    'shortcuts.key.alt',
    'shortcuts.key.shift'
]);

/** the arrows are symbols, the same in every language. `Arrows` is all four */
export const KEY_SYMBOLS: Readonly<Record<string, string>> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Arrows: '↑↓←→'
};

/** the modifiers in the order a Mac's menus show them: ⌥ ⇧ ⌘ (`⇧⌘Z`) */
const MAC_ORDER = ['Alt', 'Shift', 'Ctrl'];

/**
 * The keys of a combination, in the order the help shows them: `'Ctrl+Shift+Z'` is
 * `['Ctrl', 'Shift', 'Z']`, on a Mac `['Shift', 'Ctrl', 'Z']` - ⇧⌘Z, as its menus write it. `'Ctrl+/'` is
 * `['Ctrl', '/']`
 * @param mac true on a Mac (isMacPlatform)
 */
export function shortcutKeys(combination: string, mac: boolean): string[] {
    const keys = combination.split('+');
    if (!mac) {
        return keys;
    }
    const rank = (key: string) => (MAC_ORDER.includes(key) ? MAC_ORDER.indexOf(key) : MAC_ORDER.length);
    // a stable sort: the key itself stays last
    return [...keys].sort((a, b) => rank(a) - rank(b));
}

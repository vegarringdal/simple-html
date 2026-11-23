import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import { gridText } from './gridText';

/**
 * The texts that name a key, and their text for a Mac: there the keys are ⌘ (Cmd) and ⇧ (Shift), as
 * the menus of a Mac show them - `⌘Z`, `⇧⌘Z`. The grid takes Ctrl and Cmd alike (Ctrl+Z, Cmd+Z), the
 * texts say what a Mac user presses. A text of its own each, `<id>.mac`: translated like the others
 */
const MAC_TEXTS = {
    'row.edit.undo.hint': 'row.edit.undo.hint.mac',
    'row.edit.redo.hint': 'row.edit.redo.hint.mac',
    'find.previous.tooltip': 'find.previous.tooltip.mac',
    'find.matchCase.tooltip': 'find.matchCase.tooltip.mac',
    'cell.multiline.hint': 'cell.multiline.hint.mac',
    'filterEditor.undo.tooltip': 'filterEditor.undo.tooltip.mac',
    'filterEditor.redo.tooltip': 'filterEditor.redo.tooltip.mac',
    'columnSettings.detailForm.fields.hint': 'columnSettings.detailForm.fields.hint.mac',
    // the keyboard shortcuts help (shortcutHelp.ts): its menu entry, its hint and the names of the modifiers
    'header.shortcuts.hint': 'header.shortcuts.hint.mac',
    'shortcuts.hint': 'shortcuts.hint.mac',
    'shortcuts.key.ctrl': 'shortcuts.key.ctrl.mac',
    'shortcuts.key.alt': 'shortcuts.key.alt.mac',
    'shortcuts.key.shift': 'shortcuts.key.shift.mac'
} as const satisfies Partial<Record<TextId, TextId>>;

/** a text that names a key, see MAC_TEXTS */
export type KeyTextId = keyof typeof MAC_TEXTS;

/**
 * true on a Mac - and an iPad or iPhone, with a keyboard their keys are a Mac's. From the platform the
 * browser says it runs on: `navigator.userAgentData.platform` (`'macOS'`) where there is one (Chrome,
 * Edge), else `navigator.platform` (`'MacIntel'` on every Mac, also one with Apple silicon; `'iPhone'`,
 * `'iPad'`). `navigator.platform` is deprecated but kept by every browser, the user agent string is
 * not needed. Read each time a text is made: the tests change it
 */
export function isMacPlatform(): boolean {
    const nav = globalThis.navigator as (Navigator & { userAgentData?: { platform?: string } }) | undefined;
    const platform = nav?.userAgentData?.platform || nav?.platform || '';
    return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * A text that names a key (gridText): its Mac text on a Mac, see MAC_TEXTS
 */
export function keyText(ctx: Grid, id: KeyTextId): string {
    return gridText(ctx, isMacPlatform() ? MAC_TEXTS[id] : id);
}

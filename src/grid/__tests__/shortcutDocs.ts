import { TEXTS } from '../../texts';
import { SHORTCUT_GROUPS, type ShortcutCondition } from '../gridFunctions/shortcutList';

/**
 * The help's list in the docs: guides/14-accessibility.md has it under "### Every key of the help", made
 * by this - shortcutHelp.test.ts checks the guide has it as it is made here. After a change of the list
 * (shortcutList.ts) or of its English texts, print it and paste it into the guide:
 *
 *     npx tsx -e "import('./src/grid/__tests__/shortcutDocs.ts').then((m) => console.log(m.shortcutTablesMarkdown()))"
 */

/** where an entry is shown, as the guide says it (ShortcutCondition) */
const CONDITIONS: Record<ShortcutCondition, string> = {
    editable: 'an editable grid',
    operatorIndicator: 'with `filterOperatorIndicator`',
    shortcutHelp: 'with `shortcutHelp`',
    notMac: 'not on a Mac'
};

/**
 * A key as the guide's keyboard section writes it: `Menu` is "the menu key", `Arrows` "arrows"
 * (`Alt+Shift+arrows`)
 */
export function guideKeys(combination: string): string {
    return combination === 'Menu' ? 'the menu key' : combination.replace('Arrows', 'arrows');
}

/**
 * The tables of the help, a heading and a table for each group: the keys (` / ` between them), what
 * they do (the English text) and where they are shown
 */
export function shortcutTablesMarkdown(): string {
    return SHORTCUT_GROUPS.map((group) => {
        const rows = group.shortcuts.map((shortcut) => {
            const cells = [
                shortcut.keys.map(guideKeys).join(' / '),
                TEXTS[shortcut.text],
                shortcut.when ? CONDITIONS[shortcut.when] : ''
            ];
            // an empty cell is one space: `| |`
            return `|${cells.map((cell) => (cell ? ` ${cell} ` : ' ')).join('|')}|`;
        });
        return [`#### ${TEXTS[group.title]}`, '', '| keys | does | shown |', '| --- | --- | --- |', ...rows].join('\n');
    }).join('\n\n');
}

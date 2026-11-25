import { html, type TemplateResult } from 'lit-html';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuEntry } from '../gridMenus';
import { gridText } from './gridText';

/**
 * The ƒ button beside a formula (a calculated column's, a colour rule's): a menu of the functions of the
 * language (formula.ts FUNCTIONS) in four submenus - Logic, Numbers, Dates, Text. Each entry is the
 * function as it is written, `LEFT(text, n)` (`formula.function.<NAME>`), its tooltip what it does
 * (`formula.function.<NAME>.tooltip`, also its description for a screen reader). Picked, `LEFT()` is put
 * in at the caret, the caret between the brackets - or around the text selected: `{name}` selected is
 * `LEFT({name})`. TODAY takes nothing: `TODAY()`, the caret after it.
 */

/** the functions by submenu: every function of formula.ts once (a test checks) */
export const FUNCTION_GROUPS: Readonly<Record<'logic' | 'numbers' | 'dates' | 'text', readonly string[]>> = {
    logic: ['IF', 'COALESCE', 'ISBLANK'],
    numbers: ['ROUND', 'ABS', 'MIN', 'MAX'],
    dates: ['TODAY', 'DAYS', 'YEAR', 'MONTH'],
    text: ['CONCAT', 'LEFT', 'RIGHT', 'MID', 'SUBSTRING', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'CONTAINS']
};

/** the functions that take no value: put in whole, the caret after them */
const NO_ARGUMENTS: ReadonlySet<string> = new Set(['TODAY']);

/**
 * The text of an input with a function put in at its selection: the new text and where the caret goes
 * @param value the input's text
 * @param start the start of its selection (its caret)
 * @param end the end of its selection
 */
export function withFunction(value: string, start: number, end: number, name: string): { text: string; caret: number } {
    const selected = value.slice(start, end);
    if (NO_ARGUMENTS.has(name)) {
        const call = `${name}()`;
        return { text: `${value.slice(0, start)}${call}${value.slice(end)}`, caret: start + call.length };
    }
    const call = `${name}(${selected})`;
    // nothing selected: between the brackets; a selection wrapped: after the call
    const caret = selected ? start + call.length : start + name.length + 1;
    return { text: `${value.slice(0, start)}${call}${value.slice(end)}`, caret };
}

/**
 * The ƒ button of a formula's input
 * @param inputId the id of the input, in `dialog`
 * @param write puts the new formula in the dialog's draft (and renders it)
 */
export function functionButton(
    ctx: Grid,
    dialog: HTMLElement,
    inputId: string,
    write: (formula: string) => void
): TemplateResult {
    const text = (id: TextId) => gridText(ctx, id);
    return html`<button
        type="button"
        class="filter-editor-icon column-settings-insert-function"
        aria-label=${text('columnSettings.insertFunction')}
        aria-haspopup="menu"
        data-tooltip=${text('columnSettings.insertFunction')}
        @click=${(event: MouseEvent) => {
            const input = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${inputId}`);
            if (!input) {
                return;
            }
            const entries: MenuEntry[] = Object.entries(FUNCTION_GROUPS).map(([group, names]) => ({
                type: 'submenu',
                id: `formula.functions.${group}`,
                label: text(`formula.functions.${group}` as TextId),
                entries: names.map((name) => ({
                    id: `formula.function.${name}`,
                    label: text(`formula.function.${name}` as TextId),
                    tooltip: text(`formula.function.${name}.tooltip` as TextId),
                    action: () => {
                        // a blurred input keeps where its caret was
                        const start = input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? start;
                        const next = withFunction(input.value, start, end, name);
                        write(next.text);
                        input.focus();
                        input.setSelectionRange(next.caret, next.caret);
                    }
                }))
            }));
            ctx.gridInterface.openMenu(event.currentTarget as HTMLElement, entries);
        }}
    >
        ƒ
    </button>`;
}

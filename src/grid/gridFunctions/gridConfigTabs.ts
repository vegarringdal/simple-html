import { html, type TemplateResult } from 'lit-html';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import { gridText } from './gridText';

/**
 * The tabs of the grid config dialog (columnSettings.ts), under its title bar: *Columns* - the settings
 * of each column - and *Detail form* (detailFormSettings.ts). The WAI-ARIA tabs pattern, with
 * automatic activation:
 *
 * - a `tablist` named by the dialog's title, a `tab` button each, `aria-selected` on the one shown and
 *   `aria-controls` its `tabpanel` - the panel of the tab shown is there, the other one hidden
 * - one stop of Tab: the tab shown (`tabindex="0"`, the other `-1`), Tab goes on into its panel
 * - ArrowLeft / ArrowRight show the tab before / after (round), Home / End the first / last, the focus
 *   on it; a click shows one
 */

/** a tab of the dialog */
export type GridConfigTab = 'columns' | 'detailForm';

/** the tabs in their order, with their texts */
const TABS: readonly { tab: GridConfigTab; text: TextId }[] = [
    { tab: 'columns', text: 'columnSettings.tab.columns' },
    { tab: 'detailForm', text: 'columnSettings.tab.detailForm' }
];

/** the id of a tab's button, unique in the page: a page can have several grids */
export function tabId(ctx: Grid, tab: GridConfigTab) {
    return `${ctx.ariaIdPrefix}-settings-tab-${tab}`;
}

/** the id of a tab's panel */
export function tabPanelId(ctx: Grid, tab: GridConfigTab) {
    return `${ctx.ariaIdPrefix}-settings-tabpanel-${tab}`;
}

/**
 * The tab list
 * @param current the tab shown
 * @param show shows another tab: the dialog renders it, synchronously
 * @param labelId the id of the dialog's title, the list's name
 */
export function configTabs(
    ctx: Grid,
    current: GridConfigTab,
    show: (tab: GridConfigTab) => void,
    labelId: string
): TemplateResult {
    const keydown = (event: KeyboardEvent) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const index = TABS.findIndex((each) => each.tab === current);
        const last = TABS.length - 1;
        const next: Record<string, number> = {
            ArrowRight: index === last ? 0 : index + 1,
            ArrowLeft: index === 0 ? last : index - 1,
            Home: 0,
            End: last
        };
        if (!Object.hasOwn(next, event.key)) {
            return;
        }
        event.preventDefault();
        const tab = TABS[next[event.key]].tab;
        show(tab);
        // rendered: the focus on its button
        (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#${tabId(ctx, tab)}`)?.focus();
    };
    return html`<div class="column-settings-tabs" role="tablist" aria-labelledby=${labelId} @keydown=${keydown}>
        ${TABS.map(
            ({ tab, text }) =>
                html`<button
                    type="button"
                    role="tab"
                    class="column-settings-tab"
                    id=${tabId(ctx, tab)}
                    aria-selected=${tab === current ? 'true' : 'false'}
                    aria-controls=${tabPanelId(ctx, tab)}
                    tabindex=${tab === current ? '0' : '-1'}
                    @click=${() => show(tab)}
                >
                    ${gridText(ctx, text)}
                </button>`
        )}
    </div>`;
}

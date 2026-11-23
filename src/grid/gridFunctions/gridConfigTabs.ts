import { html, nothing, type TemplateResult } from 'lit-html';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import { gridText } from './gridText';

/**
 * The tabs of the grid config dialog (columnSettings.ts), under its title bar: *Columns* - the settings
 * of each column - and *Detail form* (detailFormSettings.ts). And the tabs of a column's settings on the
 * Columns tab: *General*, *Display*, *Header filter*, *Colours* (see ColumnSection in columnSettings.ts).
 * The WAI-ARIA tabs pattern, with automatic activation:
 *
 * - a `tablist` with a name, a `tab` button each, `aria-selected` on the one shown and `aria-controls`
 *   its `tabpanel` - the panel of the tab shown is there, the others hidden
 * - one stop of Tab: the tab shown (`tabindex="0"`, the others `-1`), Tab goes on into its panel
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
 * The tab list of the dialog: Columns, Detail form
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
    return tabList(ctx, {
        tabs: TABS,
        current,
        show,
        labelledBy: labelId,
        tabId: (tab) => tabId(ctx, tab),
        panelId: (tab) => tabPanelId(ctx, tab)
    });
}

/** a tab of a tab list, see {@link tabList} */
export interface TabOf<T extends string> {
    tab: T;
    text: TextId;
    /** a mark after its text: a setting in its panel has a problem. Said as the text of `problemText` */
    problem?: boolean;
}

/**
 * A tab list, see the top of this file
 * @param options.tabs the tabs in their order
 * @param options.current the tab shown
 * @param options.show shows another tab: the dialog renders it, synchronously
 * @param options.labelledBy the id of the list's name; `label` its name instead
 * @param options.tabId the id of a tab's button, unique in the page
 * @param options.panelId the id of a tab's panel
 * @param options.className more classes of the list
 */
export function tabList<T extends string>(
    ctx: Grid,
    options: {
        tabs: readonly TabOf<T>[];
        current: T;
        show: (tab: T) => void;
        labelledBy?: string;
        label?: string;
        tabId: (tab: T) => string;
        panelId: (tab: T) => string;
        className?: string;
    }
): TemplateResult {
    const { tabs, current, show } = options;
    const keydown = (event: KeyboardEvent) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const index = tabs.findIndex((each) => each.tab === current);
        const last = tabs.length - 1;
        const next: Record<string, number> = {
            ArrowRight: index === last ? 0 : index + 1,
            ArrowLeft: index <= 0 ? last : index - 1,
            Home: 0,
            End: last
        };
        if (!Object.hasOwn(next, event.key)) {
            return;
        }
        event.preventDefault();
        const tab = tabs[next[event.key]].tab;
        show(tab);
        // rendered: the focus on its button
        (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#${options.tabId(tab)}`)?.focus();
    };
    return html`<div
        class=${`column-settings-tabs${options.className ? ` ${options.className}` : ''}`}
        role="tablist"
        aria-labelledby=${options.labelledBy ?? nothing}
        aria-label=${options.label ?? nothing}
        @keydown=${keydown}
    >
        ${tabs.map(
            ({ tab, text, problem }) =>
                html`<button
                    type="button"
                    role="tab"
                    class="column-settings-tab"
                    id=${options.tabId(tab)}
                    aria-selected=${tab === current ? 'true' : 'false'}
                    aria-controls=${options.panelId(tab)}
                    tabindex=${tab === current ? '0' : '-1'}
                    @click=${() => show(tab)}
                >
                    ${gridText(ctx, text)}${
                        problem
                            ? html`<span class="column-settings-tab-problem" aria-hidden="true"></span
                                  ><span class="simple-html-visually-hidden"> ${gridText(ctx, 'columnSettings.badge.problem')}</span>`
                            : nothing
                    }
                </button>`
        )}
    </div>`;
}

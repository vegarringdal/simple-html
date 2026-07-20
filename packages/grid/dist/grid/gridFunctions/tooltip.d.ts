import type { Grid } from '../grid';
/**
 * Default tooltip texts, keyed by id.
 *
 * The id is what you override with `tooltipText` in the grid config:
 *
 * ```ts
 * const gridConfig: GridConfig = {
 *     tooltips: true, // default, set false to not render the built in tooltip
 *     tooltipText: {
 *         'filterEditor.addCondition': 'Legg til betingelse'
 *     },
 *     ...
 * };
 * ```
 *
 * `data-tooltip` is written to the elements no matter what `tooltips` is set to, so you can
 * hook up your own tooltip library and just turn the built in one off.
 */
export declare const TOOLTIPS: Record<string, string>;
/**
 * tooltip text for an id, using the override from the grid config if there is one
 */
export declare function tooltip(ctx: Grid, id: string): string;
/**
 * the built in tooltip is on unless the config turns it off
 */
export declare function tooltipsEnabled(ctx: Grid): boolean;
export declare function hideTooltip(): void;
/**
 * delegated hover handling for every [data-tooltip] inside root
 */
export declare function attachTooltips(root: HTMLElement): void;
//# sourceMappingURL=tooltip.d.ts.map
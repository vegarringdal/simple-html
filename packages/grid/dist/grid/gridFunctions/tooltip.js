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
export const TOOLTIPS = {
    'filterEditor.title': 'Drag to move the dialog',
    'filterEditor.close': 'Close without filtering',
    'filterEditor.filterAndClose': 'Apply this filter to the grid and close the dialog',
    'filterEditor.filterOnly': 'Apply this filter to the grid but keep the dialog open, so you can keep adjusting it',
    'filterEditor.closeButton': 'Close the dialog and leave the current filter as it is',
    'filterEditor.pickAttribute': 'Pick which column this condition looks at',
    'filterEditor.pickOperator': 'Pick how the value is compared, for example equal or greater than',
    'filterEditor.pickValueAttribute': 'Pick which column to compare against',
    'filterEditor.deleteCondition': 'Delete this condition',
    'filterEditor.deleteGroup': 'Delete this group and everything in it',
    'filterEditor.clearAll': 'Clear all conditions',
    'filterEditor.addCondition': 'Add a condition to this group',
    'filterEditor.addSubGroup': 'Add a sub group inside this group',
    'filterEditor.wrapGroup': 'Wrap everything in this group inside a new parent group',
    'filterEditor.operatorAnd': 'All conditions in this group must match. Click for OR',
    'filterEditor.operatorOr': 'Any condition in this group may match. Click for AND',
    'filterEditor.useValue': 'Compare against a typed in value instead of another column',
    'filterEditor.useAttribute': 'Compare against another column instead of a typed in value'
};
/**
 * tooltip text for an id, using the override from the grid config if there is one
 */
export function tooltip(ctx, id) {
    const override = ctx?.gridInterface?.__getGridConfig()?.tooltipText?.[id];
    return override ?? TOOLTIPS[id] ?? '';
}
/**
 * the built in tooltip is on unless the config turns it off
 */
export function tooltipsEnabled(ctx) {
    return ctx?.gridInterface?.__getGridConfig()?.tooltips !== false;
}
/**
 * One tooltip element, living on document.body.
 *
 * It has to sit on the body rather than inside the element it describes: the dialog clips
 * its content (`overflow: hidden`, needed for resize), so a tooltip rendered inside it
 * would be cut off at the edges.
 */
let tooltipElement = null;
function getTooltipElement() {
    if (tooltipElement?.isConnected) {
        return tooltipElement;
    }
    tooltipElement = document.createElement('div');
    /**
     * the simple-html-grid class is what carries the css variables and the default font,
     * and it is also what the dark theme targets. Without it a tooltip sitting on the body
     * falls back to the browser default font and has no theme colours at all.
     */
    tooltipElement.className = 'simple-html-grid simple-html-grid-tooltip';
    tooltipElement.style.display = 'none';
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}
export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
}
/**
 * places the tooltip above the element, flips it below when there is no room above, and
 * clamps it inside the window so it is never cut off at an edge
 */
function showTooltip(target, text) {
    const el = getTooltipElement();
    el.textContent = text;
    el.style.display = 'block';
    // measure only after the text is in, the size depends on it
    el.style.left = '0px';
    el.style.top = '0px';
    const margin = 6;
    const anchor = target.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    let top = anchor.top - box.height - margin;
    if (top < margin) {
        // no room above, put it under the element instead
        top = anchor.bottom + margin;
    }
    if (top + box.height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - box.height - margin);
    }
    let left = anchor.left + anchor.width / 2 - box.width / 2;
    left = Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - box.width - margin));
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
}
/**
 * delegated hover handling for every [data-tooltip] inside root
 */
export function attachTooltips(root) {
    root.addEventListener('mouseover', (event) => {
        const target = event.target?.closest?.('[data-tooltip]');
        const text = target?.getAttribute('data-tooltip');
        if (text) {
            showTooltip(target, text);
        }
    });
    root.addEventListener('mouseout', (event) => {
        if (event.target?.closest?.('[data-tooltip]')) {
            hideTooltip();
        }
    });
    // a tooltip left hanging over a dialog that just changed is worse than no tooltip
    root.addEventListener('mousedown', () => hideTooltip());
}
//# sourceMappingURL=tooltip.js.map
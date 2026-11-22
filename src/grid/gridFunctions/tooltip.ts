import type { Grid } from '../grid';

/**
 * the built in tooltip is on unless the config turns it off
 */
export function tooltipsEnabled(ctx: Grid): boolean {
    return ctx?.gridInterface?.__getGridConfig()?.tooltips !== false;
}

/**
 * One tooltip element, `position: fixed`, on the body - or in the dialog or popover the element it
 * describes is in (the filter editor, a menu with a dropdown grid, a dialog of your own). Those are in
 * the top layer, over everything on the body: a tooltip on the body would be hidden behind them.
 * Inside them it is painted over their content, and as it is `position: fixed` their
 * `overflow: hidden` (the filter editor's, needed for resize) does not cut it off.
 */
let tooltipElement: HTMLElement | null = null;

/**
 * the tooltip element, moved to `parent` when it is somewhere else
 */
function getTooltipElement(parent: HTMLElement): HTMLElement {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        /**
         * the simple-html-grid class is what carries the css variables and the default font,
         * and it is also what the dark theme targets. Without it a tooltip sitting on the body
         * falls back to the browser default font and has no theme colours at all.
         */
        tooltipElement.className = 'simple-html-grid simple-html-grid-tooltip';
        tooltipElement.style.display = 'none';
    }
    if (tooltipElement.parentElement !== parent) {
        parent.appendChild(tooltipElement);
    }
    return tooltipElement;
}

/**
 * hides the tooltip, and takes it out of the document: left in a dialog or menu that closes, it would
 * keep that (and its grid) in memory. The next tooltip puts it back
 */
export function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
        tooltipElement.remove();
    }
}

/**
 * hides the tooltip when it is in `container`: a menu that closes while it shows a tooltip of its own
 * (the operators of the filter menu's range block) - the tooltip would keep the menu in memory, see
 * hideTooltip. One shown somewhere else stays
 */
export function hideTooltipIn(container: Element) {
    if (tooltipElement && container.contains(tooltipElement)) {
        hideTooltip();
    }
}

/**
 * places the tooltip above the element, flips it below when there is no room above, and
 * clamps it inside the window so it is never cut off at an edge
 */
function showTooltip(target: HTMLElement, text: string) {
    const el = getTooltipElement(target.closest<HTMLElement>('dialog, [popover]') ?? document.body);
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
 * @param enabled asked on every hover, for a root that lives longer than the `tooltips` option it
 * was attached with (the grid's body). Left out, the tooltips are always shown
 */
export function attachTooltips(root: HTMLElement, enabled: () => boolean = () => true) {
    root.addEventListener('mouseover', (event: MouseEvent) => {
        const target = (event.target as HTMLElement)?.closest?.('[data-tooltip]') as HTMLElement;
        const text = target?.getAttribute('data-tooltip');
        if (text && enabled()) {
            showTooltip(target, text);
        }
    });

    root.addEventListener('mouseout', (event: MouseEvent) => {
        if ((event.target as HTMLElement)?.closest?.('[data-tooltip]')) {
            hideTooltip();
        }
    });

    // a tooltip left hanging over a dialog that just changed is worse than no tooltip. Scrolling the
    // grid puts other rows under the pointer, in the same cell elements
    root.addEventListener('mousedown', () => hideTooltip());
    root.addEventListener('wheel', () => hideTooltip(), { passive: true });
}

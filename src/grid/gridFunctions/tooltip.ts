import type { Grid } from '../grid';

/**
 * the built in tooltip is on unless the config turns it off
 */
export function tooltipsEnabled(ctx: Grid): boolean {
    return ctx?.gridInterface?.__getGridConfig()?.tooltips !== false;
}

/**
 * One tooltip element, living on document.body.
 *
 * It has to sit on the body rather than inside the element it describes: the dialog clips
 * its content (`overflow: hidden`, needed for resize), so a tooltip rendered inside it
 * would be cut off at the edges.
 */
let tooltipElement: HTMLElement | null = null;

function getTooltipElement(): HTMLElement {
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
function showTooltip(target: HTMLElement, text: string) {
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

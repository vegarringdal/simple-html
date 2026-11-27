import { html, render } from 'lit-html';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { dragEvent } from './dragEvent';
import { getElementByClassName } from './getElementByClassName';
import { getTextWidth } from './getTextWidth';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';

/**
 * ctx also includes some of the grouping logic
 * like adding boxes for gouping
 * logic for removing a group
 * hoving left side of grouping box
 */
export function rebuildTopPanel(ctx: Grid) {
    // the panel is a drop target while a column is dragged, dragEvent highlights it under the pointer
    const panel = getElementByClassName(ctx.element, 'simple-html-grid-panel');

    while (panel.firstChild) {
        panel.removeChild(panel.firstChild);
    }

    const grouping = ctx.gridInterface.getDatasource().getGrouping();

    grouping.forEach((group) => {
        const label = createElement('DIV', 'simple-html-grid-panel-label');
        (label as HTMLCellElement).$attribute = group.attribute;
        label.style.width = asPx(getTextWidth(ctx, group.title) + 20);

        dragEvent(ctx, label as HTMLCellElement, false);

        // drop zone: a field or chip dropped here is grouped on before this chip. It only has a size
        // while a column is dragged
        label.appendChild(createElement(DIV, 'simple-html-grid-drop-zone-left-panel'));

        const removeGroup = () => {
            // TODO: look into group logic
            const updateGrouping = ctx.gridInterface
                .getDatasource()
                .getGrouping()
                .filter((e) => e.attribute !== group.attribute);
            if (updateGrouping.length === 0) {
                ctx.gridInterface.getDatasource().group([]);
            } else {
                ctx.gridInterface.getDatasource().group(updateGrouping);
            }

            ctx.rebuild();
        };

        // the x is a button, in the tab order: Enter and Space remove the grouping like a click
        render(
            html`<div>
                <span class="simple-html-grid-panel-label-text">${group.title}</span>
                <i
                    class="simple-html-grid-icon-group"
                    role="button"
                    tabindex="0"
                    aria-label=${gridText(ctx, 'grid.removeGroup', { title: group.title })}
                    @click=${removeGroup}
                    @keydown=${(e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            removeGroup();
                        }
                    }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="simple-html-grid-icon-group-svg"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </i>
            </div>`,
            label
        );

        panel.appendChild(label);
    });
}

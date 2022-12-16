import { render, html } from 'lit-html';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { dragEvent } from './dragEvent';
import { getElementByClassName } from './getElementByClassName';
import { DIV, Grid, HTMLCellElement } from './grid';

/**
 * ctx also includes some of the grouping logic
 * like adding boxes for gouping
 * logic for removing a group
 * hoving left side of grouping box
 */
export function rebuildTopPanel(ctx: Grid) {
    const panel = getElementByClassName(ctx.element, 'simple-html-grid-panel');
    panel.onmousemove = () => {
        if (panel.classList.contains('dragdrop-state') && !panel.classList.contains('simple-html-grid-col-resize-hover')) {
            panel.classList.toggle('simple-html-grid-col-resize-hover');
        }
    };
    panel.onmouseleave = () => {
        if (panel.classList.contains('dragdrop-state')) {
            panel.classList.remove('simple-html-grid-col-resize-hover');
        }
    };

    while (panel.firstChild) {
        panel.removeChild(panel.firstChild);
    }

    const grouping = ctx.gridInterface.getDatasource().getGrouping();

    grouping.forEach((group) => {
        const label = creatElement('DIV', 'simple-html-grid-panel-label');
        (label as HTMLCellElement).$attribute = group.attribute;
        label.style.width = asPx(ctx.getTextWidth(group.title) + 20);

        dragEvent(ctx, label as HTMLCellElement, false);

        const addEvent = (child: HTMLElement, parent: HTMLElement) => {
            child.onmouseenter = () => {
                if ((parent as HTMLCellElement).$attribute) {
                    child.classList.toggle('simple-html-grid-col-resize-hover');
                }
            };
            child.onmouseleave = () => {
                if ((parent as HTMLCellElement).$attribute) {
                    child.classList.toggle('simple-html-grid-col-resize-hover');
                }
            };
            parent.appendChild(child);
        };

        addEvent(creatElement(DIV, 'simple-html-grid-drop-zone-left-panel'), label);

        render(
            html`<div>
                <span class="simple-html-grid-panel-label-text">${group.title}</span>
                <i
                    class="simple-html-grid-icon-group"
                    @click=${() => {
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

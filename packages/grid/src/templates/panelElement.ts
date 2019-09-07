import { html, svg } from 'lit-html';
import { FreeGrid } from '..';
import { eventIF } from '../eventIF';
import { columnDragDropPanel } from '../dragEvent';

export function panelElement(freeGrid: FreeGrid) {
    const grouping = freeGrid.config.groupingSet || [];

    const mouseEnter = (e: MouseEvent) => {
        (<HTMLElement>e.target)
            .getElementsByClassName('free-grid-icon')[0]
            .classList.remove('free-grid-iconhidden');
    };

    const mouseLeave = (e: MouseEvent) => {
        (<HTMLElement>e.target)
            .getElementsByClassName('free-grid-icon')[0]
            .classList.add('free-grid-iconhidden');
    };

    const enter = columnDragDropPanel('enter', freeGrid);
    const leave = columnDragDropPanel('leave', freeGrid);

    return html`
        <free-grid-panel
            @custom-1=${eventIF(true, 'mouseleave', leave)}
            @custom-2=${eventIF(true, 'mouseenter', enter)}
            style="height:${freeGrid.config.panelHeight}px"
            class="free-grid-panel"
        >
            ${grouping.map(group => {
                const click = () => {
                    freeGrid.arrayUtils.removeGroupBinded(group);
                };

                return html`
                    <div
                        @mouseenter=${mouseEnter}
                        @mouseleave=${mouseLeave}
                        class="free-grid-grouping-panel-container"
                    >
                        <p class="free-grid-grouping-panel-p">
                            ${group.title || group.field}
                            <i>
                                <svg
                                    @click=${click}
                                    class="free-grid-icon free-grid-iconhidden"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 16 16"
                                >
                                    ${svg`<path d="M3 4l4.3 4L3 12h1.4L8 8.7l3.5 3.3H13L8.6 8 13 4h-1.5L8 7.3 4.4 4H3z"/>`}
                                </svg></i
                            >
                        </p>
                    </div>
                `;
            })}
        </free-grid-panel>
    `;
}

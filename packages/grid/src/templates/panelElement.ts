import { html, svg } from 'lit-html';
import { eventIF } from '../eventIF';
import { columnDragDropPanel } from '../dragEvent';
import { GridInterface } from '../gridInterface';

export function panelElement(connector: GridInterface) {
    const grouping = connector.config.groupingSet || [];

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

    const enter = columnDragDropPanel('enter', connector);
    const leave = columnDragDropPanel('leave', connector);

    return html`
        <free-grid-panel
            @custom-1=${eventIF(true, 'mouseleave', leave)}
            @custom-2=${eventIF(true, 'mouseenter', enter)}
            style="height:${connector.config.panelHeight}px"
            class="free-grid-panel"
        >
            ${grouping.map(group => {
                const click = () => {
                    connector.removeGroup(group);
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

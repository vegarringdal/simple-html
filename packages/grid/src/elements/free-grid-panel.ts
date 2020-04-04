import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { html, svg } from 'lit-html';
import { FreeGrid } from '..';

@customElement('free-grid-panel')
export default class extends HTMLElement {
    classList: any = 'free-grid-panel';
    connector: GridInterface;
    ref: FreeGrid;

    connectedCallback() {
        const config = this.connector.config;
        this.style.height = config.panelHeight + 'px';
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }
    
    render() {
        const grouping = this.connector.config.groupingSet || [];

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

        return html`
            ${grouping.map(group => {
                const click = () => {
                    this.connector.removeGroup(group);
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
        `;
    }
}

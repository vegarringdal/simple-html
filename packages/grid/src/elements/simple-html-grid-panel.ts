import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { html, svg } from 'lit-html';
import { SimpleHtmlGrid } from '..';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-panel')
export default class extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-panel');
        const config = this.connector.config;
        this.style.height = config.panelHeight + 'px';
        this.ref.addEventListener('reRender', this);
        this.addEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'reRender') {
            this.render();
        }
        if (e.type === 'contextmenu') {
            e.preventDefault();
            generateMenuWithComponentName(
                'simple-html-grid-menu-panel',
                e,
                this.connector,
                this.ref
            );
        }
    }

    disconnectedCallback() {
        this.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const grouping = this.connector.config.groupingSet || [];

        const mouseEnter = (e: MouseEvent) => {
            (e.target as HTMLElement)
                .getElementsByClassName('simple-html-grid-icon')[0]
                .classList.remove('simple-html-grid-iconhidden');
        };

        const mouseLeave = (e: MouseEvent) => {
            (e.target as HTMLElement)
                .getElementsByClassName('simple-html-grid-icon')[0]
                .classList.add('simple-html-grid-iconhidden');
        };

        return html`
            ${grouping.map((group) => {
                const click = () => {
                    this.connector.removeGroup(group);
                };
                return html`
                    <div
                        @mouseenter=${mouseEnter}
                        @mouseleave=${mouseLeave}
                        class="simple-html-grid-grouping-panel-container"
                    >
                        <p class="simple-html-grid-grouping-panel-p">
                            ${group.title || group.attribute}
                            <i>
                                <svg
                                    @click=${click}
                                    class="simple-html-grid-icon simple-html-grid-iconhidden"
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

import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '..';

@customElement('free-grid-header')
export default class extends HTMLElement {
    classList: any = 'free-grid-header';
    connector: GridInterface;
    ref: FreeGrid;

    connectedCallback() {
        const config = this.connector.config;
        this.style.top = config.panelHeight + 'px';
        this.style.height = config.__rowHeight * 2 + 'px';
        this.ref.addEventListener('horizontal-scroll', this);
    }

    handleEvent(e: any) {
        if (e.type === 'horizontal-scroll') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('horizontal-scroll', this);
    }

    render() {
        const config = this.connector.config;

        this.style.left = -config.scrollLeft + 'px'
        this.style.width = config.__rowWidth + 'px';

        return html`
            ${config.groups.map(group => {
                return html`
                    <free-grid-group-label
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </free-grid-group-label>
                    <free-grid-group-filter
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </free-grid-group-filter>
                `;
            })}
        `;
    }
}

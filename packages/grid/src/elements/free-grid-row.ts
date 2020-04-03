import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '../';
import { html } from 'lit-html';

@customElement('free-grid-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-row';
    connector: GridInterface;
    row: { i: number };
    ref: FreeGrid;
    currentHeight: number;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.__rowHeight + 'px';
        this.currentHeight = this.row.i * config.__rowHeight;
        this.style.transform = `translate3d(0px, ${this.currentHeight}px, 0px)`;
        this.ref.addEventListener('scrolled', this);
    }

    handleEvent(e: any) {
        if (e.type === 'scrolled') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('scrolled', this);
    }

    render() {
        const config = this.connector.config;

        // check if height is changed
        if (this.currentHeight !== this.row.i * config.__rowHeight) {
            this.currentHeight = this.row.i * config.__rowHeight;
            this.style.transform = `translate3d(0px, ${this.row.i * config.__rowHeight}px, 0px)`;
        }

        const rowClick = (e: any) => {
            this.connector.selection.highlightRow(<any>e, this.row.i);
            this.ref.triggerEvent('scrolled');
        };

        if (this.connector.selection.isSelected(this.row.i)) {
            this.classList.add('free-grid-selected-row');
        } else {
            this.classList.remove('free-grid-selected-row');
        }

        return html`
            ${config.groups.map(group => {
                return html`
                    <free-grid-group-row
                        @click=${rowClick}
                        .connector=${this.connector}
                        .rowNo=${this.row.i}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </free-grid-group-row>
                `;
            })}
        `;
    }
}

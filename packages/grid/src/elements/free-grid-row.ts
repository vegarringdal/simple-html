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

    connectedCallback() {
        this.style.display = 'block';
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'vertical-scroll') {
            this.render();
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const config = this.connector.config;

        // check if height is changed
        this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';
        this.style.transform = `translate3d(0px, ${
            this.connector.getScrollVars.__SCROLL_TOPS[this.row.i]
        }px, 0px)`;

        const rowClick = (e: any) => {
            this.connector.selection.highlightRow(<any>e, this.row.i);
            this.ref.triggerEvent('vertical-scroll');
        };

        if (this.connector.selection.isSelected(this.row.i)) {
            this.classList.add('free-grid-selected-row');
        } else {
            this.classList.remove('free-grid-selected-row');
        }

        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;

        return html`
            <free-grid-col
                class="free-grid-grouping-row"
                style="width:${grouping ? grouping * 15 : 0}px;left:0; display:${grouping
                    ? 'block'
                    : 'none'}"
            >
            </free-grid-col>
            ${config.groups.map((group) => {
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

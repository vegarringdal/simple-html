import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '..';
import { html, svg } from 'lit-html';

@customElement('free-grid-row-group')
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
      //  if (this.currentHeight !== this.row.i * config.__rowHeight) {
            this.currentHeight = this.row.i * config.__rowHeight;
            this.style.transform = `translate3d(0px, ${this.row.i * config.__rowHeight}px, 0px)`;
       // }
        const entity = this.connector.displayedDataset[this.row.i] ;

        if(entity){
        const changeGrouping = () => {
            if (entity.__groupExpanded) {
                this.connector.groupCollapse(entity.__groupID);
            } else {
                this.connector.groupExpand(entity.__groupID);
            }
        };
    
        const defaultMarkup = html`
            <i @click=${changeGrouping}>
                <svg class="free-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    ${entity.__groupExpanded
                        ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                        : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
                </svg></i
            ><span> ${entity.__groupName} (${entity.__groupTotal})</span>
        `;

        return html`
             ${entity.__groupLvl
                ? html`
                      <free-grid-col
                          class="free-grid-col free-grid-grouping-row"
                          style="width:${entity.__groupLvl ? entity.__groupLvl * 15 : 0}px;left:0"
                      >
                      </free-grid-col>
                  `
                : ''}
            ${html`
                <free-grid-col
                    class="free-grid-col-group"
                    style="left:${entity.__groupLvl ? entity.__groupLvl * 15 : 0}px;right:0"
                >
                    ${defaultMarkup}
                </free-grid-col>
            `}
        `;
        } else{
            return ''
        }
    }
}

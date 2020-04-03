import { customElement ,property} from '@simple-html/core';
import { FreeGrid, GridInterface } from '..';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';


@customElement('free-grid-cell-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-cell-row';
    connector: GridInterface;
    cellPosition: number;
    ref: FreeGrid;
    currentHeight: number;
    @property() rowNo: number;
    group: IgridConfigGroups;
    attribute: string;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        //@ts-ignore fix later- might add options for columns in cell rows
        this.attribute = this.group.rows[this.cellPosition].attribute;
    }

    render() {
        if (this.connector.displayedDataset[this.rowNo]) {
            const data = this.connector.displayedDataset[this.rowNo][this.attribute];
            return html`
                <input value=${data} class="free-grid-row-input" />
            `;
        } else {
            return '';
        }
    }
}

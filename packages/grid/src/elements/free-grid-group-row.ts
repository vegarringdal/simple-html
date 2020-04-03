import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '../';
import { IgridConfigGroups } from '../interfaces';

@customElement('free-grid-group-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-group-row';
    connector: GridInterface;
    rowNo: number
    ref: FreeGrid;
    currentHeight: number;
    group: IgridConfigGroups;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.__rowHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.left = this.group.__left + 'px';
    }

    render() {
        return 'row';
    }
}


import { html, svg } from 'lit-html';
import { ICell } from '../interfaces';
import { GridInterface } from '../gridInterface';

export function sorticonElement(_connector: GridInterface, col: ICell) {
    const ascTemplate = svg`
        <svg class="free-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path d="M7.4 6L3 10h1.5L8 7l3.4 3H13L8.5 6h-1z"/>
        </svg>`;

    const descTemplate = svg`
        <svg class="free-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path d="M7.4 10L3 6h1.5L8 9.2 11.3 6H13l-4.5 4h-1z"/>
        </svg>`;

    if (col.sortable && col.sortable.sortNo) {
        return html`
            <i class="free-grid-fa-sort-number" data-vgridsort="${col.sortable.sortNo}">
                ${col.sortable.sortAscending ? ascTemplate : descTemplate}
            </i>
        `;
    } else {
        return html``;
    }
}
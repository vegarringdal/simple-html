import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-day-header')
export default class extends HTMLElement {
    config: IDateConfig;
    blockDay: number;

    getDayHeaders(blockDay: number) {
        let start = this.config.weekStart;
        const newArr = [];
        for (let i = 0; i < 7; i++) {
            newArr.push(start);
            start++;
            if (start > 6) {
                start = 0;
            }
        }
        return this.config.weekHeader[newArr[blockDay]];
    }

    render() {
        this.style.height = this.config.rowHeight;
        return html`${this.getDayHeaders(this.blockDay)}`;
    }
}

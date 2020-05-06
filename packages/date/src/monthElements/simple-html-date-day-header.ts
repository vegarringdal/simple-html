import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-day-header')
export default class extends HTMLElement {
    ref: SimpleHtmlDate;
    blockDay: number;

    connectedCallback() {
        this.ref.addEventListener('update', this);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('update', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'update') {
            this.render();
        }
    }

    getDayHeaders(blockDay: number) {
        let start = this.ref.config.weekStart;
        const newArr = [];
        for (let i = 0; i < 7; i++) {
            newArr.push(start);
            start++;
            if (start > 6) {
                start = 0;
            }
        }
        return this.ref.config.weekHeader[newArr[blockDay]];
    }

    render() {
        this.style.height = this.ref.config.rowHeight;
        return html`${this.getDayHeaders(this.blockDay)}`;
    }
}

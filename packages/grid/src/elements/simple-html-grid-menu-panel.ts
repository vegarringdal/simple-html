import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig } from '../types';
import { defineElement } from './defineElement';

export class SimpleHtmlGridMenuPanel extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
        this.buildHtml();
        // move menu to fit inside viewport
        const rect = this.getBoundingClientRect();
        const thisInnerHeight = window.innerHeight;
        const thisInnerWidth = window.innerWidth;
        if (rect.bottom > thisInnerHeight) {
            this.style.top = `${this.offsetTop - (rect.bottom - thisInnerHeight)}px`;
        }
        if (rect.right > thisInnerWidth) {
            this.style.left = `${this.offsetLeft - (rect.right - thisInnerWidth)}px`;
        }
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: string) {
        if (_type === 'clear') {
            this.connector.config.groupingExpanded = [];
            this.connector.config.groupingSet = [];
            this.connector.manualConfigChange();
        }
        if (_type === 'collapse') {
            this.connector.groupCollapse(null);
        }
        if (_type === 'expand') {
            this.connector.groupExpand(null);
        }
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    buildHtml() {
        const el = [1, 1, 1].map(() => document.createElement('p'));
        el.forEach((e) => e.classList.add('simple-html-grid-menu-item'));

        el[0].onclick = () => this.select('clear');
        el[0].appendChild(document.createTextNode('Clear grouping'));

        el[1].onclick = () => this.select('collapse');
        el[1].appendChild(document.createTextNode('Collapse all'));

        el[2].onclick = () => this.select('expand');
        el[2].appendChild(document.createTextNode('Expand all'));

        el.forEach((e) => this.appendChild(e));
    }
}

defineElement(SimpleHtmlGridMenuPanel, 'simple-html-grid-menu-panel');

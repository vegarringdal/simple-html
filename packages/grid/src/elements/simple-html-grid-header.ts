import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { SimpleHtmlGridCol } from './simple-html-grid-col';
import { SimpleHtmlGridGroupLabel } from './simple-html-grid-group-label';
import { SimpleHtmlGridGroupFilter } from './simple-html-grid-group-filter';

@customElement('simple-html-grid-header')
export class SimpleHtmlGridHeader extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;
    groupMarginEl: any;
    colLabels: SimpleHtmlGridGroupLabel[];
    colFilters: SimpleHtmlGridGroupFilter[];

    connectedCallback() {
        this.classList.add('simple-html-grid-header');
        const config = this.connector.config;
        this.style.top = config.panelHeight + 'px';
        this.style.height = config.__rowHeight * 2 + 2 + 'px';
        this.ref.addEventListener('horizontal-scroll', this);
        this.ref.addEventListener('reRender', this);
        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;

        this.groupMarginEl = document.createElement('simple-html-grid-col') as SimpleHtmlGridCol;
        this.groupMarginEl.classList.add('simple-html-grid-grouping-row');
        this.groupMarginEl.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.groupMarginEl.style.left = `0`;
        this.groupMarginEl.style.display = grouping ? 'block' : 'none';
        this.appendChild(this.groupMarginEl);
        this.colLabels = this.connector.config.groups.map((group) => {
            const el = document.createElement(
                'simple-html-grid-group-label'
            ) as SimpleHtmlGridGroupLabel;
            el.connector = this.connector;
            el.ref = this.ref;
            el.group = group;

            this.appendChild(el);
            return el;
        });

        this.colFilters = this.connector.config.groups.map((group) => {
            const el = document.createElement(
                'simple-html-grid-group-filter'
            ) as SimpleHtmlGridGroupFilter;
            el.connector = this.connector;
            el.ref = this.ref;
            el.group = group;

            this.appendChild(el);
            return el;
        });
    }

    handleEvent(e: Event) {
        if (e.type === 'horizontal-scroll' || e.type === 'reRender') {
            this.xrender();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('horizontal-scroll', this);
        this.ref.removeEventListener('reRender', this);
    }

    xrender() {
        const config = this.connector.config;

        this.style.left = -config.scrollLeft + 'px';
        this.style.width = config.__rowWidth + 'px';

        /*       return html`
            ${config.groups.map((group) => {
                return html`
                    <simple-html-grid-group-label
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </simple-html-grid-group-label>
                    <simple-html-grid-group-filter
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </simple-html-grid-group-filter>
                `;
            })}
        `; */
    }
}

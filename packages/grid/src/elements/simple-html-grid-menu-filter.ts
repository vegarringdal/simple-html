import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { CellConfig, FilterComparisonOperator } from '../interfaces';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-menu-filter')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('vertical-scroll', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: FilterComparisonOperator) {
        if (this.cell.filterable) {
            this.cell.filterable.operator = _type;
        }
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    clearAll() {
        this.connector.setCurrentFilter(null);
        const columns = this.connector.config.groups.flatMap((x) => x.rows);
        columns.forEach((col) => {
            const f = col.filterable;
            if (f) {
                f.currentValue = null;
            }
        });
        this.connector.reRender();
        this.connector.reRunFilter();
    }

    render() {
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('EQUAL')}>
                Equal to
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('NOT_EQUAL_TO')}>
                Not equal to
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('BEGIN_WITH')}>
                Starts with
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('GREATER_THAN')}>
                Greater than
            </p>

            <p
                class="simple-html-grid-menu-item"
                @click=${() => this.select('GREATER_THAN_OR_EQUAL_TO')}
            >
                Greater than or equal
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('LESS_THAN')}>
                Less than
            </p>

            <p
                class="simple-html-grid-menu-item"
                @click=${() => this.select('LESS_THAN_OR_EQUAL_TO')}
            >
                Less than or equal
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('END_WITH')}>
                End with
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('CONTAINS')}>
                Contains
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('DOES_NOT_CONTAIN')}>
                Does not contain
            </p>

            <hr />

            <p
                class="simple-html-grid-menu-item"
                @click=${(e: any) =>
                    generateMenuWithComponentName(
                        'simple-html-grid-filter-dialog',
                        e,
                        this.connector,
                        this.ref,
                        null,
                        null,
                        null
                    )}
            >
                Advanced
            </p>

            <hr />

            <p class="simple-html-grid-menu-item" @click=${this.clearAll}>
                clear filters
            </p>`;
    }
}

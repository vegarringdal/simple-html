import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { CellConfig, FilterComparisonOperator } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-menu-filter')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;
    defaultMenu: boolean = true;
    wait: boolean;
    selectAll: boolean = true;
    dataFilterSet: Set<unknown>;
    dataFilterSetFull: Set<unknown>;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);

        const data = this.connector.getDatasource().getAllData();

        if (!this.cell.type || this.cell.type === 'text') {
            const attribute = this.cell.attribute;
            const dataFilterSet = new Set();
            const length = data.length;
            for (let i = 0; i < length; i++) {
                // maybe I should let this be aoption ? the 200 size..
                if (data[i] && data[i][attribute] && dataFilterSet.size < 200) {
                    if (typeof data[i][attribute] === 'string') {
                        dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                    }
                }
            }
            this.dataFilterSet = dataFilterSet;
            this.dataFilterSet.add('NULL'); // null so we can get the blanks

            const tempArray = Array.from(dataFilterSet).sort();
            tempArray.unshift('NULL'); // null so we can get the blanks
            this.dataFilterSetFull = new Set(tempArray);

            // check if top level filter have attribute, if so.. use it
            const oldFilter = this.connector.getDatasource().getFilter();
            if (oldFilter?.filterArguments?.length) {
                oldFilter?.filterArguments.forEach((f) => {
                    if (f.attribute === this.cell.attribute) {
                        if (Array.isArray(f.value as any)) {
                            if (f.operator === 'IN') {
                                this.dataFilterSet = new Set(f.value as any);
                                this.selectAll = false;
                            }
                        }
                    }
                });
            }
        }
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('vertical-scroll', this);
    }

    handleEvent(e: Event) {
        if (this.wait) {
            this.wait = false;
            return;
        }
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

    filters() {
        const operator = this.cell?.filterable?.operator || 'BEGIN_WITH';
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('EQUAL')}>
                ${operator === 'EQUAL' ? html`<u><b>Equal to</b></u>` : 'Equal to'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('NOT_EQUAL_TO')}>
                ${operator === 'NOT_EQUAL_TO' ? html`<u><b>Not equal to</b></u>` : 'Not equal to'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('BEGIN_WITH')}>
                ${operator === 'BEGIN_WITH' ? html`<u><b>Begin with</b></u>` : 'Begin with'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('GREATER_THAN')}>
                ${operator === 'GREATER_THAN' ? html`<u><b>Greater than</b></u>` : 'Greater than'}
            </p>

            <p
                class="simple-html-grid-menu-item"
                @click=${() => this.select('GREATER_THAN_OR_EQUAL_TO')}
            >
                ${operator === 'GREATER_THAN_OR_EQUAL_TO'
                    ? html`<u><b>Greater than or equal</b></u>`
                    : 'Greater than or equal'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('LESS_THAN')}>
                ${operator === 'LESS_THAN' ? html`<u><b>Less than</b></u>` : 'Less than'}
            </p>

            <p
                class="simple-html-grid-menu-item"
                @click=${() => this.select('LESS_THAN_OR_EQUAL_TO')}
            >
                ${operator === 'LESS_THAN_OR_EQUAL_TO'
                    ? html`<u><b>Less than or equal</b></u>`
                    : 'Less than or equal'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('END_WITH')}>
                ${operator === 'END_WITH' ? html`<u><b>End with</b></u>` : 'End with'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('CONTAINS')}>
                ${operator === 'CONTAINS' ? html`<u><b>Contains</b></u>` : 'Contains'}
            </p>

            <p class="simple-html-grid-menu-item" @click=${() => this.select('DOES_NOT_CONTAIN')}>
                ${operator === 'DOES_NOT_CONTAIN'
                    ? html`<u><b>Does not contain</b></u>`
                    : 'Does not contain'}
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('END_WITH')}>
                ${operator === 'END_WITH' ? html`<u><b>End with</b></u>` : 'End with'}
            </p>
            <hr />
            <p
                class="simple-html-grid-menu-item"
                @click=${() => {
                    this.defaultMenu = true;
                    this.wait = true;
                    this.render();
                }}
            >
                <b>Back</b>
            </p>`;
    }

    default() {
        return html`
            <p
                class="simple-html-grid-menu-item"
                @click=${() => {
                    this.defaultMenu = false;
                    this.wait = true;
                    this.render();
                }}
            >
                Filters
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
                clear filter all columns
            </p>
            <hr />
            ${this.cell.type === 'text' || this.cell.type === undefined
                ? html`<div style="max-height:250px; overflow-y:auto">
                          <div style="padding:2px">
                              <input
                                  style="padding:2px"
                                  type="checkbox"
                                  .checked=${this.selectAll}
                                  @click=${() => {
                                      this.wait = true;
                                      this.selectAll = !this.selectAll;
                                      if (this.selectAll) {
                                          this.dataFilterSet = new Set(this.dataFilterSetFull);
                                      } else {
                                          this.dataFilterSet = new Set();
                                      }

                                      this.render();
                                  }}
                              /><label
                                  style="padding:2px"
                                  @click=${() => {
                                      this.wait = true;
                                      this.selectAll = !this.selectAll;
                                      if (this.selectAll) {
                                          this.dataFilterSet = new Set(this.dataFilterSetFull);
                                      } else {
                                          this.dataFilterSet = new Set();
                                      }

                                      this.render();
                                  }}
                                  >Select all</label
                              >
                          </div>
                          ${this.filterValues()}
                      </div>
                      <p
                          class="simple-html-grid-menu-item"
                          @click=${() => {
                              this.connector.filterCallback(
                                  {} as any,
                                  this.cell,
                                  this.dataFilterSet.size !== 0 &&
                                      this.dataFilterSet.size !== this.dataFilterSetFull.size
                                      ? Array.from(this.dataFilterSet)
                                      : null
                              );
                          }}
                      >
                          <b>run filter</b>
                      </p> `
                : ''}
        `;
    }

    render() {
        return html` ${this.defaultMenu ? this.default() : this.filters()}`;
    }

    filterValues() {
        return Array.from(this.dataFilterSetFull).map((rowData: any) => {
            return html`<div style="padding:2px">
                <input
                    style="padding:2px"
                    type="checkbox"
                    .checked="${this.dataFilterSet.has(rowData)}"
                    @click=${() => {
                        this.wait = true;
                        this.selectAll = false;
                        this.dataFilterSet.has(rowData)
                            ? this.dataFilterSet.delete(rowData)
                            : this.dataFilterSet.add(rowData);
                        this.selectAll = this.dataFilterSetFull.size === this.dataFilterSet.size;
                        this.render();
                    }}
                /><label
                    style="padding:2px"
                    @click=${() => {
                        this.wait = true;
                        this.dataFilterSet.has(rowData)
                            ? this.dataFilterSet.delete(rowData)
                            : this.dataFilterSet.add(rowData);
                        this.selectAll = this.dataFilterSetFull.size === this.dataFilterSet.size;
                        this.render();
                    }}
                    >${rowData}</label
                >
            </div>`;
        });
    }
}

import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { CellConfig, FilterComparisonOperator } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { log } from './log';

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
    availableOnly: boolean = false;
    enableAvailableOnlyOption: boolean = false;
    search: any;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
        this.search = this.cell.filterable?.currentValue || null;
        this.fillDropdown();
    }

    fillDropdown() {
        if (!this.cell.type || this.cell.type === 'text') {
            const data = this.availableOnly
                ? this.connector.getDatasource().getRows(true)
                : this.connector.getDatasource().getAllData();

            const attribute = this.cell.attribute;
            const dataFilterSet = new Set();
            const length = data.length;
            let haveNull = false;
            for (let i = 0; i < length; i++) {
                // maybe I should let this be aoption ? the 200 size..
                if (data[i] && data[i][attribute] && dataFilterSet.size < 50) {
                    if (typeof data[i][attribute] === 'string') {
                        if (this.search) {
                            if (
                                data[i][attribute]
                                    .toLocaleUpperCase()
                                    .indexOf(this.search.toLocaleUpperCase()) !== -1
                            ) {
                                dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                            }
                        } else {
                            dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                        }
                    }
                    if (typeof data[i][attribute] === 'number') {
                        if (this.search) {
                            if (data[i][attribute].toString().indexOf(this.search) !== -1) {
                                dataFilterSet.add(data[i][attribute]);
                            }
                        } else {
                            dataFilterSet.add(data[i][attribute]);
                        }
                    }
                } else {
                    haveNull = true;
                }
            }
            this.dataFilterSet = dataFilterSet;
            if (haveNull) {
                this.dataFilterSet.add('NULL'); // null so we can get the blanks
            }

            const tempArray = Array.from(dataFilterSet).sort();

            if (haveNull) {
                tempArray.unshift('NULL'); // null so we can get the blanks
            }

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
                            if (f.operator === 'NOT_IN') {
                                const tempSet = new Set(f.value as any);
                                this.dataFilterSet = new Set(
                                    Array.from(this.dataFilterSetFull).filter(
                                        (x) => !tempSet.has(x)
                                    )
                                );
                                this.selectAll = false;
                            }
                        }
                    }
                });
            }

            this.enableAvailableOnlyOption =
                this.connector.getDatasource().getRows(true).length !==
                    this.connector.getDatasource().getAllData().length &&
                this.dataFilterSet.size === this.dataFilterSetFull.size;
        }
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('vertical-scroll', this);
    }

    handleEvent(e: Event) {
        log(this, e);

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
        const filtertoggleClick = () => {
            this.wait = true;
            this.availableOnly = !this.availableOnly;
            this.selectAll =
                this.dataFilterSetFull.size === this.dataFilterSet.size && !this.availableOnly;
            this.fillDropdown();
            this.render();
        };

        const selectAllClick = () => {
            this.wait = true;
            this.selectAll = !this.selectAll;
            if (this.selectAll) {
                this.dataFilterSet = new Set(this.dataFilterSetFull);
            } else {
                this.dataFilterSet = new Set();
            }

            this.render();
        };

        const runFilterClick = () => {
            const intersection = Array.from(this.dataFilterSetFull).filter(
                (x) => !this.dataFilterSet.has(x)
            );

            if (intersection.length < this.dataFilterSet.size) {
                // if full we want to use NOT in
                this.connector.filterCallback(
                    {} as any,
                    this.cell,
                    intersection.length ? intersection : null,
                    this.search ? this.search : null,
                    intersection.length ? true : false
                );
            } else {
                this.connector.filterCallback(
                    {} as any,
                    this.cell,
                    this.dataFilterSet.size ? Array.from(this.dataFilterSet) : null,
                    this.search ? this.search : null,
                    false
                );
            }
        };

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

            ${this.enableAvailableOnlyOption
                ? html`<div style="padding:2px">
                      <input
                          style="padding:2px"
                          type="checkbox"
                          .checked=${this.availableOnly}
                          @click=${filtertoggleClick}
                      /><label style="padding:2px" @click="${filtertoggleClick}"
                          >Filter Available</label
                      >
                  </div>`
                : ''}
            ${this.cell.type === 'text' || this.cell.type === undefined
                ? html` <input
                      class="simple-html-grid-menu-item-input"
                      style="outline:none;width: 100%;"
                      placeholder="search"
                      .value=${this.search}
                      @click=${() => {
                          this.wait = true;
                      }}
                      @input=${(e: any) => {
                          this.search = e.target.value || null;
                          this.fillDropdown();
                          this.render();
                      }}
                  />`
                : ''}
            ${this.cell.type === 'text' || this.cell.type === undefined
                ? html`<div style="max-height:250px; overflow-y:auto">
                          ${!this.availableOnly
                              ? html`<div style="padding:2px">
                                    <input
                                        style="padding:2px"
                                        type="checkbox"
                                        .checked=${this.selectAll}
                                        @click=${selectAllClick}
                                    /><label style="padding:2px" @click=${selectAllClick}
                                        >Select all</label
                                    >
                                </div>`
                              : ''}
                          ${this.filterValues()}
                      </div>

                      <p class="simple-html-grid-menu-item" @click=${runFilterClick}>
                          <b>run filter</b>
                      </p> `
                : ''}
        `;
    }

    render() {
        return html` ${this.defaultMenu ? this.default() : this.filters()}`;
    }

    filterValues() {
        const filterValueClick = (rowData: any) => {
            this.wait = true;
            this.selectAll = false;
            this.dataFilterSet.has(rowData)
                ? this.dataFilterSet.delete(rowData)
                : this.dataFilterSet.add(rowData);
            this.selectAll =
                this.dataFilterSetFull.size === this.dataFilterSet.size && !this.availableOnly;
            this.render();
        };
        return Array.from(this.dataFilterSetFull).map((rowData: any) => {
            return html`<div style="padding:2px">
                <input
                    style="padding:2px"
                    type="checkbox"
                    .checked="${this.dataFilterSet.has(rowData)}"
                    @click="${() => filterValueClick(rowData)}}"
                /><label style="padding:2px" @click="${() => filterValueClick(rowData)}}"
                    >${rowData === 'NULL' ? 'Blank' : rowData}</label
                >
            </div>`;
        });
    }
}

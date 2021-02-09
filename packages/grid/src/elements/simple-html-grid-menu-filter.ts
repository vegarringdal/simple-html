import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig, FilterArgument, FilterComparisonOperator } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-menu-filter')
export class SimpleHtmlGridMenuFilter extends HTMLElement {
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
    scrollAreaRef: HTMLDivElement;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
        this.search = this.cell.filterable?.currentValue || null;
        this.fillDropdown();
        this.default();
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
            this.search = this.search && this.search?.replaceAll('%', '').replaceAll('*', '');

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
                oldFilter?.filterArguments.forEach((f: FilterArgument) => {
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
                    this.connector.getDatasource().getAllData().length ||
                this.dataFilterSet.size === this.dataFilterSetFull.size;
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
        this.innerHTML = '';
        const operator = this.cell?.filterable?.operator || 'BEGIN_WITH';

        let el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('EQUAL');
        el.style.fontWeight = operator === 'EQUAL' ? 'bold' : '';
        el.appendChild(document.createTextNode('Equal to'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('NOT_EQUAL_TO');
        el.style.fontWeight = operator === 'NOT_EQUAL_TO' ? 'bold' : '';
        el.appendChild(document.createTextNode('Not equal to'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('BEGIN_WITH');
        el.style.fontWeight = operator === 'BEGIN_WITH' ? 'bold' : '';
        el.appendChild(document.createTextNode('Begin with'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('GREATER_THAN');
        el.style.fontWeight = operator === 'GREATER_THAN' ? 'bold' : '';
        el.appendChild(document.createTextNode('Greater than'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('GREATER_THAN_OR_EQUAL_TO');
        el.style.fontWeight = operator === 'GREATER_THAN_OR_EQUAL_TO' ? 'bold' : '';
        el.appendChild(document.createTextNode('Greater than or equal'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('LESS_THAN');
        el.style.fontWeight = operator === 'LESS_THAN' ? 'bold' : '';
        el.appendChild(document.createTextNode('Less than'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('LESS_THAN_OR_EQUAL_TO');
        el.style.fontWeight = operator === 'LESS_THAN_OR_EQUAL_TO' ? 'bold' : '';
        el.appendChild(document.createTextNode('Less than or equal'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('END_WITH');
        el.style.fontWeight = operator === 'END_WITH' ? 'bold' : '';
        el.appendChild(document.createTextNode('End with'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('CONTAINS');
        el.style.fontWeight = operator === 'CONTAINS' ? 'bold' : '';
        el.appendChild(document.createTextNode('Contains'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('DOES_NOT_CONTAIN');
        el.style.fontWeight = operator === 'DOES_NOT_CONTAIN' ? 'bold' : '';
        el.appendChild(document.createTextNode('Does not contain'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.select('END_WITH');
        el.style.fontWeight = operator === 'END_WITH' ? 'bold' : '';
        el.appendChild(document.createTextNode('End with'));
        this.appendChild(el);

        el = document.createElement('hr');
        el.appendChild(document.createTextNode('End with'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.appendChild(document.createTextNode('Back'));
        el.onclick = () => {
            this.defaultMenu = true;
            this.wait = true;
            this.default();
        };
        this.appendChild(el);
    }

    filterValueClick(rowData: any) {
        this.wait = true;
        this.selectAll = false;
        this.dataFilterSet.has(rowData)
            ? this.dataFilterSet.delete(rowData)
            : this.dataFilterSet.add(rowData);
        this.selectAll =
            this.dataFilterSetFull.size === this.dataFilterSet.size && !this.availableOnly;
        this.default();
    }

    selectAllClick() {
        this.wait = true;
        this.selectAll = !this.selectAll;
        if (this.selectAll) {
            this.dataFilterSet = new Set(this.dataFilterSetFull);
        } else {
            this.dataFilterSet = new Set();
        }

        this.default();
    }

    default() {
        this.innerHTML = '';

        const filtertoggleClick = () => {
            this.wait = true;
            this.availableOnly = !this.availableOnly;
            this.selectAll =
                this.dataFilterSetFull.size === this.dataFilterSet.size && !this.availableOnly;
            this.fillDropdown();
            this.default();
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

        let el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => {
            this.defaultMenu = false;
            this.wait = true;
            this.filters();
        };
        el.appendChild(document.createTextNode('Filters'));
        this.appendChild(el);

        el = document.createElement('hr');
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = (e: any) =>
            generateMenuWithComponentName(
                'simple-html-grid-filter-dialog',
                e,
                this.connector,
                this.ref,
                null,
                null,
                null
            );
        el.appendChild(document.createTextNode('Advanced'));
        this.appendChild(el);

        el = document.createElement('hr');
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.clearAll();
        el.appendChild(document.createTextNode('clear filter all columns'));
        this.appendChild(el);

        el = document.createElement('hr');
        this.appendChild(el);

        if (this.enableAvailableOnlyOption) {
            el = document.createElement('div');
            el.style.padding = '2px';

            let iel = document.createElement('input');
            iel.style.padding = '2px';
            iel.type = 'checkbox';
            iel.checked = this.availableOnly;
            iel.onclick = () => filtertoggleClick();
            el.appendChild(iel);

            let lel = document.createElement('label');
            lel.style.padding = '2px';
            lel.onclick = () => filtertoggleClick();
            lel.appendChild(document.createTextNode('Filter Available'));
            el.appendChild(lel);

            this.appendChild(el);
        }

        if (this.cell.type === 'text' || this.cell.type === undefined) {
            let textFilterInput = document.createElement('input');
            textFilterInput.classList.add('simple-html-grid-menu-item-input');
            textFilterInput.style.outline = 'none';
            textFilterInput.style.width = '100%';
            textFilterInput.type = 'text';
            textFilterInput.placeholder = 'search';
            textFilterInput.value = this.search;
            textFilterInput.checked = this.availableOnly;
            textFilterInput.onclick = () => {
                this.wait = true;
            };
            textFilterInput.oninput = (e: any) => {
                this.search = e.target.value || null;
                this.fillDropdown();

                this.scrollAreaRef.innerText = '';
                this.filterValues(this.scrollAreaRef);
            };
            this.appendChild(textFilterInput);

            let scrollArea = document.createElement('div');
            scrollArea.style.padding = '2px';
            scrollArea.style.overflowY = 'auto';
            scrollArea.style.maxHeight = '250px';

            this.filterValues(scrollArea);
            this.appendChild(scrollArea);
            this.scrollAreaRef = scrollArea;

            let el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => runFilterClick();
            el.appendChild(document.createTextNode('run filter'));
            this.appendChild(el);
        }
    }

    filterValues(scrollArea: HTMLElement) {
        let containerSelectAll = document.createElement('div');
        containerSelectAll.style.padding = '2px';

        let selectAll = document.createElement('input');
        selectAll.style.padding = '2px';
        selectAll.type = 'checkbox';
        selectAll.checked = this.selectAll;
        selectAll.onclick = () => this.selectAllClick();

        containerSelectAll.appendChild(selectAll);

        let labelSelectAll = document.createElement('label');
        labelSelectAll.style.padding = '2px';
        labelSelectAll.onclick = () => this.selectAllClick();
        labelSelectAll.appendChild(document.createTextNode('Select all'));
        containerSelectAll.appendChild(labelSelectAll);

        scrollArea.appendChild(containerSelectAll);

        Array.from(this.dataFilterSetFull).forEach((rowData: any) => {
            let el = document.createElement('div');
            el.style.padding = '2px';

            let iel = document.createElement('input');
            iel.style.padding = '2px';
            iel.type = 'checkbox';
            iel.checked = this.dataFilterSet.has(rowData);
            iel.onclick = () => this.filterValueClick(rowData);
            el.appendChild(iel);

            let lel = document.createElement('label');
            lel.style.padding = '2px';
            lel.onclick = () => this.filterValueClick(rowData);
            lel.appendChild(document.createTextNode(rowData === 'NULL' ? 'Blank' : rowData));
            el.appendChild(lel);

            scrollArea.appendChild(el);
        });
    }
}

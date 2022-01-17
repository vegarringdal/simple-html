import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig, FilterArgument, FilterComparisonOperator } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { defineElement } from './defineElement';

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
        this.getDropdownData();
        this.generateMainMenu();

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

    getDropdownData() {
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

    clearThis() {
        const x = this.connector.getDatasource().getFilter();

        const loopFilter = (filter: FilterArgument) => {
            if (filter && Array.isArray(filter.filterArguments)) {
                filter.filterArguments = filter.filterArguments.filter((fi: FilterArgument) => {
                    if (fi.attribute === this.cell.attribute) {
                        return false;
                    } else {
                        return true;
                    }
                });
                filter.filterArguments.forEach((fi: FilterArgument) => {
                    if (fi.type === 'GROUP') {
                        loopFilter(fi);
                    }
                });
            }
        };
        loopFilter(x);

        const columns = this.connector.config.groups.flatMap((x) => x.rows);
        columns.forEach((col) => {
            const f = col.filterable;
            if (f && this.cell.attribute === col.attribute) {
                f.currentValue = null;
            }
        });
        this.connector.reRender();
        this.connector.reRunFilter();
    }

    setFilter(arg: 'IS_BLANK' | 'IS_NOT_BLANK') {
        const x = this.connector.getDatasource().getFilter();

        const loopFilter = (filter: FilterArgument) => {
            if (filter && Array.isArray(filter.filterArguments)) {
                filter.filterArguments = filter.filterArguments.filter((fi: FilterArgument) => {
                    if (fi.attribute === this.cell.attribute) {
                        return false;
                    } else {
                        return true;
                    }
                });
                filter.filterArguments.forEach((fi: FilterArgument) => {
                    if (fi.type === 'GROUP') {
                        loopFilter(fi);
                    }
                });
            }
        };
        loopFilter(x);

        const columns = this.connector.config.groups.flatMap((x) => x.rows);
        columns.forEach((col) => {
            const f = col.filterable;
            if (f && this.cell.attribute === col.attribute) {
                f.currentValue = null;
            }
        });
        if (x && Array.isArray(x.filterArguments)) {
            x.filterArguments.push({
                type: 'CONDITION',
                attribute: this.cell.attribute,
                operator: arg,
                attributeType: this.cell.type
            });
            this.connector.getDatasource().setFilter(x);
        } else {
            this.connector.getDatasource().setFilter({
                type: 'GROUP',
                logicalOperator: 'AND',
                filterArguments: [
                    {
                        type: 'CONDITION',
                        attribute: this.cell.attribute,
                        operator: arg,
                        attributeType: this.cell.type
                    }
                ]
            });
        }
        this.connector.reRender();
        this.connector.reRunFilter();
    }

    generateOperatorMenu() {
        this.innerHTML = '';
        let operator = this.cell?.filterable?.operator || 'BEGIN_WITH';
        const celltype = this.cell?.type || 'text';

        const isText = celltype === 'text';
        const isNumberOrDate = celltype === 'number' || celltype === 'date';
        const isBool = celltype === 'boolean';

        if (isNumberOrDate && operator === 'BEGIN_WITH') {
            operator = 'GREATER_THAN';
        }

        if (isText || isBool || isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('EQUAL');
            el.style.fontWeight = operator === 'EQUAL' ? 'bold' : '';
            el.appendChild(document.createTextNode('Equal to'));
            this.appendChild(el);
        }

        if (isText || isBool || isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('NOT_EQUAL_TO');
            el.style.fontWeight = operator === 'NOT_EQUAL_TO' ? 'bold' : '';
            el.appendChild(document.createTextNode('Not equal to'));
            this.appendChild(el);
        }

        if (isText || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('BEGIN_WITH');
            el.style.fontWeight = operator === 'BEGIN_WITH' ? 'bold' : '';
            el.appendChild(document.createTextNode('Begin with'));
            this.appendChild(el);
        }

        if (isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('GREATER_THAN');
            el.style.fontWeight = operator === 'GREATER_THAN' ? 'bold' : '';
            el.appendChild(document.createTextNode('Greater than'));
            this.appendChild(el);
        }

        if (isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('GREATER_THAN_OR_EQUAL_TO');
            el.style.fontWeight = operator === 'GREATER_THAN_OR_EQUAL_TO' ? 'bold' : '';
            el.appendChild(document.createTextNode('Greater than or equal'));
            this.appendChild(el);
        }

        if (isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('LESS_THAN');
            el.style.fontWeight = operator === 'LESS_THAN' ? 'bold' : '';
            el.appendChild(document.createTextNode('Less than'));
            this.appendChild(el);
        }

        if (isNumberOrDate || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('LESS_THAN_OR_EQUAL_TO');
            el.style.fontWeight = operator === 'LESS_THAN_OR_EQUAL_TO' ? 'bold' : '';
            el.appendChild(document.createTextNode('Less than or equal'));
            this.appendChild(el);
        }

        if (isText || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('END_WITH');
            el.style.fontWeight = operator === 'END_WITH' ? 'bold' : '';
            el.appendChild(document.createTextNode('End with'));
            this.appendChild(el);
        }

        if (isText || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('CONTAINS');
            el.style.fontWeight = operator === 'CONTAINS' ? 'bold' : '';
            el.appendChild(document.createTextNode('Contains'));
            this.appendChild(el);
        }

        if (isText || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('DOES_NOT_CONTAIN');
            el.style.fontWeight = operator === 'DOES_NOT_CONTAIN' ? 'bold' : '';
            el.appendChild(document.createTextNode('Does not contain'));
            this.appendChild(el);
        }

        if (isText || !this.connector.smartFilterStatus()) {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => this.select('END_WITH');
            el.style.fontWeight = operator === 'END_WITH' ? 'bold' : '';
            el.appendChild(document.createTextNode('End with'));
            this.appendChild(el);
        }

        const elH = document.createElement('hr');
        this.appendChild(elH);

        const el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.appendChild(document.createTextNode('Back'));
        el.onclick = () => {
            this.defaultMenu = true;
            this.wait = true;
            this.generateMainMenu();
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

        const scrollTop = this.scrollAreaRef.scrollTop;
        this.generateMainMenu();
        this.scrollAreaRef.scrollTop = scrollTop;
    }

    selectAllClick() {
        this.wait = true;
        this.selectAll = !this.selectAll;
        if (this.selectAll) {
            this.dataFilterSet = new Set(this.dataFilterSetFull);
        } else {
            this.dataFilterSet = new Set();
        }

        this.generateMainMenu();
    }

    generateMainMenu() {
        this.innerHTML = '';

        const filtertoggleClick = () => {
            this.wait = true;
            this.availableOnly = !this.availableOnly;
            this.selectAll =
                this.dataFilterSetFull.size === this.dataFilterSet.size && !this.availableOnly;
            this.getDropdownData();
            this.generateMainMenu();
        };

        const runFilterClick = () => {
            const intersection = Array.from(this.dataFilterSetFull).filter(
                (x) => !this.dataFilterSet.has(x)
            );

            if (intersection.length < this.dataFilterSet.size) {
                // if full we want to use NOT in
                this.connector.filterCallback(
                    null,
                    this.cell,
                    intersection.length ? intersection : null,
                    this.search ? this.search : null,
                    intersection.length ? true : false
                );
            } else {
                this.connector.filterCallback(
                    null,
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
            this.generateOperatorMenu();
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
        el.appendChild(document.createTextNode('Remove all filters'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.clearThis();
        el.appendChild(document.createTextNode('Reset column filter'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.setFilter('IS_BLANK');
        el.appendChild(document.createTextNode('Set blank filter'));
        this.appendChild(el);

        el = document.createElement('p');
        el.classList.add('simple-html-grid-menu-item');
        el.onclick = () => this.setFilter('IS_NOT_BLANK');
        el.appendChild(document.createTextNode('Set not blank filter'));
        this.appendChild(el);

        el = document.createElement('hr');
        this.appendChild(el);

        if (this.enableAvailableOnlyOption) {
            el = document.createElement('div');
            el.style.padding = '2px';

            const iel = document.createElement('input');
            iel.style.padding = '2px';
            iel.type = 'checkbox';
            iel.checked = this.availableOnly;
            iel.onclick = () => filtertoggleClick();
            el.appendChild(iel);

            const lel = document.createElement('label');
            //lel.style.padding = '2px';
            lel.onclick = () => filtertoggleClick();
            lel.appendChild(document.createTextNode('Filter Available'));
            el.appendChild(lel);
            el.classList.add('simple-html-defaults');

            this.appendChild(el);
        }

        if (this.cell.type === 'text' || this.cell.type === undefined) {
            const textFilterInput = document.createElement('input');
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
                this.getDropdownData();

                this.scrollAreaRef.innerText = '';
                this.generateScrollListItems(this.scrollAreaRef);
            };
            this.appendChild(textFilterInput);

            const scrollArea = document.createElement('div');
            scrollArea.style.padding = '2px';
            scrollArea.style.overflowY = 'auto';
            scrollArea.style.maxHeight = '250px';

            this.generateScrollListItems(scrollArea);
            this.appendChild(scrollArea);
            this.scrollAreaRef = scrollArea;

            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.classList.add('simple-html-grid-menu-item-center');
            el.onclick = () => runFilterClick();
            el.appendChild(document.createTextNode('Run filter'));
            this.appendChild(el);
        }
    }

    generateScrollListItems(scrollArea: HTMLElement) {
        const containerSelectAll = document.createElement('div');
        containerSelectAll.style.padding = '2px';

        const selectAll = document.createElement('input');
        selectAll.style.padding = '2px';
        selectAll.type = 'checkbox';
        selectAll.checked = this.selectAll;
        selectAll.onclick = () => this.selectAllClick();

        containerSelectAll.appendChild(selectAll);

        const labelSelectAll = document.createElement('label');
        labelSelectAll.style.padding = '2px';

        labelSelectAll.onclick = () => this.selectAllClick();
        labelSelectAll.appendChild(document.createTextNode('Select all'));
        containerSelectAll.appendChild(labelSelectAll);
        containerSelectAll.classList.add('simple-html-defaults');

        scrollArea.appendChild(containerSelectAll);

        Array.from(this.dataFilterSetFull).forEach((rowData: any) => {
            const el = document.createElement('div');
            el.style.padding = '2px';
            el.style.display = 'flex';
            el.className = 'simple-html-grid-hover';

            const iel = document.createElement('input');
            iel.style.padding = '2px';
            iel.type = 'checkbox';
            iel.checked = this.dataFilterSet.has(rowData);
            iel.onclick = () => this.filterValueClick(rowData);
            el.appendChild(iel);

            const lel = document.createElement('label');
            lel.style.padding = '2px';
            lel.style.width = '100%';

            lel.onclick = () => this.filterValueClick(rowData);
            lel.appendChild(document.createTextNode(rowData === 'NULL' ? 'Blank' : rowData));
            el.appendChild(lel);

            scrollArea.appendChild(el);
            scrollArea.classList.add('simple-html-defaults');
        });
    }
}

defineElement(SimpleHtmlGridMenuFilter, 'simple-html-grid-menu-filter');

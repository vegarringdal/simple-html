import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig, Entity } from '../types';
import { defineElement } from './defineElement';
import { NumberFormater } from '@simple-html/datasource';

let dataClip: any = null; // firefox hack

export class SimpleHtmlGridMenuRow extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;
    rowNo: number;
    rowData: Entity;

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

    capalize(text: string) {
        if (text) {
            text = text.toLowerCase();
            return text[0].toUpperCase() + text.substring(1, text.length);
        } else {
            return text;
        }
    }

    async action(
        _type:
            | 'copy-cell'
            | 'copy-column-with-header'
            | 'copy-column'
            | 'copy-row-with-header'
            | 'paste-into-selected-rows-in-selected-column'
            | 'clear-cells-selected-rows-in-selected-columns'
    ) {
        /**
         * Copy of cell
         */
        if (_type === 'copy-cell' && this.rowData) {
            try {
                const numberformater = this.connector.numberFormater;
                const dateformater = this.connector.dateFormater;
                dataClip = this.rowData[this.cell.attribute]; // firefox hack
                if (this.cell.type === 'date') {
                    dataClip = dateformater.fromDate(dataClip);
                }
                if (this.cell.type === 'number') {
                    dataClip = numberformater.fromNumber(dataClip);
                }

                function listener(e: any) {
                    e.clipboardData.setData('text/html', dataClip);
                    e.clipboardData.setData('text/plain', dataClip);
                    e.preventDefault();
                }
                document.addEventListener('copy', listener);
                document.execCommand('copy');
                document.removeEventListener('copy', listener);
            } catch (err) {
                console.error(err);
            }
        }

        /**
         * Copy of column range
         */
        if ((_type === 'copy-column' || _type === 'copy-column-with-header') && this.rowData) {
            try {
                const getText = () => {
                    dataClip = '';
                    if (_type === 'copy-column-with-header') {
                        dataClip = this.capalize(this.cell.attribute) + '\n';
                    }

                    const numberformater = this.connector.numberFormater;
                    const dateformater = this.connector.dateFormater;

                    this.connector.getSelectedRows().forEach((row: number) => {
                        if (!this.connector.displayedDataset[row].__group) {
                            const data = this.connector.displayedDataset[row][this.cell.attribute];
                            if (this.cell.type === 'date') {
                                dataClip = dataClip + dateformater.fromDate(data) + '\n';
                            } else {
                                if (this.cell.type === 'number') {
                                    dataClip = dataClip + numberformater.fromNumber(data) + '\n';
                                } else {
                                    dataClip = dataClip + (data || '') + '\n';
                                }
                            }
                        }
                    });
                    return dataClip;
                };

                const getHtml = () => {
                    dataClip = `
                                <html>
                                <body>
                                <style>
                                table {
                                    border-collapse: collapse;
                                }
                                td,
                                th {
                                    border: 1px solid rgb(190, 190, 190);
                                    border-collapse: collapse;
                                    padding:3px;
                                }
                                
                                </style>
                                <table>`;
                    if (_type === 'copy-column-with-header') {
                        dataClip =
                            dataClip +
                            '<tr><th>' +
                            this.capalize(this.cell.attribute) +
                            '</th></tr>';
                    }

                    const numberformater = this.connector.numberFormater;
                    const dateformater = this.connector.dateFormater;

                    this.connector.getSelectedRows().forEach((row: number) => {
                        if (!this.connector.displayedDataset[row].__group) {
                            const data = this.connector.displayedDataset[row][this.cell.attribute];
                            if (this.cell.type === 'date') {
                                dataClip =
                                    dataClip +
                                    '<tr><td>' +
                                    dateformater.fromDate(data) +
                                    '</td></tr>';
                            } else {
                                if (this.cell.type === 'number') {
                                    dataClip =
                                        dataClip +
                                        '<tr><td>' +
                                        numberformater.fromNumber(data) +
                                        '</td></tr>';
                                } else {
                                    dataClip = dataClip + '<tr><td>' + (data || '') + '</td></tr>';
                                }
                            }
                        }
                    });
                    dataClip = dataClip + '<table/></body></html>';
                    return dataClip;
                };

                function listener(e: any) {
                    e.clipboardData.setData('text/html', getHtml());
                    e.clipboardData.setData('text/plain', getText());
                    e.preventDefault();
                }
                document.addEventListener('copy', listener);
                document.execCommand('copy');
                document.removeEventListener('copy', listener);
            } catch (err) {
                console.error(err);
            }
        }

        /**
         * Copy of row range
         */
        if (_type === 'copy-row-with-header' && this.rowData) {
            try {
                const attributes = this.connector.config.groups.flatMap((g) =>
                    g.rows.map((r) => r.attribute)
                );

                const types = this.connector.config.groups.flatMap((g) =>
                    g.rows.map((r) => r.type)
                );

                const getText = () => {
                    dataClip = '';
                    // headers
                    attributes.forEach((att) => {
                        dataClip = dataClip + this.capalize(att) + '\t';
                    });
                    //rows
                    dataClip = dataClip + '\n';

                    const numberformater = this.connector.numberFormater;
                    const dateformater = this.connector.dateFormater;

                    this.connector.getSelectedRows().forEach((row: number) => {
                        if (!this.connector.displayedDataset[row].__group) {
                            attributes.forEach((att, i) => {
                                const data = this.connector.displayedDataset[row][att];
                                if (types[i] === 'date') {
                                    dataClip = dataClip + dateformater.fromDate(data) + '\t';
                                } else {
                                    if (types[i] === 'number') {
                                        dataClip =
                                            dataClip + numberformater.fromNumber(data) + '\t';
                                    } else {
                                        dataClip = dataClip + (data || '') + '\t';
                                    }
                                }
                            });
                            dataClip = dataClip + '\n';
                        }
                    });
                };

                const getHtml = () => {
                    dataClip = `
                                <html>
                                <body>
                                <style>
                                table {
                                    border-collapse: collapse;
                                }
                                td,
                                th {
                                    border: 1px solid rgb(190, 190, 190);
                                    border-collapse: collapse;
                                    padding:3px;
                                }
                                
                                </style>
                                <table>`;
                    // headers
                    dataClip = dataClip + '<tr>';
                    attributes.forEach((att) => {
                        dataClip = dataClip + '<th>' + this.capalize(att) + '</th>';
                    });
                    //rows
                    dataClip = dataClip + '</tr>';

                    const numberformater = this.connector.numberFormater;
                    const dateformater = this.connector.dateFormater;

                    this.connector.getSelectedRows().forEach((row: number) => {
                        if (!this.connector.displayedDataset[row].__group) {
                            let rowClip = '<tr>';
                            attributes.forEach((att, i) => {
                                const data = this.connector.displayedDataset[row][att];
                                if (types[i] === 'date') {
                                    rowClip =
                                        rowClip + '<td>' + dateformater.fromDate(data) + '</td>';
                                } else {
                                    if (types[i] === 'number') {
                                        rowClip =
                                            rowClip +
                                            '<td>' +
                                            numberformater.fromNumber(data) +
                                            '</td>';
                                    } else {
                                        rowClip = rowClip + '<td>' + (data || '') + '</td>';
                                    }
                                }
                            });

                            dataClip = dataClip + rowClip + '</tr>';
                        }
                    });
                    dataClip = dataClip + '<table/></body></html>';
                    return dataClip;
                };

                function listener(e: any) {
                    e.clipboardData.setData('text/html', getHtml());
                    e.clipboardData.setData('text/plain', getText());
                    e.preventDefault();
                }
                document.addEventListener('copy', listener);
                document.execCommand('copy');
                document.removeEventListener('copy', listener);
            } catch (err) {
                console.error(err);
            }
        }
        if (_type === 'paste-into-selected-rows-in-selected-column') {
            try {
                let data;
                if (navigator.clipboard.readText) {
                    data = await navigator.clipboard.readText();
                } else {
                    data = dataClip; // firefox hack
                }

                if (data === 'undefined' || data === 'null') {
                    data = null;
                }
                this.pasteIntoCells(data);
            } catch (err) {
                console.error(err);
            }
        }

        if (_type === 'clear-cells-selected-rows-in-selected-columns') {
            this.pasteIntoCells(null);
        }
    }

    pasteIntoCells(data: any) {
        const numberformater = this.connector.numberFormater;
        const dateformater = this.connector.dateFormater;

        this.connector.getSelectedRows().forEach((row: number) => {
            if (this.cell.type === 'number') {
                this.connector.displayedDataset[row][this.cell.attribute] =
                    numberformater.toNumber(data);
            }
            if (this.cell.type === 'date') {
                this.connector.displayedDataset[row][this.cell.attribute] =
                    dateformater.toDate(data);
            }
            if (this.cell.type !== 'number' && this.cell.type !== 'date') {
                this.connector.displayedDataset[row][this.cell.attribute] = data;
            }
        });
        this.connector.reRender();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    buildHtml() {
        let x = document.createElement('p');
        x.onclick = () => this.action('copy-cell');
        x.appendChild(document.createTextNode('Copy'));
        x.classList.add('simple-html-grid-menu-item');
        this.appendChild(x);

        /*     x = document.createElement('p');
        x.onclick = () => this.select('copy-range');
        x.appendChild(document.createTextNode('Copy column'));
        x.classList.add('simple-html-grid-menu-item');
        this.appendChild(x);
 */
        x = document.createElement('p');
        x.onclick = () => this.action('copy-column-with-header');
        x.appendChild(document.createTextNode('Copy column'));
        x.classList.add('simple-html-grid-menu-item');
        this.appendChild(x);

        x = document.createElement('p');
        x.onclick = () => this.action('copy-row-with-header');
        x.appendChild(document.createTextNode('Copy rows'));
        x.classList.add('simple-html-grid-menu-item');
        this.appendChild(x);

        if (!this.connector.config.readonly && !this.cell.readonly) {
            x = document.createElement('p');
            x.onclick = () => this.action('paste-into-selected-rows-in-selected-column');
            x.appendChild(document.createTextNode('Paste into rows'));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = () => this.action('clear-cells-selected-rows-in-selected-columns');
            x.appendChild(document.createTextNode('Clear rows'));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);
        }

        if (this.cell.type === 'number') {
            function add(prev: number, cur: number) {
                return parseFloat((prev + cur).toFixed(5));
            }

            function max(prev: number, cur: number) {
                return cur > prev ? cur : prev;
            }

            function min(prev: number | null, cur: number) {
                if (prev === null) {
                    return cur;
                }

                return cur < prev ? cur : prev;
            }

            function avg(no: number, sum: number) {
                return Math.round(sum / no);
            }

            const ds = this.connector.getDatasource();
            const selectedRows = ds.getSelection().getSelectedRows();
            const allrows = ds.getRows();

            let curValue = 0;
            let maxValue = 0;
            let minValue: number = null;
            selectedRows.forEach((index: number) => {
                const x = allrows[index];
                if (x && x[this.cell.attribute]) {
                    curValue = add(curValue, x[this.cell.attribute]);
                    maxValue = max(maxValue, x[this.cell.attribute]);
                    minValue = min(minValue, x[this.cell.attribute]);
                }
            });

            x = document.createElement('hr');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = async () => {
                const curValueX = Math.round(curValue * 100) / 100;
                await navigator.clipboard.writeText(NumberFormater.fromNumber(curValueX));
            };
            const curValueX = Math.round(curValue * 100) / 100;
            x.appendChild(document.createTextNode(`Sum: ${NumberFormater.fromNumber(curValueX)}`));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = async () => {
                const maxValueX = Math.round(maxValue * 100) / 100;
                await navigator.clipboard.writeText(NumberFormater.fromNumber(maxValueX));
            };
            const maxValueX = Math.round(maxValue * 100) / 100;
            x.appendChild(document.createTextNode(`Max: ${NumberFormater.fromNumber(maxValueX)}`));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = async () => {
                const minValueX = Math.round(minValue * 100) / 100;
                await navigator.clipboard.writeText(NumberFormater.fromNumber(minValueX));
            };
            const minValueX = Math.round(minValue * 100) / 100;
            x.appendChild(document.createTextNode(`Min: ${NumberFormater.fromNumber(minValueX)}`));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = async () => {
                const avgValueX = Math.round(avg(selectedRows.length, curValue) * 100) / 100;
                await navigator.clipboard.writeText(NumberFormater.fromNumber(avgValueX));
            };
            const avgValueX = Math.round(avg(selectedRows.length, curValue) * 100) / 100;
            x.appendChild(document.createTextNode(`Avg: ${NumberFormater.fromNumber(avgValueX)}`));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);

            x = document.createElement('p');
            x.onclick = async () => {
                await navigator.clipboard.writeText(NumberFormater.fromNumber(selectedRows.length));
            };
            x.appendChild(document.createTextNode(`Rows: ${selectedRows.length}`));
            x.classList.add('simple-html-grid-menu-item');
            this.appendChild(x);
        }
    }
}

defineElement(SimpleHtmlGridMenuRow, 'simple-html-grid-menu-row');

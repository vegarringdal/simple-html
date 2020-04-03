import { html } from 'lit-html';
import { COL_SETUP as gridConfig } from './colSetup';
import { DummyDataGenerator } from './dummyDataGenerator';
import { GridInterface } from '@simple-html/grid';
import { customElement, property } from '@simple-html/core';
import { requestRender } from '@simple-html/core/src/requestRender';

@customElement('app-component')
export default class extends HTMLElement {
    private data: any = [];
    private connector: GridInterface;
    private dummyDataGenerator: DummyDataGenerator;
    //@ts-ignore
    @property() private entity: any = null;

    constructor() {
        super();
        this.dummyDataGenerator = new DummyDataGenerator();
        this.data = this.dummyDataGenerator.generateData(1000);
        this.connector = new GridInterface(gridConfig);
        this.connector.setData(this.data, false);
        this.connector.addEventListener(() => {
            this.entity = this.connector.currentEntity;
            //console.log('connected', this.isConnected);
            requestRender(this);
            return this.isConnected;
        });
    }

    public replaceData(x: number) {
        this.data = this.dummyDataGenerator.generateData(x);
        this.connector.setData(this.data);
    }
    public group() {
        gridConfig.sortingSet = [
            {
                attribute: 'last',
                asc: true,
                no: 1
            },
            {
                attribute: 'first',
                asc: true,
                no: 2
            },
            {
                attribute: 'index',
                asc: true,
                no: 3
            }
        ];
        gridConfig.groupingSet = [
            { title: 'Last', field: 'last' },
            { title: 'First', field: 'first' }
        ];
        gridConfig.groupingExpanded = ['Barton', 'Barton-Aida'];

        this.connector.manualConfigChange();
    }

    public clear() {
        gridConfig.groupingExpanded = [];
        gridConfig.sortingSet = [];
        gridConfig.groupingSet = [];
        this.connector.manualConfigChange();
    }

    public addData(x: number) {
        this.data = this.data.concat(this.dummyDataGenerator.generateData(x));
        this.connector.setData(this.data);
    }

    public render() {
        return html`
            <div class="flex flex-col">
                <free-grid style="height:800px" class="free-grid" .interface=${this.connector}>
             
                </free-grid>
            </div>
        `;
    }
}

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
                <div class="m-1">
                       <button
                        @click=${() => {
                            this.clear();
                        }}
                    >
                        clear grouping/sorting etc
                    </button>
                    <button
                        @click=${() => {
                            this.group();
                        }}
                    >
                        group
                    </button>
                </div>
                <div class="p-1">
                    <button
                        @click=${() => {
                            this.replaceData(100);
                        }}
                    >
                        set 100
                    </button>
                    <button
                        @click=${() => {
                            this.replaceData(50);
                        }}
                    >
                        set 50
                    </button>
                    <button
                        @click=${() => {
                            this.replaceData(10);
                        }}
                    >
                        set 10
                    </button>
                    <button
                        @click=${() => {
                            this.replaceData(1);
                        }}
                    >
                        set 1
                    </button>
                    <button
                        @click=${() => {
                            this.replaceData(0);
                        }}
                    >
                        set 0
                    </button>
                    <button
                        @click=${() => {
                            console.log(this.connector.edited());
                        }}
                    >
                        edited
                    </button>
                </div>
                <div class="m-1">
                    <button
                        @click=${() => {
                            this.addData(1);
                        }}
                    >
                        add 1
                    </button>
                    <button
                        @click=${() => {
                            this.addData(10);
                        }}
                    >
                        add 10
                    </button>
                    <button
                        @click=${() => {
                            this.addData(100);
                        }}
                    >
                        add 100
                    </button>
                    <button
                        @click=${() => {
                            this.addData(1000);
                        }}
                    >
                        add 1000
                    </button>
                </div>
                <div>
                    <button
                        @click=${() => {
                            this.connector.first();
                        }}
                    >
                        first
                    </button>
                    <button
                        @click=${() => {
                            this.connector.prev();
                        }}
                    >
                        prev
                    </button>
                    <button
                        @click=${() => {
                            this.connector.select(5);
                        }}
                    >
                        select row 5
                    </button>
                    <button
                        @click=${() => {
                            this.connector.next();
                        }}
                    >
                        next
                    </button>
                    <button
                        @click=${() => {
                            this.connector.last();
                        }}
                    >
                        last
                    </button>
                </div>
            </div>
        `;
    }
}

import { html } from 'lit-html';
import { COL_SETUP as gridConfig } from './colSetup';
import { DummyDataGenerator } from './dummyDataGenerator';
import { GridInterface } from '@simple-html/grid';
import { customElement, property, requestRender } from '@simple-html/core';


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
        console.log(this.data[0])
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
                attribute: 'word1',
                asc: true,
                no: 1
            },
            {
                attribute: 'word2',
                asc: true,
                no: 2
            },
            {
                attribute: 'word3',
                asc: true,
                no: 3
            }
        ];
        gridConfig.groupingSet = [
            { title: 'Word1', field: 'word1' },
            { title: 'Word2', field: 'word2' }
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
        //this.data = this.data.concat(this.dummyDataGenerator.generateData(x));
        this.connector.setData(this.dummyDataGenerator.generateData(x), true);
    }

    public render() {
        return html`
            <div class="flex flex-row">
               
                <div>
                    <div class="m-1 p-1">
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

                    <div class="m-1 p-1">
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
                    <div class="m-1 p-1">
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
                    <div class="m-1 p-1">
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
                    <div class="flex flex-col">
                    <label class="p-1 m-2"
                        >word1:
                        <input
                            .value=${this.entity?.word1 || ''}
                            @change=${(e: any) => {
                                if (this.entity) {
                                     this.entity.word1 = e.target.value;
                                    this.connector.reRender();
                                }
                            }}
                    /></label>
                    <label class="p-1 m-2"
                        >word2:
                        <input
                            .value=${this.entity?.word2 || ''}
                            @change=${(e: any) => {
                                if (this.entity) {
                                    this.entity.word2 = e.target.value;
                                    this.connector.reRender();
                                }
                            }}
                    /></label>
                    <label class="p-1 m-2"
                        >word3:
                        <input
                            .value=${this.entity?.word3 || ''}
                            @change=${(e: any) => {
                                if (this.entity) {
                                    this.entity.word3 = e.target.value;
                                    this.connector.reRender();
                                }
                            }}
                    /></label>
                </div>
                </div>
                <free-grid style="height:700px;width:100%" class="free-grid" .interface=${this.connector}>
                </free-grid>
            </div>
        `;
    }
}

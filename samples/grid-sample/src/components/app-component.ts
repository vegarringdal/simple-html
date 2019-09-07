import { html } from 'lit-html';
import { COL_SETUP as gridConfig } from './colSetup';
import { DummyDataGenerator } from './dummyDataGenerator';
import { IGridConfig } from '@simple-html/grid';
import { customElement } from '@simple-html/core';

@customElement('app-component')
export default class extends HTMLElement {
    private data: any = [];
    private gridConfig: IGridConfig;
    private dummyDataGenerator: DummyDataGenerator;

    constructor() {
        super();
        this.dummyDataGenerator = new DummyDataGenerator();
        this.data = this.dummyDataGenerator.generateData(1000);
        this.gridConfig = gridConfig;
    }

    public replaceData(x: number) {
        this.data = this.dummyDataGenerator.generateData(x);
        this.render();
    }
    public clear() {
        this.gridConfig.groupingExpanded = [];
        this.gridConfig.sortingSet = [];
        this.gridConfig.groupingSet = [];
        (<any>this.getElementsByTagName('FREE-GRID')[0]).manualConfigChange();
    }

    public addData(x: number) {
        this.data = this.data.concat(this.dummyDataGenerator.generateData(x));
        this.render();
    }

    public render() {
        return html`
            <ul>
                <li>hold shift key down to multi sort...</li>
                <li>multiselect with contrl and shift button</li>
                <li>virtual scrolling with max 40 row cache</li>
                <li>edit cells</li>
            </ul>
            <button
                @click=${() => {
                    this.clear();
                }}
            >
                clear grouping/sorting etc
            </button>
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
            <free-grid
                style="margin:20px;width:800px;height:400px"
                class="free-grid"
                .data=${this.data}
                .config=${this.gridConfig}
            >
            </free-grid>
        `;
    }
}

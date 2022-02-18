import './index.css';
import '../../packages/grid/src/grid.css'; // direct so we can edit
import { Datasource, GridConfig, GridInterface } from '@simple-html/grid';
import { customElement } from 'lit/decorators.js';

import { generateGridConfig } from './generateGridConfig';
import { DataGenerator } from './DataGenerator';
import { LitElement, html } from 'lit';

/**
 * simple gridconfig
 */
const gridConfig: GridConfig = generateGridConfig(1, 30);

/**
 * create datasource & data
 */
const datasource = new Datasource();
const generator = new DataGenerator();

/**
 * create interface
 */
const gridInterface = new GridInterface(gridConfig, datasource);

@customElement('root-app')
export class MyElement extends LitElement {
    createRenderRoot() {
        return this;
    }

    buttonsTemplate() {
        function addDataBtn(rows: number) {
            console.log('click');
            gridInterface.setData(generator.generateData(rows), true);
        }

        return html`<!-- buttons -->
            <div class="p-2 m-2">
                <button
                    @click="${() => {
                        debugger;
                        addDataBtn(1000);
                    }}"
                >
                    add 1k
                </button>
            </div>`;
    }

    render() {
        return html`
            <div>
                ${this.buttonsTemplate()}
            <simple-html-grid style="width:1200px;height:600px" class="simple-html-grid" .interface=${gridInterface}></simple-html>
            </div> `;
    }
}

document.body.appendChild(document.createElement('root-app'));

import './index.css';
import '../../packages/grid/src/grid.css'; // direct so we can edit
import { Datasource, GridConfig, GridInterface } from '@simple-html/grid';
import { customElement } from 'lit/decorators.js';

import { generateGridConfig } from './generateGridConfig';
import { DataGenerator } from './DataGenerator';
import { LitElement, html } from 'lit';
import { sampleButtons } from './sampleButtons';

/**
 * simple gridconfig
 */
export const gridConfig: GridConfig = generateGridConfig(1, 30);

/**
 * create datasource & data/
 */
export const datasource = new Datasource();
export const generator = new DataGenerator();

/**
 * create interface
 */
export const gridInterface = new GridInterface(gridConfig, datasource);

@customElement('root-app')
export class MyElement extends LitElement {
    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div class="flex flec-col">
                ${sampleButtons()}
            <simple-html-grid style="width:1200px;height:600px" class="simple-html-grid" .interface=${gridInterface}></simple-html>
            </div> `;
    }
}

document.body.appendChild(document.createElement('root-app'));

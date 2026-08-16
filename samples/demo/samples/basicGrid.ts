import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const basicGrid: DemoSample = {
    id: 'basic-grid',
    title: 'Basic grid',
    group: 'Getting started',
    description:
        'Minimal setup: create a Datasource with your rows, wrap it in a GridInterface with a config, and connect it to a <simple-html-grid> element. Columns can be sorted (click label), filtered (input row), resized and reordered out of the box. Note: the grid defaults to readonly - set readonly: false in the config to allow editing.',
    code: `
import { Datasource, GridInterface, type GridConfig, type GridElement } from '@simple-html/grid';
import '@simple-html/grid/dist/grid.css';

// columnsCenter controls the layout, attributes controls cell type/behavior
const gridConfig: GridConfig = {
    panelHeight: 25,
    readonly: false, // NB: the grid defaults to readonly: true when not set
    columnsCenter: [
        { rows: ['company'], width: 170 },
        { rows: ['country'], width: 120 },
        { rows: ['age'], width: 70 },
        { rows: ['balance'], width: 100 },
        { rows: ['date1'], width: 110 },
        { rows: ['isActive'], width: 80 }
    ],
    attributes: [
        { attribute: 'company' },
        { attribute: 'country' },
        { attribute: 'age', type: 'number' },
        { attribute: 'balance', type: 'number' },
        { attribute: 'date1', type: 'date', label: 'date' },
        { attribute: 'isActive', type: 'boolean', label: 'active' }
    ]
};

const datasource = new Datasource();
datasource.setData(rows); // any array of objects

const gridInterface = new GridInterface(gridConfig, datasource);

const grid = document.createElement('simple-html-grid') as GridElement;
grid.classList.add('simple-html-grid');
grid.style.width = '100%';
grid.style.height = '100%';
grid.connectInterface(gridInterface);
document.body.appendChild(grid);
`,
    run(stage) {
        const ui = createStage(stage);
        mountGrid(ui.gridHost, baseGridConfig());
    }
};

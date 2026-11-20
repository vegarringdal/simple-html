import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const basicGrid: DemoSample = {
    id: 'basic-grid',
    title: 'Basic grid',
    group: 'Getting started',
    description:
        'Minimal setup: create a Datasource with your rows and the types of your fields, wrap it in a GridInterface with a config, and connect it to a <simple-html-grid> element. Columns can be sorted (click label), filtered (input row), resized and reordered out of the box. Note: the grid defaults to readonly - set readonly: false in the config to allow editing.',
    code: `
import { Datasource, GridInterface, type GridConfig, type GridElement } from '@simple-html/grid';
import '@simple-html/grid/grid.css';

// the datasource knows the fields: their type, label and formatter. A field not listed is text
const datasource = new Datasource({
    fields: {
        age: 'number',
        balance: 'number',
        date1: { type: 'date', label: 'date' },
        isActive: { type: 'boolean', label: 'active' }
    }
});
datasource.setData(rows); // any array of objects

// layout says where the columns go, columns has the options of a column (label, readonly,
// placeholders ...) by field name. A field without an entry in columns gets the defaults
const gridConfig: GridConfig = {
    panelHeight: 25,
    readonly: false, // NB: the grid defaults to readonly: true when not set
    columns: {
        company: { label: 'Company' }
    },
    layout: {
        center: [
            { fields: ['company'], width: 170 },
            { fields: ['country'], width: 120 },
            { fields: ['age'], width: 70 },
            { fields: ['balance'], width: 100 },
            { fields: ['date1'], width: 110 },
            { fields: ['isActive'], width: 80 }
        ]
    }
};

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
        mountGrid(ui.gridHost, { ...baseGridConfig(), columns: { company: { label: 'Company' } } });
    }
};

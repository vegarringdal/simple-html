import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filtering: DemoSample = {
    id: 'filtering',
    title: 'Filtering',
    group: 'Datasource',
    description:
        'Users can type in the filter row under the headers, or use the built-in filter editor for advanced conditions. From code you pass a FilterArgument - either a simple condition or nested AND/OR groups.',
    code: `
// simple condition
datasource.filter({ attribute: 'balance', operator: 'GREATER_THAN', value: 2500 });

// AND group (nest groups for more advanced filters)
datasource.filter({
    logicalOperator: 'AND',
    filterArguments: [
        { attribute: 'country', operator: 'EQUAL', value: 'Norway' },
        { attribute: 'age', operator: 'LESS_THAN', value: 30 }
    ]
});

// clear filter
datasource.filter({ logicalOperator: 'AND', filterArguments: [] });

// or let the user build it in the built-in dialog
gridInterface.openFilterEditor();
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('balance > 2500', () => {
            datasource.filter({ attribute: 'balance', operator: 'GREATER_THAN', value: 2500 });
        });
        ui.button('Norway AND age < 30', () => {
            datasource.filter({
                logicalOperator: 'AND',
                filterArguments: [
                    { attribute: 'country', operator: 'EQUAL', value: 'Norway' },
                    { attribute: 'age', operator: 'LESS_THAN', value: 30 }
                ]
            });
        });
        ui.button('Clear filter', () => {
            datasource.filter({ logicalOperator: 'AND', filterArguments: [] });
        });
        ui.button('Open filter editor', () => {
            gridInterface.openFilterEditor();
        });
    }
};

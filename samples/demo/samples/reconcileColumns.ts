import { and, type ColumnsReport, type GridConfig, type SourceColumn, where } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

/**
 * the columns of the source - a database view, say - in two versions: version 2 lost `age` and has
 * `favoriteFruit` and `phone`
 */
const VERSION_1: SourceColumn[] = [
    { field: 'company', label: 'Company' },
    { field: 'country', label: 'Country' },
    { field: 'age', label: 'Age' },
    { field: 'balance', label: 'Balance' },
    { field: 'date1', label: 'Date' }
];
const VERSION_2: SourceColumn[] = [
    { field: 'company', label: 'Company' },
    { field: 'country', label: 'Country' },
    { field: 'balance', label: 'Balance' },
    { field: 'date1', label: 'Date' },
    { field: 'favoriteFruit', label: 'Fruit' },
    { field: 'phone', label: 'Phone' }
];

/** the grid as it was built from version 1: age is in the layout, a rule, a condition, a formula, the filter, a view */
function configOfVersion1(): GridConfig {
    return {
        readonly: false,
        columns: {
            company: { label: 'Company' },
            country: { label: 'Country' },
            age: { label: 'Age', format: { rules: [{ operator: 'GREATER_THAN', value: '50', background: 'orange' }] } },
            balance: {
                label: 'Balance',
                format: {
                    rules: [
                        // only on age: taken out with it
                        { conditions: [{ field: 'age', operator: 'LESS_THAN', value: '30' }], color: 'blue', bold: true },
                        // on balance: stays
                        { operator: 'GREATER_THAN', value: '2500', background: 'green' }
                    ]
                }
            },
            date1: { label: 'Date' }
        },
        layout: {
            left: [{ fields: ['company'], width: 160 }],
            center: [
                { fields: ['country'], width: 110 },
                { fields: ['age'], width: 70 },
                { fields: ['balance'], width: 100 },
                { fields: ['date1'], width: 110 },
                { fields: ['nextAge'], width: 100 }
            ]
        },
        // a calculated column on age: taken out with it
        calculatedColumns: { nextAge: { formula: '{age} + 1', label: 'Age next year', type: 'number' } },
        initialState: {
            sorting: [{ attribute: 'age', ascending: false }],
            filter: and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 25), where('balance', 'GREATER_THAN', 100))
        },
        views: [
            { id: 'young', name: 'Young customers', state: { filter: and(where('age', 'LESS_THAN', 30)), sorting: [] } },
            { id: 'rich', name: 'Rich customers', state: { filter: and(where('balance', 'GREATER_THAN', 2000)), sorting: [] } }
        ],
        viewsButton: true
    };
}

export const reconcileColumns: DemoSample = {
    id: 'reconcile-columns',
    title: 'Columns from a source',
    group: 'Config',
    description:
        'A grid made from a source - the columns of a database view - and saved, when the source changes: gridInterface.updateColumns(columns) (reconcileColumns(saved, columns) for a saved grid, before the grid is made) brings it up to date with the columns the source has now. Version 1 of the source has Age; version 2 lost it and has Fruit and Phone. "Update to version 2": Age leaves the layout, the sort, the filter (the condition on balance stays), its colour rule, the rule of Balance that was on Age only (the one on Balance stays), the calculated column Age next year (its formula named it) and the view Young customers (its filter on Age) - the log shows the report. Fruit and Phone are new: the column chooser (header menu › Column chooser) lists them, hidden - or shown with "…, new columns shown" (showNew). "Back to version 1" brings Age back as a new column. GridConfig.viewsButton shows or hides the views button at the footer\'s left: "Views button on / off".',
    run(stage) {
        const ui = createStage(stage);
        // the datasource knows every field's type: the new ones too
        const { gridInterface } = mountGrid(ui.gridHost, configOfVersion1(), generateRows(300), { fields: baseFields() });

        const log = (version: string, report: ColumnsReport) => {
            ui.log(
                `${version}: added [${report.added.join(', ')}], removed [${report.removed.join(', ')}], calculated removed [${report.removedCalculated.join(', ')}], rules removed: ${report.removedRules.length}`
            );
            ui.log(
                `views now: ${gridInterface
                    .getViews()
                    .map((view) => `${view.name} ${JSON.stringify(view.state.filter)}`)
                    .join(' | ')}`
            );
        };

        ui.button('Update to version 2', () => log('version 2', gridInterface.updateColumns(VERSION_2)));
        ui.button('Update to version 2, new columns shown', () =>
            log('version 2', gridInterface.updateColumns(VERSION_2, { showNew: true, width: 120 }))
        );
        ui.button('Back to version 1', () => log('version 1', gridInterface.updateColumns(VERSION_1, { showNew: true })));
        ui.button('Show the saved grid (exportConfig)', () => ui.log(JSON.stringify(gridInterface.exportConfig())));
        let viewsButton = true;
        ui.button('Views button on / off', () => {
            viewsButton = !viewsButton;
            gridInterface.updateConfig({ viewsButton });
            ui.log(`viewsButton: ${viewsButton}`);
        });
        ui.button('Start again', () => {
            gridInterface.importConfig({ version: 2, config: configOfVersion1() });
            ui.log('the grid of version 1 again');
        });
    }
};

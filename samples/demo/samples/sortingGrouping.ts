import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const sortingGrouping: DemoSample = {
    id: 'sorting-grouping',
    title: 'Sorting & grouping',
    group: 'Datasource',
    description:
        'Sorting and grouping live on the datasource. Users can click headers to sort (shift-click for multi sort) and drag columns to the panel to group - the buttons below do the same from code.',
    code: `
// sort by a single column
datasource.sort({ attribute: 'company', ascending: true });

// multi column sort
datasource.sort([
    { attribute: 'country', ascending: true },
    { attribute: 'age', ascending: false }
]);

// group rows (same as dragging a column into the top panel)
datasource.group([{ title: 'Country', attribute: 'country' }]);

// several levels
datasource.group([
    { title: 'Country', attribute: 'country' },
    { title: 'Fruit', attribute: 'favoriteFruit' }
]);

datasource.expandGroup(); // expand all
datasource.collapseGroup(); // collapse all
datasource.removeGroup(); // remove all grouping
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Sort company (asc)', () => {
            datasource.sort({ attribute: 'company', ascending: true });
        });
        ui.button('Sort country + age (desc)', () => {
            datasource.sort([
                { attribute: 'country', ascending: true },
                { attribute: 'age', ascending: false }
            ]);
        });
        ui.button('Group by country', () => {
            datasource.group([{ title: 'Country', attribute: 'country' }]);
        });
        ui.button('Group country + fruit', () => {
            datasource.group([
                { title: 'Country', attribute: 'country' },
                { title: 'Fruit', attribute: 'favoriteFruit' }
            ]);
        });
        ui.button('Expand all', () => {
            datasource.expandGroup();
        });
        ui.button('Collapse all', () => {
            datasource.collapseGroup();
        });
        ui.button('Remove grouping', () => {
            datasource.removeGroup();
        });
    }
};

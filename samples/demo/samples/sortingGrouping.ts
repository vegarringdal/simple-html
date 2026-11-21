import { isGroupRow } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const sortingGrouping: DemoSample = {
    id: 'sorting-grouping',
    title: 'Sorting & grouping',
    group: 'Datasource',
    description:
        'Sorting and grouping live on the datasource. Users can click headers to sort (shift-click for multi sort) and drag columns to the panel to group - the buttons below do the same from code. When grouped, getRows() has a group row in front of each group: isGroupRow() tells it from a data row, getDataRows() leaves the group rows out. From the keyboard Tab stops on the +/- of a group row between the cells, Enter or Space expands or collapses it; Ctrl+End goes to the last data row.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Sort company (asc)', () => {
            datasource.sort({ attribute: 'company', ascending: true });
        });
        ui.button('Add age (desc) to the sort', () => {
            // add a column to the sort there is (what shift-click on a header does)
            datasource.sort({ attribute: 'age', ascending: false }, { add: true });
            ui.log(
                'sorted on ' +
                    datasource
                        .getOrderBy()
                        .map((sort) => sort.attribute)
                        .join(', ')
            );
        });
        ui.button('Sort country + age (desc)', () => {
            datasource.sort([
                { attribute: 'country', ascending: true },
                { attribute: 'age', ascending: false }
            ]);
        });
        ui.button('Group by country', () => {
            // the same as dragging a column into the top panel
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
        ui.button('Log group rows', () => {
            // the displayed rows have a group row in front of each group
            datasource.getRows().forEach((row) => {
                if (isGroupRow(row)) {
                    ui.log(`${row.__groupName}, ${row.__groupTotal} rows`);
                }
            });
            ui.log(`${datasource.getDataRows().length} data rows - getDataRows()`);
        });
        ui.button('Remove grouping', () => {
            datasource.removeGroup();
        });
    }
};

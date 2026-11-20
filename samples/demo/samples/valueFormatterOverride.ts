import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const valueFormatterOverride: DemoSample = {
    id: 'value-formatter',
    title: 'Value formatter override',
    group: 'Formatting',
    description:
        'The datasource routes every cell value through a ValueFormatter. fromSourceDisplay is what normal cells render, while fromSource is used for edit cells and the filter row - so override fromSourceDisplay to change how values are shown without touching what the user edits. Here country displays uppercase, but click into a cell and you edit the real value.',
    code: `
// grab the active formatter and keep the original method
const formatter = datasource.getValueFormatter();
const originalDisplay = formatter.fromSourceDisplay;

// fromSourceDisplay = what normal cells show.
// fromSource = edit/filter value, so editing still shows the real value
formatter.fromSourceDisplay = (value, type, attribute, isFilter) => {
    if (attribute === 'country' && value) {
        return String(value).toUpperCase();
    }
    return originalDisplay.apply(formatter, [value, type, attribute, isFilter]);
};

gridInterface.triggerRebuild();

// restore
formatter.fromSourceDisplay = originalDisplay;
gridInterface.triggerRebuild();

// or implement the full ValueFormatter interface and replace it
// (fromSource/toSource/toFilter/fromSourceDisplay/fromSourceGrouping)
datasource.setValueFormatter(myValueFormatter);
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        const formatter = datasource.getValueFormatter();
        const originalDisplay = formatter.fromSourceDisplay;

        ui.button('Uppercase country (display only)', () => {
            formatter.fromSourceDisplay = (value: any, type: any, attribute: string, isFilter: boolean) => {
                if (attribute === 'country' && value) {
                    return String(value).toUpperCase();
                }
                return originalDisplay.apply(formatter, [value, type, attribute, isFilter]);
            };
            gridInterface.triggerRebuild();
            ui.log('country displays uppercase - click into a cell: you edit the real value');
        });
        ui.button('Restore default', () => {
            formatter.fromSourceDisplay = originalDisplay;
            gridInterface.triggerRebuild();
        });
        ui.button('Log a raw row (console)', () => {
            console.log(datasource.getRow(0));
            ui.log('country in data: ' + (datasource.getRow(0) as any).country);
        });
    }
};

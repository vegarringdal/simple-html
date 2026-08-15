import {
    DateFormaterDDMMYYYY,
    DateFormaterYYYYMMDD,
    NumberFormaterComma,
    NumberFormaterDot
} from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const formatters: DemoSample = {
    id: 'formatters',
    title: 'Number & date formaters',
    group: 'Formatting',
    description:
        'The datasource formats number/date cells through pluggable formaters. A few are built in, and you can implement your own by following the same interface. Watch the balance and date columns when you switch.',
    code: `
import {
    NumberFormaterComma, // 1.234,56
    NumberFormaterDot, // 1,234.56 (default)
    DateFormaterDDMMYYYY, // 31.12.2026
    DateFormaterYYYYMMDD // 2026-12-31 (default)
} from '@simple-html/grid';

datasource.setNumberFormater(NumberFormaterComma);
datasource.setDateFormater(DateFormaterDDMMYYYY);

// rebuild cells so the new format shows
gridInterface.triggerRebuild();

// you can also implement your own - see the ValueFormater type,
// and datasource.setValueFormater() for full control of all cell values
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Number: comma (1.234,56)', () => {
            datasource.setNumberFormater(NumberFormaterComma);
            gridInterface.triggerRebuild();
        });
        ui.button('Number: dot (1,234.56)', () => {
            datasource.setNumberFormater(NumberFormaterDot);
            gridInterface.triggerRebuild();
        });
        ui.button('Date: DD.MM.YYYY', () => {
            datasource.setDateFormater(DateFormaterDDMMYYYY);
            gridInterface.triggerRebuild();
        });
        ui.button('Date: YYYY-MM-DD', () => {
            datasource.setDateFormater(DateFormaterYYYYMMDD);
            gridInterface.triggerRebuild();
        });
    }
};

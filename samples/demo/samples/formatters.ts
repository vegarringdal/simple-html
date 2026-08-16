import {
    DateFormaterDDMMYYYY,
    DateFormaterYYYYMMDD,
    NumberFormaterComma,
    NumberFormaterDot
} from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * custom number formater sample: comma decimals + space as thousand separator
 */
class MyNumberFormater {
    static fromSource(value: any): string | null | undefined {
        if (value === null || value === undefined) {
            return value;
        }
        return String(value).replace('.', ',');
    }

    static toSource(value: any): number | null | undefined {
        const parsed = parseFloat(String(value).replace(',', '.'));
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    static toFilter(value: any): number | null | undefined {
        return MyNumberFormater.toSource(value);
    }

    static fromSourceDisplay(value: any): string | null | undefined {
        const parsed = parseFloat(value);
        if (Number.isNaN(parsed)) {
            return '';
        }
        return parsed.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    static fromSourceGrouping(value: any): string | null | undefined {
        return MyNumberFormater.fromSourceDisplay(value);
    }

    static placeholder() {
        return '';
    }
}

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

// or implement your own (static class with these methods):
class MyNumberFormater {
    static fromSource(value) {
        // source value -> string shown in edit/filter inputs
        return value === null || value === undefined ? value : String(value).replace('.', ',');
    }
    static toSource(value) {
        // user typed string -> source value
        const parsed = parseFloat(String(value).replace(',', '.'));
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    static toFilter(value) {
        return MyNumberFormater.toSource(value);
    }
    static fromSourceDisplay(value) {
        // source value -> string shown in normal cells
        const parsed = parseFloat(value);
        if (Number.isNaN(parsed)) {
            return '';
        }
        // 12345.6 -> 12 345,60
        return parsed.toFixed(2).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ');
    }
    static fromSourceGrouping(value) {
        return MyNumberFormater.fromSourceDisplay(value);
    }
    static placeholder() {
        return '';
    }
}
datasource.setNumberFormater(MyNumberFormater);

// datasource.setValueFormater() gives full control of ALL cell values
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
        ui.button('Number: custom (12 345,60)', () => {
            datasource.setNumberFormater(MyNumberFormater);
            gridInterface.triggerRebuild();
        });
    }
};

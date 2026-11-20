import { DateFormatterDDMMYYYY, DateFormatterYYYYMMDD, NumberFormatterComma, NumberFormatterDot } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * custom number formatter sample: comma decimals + space as thousand separator
 */
class MyNumberFormatter {
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
        return MyNumberFormatter.toSource(value);
    }

    static fromSourceDisplay(value: any): string | null | undefined {
        const parsed = parseFloat(value);
        if (Number.isNaN(parsed)) {
            return '';
        }
        return parsed
            .toFixed(2)
            .replace('.', ',')
            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    static fromSourceGrouping(value: any): string | null | undefined {
        return MyNumberFormatter.fromSourceDisplay(value);
    }

    static placeholder() {
        return '';
    }
}

export const formatters: DemoSample = {
    id: 'formatters',
    title: 'Number & date formatters',
    group: 'Formatting',
    description:
        'The datasource formats number/date cells through pluggable formatters. A few are built in, and you can implement your own by following the same interface. Watch the balance and date columns when you switch.',
    code: `
import {
    NumberFormatterComma, // 1.234,56
    NumberFormatterDot, // 1,234.56 (default)
    DateFormatterDDMMYYYY, // 31.12.2026
    DateFormatterYYYYMMDD // 2026-12-31 (default)
} from '@simple-html/grid';

datasource.setNumberFormatter(NumberFormatterComma);
datasource.setDateFormatter(DateFormatterDDMMYYYY);

// rebuild cells so the new format shows
gridInterface.triggerRebuild();

// or implement your own (static class with these methods):
class MyNumberFormatter {
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
        return MyNumberFormatter.toSource(value);
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
        return MyNumberFormatter.fromSourceDisplay(value);
    }
    static placeholder() {
        return '';
    }
}
datasource.setNumberFormatter(MyNumberFormatter);

// datasource.setValueFormatter() gives full control of ALL cell values
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('Number: comma (1.234,56)', () => {
            datasource.setNumberFormatter(NumberFormatterComma);
            gridInterface.triggerRebuild();
        });
        ui.button('Number: dot (1,234.56)', () => {
            datasource.setNumberFormatter(NumberFormatterDot);
            gridInterface.triggerRebuild();
        });
        ui.button('Date: DD.MM.YYYY', () => {
            datasource.setDateFormatter(DateFormatterDDMMYYYY);
            gridInterface.triggerRebuild();
        });
        ui.button('Date: YYYY-MM-DD', () => {
            datasource.setDateFormatter(DateFormatterYYYYMMDD);
            gridInterface.triggerRebuild();
        });
        ui.button('Number: custom (12 345,60)', () => {
            datasource.setNumberFormatter(MyNumberFormatter);
            gridInterface.triggerRebuild();
        });
    }
};

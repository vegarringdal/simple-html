import type { Datasource } from './dataSource';
import type { DataTypes } from './filterArgument';
import type { ValueFormatter } from './valueFormatter';

/**
 * default dateformatter - YYYY-MM-DD
 */
export class DefaultValueFormatter implements ValueFormatter {
    public datasource: Datasource;

    constructor(datasource: Datasource) {
        this.datasource = datasource;
    }

    /**
     * Takes value and return string
     * @param value
     */
    fromSource(value: any, type: DataTypes, _attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormatter().fromSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormatter().fromSource(value);
        }
        if (type === 'boolean') {
            return value || false;
        }

        return value || '';
    }

    /**
     * will to use when setting to source
     * @param value Takes string and returns date
     */
    toSource(value: any, type: DataTypes, _attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormatter().toSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormatter().toSource(value);
        }
        if (type === 'boolean') {
            return value || false;
        }

        return value;
    }

    /**
     * will be used in filters, you might want other logic here
     * @param value
     * @param type
     * @param attribute
     * @returns
     */
    toFilter(value: any, type: DataTypes, _attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormatter().toFilter(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormatter().toFilter(value);
        }
        if (type === 'boolean') {
            return value || false;
        }

        return value;
    }

    fromSourceDisplay(value: any, type: DataTypes, attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormatter().fromSourceDisplay(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormatter().fromSourceDisplay(value);
        }

        return this.fromSource(value, type, attribute);
    }

    fromSourceGrouping(value: any, type: DataTypes, attribute: string): any {
        return this.fromSourceDisplay(value, type, attribute);
    }

    /**
     * answered from the current date formatter. A date formatter without `includesTime` counts as
     * including time, so date filters keep comparing with time
     */
    dateIncludesTime(_attribute: string): boolean {
        return this.datasource.getDateFormatter().includesTime !== false;
    }

    placeholder(type: DataTypes, _attribute: string) {
        if (type === 'date') {
            return this.datasource.getDateFormatter().placeholder();
        }
        if (type === 'number') {
            return this.datasource.getNumberFormatter().placeholder();
        }

        return '';
    }
}

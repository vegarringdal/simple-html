import { Datasource } from './dataSource';
import { DataTypes } from './filterArgument';
import { ValueFormater } from './valueFormater';

/**
 * default dateformater - YYYY-MM-DD
 */
export class DefaultValueFormater implements ValueFormater {
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
            return this.datasource.getDateFormater().fromSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().fromSource(value);
        }
        if (type === 'boolean') {
            return  value || false
        }

        return value;
    }

    /**
     *
     * @param value Takes string and returns date
     */
    toSource(value: any, type: DataTypes, _attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormater().toSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().toSource(value);
        }
        if (type === 'boolean') {
            return  value || false
        }

        return value;
    }

    fromSourceDisplay(value: any, type: DataTypes, attribute: string): any {
        if (type === 'date') {
            return this.datasource.getDateFormater().fromSourceDisplay(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().fromSourceDisplay(value);
        }

        return this.fromSource(value, type, attribute);
    }

    placeholder(type: DataTypes, _attribute: string) {
        if (type === 'date') {
            return this.datasource.getDateFormater().placeholder();
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().placeholder();
        }


        return '';
    }
}

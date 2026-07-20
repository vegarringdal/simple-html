/**
 * default dateformater - YYYY-MM-DD
 */
export class DefaultValueFormater {
    datasource;
    constructor(datasource) {
        this.datasource = datasource;
    }
    /**
     * Takes value and return string
     * @param value
     */
    fromSource(value, type, _attribute) {
        if (type === 'date') {
            return this.datasource.getDateFormater().fromSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().fromSource(value);
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
    toSource(value, type, _attribute) {
        if (type === 'date') {
            return this.datasource.getDateFormater().toSource(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().toSource(value);
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
    toFilter(value, type, _attribute) {
        if (type === 'date') {
            return this.datasource.getDateFormater().toFilter(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().toFilter(value);
        }
        if (type === 'boolean') {
            return value || false;
        }
        return value;
    }
    fromSourceDisplay(value, type, attribute) {
        if (type === 'date') {
            return this.datasource.getDateFormater().fromSourceDisplay(value);
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().fromSourceDisplay(value);
        }
        return this.fromSource(value, type, attribute);
    }
    fromSourceGrouping(value, type, attribute) {
        return this.fromSourceDisplay(value, type, attribute);
    }
    placeholder(type, _attribute) {
        if (type === 'date') {
            return this.datasource.getDateFormater().placeholder();
        }
        if (type === 'number') {
            return this.datasource.getNumberFormater().placeholder();
        }
        return '';
    }
}
//# sourceMappingURL=defaultValueFormater.js.map
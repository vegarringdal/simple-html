import { beforeEach, describe, expect, it } from 'vitest';
import { DateFormatterDDMMYYYY } from '../DateFormatterDDMMYYYY';
import { Datasource } from '../dataSource';
import { DefaultValueFormatter } from '../defaultValueFormatter';
import { NumberFormatterComma } from '../numberFormatterComma';

let datasource: Datasource;
let formatter: DefaultValueFormatter;

describe('DefaultValueFormatter.fromSource', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formatter = new DefaultValueFormatter(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formatter.fromSource('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be empty string', () => {
        expect(formatter.fromSource(null, 'text', 'name')).toEqual('');
    });

    it('expect undefined text value to be empty string', () => {
        expect(formatter.fromSource(undefined, 'text', 'name')).toEqual('');
    });

    it('expect true boolean value to be true', () => {
        expect(formatter.fromSource(true, 'boolean', 'active')).toEqual(true);
    });

    it('expect null boolean value to be false', () => {
        expect(formatter.fromSource(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date value to use the datasource date formatter', () => {
        expect(formatter.fromSource(new Date(2019, 0, 5), 'date', 'created')).toEqual('2019-01-05');
    });

    it('expect date value to use a replaced date formatter', () => {
        datasource.setDateFormatter(DateFormatterDDMMYYYY);
        expect(formatter.fromSource(new Date(2019, 0, 5), 'date', 'created')).toEqual('05.01.2019');
    });

    it('expect number value to use the datasource number formatter', () => {
        expect(formatter.fromSource(12.5, 'number', 'amount')).toEqual('12.5');
    });

    it('expect number value to use a replaced number formatter', () => {
        datasource.setNumberFormatter(NumberFormatterComma);
        expect(formatter.fromSource(12.5, 'number', 'amount')).toEqual('12,5');
    });
});

describe('DefaultValueFormatter.toSource', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formatter = new DefaultValueFormatter(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formatter.toSource('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be null', () => {
        expect(formatter.toSource(null, 'text', 'name')).toEqual(null);
    });

    it('expect false boolean value to be false', () => {
        expect(formatter.toSource(false, 'boolean', 'active')).toEqual(false);
    });

    it('expect null boolean value to be false', () => {
        expect(formatter.toSource(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date string to use the datasource date formatter', () => {
        const result = formatter.toSource('2019-01-05', 'date', 'created') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(0);
        expect(result.getDate()).toEqual(5);
    });

    it('expect number string to use the datasource number formatter', () => {
        expect(formatter.toSource('12,5', 'number', 'amount')).toEqual(12.5);
    });

    it('expect null number to be null', () => {
        expect(formatter.toSource(null, 'number', 'amount')).toEqual(null);
    });
});

describe('DefaultValueFormatter.toFilter', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formatter = new DefaultValueFormatter(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formatter.toFilter('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be null', () => {
        expect(formatter.toFilter(null, 'text', 'name')).toEqual(null);
    });

    it('expect null boolean value to be false', () => {
        expect(formatter.toFilter(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date string to be local midnight', () => {
        expect(formatter.toFilter('2019-01-05', 'date', 'created')).toEqual(new Date(2019, 0, 5, 0, 0, 0, 0));
    });

    it('expect number string to be a number', () => {
        expect(formatter.toFilter('12,5', 'number', 'amount')).toEqual(12.5);
    });
});

describe('DefaultValueFormatter.fromSourceDisplay and fromSourceGrouping', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formatter = new DefaultValueFormatter(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formatter.fromSourceDisplay('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be empty string', () => {
        expect(formatter.fromSourceDisplay(null, 'text', 'name')).toEqual('');
    });

    it('expect null boolean value to be false', () => {
        expect(formatter.fromSourceDisplay(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date value to be formated', () => {
        expect(formatter.fromSourceDisplay(new Date(2019, 0, 5), 'date', 'created')).toEqual('2019-01-05');
    });

    it('expect number value to be formated', () => {
        expect(formatter.fromSourceDisplay(12.5, 'number', 'amount')).toEqual('12.5');
    });

    it('expect fromSourceGrouping to be same as fromSourceDisplay', () => {
        expect(formatter.fromSourceGrouping(new Date(2019, 0, 5), 'date', 'created')).toEqual(
            formatter.fromSourceDisplay(new Date(2019, 0, 5), 'date', 'created')
        );
    });

    it('expect fromSourceGrouping of number to be formated', () => {
        expect(formatter.fromSourceGrouping(12.5, 'number', 'amount')).toEqual('12.5');
    });
});

describe('DefaultValueFormatter.placeholder', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formatter = new DefaultValueFormatter(datasource);
    });

    it('expect date placeholder to be YYYY-MM-DD', () => {
        expect(formatter.placeholder('date', 'created')).toEqual('YYYY-MM-DD');
    });

    it('expect number placeholder to be empty string', () => {
        expect(formatter.placeholder('number', 'amount')).toEqual('');
    });

    it('expect text placeholder to be empty string', () => {
        expect(formatter.placeholder('text', 'name')).toEqual('');
    });

    it('expect boolean placeholder to be empty string', () => {
        expect(formatter.placeholder('boolean', 'active')).toEqual('');
    });

    it('expect date placeholder to follow a replaced date formatter', () => {
        datasource.setDateFormatter(DateFormatterDDMMYYYY);
        expect(formatter.placeholder('date', 'created')).toEqual('DD.MM.YYYY');
    });

    it('expect the datasource to expose the same value formatter type by default', () => {
        expect(datasource.getValueFormatter() instanceof DefaultValueFormatter).toEqual(true);
    });
});

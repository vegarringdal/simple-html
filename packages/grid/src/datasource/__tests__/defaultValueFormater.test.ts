import { beforeEach, describe, expect, it } from 'vitest';
import { DateFormaterDDMMYYYY } from '../DateFormaterDDMMYYYY';
import { Datasource } from '../dataSource';
import { DefaultValueFormater } from '../defaultValueFormater';
import { NumberFormaterComma } from '../numberFormaterComma';

let datasource: Datasource;
let formater: DefaultValueFormater;

describe('DefaultValueFormater.fromSource', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formater = new DefaultValueFormater(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formater.fromSource('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be empty string', () => {
        expect(formater.fromSource(null, 'text', 'name')).toEqual('');
    });

    it('expect undefined text value to be empty string', () => {
        expect(formater.fromSource(undefined, 'text', 'name')).toEqual('');
    });

    it('expect true boolean value to be true', () => {
        expect(formater.fromSource(true, 'boolean', 'active')).toEqual(true);
    });

    it('expect null boolean value to be false', () => {
        expect(formater.fromSource(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date value to use the datasource date formater', () => {
        expect(formater.fromSource(new Date(2019, 0, 5), 'date', 'created')).toEqual('2019-01-05');
    });

    it('expect date value to use a replaced date formater', () => {
        datasource.setDateFormater(DateFormaterDDMMYYYY);
        expect(formater.fromSource(new Date(2019, 0, 5), 'date', 'created')).toEqual('05.01.2019');
    });

    it('expect number value to use the datasource number formater', () => {
        expect(formater.fromSource(12.5, 'number', 'amount')).toEqual('12.5');
    });

    it('expect number value to use a replaced number formater', () => {
        datasource.setNumberFormater(NumberFormaterComma);
        expect(formater.fromSource(12.5, 'number', 'amount')).toEqual('12,5');
    });
});

describe('DefaultValueFormater.toSource', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formater = new DefaultValueFormater(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formater.toSource('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be null', () => {
        expect(formater.toSource(null, 'text', 'name')).toEqual(null);
    });

    it('expect false boolean value to be false', () => {
        expect(formater.toSource(false, 'boolean', 'active')).toEqual(false);
    });

    it('expect null boolean value to be false', () => {
        expect(formater.toSource(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date string to use the datasource date formater', () => {
        const result = formater.toSource('2019-01-05', 'date', 'created') as Date;
        expect(result.getFullYear()).toEqual(2019);
        expect(result.getMonth()).toEqual(0);
        expect(result.getDate()).toEqual(5);
    });

    it('expect number string to use the datasource number formater', () => {
        expect(formater.toSource('12,5', 'number', 'amount')).toEqual(12.5);
    });

    it('expect null number to be null', () => {
        expect(formater.toSource(null, 'number', 'amount')).toEqual(null);
    });
});

describe('DefaultValueFormater.toFilter', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formater = new DefaultValueFormater(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formater.toFilter('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be null', () => {
        expect(formater.toFilter(null, 'text', 'name')).toEqual(null);
    });

    it('expect null boolean value to be false', () => {
        expect(formater.toFilter(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date string to be local midnight', () => {
        expect(formater.toFilter('2019-01-05', 'date', 'created')).toEqual(new Date(2019, 0, 5, 0, 0, 0, 0));
    });

    it('expect number string to be a number', () => {
        expect(formater.toFilter('12,5', 'number', 'amount')).toEqual(12.5);
    });
});

describe('DefaultValueFormater.fromSourceDisplay and fromSourceGrouping', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formater = new DefaultValueFormater(datasource);
    });

    it('expect text value to be returned as is', () => {
        expect(formater.fromSourceDisplay('hello', 'text', 'name')).toEqual('hello');
    });

    it('expect null text value to be empty string', () => {
        expect(formater.fromSourceDisplay(null, 'text', 'name')).toEqual('');
    });

    it('expect null boolean value to be false', () => {
        expect(formater.fromSourceDisplay(null, 'boolean', 'active')).toEqual(false);
    });

    it('expect date value to be formated', () => {
        expect(formater.fromSourceDisplay(new Date(2019, 0, 5), 'date', 'created')).toEqual('2019-01-05');
    });

    it('expect number value to be formated', () => {
        expect(formater.fromSourceDisplay(12.5, 'number', 'amount')).toEqual('12.5');
    });

    it('expect fromSourceGrouping to be same as fromSourceDisplay', () => {
        expect(formater.fromSourceGrouping(new Date(2019, 0, 5), 'date', 'created')).toEqual(
            formater.fromSourceDisplay(new Date(2019, 0, 5), 'date', 'created')
        );
    });

    it('expect fromSourceGrouping of number to be formated', () => {
        expect(formater.fromSourceGrouping(12.5, 'number', 'amount')).toEqual('12.5');
    });
});

describe('DefaultValueFormater.placeholder', () => {
    beforeEach(() => {
        datasource = new Datasource();
        formater = new DefaultValueFormater(datasource);
    });

    it('expect date placeholder to be YYYY-MM-DD', () => {
        expect(formater.placeholder('date', 'created')).toEqual('YYYY-MM-DD');
    });

    it('expect number placeholder to be empty string', () => {
        expect(formater.placeholder('number', 'amount')).toEqual('');
    });

    it('expect text placeholder to be empty string', () => {
        expect(formater.placeholder('text', 'name')).toEqual('');
    });

    it('expect boolean placeholder to be empty string', () => {
        expect(formater.placeholder('boolean', 'active')).toEqual('');
    });

    it('expect date placeholder to follow a replaced date formater', () => {
        datasource.setDateFormater(DateFormaterDDMMYYYY);
        expect(formater.placeholder('date', 'created')).toEqual('DD.MM.YYYY');
    });

    it('expect the datasource to expose the same value formater type by default', () => {
        expect(datasource.getValueFormater() instanceof DefaultValueFormater).toEqual(true);
    });
});

import { afterEach, describe, expect, it } from 'vitest';
import { setTexts } from '../../texts';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';
import { and, or, where } from '../filterExpression';
import { registerValidator } from '../validatorRegistry';

/**
 * The texts the datasource makes - the validation messages, getFilterString() and the name of the
 * group of blank values - come from setTexts() and the defaults: the datasource has no grid.
 *
 * The validator registry is one for the page: the validators here have ids of their own (`texts.*`).
 */

// setTexts() is one for the page: back to the defaults, so no other test sees these
afterEach(() => {
    setTexts({});
});

// one row edited to `value` in `field`, its messages
function messagesAfterEdit(datasource: Datasource, field: string, value: unknown): string[] {
    datasource.setData([{ id: 1, name: 'a', age: 30 }]);
    const row = datasource.getDataRows()[0];
    row[field] = value;
    return datasource.getErrors(row).flatMap((error) => error.messages);
}

describe('datasource texts - validation messages', () => {
    it("expect a built-in's message to be the page's text, with the rule's value", () => {
        setTexts({ 'validation.required': 'Må fylles ut', 'validation.max': 'Høyst {value}' });
        const datasource = new Datasource({
            key: 'id',
            fields: { name: { validate: ['required'] }, age: { type: 'number', validate: [{ id: 'max', value: 50 }] } }
        });

        expect(messagesAfterEdit(datasource, 'name', '')).toEqual(['Må fylles ut']);
        expect(messagesAfterEdit(datasource, 'age', 60)).toEqual(['Høyst 50']);
    });

    it('expect a text id of your own from a validator to get its text from setTexts()', () => {
        registerValidator('texts.eight', (value) =>
            typeof value === 'string' && value.length !== 8 ? 'texts.eightDigits' : null
        );
        const datasource = new Datasource({ key: 'id', fields: { name: { validate: ['texts.eight'] } } });

        // no text yet: the id is the message
        expect(messagesAfterEdit(datasource, 'name', '12')).toEqual(['texts.eightDigits']);

        setTexts({ 'texts.eightDigits': 'Må være 8 siffer' });
        expect(messagesAfterEdit(datasource, 'name', '12')).toEqual(['Må være 8 siffer']);
    });

    it("expect a rule's message to be a text id too, with the rule's options", () => {
        setTexts({ 'texts.tooOld': 'For gammel, høyst {value}' });
        const datasource = new Datasource({
            key: 'id',
            fields: { age: { type: 'number', validate: [{ id: 'max', value: 50, message: 'texts.tooOld' }] } }
        });

        expect(messagesAfterEdit(datasource, 'age', 60)).toEqual(['For gammel, høyst 50']);
    });

    it('expect a message to keep its text until the field is validated again', () => {
        const datasource = new Datasource({ key: 'id', fields: { name: { validate: ['required'] } } });
        datasource.setData([{ id: 1, name: '' }]);
        expect(datasource.validate()[0].messages).toEqual(['Required']);

        setTexts({ 'validation.required': 'Må fylles ut' });
        // made when it was validated
        expect(datasource.getErrors()[0].messages).toEqual(['Required']);
        expect(datasource.validate()[0].messages).toEqual(['Må fylles ut']);
    });
});

describe('datasource texts - getFilterString()', () => {
    const datasource = () => {
        const people = new Datasource({ fields: { age: 'number' } });
        people.setFilter(and(where('name', 'EQUAL', 'x'), or(where('age', 'LESS_THAN', 20), where('name', 'IS_BLANK'))));
        return people;
    };

    it('expect the same string as before with the default texts', () => {
        expect(datasource().getFilterString()).toEqual(
            "([NAME] <<EQUAL_TO>> 'X' AND ([AGE] <<LESS_THAN>> '20' OR [NAME] <<IS_BLANK>>))"
        );
    });

    it("expect the operators and AND / OR to be the page's texts, upper cased", () => {
        setTexts({
            'filterString.operator.EQUAL': 'lik',
            'filterString.operator.LESS_THAN': 'mindre_enn',
            'filterString.operator.IS_BLANK': 'er_tom',
            'filterString.and': 'og',
            'filterString.or': 'eller'
        });
        expect(datasource().getFilterString()).toEqual(
            "([NAME] <<LIK>> 'X' OG ([AGE] <<MINDRE_ENN>> '20' ELLER [NAME] <<ER_TOM>>))"
        );
    });

    it('expect an operator of plain js that is not one to be shown as it is', () => {
        const people = new Datasource();
        // a filter from JSON can have any operator
        people.setFilter(where('name', JSON.parse('"SOUNDS_LIKE"'), 'x'));
        expect(people.getFilterString()).toEqual("([NAME] <<SOUNDS_LIKE>> 'X')");
    });
});

describe('datasource texts - the group of blank values', () => {
    const groupNames = (datasource: Datasource) =>
        datasource
            .getRows()
            .filter(isGroupRow)
            .map((row) => [row.__groupID, row.__groupName]);

    it("expect its name to show the text grouping.blank, its id to stay ' blank'", () => {
        const datasource = new Datasource();
        datasource.setData([{ country: 'Norway' }, { country: null }]);

        datasource.group([{ attribute: 'country', title: 'Country' }]);
        expect(groupNames(datasource)).toEqual([
            [' blank', 'Country: blank'],
            ['Norway', 'Country: Norway']
        ]);

        setTexts({ 'grouping.blank': '(tom)' });
        // made when the rows are grouped
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        expect(groupNames(datasource)).toEqual([
            [' blank', 'Country: (tom)'],
            ['Norway', 'Country: Norway']
        ]);
    });
});

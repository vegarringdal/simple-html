import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, type FilterCondition, type FilterExpression, or, where } from '../filterExpression';

/**
 * The v6 filter format: a FilterExpression is a FilterGroup ({ group, children }) or a
 * FilterCondition ({ field, operator, value?, valueField? }). The condition has no type, the
 * datasource reads it from its fields.
 */

const rows = () => [
    { name: 'a', age: 9, min: 5, born: new Date(2020, 0, 1) },
    { name: 'b', age: 20, min: 30, born: new Date(2021, 0, 1) },
    { name: 'c', age: 100, min: 50, born: null }
];

const build = (filter?: FilterExpression | null) => {
    const ds = new Datasource({ fields: { age: { type: 'number', label: 'Age' }, min: 'number', born: 'date' } });
    ds.setData(rows());
    if (filter !== undefined) {
        ds.filter(filter);
    }
    return ds;
};

const names = (ds: Datasource) => ds.getDataRows().map((row) => row.name);

describe('builders', () => {
    it('expect where to build a condition', () => {
        expect(where('age', 'GREATER_THAN', 18)).toEqual({ field: 'age', operator: 'GREATER_THAN', value: 18 });
    });

    it('expect where without a value to leave the value property out', () => {
        const condition = where('email', 'IS_BLANK');
        expect(condition).toEqual({ field: 'email', operator: 'IS_BLANK' });
        expect('value' in condition).toEqual(false);
    });

    it('expect where to keep a null value, it is a value', () => {
        expect('value' in where('born', 'EQUAL', null)).toEqual(true);
    });

    it('expect and/or to build groups of their arguments, in order', () => {
        const a = where('a', 'EQUAL', 1);
        const b = where('b', 'EQUAL', 2);
        expect(and(a, b)).toEqual({ group: 'AND', children: [a, b] });
        expect(or(a, and(b))).toEqual({ group: 'OR', children: [a, { group: 'AND', children: [b] }] });
    });

    it('expect and/or without arguments to be an empty group', () => {
        expect(and()).toEqual({ group: 'AND', children: [] });
        expect(or()).toEqual({ group: 'OR', children: [] });
    });

    it('expect the builders to give the same filter as the objects written out', () => {
        const written: FilterExpression = {
            group: 'AND',
            children: [
                { field: 'age', operator: 'GREATER_THAN', value: 10 },
                {
                    group: 'OR',
                    children: [
                        { field: 'name', operator: 'EQUAL', value: 'b' },
                        { field: 'name', operator: 'EQUAL', value: 'c' }
                    ]
                }
            ]
        };
        const built = and(where('age', 'GREATER_THAN', 10), or(where('name', 'EQUAL', 'b'), where('name', 'EQUAL', 'c')));
        expect(built).toEqual(written);
        expect(names(build(built))).toEqual(names(build(written)));
        expect(names(build(built))).toEqual(['b', 'c']);
    });
});

describe('filter(), setFilter() and getFilter()', () => {
    it('expect getFilter to return the filter that was given, a root condition as it is', () => {
        const condition = where('age', 'GREATER_THAN', 10);
        const ds = build(condition);
        expect(ds.getFilter()).toBe(condition);
    });

    it('expect filter(null) to remove the filter', () => {
        const ds = build(where('age', 'GREATER_THAN', 10));
        ds.filter(null);
        expect(ds.getFilter()).toEqual(null);
        expect(names(ds)).toEqual(['a', 'b', 'c']);
    });

    it('expect filter() to run the current filter again', () => {
        const ds = build(where('age', 'GREATER_THAN', 10));
        // refilter: false, so the filter has not run on these rows
        ds.setData([...rows(), { name: 'd', age: 50, min: 0, born: null }], { refilter: false });
        expect(names(ds)).toEqual(['a', 'b', 'c', 'd']);

        ds.filter();

        expect(names(ds)).toEqual(['b', 'c', 'd']);
    });

    it('expect setFilter to set the filter without running it', () => {
        const ds = build();
        ds.setFilter(where('age', 'GREATER_THAN', 10));
        expect(names(ds)).toEqual(['a', 'b', 'c']);
        ds.filter();
        expect(names(ds)).toEqual(['b', 'c']);
    });

    it('expect an empty group to filter nothing out', () => {
        expect(names(build(and()))).toEqual(['a', 'b', 'c']);
        expect(names(build(or()))).toEqual(['a', 'b', 'c']);
    });
});

describe('a single condition at the root', () => {
    it('expect it to filter', () => {
        expect(names(build(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20)))).toEqual(['b', 'c']);
    });

    /**
     * v5 wrapped a condition passed to filter() in a group, but one set with setFilter() was ignored
     * by getFilterString() and getFilterTree(): they returned '' and null
     */
    it('expect getFilterString to show it, in parentheses like a group of one', () => {
        const ds = build();
        ds.setFilter(where('age', 'GREATER_THAN', 10));
        ds.filter();
        expect(ds.getFilterString()).toEqual("([AGE] <<GREATER_THAN>> '10')");
    });

    it('expect getFilterTree to put it in an AND group', () => {
        const ds = build();
        ds.setFilter(where('age', 'GREATER_THAN', 10));
        ds.filter();
        expect(ds.getFilterTree()).toEqual({
            kind: 'group',
            logicalOperator: 'AND',
            children: [{ kind: 'condition', label: 'Age', operator: 'GREATER_THAN', value: '10', hasValue: true }]
        });
    });
});

describe('valueField - compare with another field of the row', () => {
    it('expect the row value of valueField to be compared with', () => {
        expect(names(build({ field: 'age', operator: 'GREATER_THAN', valueField: 'min' }))).toEqual(['a', 'c']);
        expect(names(build({ field: 'age', operator: 'LESS_THAN', valueField: 'min' }))).toEqual(['b']);
    });

    it('expect valueField to win over value', () => {
        const ds = build({ field: 'age', operator: 'GREATER_THAN', value: 1000, valueField: 'min' });
        expect(names(ds)).toEqual(['a', 'c']);
    });

    it('expect the filter string and tree to show the other field by its label', () => {
        const ds = build({ field: 'min', operator: 'LESS_THAN', valueField: 'age' });
        expect(ds.getFilterString()).toEqual('([MIN] <<LESS_THAN>> [AGE])');
        expect(ds.getFilterTree()?.children[0]).toEqual({
            kind: 'condition',
            label: 'min',
            operator: 'LESS_THAN',
            value: '[Age]',
            hasValue: true
        });
    });

    it('expect a date valueField condition not to be ignored, its value is in the row', () => {
        const ds = new Datasource({ fields: { start: 'date', end: 'date' } });
        ds.setData([
            { n: 'in order', start: new Date(2020, 0, 1), end: new Date(2020, 0, 2) },
            { n: 'reversed', start: new Date(2020, 0, 3), end: new Date(2020, 0, 2) }
        ]);
        ds.filter({ field: 'start', operator: 'LESS_THAN', valueField: 'end' });
        expect(ds.getDataRows().map((row) => row.n)).toEqual(['in order']);
    });
});

describe('the type comes from the fields', () => {
    const numbersAsText = (fields: Record<string, 'number'>) => {
        const ds = new Datasource({ fields });
        ds.setData([{ n: 9 }, { n: 20 }, { n: 100 }]);
        // a text value, as typed: only the field type can make it a number
        ds.filter(where('n', 'GREATER_THAN', '10'));
        return ds.getDataRows().map((row) => row.n);
    };

    it('expect a number field to compare a text value as a number', () => {
        expect(numbersAsText({ n: 'number' })).toEqual([20, 100]);
    });

    it('expect a field that is not listed to be text, compared as text', () => {
        // '9' > '10' as text
        expect(numbersAsText({})).toEqual([9, 20, 100]);
    });

    it('expect a date field to ignore the time, a datetime field not', () => {
        const at = (type: 'date' | 'datetime') => {
            const ds = new Datasource({ fields: { d: type } });
            ds.setData([{ d: new Date(2020, 0, 1, 15, 0) }]);
            ds.filter(where('d', 'EQUAL', new Date(2020, 0, 1)));
            return ds.getDataRows().length;
        };
        expect(at('date')).toEqual(1);
        expect(at('datetime')).toEqual(0);
    });
});

describe('incomplete conditions are ignored', () => {
    // plain js and the filter editor's drafts can leave anything out, hence the casts
    const incomplete = [
        {} as FilterCondition,
        { field: 'age' } as FilterCondition,
        { operator: 'EQUAL', value: 'a' } as FilterCondition,
        // a date condition needs a value
        where('born', 'GREATER_THAN', null),
        where('born', 'EQUAL', '')
    ];

    for (const condition of incomplete) {
        const shown = JSON.stringify(condition);

        it(`expect ${shown} at the root to filter nothing out and show nothing`, () => {
            const ds = build(condition);
            expect(names(ds)).toEqual(['a', 'b', 'c']);
            expect(ds.getFilterString()).toEqual('');
            expect(ds.getFilterTree()).toEqual(null);
        });

        it(`expect ${shown} to be left out of an AND and an OR group`, () => {
            const andDs = build(and(condition, where('name', 'EQUAL', 'b')));
            expect(names(andDs)).toEqual(['b']);
            expect(andDs.getFilterString()).toEqual("([NAME] <<EQUAL_TO>> 'B')");
            expect(andDs.getFilterTree()?.children).toHaveLength(1);

            expect(names(build(or(condition, where('name', 'EQUAL', 'b'))))).toEqual(['b']);
        });
    }

    it('expect a group with only incomplete conditions to show nothing', () => {
        const ds = build(and({} as FilterCondition, or({ field: 'age' } as FilterCondition)));
        expect(names(ds)).toEqual(['a', 'b', 'c']);
        expect(ds.getFilterString()).toEqual('');
        expect(ds.getFilterTree()).toEqual(null);
    });

    it('expect IS_BLANK on a date field to need no value', () => {
        expect(names(build(where('born', 'IS_BLANK')))).toEqual(['c']);
    });
});

describe('0 is blank - kept on purpose, see FilterOperator', () => {
    const quantities = () => {
        const ds = new Datasource({ fields: { qty: 'number' } });
        ds.setData([
            { n: 'zero', qty: 0 },
            { n: 'null', qty: null },
            { n: 'one', qty: 1 }
        ]);
        return ds;
    };
    const filterNames = (ds: Datasource, filter: FilterExpression) => {
        ds.filter(filter);
        return ds.getDataRows().map((row) => row.n);
    };

    it('expect IS_BLANK on a number field to match 0', () => {
        expect(filterNames(quantities(), where('qty', 'IS_BLANK'))).toEqual(['zero', 'null']);
    });

    it('expect IS_NOT_BLANK on a number field to leave 0 out', () => {
        expect(filterNames(quantities(), where('qty', 'IS_NOT_BLANK'))).toEqual(['one']);
    });
});

describe('IN', () => {
    it('expect a list as text to leave the condition as it was given', () => {
        // v5 wrote the value back as an upper case array while filtering
        const condition = where('name', 'IN', 'a\nb');
        const ds = build(condition);
        expect(names(ds)).toEqual(['a', 'b']);
        expect(condition).toEqual({ field: 'name', operator: 'IN', value: 'a\nb' });
    });
});

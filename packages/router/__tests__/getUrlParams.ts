import { getRouteParams } from '../src/getRouteParams';

describe('getRouteParams paths', () => {
    it('home', () => {
        const result = getRouteParams('home', 'home');
        expect(result._paths).toEqual(['home']);
    });

    it('#home', () => {
        const result = getRouteParams('#home', '#home');
        expect(result._paths).toEqual(['#home']);
    });

    it('#home/test1', () => {
        const result = getRouteParams('#home:cool', '#home/test1');
        expect(result._paths).toEqual(['#home', 'test1']);
    });

    it('#home/co:to', () => {
        const result = getRouteParams('', '#home/co:to');
        expect(result._paths).toEqual(['#home', 'co:to']);
    });
});

describe('getRouteParams query', () => {
    it('home?home=1', () => {
        const result = getRouteParams('', 'home?home=1');
        expect(result._query).toEqual({ home: '1' });
    });

    it('home?', () => {
        const result = getRouteParams('', 'home?');
        expect(result._query).toEqual({});
    });

    it('home?home', () => {
        const result = getRouteParams('', 'home?home');
        expect(result._query).toEqual({});
    });

    it('home?home=true', () => {
        const result = getRouteParams('', 'home?home=true');
        expect(result._query).toEqual({ home: 'true' });
    });

    it('home?home=true&wow=1', () => {
        const result = getRouteParams('', '?home=true&wow=1');
        expect(result._query).toEqual({ home: 'true', wow: '1' });
    });
});

describe('getRouteParams query', () => {
    it('cool:wow', () => {
        const result = getRouteParams('home/:var1', 'cool/wow');
        expect(result.var1).toEqual('wow');
    });

    it('home/:var1 with cool/wow = {var1:wow}', () => {
        const result = getRouteParams('home/:var1', 'cool/wow');
        expect(result.var1).toEqual('wow');
    });

    it('home/:var1 with cool/:wow = {var1::wow}', () => {
        const result = getRouteParams('home/:var1', 'cool/:wow');
        expect(result.var1).toEqual(':wow');
    });

    it('home/:var1/ with cool/:wow = {var1::wow}', () => {
        const result = getRouteParams('home/:var1/', 'cool/:wow/');
        expect(result.var1).toEqual(':wow');
    });

    it('home/:var1/:var2 with cool/:wow/99 = {var1:wow}', () => {
        const result = getRouteParams('home/:var1/:var2', 'cool/wow/99');
        expect(result.var1).toEqual('wow');
        expect(result.var2).toEqual('99');
    });
});

describe('full test', () => {
    it('cool:wow', () => {
        const result = getRouteParams('home/:var1', 'cool/wow');
        expect(result).toEqual({ _paths: ['wow'], _query: {}, var1: 'wow' });
    });
    it('cool:wow?test=1', () => {
        const result = getRouteParams('home/:var1', 'cool/wow?test=1');
        expect(result).toEqual({ _paths: ['wow'], _query: { test: '1' }, var1: 'wow' });
    });
});

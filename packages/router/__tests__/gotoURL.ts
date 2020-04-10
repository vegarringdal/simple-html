import { gotoURL } from '../src/gotoURL';

const clearLocationHash = () => {
    (globalThis as any).location = { hash: '' };
};

describe('gotoURL', () => {
    it('#home should be #home', () => {
        clearLocationHash();
        gotoURL('#home');
        expect(globalThis.location.hash).toEqual('#home');
    });

    it('#home/ should be #home', () => {
        clearLocationHash();
        gotoURL('#home/');
        expect(globalThis.location.hash).toEqual('#home');
    });

    it('home adds # is #home', () => {
        clearLocationHash();
        gotoURL('home');
        expect(globalThis.location.hash).toEqual('#home');
    });

    it('home/edit adds # is #home', () => {
        clearLocationHash();
        gotoURL('home/edit');
        expect(globalThis.location.hash).toEqual('#home/edit');
    });

    it('# adds # is #', () => {
        clearLocationHash();
        gotoURL('');
        expect(globalThis.location.hash).toEqual('#');
    });

    it('test with 1 param passed', () => {
        clearLocationHash();
        gotoURL('#home/:param1', { param1: 'whocares' });
        expect(globalThis.location.hash).toEqual('#home/whocares');
    });

    it('test2 with 1 param passed', () => {
        clearLocationHash();
        gotoURL('#:param1', { param1: 'whocares' });
        expect(globalThis.location.hash).toEqual('#whocares');
    });

    it('test with 1 wrong passed', () => {
        clearLocationHash();
        gotoURL('#home/:param1', { params1: 'whocares' });
        expect(globalThis.location.hash).toEqual('#home/:param1');
    });

    it('test with 2 params passed', () => {
        clearLocationHash();
        gotoURL('#home/:param1/:param2', { param1: 'whocares', param2: 'Ido' });
        expect(globalThis.location.hash).toEqual('#home/whocares/Ido');
    });

    it('test with 2 wrong params passed', () => {
        clearLocationHash();
        gotoURL('#home/:param1/:param2', { param21: 'whocares', param22: 'Ido' });
        expect(globalThis.location.hash).toEqual('#home/:param1/:param2');
    });

    it('test with 1 of 2 wrong params passed', () => {
        clearLocationHash();
        gotoURL('#home/:param1/:param2', { param21: 'whocares', param2: 'Ido' });
        expect(globalThis.location.hash).toEqual('#home/:param1/Ido');
    });

    it('test query added', () => {
        clearLocationHash();
        gotoURL('#home', {}, { name: '1' });
        expect(globalThis.location.hash).toEqual('#home?name=1');
    });

    it('test query added and params', () => {
        clearLocationHash();
        gotoURL('#home/:option', { option: 'awsome' }, { name: '1' });
        expect(globalThis.location.hash).toEqual('#home/awsome?name=1');
    });
});

import { routeMatch } from '../src/routeMatch';

const clearLocationHash = (hash = '') => {
    (globalThis as any).location = { hash };
    (globalThis as any).window = { location: { hash } };
};

describe('routeMatch', () => {
    it('#home === #home', () => {
        clearLocationHash('#home');
        expect(routeMatch('#home')).toEqual(true);
    });

    it('#home/something === #home/something', () => {
        clearLocationHash('#home/something');
        expect(routeMatch('#home/something')).toEqual(true);
    });

    it('#home/something/ === #home/something', () => {
        clearLocationHash('#home/something/');
        expect(routeMatch('#home/something')).toEqual(true);
    });

    it('#home/any !== #home/something', () => {
        clearLocationHash('#home/something');
        expect(routeMatch('#home/any')).toEqual(false);
    });

    it('#home/:any === #home/something', () => {
        clearLocationHash('#home/something');
        expect(routeMatch('#home/:any')).toEqual(true);
    });

    it('#home/:any === #home/something', () => {
        clearLocationHash('#home/something?name=1');
        expect(routeMatch('#home/:any')).toEqual(true);
    });

    it('#home/:any* === #home/something/whatever/some', () => {
        clearLocationHash('#home/something/whatever/some');
        expect(routeMatch('#home/:any*')).toEqual(true);
    });

    it('#home/:any !== #home/something/whatever/some', () => {
        clearLocationHash('#home/something/whatever/some');
        expect(routeMatch('#home/:any')).toEqual(false);
    });

    it('#home/:any/whatever === #home/something/whatever', () => {
        clearLocationHash('#home/something/whatever');
        expect(routeMatch('#home/:any/whatever')).toEqual(true);
    });

    it('#home/:any/whatever/ !== #home/something/whatever', () => {
        clearLocationHash('#home/something/whatever');
        expect(routeMatch('#home/:any/whatever/')).toEqual(false);
    });

    it('#home/:any/whatever === #home/something/whatever/', () => {
        clearLocationHash('#home/something/whatever/');
        expect(routeMatch('#home/:any/whatever')).toEqual(true);
    });

    it('#home/any/whatever === #home/any/whatever/', () => {
        clearLocationHash('#home/any/whatever/');
        expect(routeMatch('#home/any/whatever')).toEqual(true);
    });

    it('# === #', () => {
        clearLocationHash('#');
        expect(routeMatch('#')).toEqual(true);
    });

    it(' === #', () => {
        clearLocationHash('#');
        expect(routeMatch('')).toEqual(true);
    });
});

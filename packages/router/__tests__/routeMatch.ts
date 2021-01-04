import { routeMatch } from '../src/routeMatch';
import { gotoURL } from '../src/gotoURL';

describe('routeMatch', () => {
    it('#home === #home', () => {
        gotoURL('#home');
        expect(routeMatch('#home')).toEqual(true);
    });

    it('#home/something === #home/something', () => {
        gotoURL('#home/something');
        expect(routeMatch('#home/something')).toEqual(true);
    });

    it('#home/something/ === #home/something', () => {
        gotoURL('#home/something/');
        expect(routeMatch('#home/something')).toEqual(true);
    });

    it('#home/any !== #home/something', () => {
        gotoURL('#home/something');
        expect(routeMatch('#home/any')).toEqual(false);
    });

    it('#home/:any === #home/something', () => {
        gotoURL('#home/something');
        expect(routeMatch('#home/:any')).toEqual(true);
    });

    it('#home/:any === #home/something', () => {
        gotoURL('#home/something?name=1');
        expect(routeMatch('#home/:any')).toEqual(true);
    });

    it('#home/:any* === #home/something/whatever/some', () => {
        gotoURL('#home/something/whatever/some');
        expect(routeMatch('#home/:any*')).toEqual(true);
    });

    it('#home/:any !== #home/something/whatever/some', () => {
        gotoURL('#home/something/whatever/some');
        expect(routeMatch('#home/:any')).toEqual(false);
    });

    it('#home/:any/whatever === #home/something/whatever', () => {
        gotoURL('#home/something/whatever');
        expect(routeMatch('#home/:any/whatever')).toEqual(true);
    });

    it('#home/:any/whatever/ !== #home/something/whatever', () => {
        gotoURL('#home/something/whatever');
        expect(routeMatch('#home/:any/whatever/')).toEqual(false);
    });

    it('#home/:any/whatever === #home/something/whatever/', () => {
        gotoURL('#home/something/whatever/?ddd');
        expect(routeMatch('#home/:any/whatever')).toEqual(true);
    });

    it('#home/:any/whatever === #home/something/whatever/?test=1', () => {
        gotoURL('#home/something/whatever/?test=1');
        expect(routeMatch('#home/:any/whatever')).toEqual(true);
    });

    it('#home/:any/whatever === #home/something/whatever/?foo=1&bar=2', () => {
        gotoURL('#home/something/awsome/?foo=1&bar=2');
        expect(routeMatch('#home/:any/:whatever')).toEqual(true);
    });

    it('#home/any/whatever === #home/any/whatever/', () => {
        gotoURL('#home/any/whatever/');
        expect(routeMatch('#home/any/whatever')).toEqual(true);
    });

    it('# === ""', () => {
        gotoURL('#');
        expect(routeMatch('')).toEqual(true);
    });

    it(' === #', () => {
        gotoURL('#');
        expect(routeMatch('')).toEqual(true);
    });
});

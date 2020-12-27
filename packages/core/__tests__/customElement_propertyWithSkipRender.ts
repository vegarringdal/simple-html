/* eslint-disable @typescript-eslint/no-unused-vars */
import { property, customElement, requestRender } from '../src';
import { updatedCallback } from '../src/updateCallback';

describe('customElement property decorator with skip render', () => {
    let changedCallbacks: string[][] = [];

    beforeAll((done) => {
        @customElement('app-root1')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        class Ele extends HTMLElement {
            @property({ skipRender: true }) myAtt: string;

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                changedCallbacks.push([type, name, oldValue, newValue]);
            }

            render() {
                return 'current attribute is:' + this.myAtt;
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element" ></app-root1>';
        const ref = document.getElementById('my-element');
        (ref as any).myAtt = 'initvalue';
        requestAnimationFrame(() => {
            done();
        });
    });

    it('see if property have triggered render (should not)', (done) => {
        expect(document.getElementById('my-element').textContent).toEqual(
            'current attribute is:undefined'
        );
        done();
    });

    it('check valuesChangedCallback initial call', (done) => {
        expect(changedCallbacks[0]).toEqual(['property', 'myAtt', undefined, 'initvalue']);
        done();
    });

    describe('---> Edit value', () => {
        beforeAll((done) => {
            changedCallbacks = [];

            // set newvalue so we can also test change trigger
            const ref = document.getElementById('my-element');
            (ref as any).myAtt = 'newValue';

            // giv it chance to update
            requestAnimationFrame(() => {
                done();
            });
        });

        it('see if property have not triggered update', (done) => {
            expect(document.getElementById('my-element').textContent).toEqual(
                'current attribute is:undefined'
            );
            done();
        });

        it('check valuesChangedCallback updated call', (done) => {
            // init set
            expect(changedCallbacks[0]).toEqual(['property', 'myAtt', 'initvalue', 'newValue']);
            done();
        });

        it('trigger update and see new value', (done) => {
            // register updated callback on element
            updatedCallback(document.getElementById('my-element'), () => {
                expect(document.getElementById('my-element').textContent).toEqual(
                    'current attribute is:newValue'
                );
                done();
            });

            // request element to run render
            requestRender(document.getElementById('my-element'));
        });
    });
});

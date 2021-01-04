/* eslint-disable @typescript-eslint/no-unused-vars */
import { property, customElement } from '../src';

describe('customElement property decorator with skip render but initial value', () => {
    let changedCallbacks: string[][] = [];

    beforeAll((done) => {
        @customElement('app-root1')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        class Ele extends HTMLElement {
            @property({ skipRender: false }) myAtt: string = 'something';

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

    it('see if property have triggered render', (done) => {
        expect(document.getElementById('my-element').textContent).toEqual(
            'current attribute is:initvalue'
        );
        done();
    });

    it('check valuesChangedCallback initial call', (done) => {
        expect(changedCallbacks[0]).toEqual(['property', 'myAtt', 'something', 'initvalue']);
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

        it('see if property have triggered update', (done) => {
            expect(document.getElementById('my-element').textContent).toEqual(
                'current attribute is:newValue'
            );
            done();
        });

        it('check valuesChangedCallback updated call', (done) => {
            // init set
            expect(changedCallbacks[0]).toEqual(['property', 'myAtt', 'initvalue', 'newValue']);
            done();
        });
    });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
import { customElement, attribute } from '../src';

describe('customElement attributeChangedCallback native', () => {
    it('standard attibute', (done) => {
        const attributeChangedCallbacks: string[][] = [];
        const valuesChangedCallbacks: string[][] = [];

        @customElement('app-root1')
        class Ele extends HTMLElement {
            static get observedAttributes() {
                return ['my-att'];
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallbacks.push([name, oldValue, newValue]);
            }

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                valuesChangedCallbacks.push([type, name, oldValue, newValue]);
            }

            render() {
                return 'render works';
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element" my-att="initvalue" ></app-root1>';

        requestAnimationFrame(() => {
            expect(document.getElementById('my-element').textContent).toEqual('render works');

            // set newvalue so we can also test change trigger
            document.getElementById('my-element').setAttribute('my-att', 'newvalue');

            requestAnimationFrame(() => {
                // init set
                expect(attributeChangedCallbacks[0]).toEqual(['my-att', null, 'initvalue']);

                // after edit
                expect(attributeChangedCallbacks[1]).toEqual(['my-att', 'initvalue', 'newvalue']);

                // init set
                expect(valuesChangedCallbacks[0]).toEqual([
                    'attribute',
                    'my-att',
                    null,
                    'initvalue'
                ]);

                // after edit
                expect(valuesChangedCallbacks[1]).toEqual([
                    'attribute',
                    'my-att',
                    'initvalue',
                    'newvalue'
                ]);

                done();
            });
        });
    });

    /*******************************************************************************
     * This does the same as above, just simpler and keeps local vaiable in sync
     *********************************************************************************/
    it('custom attributeChangedCallback @attribute', (done) => {
        // simple variable for holding value so we can check in the end
        const attributeChangedCallbacks: string[][] = [];
        const valuesChangedCallbacks: string[][] = [];

        // our element with minimum config
        @customElement('app-root2')
        class Ele extends HTMLElement {
            @attribute() myAtt: string = 'whatever'; // this tracks "my-att"

            constructor() {
                super();
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallbacks.push([name, oldValue, newValue]);
            }

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                valuesChangedCallbacks.push([type, name, oldValue, newValue]);
            }

            render() {
                return 'render works:' + this.myAtt;
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root2 id="my-element" my-att="initvalue" ></app-root2>';

        requestAnimationFrame(() => {
            expect(document.getElementById('my-element').textContent).toEqual(
                'render works:initvalue'
            );

            // set newvalue so we can also test change trigger
            document.getElementById('my-element').setAttribute('my-att', 'newvalue');

            requestAnimationFrame(() => {
                // init set
                expect(attributeChangedCallbacks[0]).toEqual(['my-att', null, 'initvalue']);

                // after edit
                expect(attributeChangedCallbacks[1]).toEqual(['my-att', 'initvalue', 'newvalue']);

                // no init from null to value on props
                expect(valuesChangedCallbacks[0]).toEqual([
                    'property',
                    'myAtt',
                    'whatever',
                    'initvalue'
                ]);
                expect(valuesChangedCallbacks[1]).toEqual([
                    'attribute',
                    'my-att',
                    null,
                    'initvalue'
                ]);

                // after edit
                expect(valuesChangedCallbacks[2]).toEqual([
                    'property',
                    'myAtt',
                    'initvalue',
                    'newvalue'
                ]);
                expect(valuesChangedCallbacks[3]).toEqual([
                    'attribute',
                    'my-att',
                    'initvalue',
                    'newvalue'
                ]);

                done();
            });
        });
    });
});

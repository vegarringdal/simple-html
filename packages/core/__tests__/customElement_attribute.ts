/* eslint-disable @typescript-eslint/no-unused-vars */
import { customElement, attribute } from '../src';

describe('customElement attributeChangedCallback native', () => {
    it('standard attibute', (done) => {
        const attributeChangedCallbacks: string[] = [];
        const valuesChangedCallbacks: string[] = [];

        @customElement('app-root1')
        class Ele extends HTMLElement {
            static get observedAttributes() {
                return ['my-att'];
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallbacks.push(name, oldValue, newValue);
            }

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                valuesChangedCallbacks.push(type, name, oldValue, newValue);
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
                expect(attributeChangedCallbacks[0]).toEqual('my-att');
                expect(attributeChangedCallbacks[1]).toEqual(null);
                expect(attributeChangedCallbacks[2]).toEqual('initvalue');
                // after edit
                expect(attributeChangedCallbacks[3]).toEqual('my-att');
                expect(attributeChangedCallbacks[4]).toEqual('initvalue');
                expect(attributeChangedCallbacks[5]).toEqual('newvalue');

                // init set
                expect(valuesChangedCallbacks[0]).toEqual('attribute');
                expect(valuesChangedCallbacks[1]).toEqual('my-att');
                expect(valuesChangedCallbacks[2]).toEqual(null);
                expect(valuesChangedCallbacks[3]).toEqual('initvalue');
                // after edit
                expect(valuesChangedCallbacks[4]).toEqual('attribute');
                expect(valuesChangedCallbacks[5]).toEqual('my-att');
                expect(valuesChangedCallbacks[6]).toEqual('initvalue');
                expect(valuesChangedCallbacks[7]).toEqual('newvalue');
                done();
            });
        });
    });

    /*******************************************************************************
     * This does the same as above, just simpler and keeps local vaiable in sync
     *********************************************************************************/
    it('custom attributeChangedCallback @attribute', (done) => {
        // simple variable for holding value so we can check in the end
        const attributeChangedCallbacks: string[] = [];
        const valuesChangedCallbacks: string[] = [];

        // our element with minimum config
        @customElement('app-root2')
        class Ele extends HTMLElement {
            @attribute() myAtt: string = 'whatever'; // this tracks "my-att"

            constructor() {
                super();
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallbacks.push(name, oldValue, newValue);
            }

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                valuesChangedCallbacks.push(type, name, oldValue, newValue);
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
                expect(attributeChangedCallbacks[0]).toEqual('my-att');
                expect(attributeChangedCallbacks[1]).toEqual(null);
                expect(attributeChangedCallbacks[2]).toEqual('initvalue');
                // after edit
                expect(attributeChangedCallbacks[3]).toEqual('my-att');
                expect(attributeChangedCallbacks[4]).toEqual('initvalue');
                expect(attributeChangedCallbacks[5]).toEqual('newvalue');

                // no init from null to value on props
                expect(valuesChangedCallbacks[0]).toEqual('property');
                expect(valuesChangedCallbacks[1]).toEqual('myAtt');
                expect(valuesChangedCallbacks[2]).toEqual('whatever');
                expect(valuesChangedCallbacks[3]).toEqual('initvalue');

                expect(valuesChangedCallbacks[4]).toEqual('attribute');
                expect(valuesChangedCallbacks[5]).toEqual('my-att');
                expect(valuesChangedCallbacks[6]).toEqual(null);
                expect(valuesChangedCallbacks[7]).toEqual('initvalue');
                // after edit

                expect(valuesChangedCallbacks[8]).toEqual('property');
                expect(valuesChangedCallbacks[9]).toEqual('myAtt');
                expect(valuesChangedCallbacks[10]).toEqual('initvalue');
                expect(valuesChangedCallbacks[11]).toEqual('newvalue');

                expect(valuesChangedCallbacks[12]).toEqual('attribute');
                expect(valuesChangedCallbacks[13]).toEqual('my-att');
                expect(valuesChangedCallbacks[14]).toEqual('initvalue');
                expect(valuesChangedCallbacks[15]).toEqual('newvalue');
                done();
            });
        });
    });
});

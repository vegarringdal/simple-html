/* eslint-disable @typescript-eslint/no-unused-vars */
import { customElement, attribute } from '../src';

describe('customElement attributeChangedCallback native', () => {
    it('standard attibute', (done) => {
        const attributeChangedCallback: string[] = [];
        const valuesChanged: string[] = [];

        @customElement('app-root1')
        class Ele extends HTMLElement {
            static get observedAttributes() {
                return ['my-att'];
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallback.push(name, oldValue, newValue);
            }

            valuesChanged(type: string, name: string, oldValue: string, newValue: string) {
                valuesChanged.push(type, name, oldValue, newValue);
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
                expect(attributeChangedCallback[0]).toEqual('my-att');
                expect(attributeChangedCallback[1]).toEqual(null);
                expect(attributeChangedCallback[2]).toEqual('initvalue');
                // after edit
                expect(attributeChangedCallback[3]).toEqual('my-att');
                expect(attributeChangedCallback[4]).toEqual('initvalue');
                expect(attributeChangedCallback[5]).toEqual('newvalue');

                // init set
                expect(valuesChanged[0]).toEqual('attribute');
                expect(valuesChanged[1]).toEqual('my-att');
                expect(valuesChanged[2]).toEqual(null);
                expect(valuesChanged[3]).toEqual('initvalue');
                // after edit
                expect(valuesChanged[4]).toEqual('attribute');
                expect(valuesChanged[5]).toEqual('my-att');
                expect(valuesChanged[6]).toEqual('initvalue');
                expect(valuesChanged[7]).toEqual('newvalue');
                done();
            });
        });
    });

    /*******************************************************************************
     * This does the same as above, just simpler and keeps local vaiable in sync
     *********************************************************************************/
    it('custom attributeChangedCallback @attribute', (done) => {
        // simple variable for holding value so we can check in the end
        const attributeChangedCallback: string[] = [];
        const valuesChanged: string[] = [];
        const localVariable: string[] = [];

        // our element with minimum config
        @customElement('app-root2')
        class Ele extends HTMLElement {
            @attribute() myAtt: string = 'whatever'; // this tracks "my-att"

            constructor() {
                super();
                localVariable.push(this.myAtt);
            }

            connectedCallback() {
                localVariable.push(this.myAtt);
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallback.push(name, oldValue, newValue);
            }

            valuesChanged(type: string, name: string, oldValue: string, newValue: string) {
                localVariable.push(this.myAtt);
                valuesChanged.push(type, name, oldValue, newValue);
            }

            render() {
                return 'render works';
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root2 id="my-element" my-att="initvalue" ></app-root2>';

        requestAnimationFrame(() => {
            expect(document.getElementById('my-element').textContent).toEqual('render works');

            // set newvalue so we can also test change trigger
            document.getElementById('my-element').setAttribute('my-att', 'newvalue');

            requestAnimationFrame(() => {
                // init set
                expect(attributeChangedCallback[0]).toEqual('my-att');
                expect(attributeChangedCallback[1]).toEqual(null);
                expect(attributeChangedCallback[2]).toEqual('initvalue');
                // after edit
                expect(attributeChangedCallback[3]).toEqual('my-att');
                expect(attributeChangedCallback[4]).toEqual('initvalue');
                expect(attributeChangedCallback[5]).toEqual('newvalue');

                // init set
                expect(valuesChanged[0]).toEqual('attribute');
                expect(valuesChanged[1]).toEqual('my-att');
                expect(valuesChanged[2]).toEqual(null);
                expect(valuesChanged[3]).toEqual('initvalue');
                // after edit
                expect(valuesChanged[4]).toEqual('attribute');
                expect(valuesChanged[5]).toEqual('my-att');
                expect(valuesChanged[6]).toEqual('initvalue');
                expect(valuesChanged[7]).toEqual('newvalue');

                // out myAtt set by @decorator
                expect(localVariable[0]).toEqual('whatever'); // constructor
                expect(localVariable[1]).toEqual('initvalue'); //connected it set
                expect(localVariable[2]).toEqual('initvalue'); // first trigger to tell us it set
                expect(localVariable[3]).toEqual('newvalue'); // first change

                done();
            });
        });
    });
});

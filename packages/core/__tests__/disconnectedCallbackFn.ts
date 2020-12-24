/* eslint-disable @typescript-eslint/no-unused-vars */
import { customElement, disconnectedCallback } from '../src';

describe('customElement', () => {
    it('disconnectedCallback FN', (done) => {
        const events: string[] = [];

        // our element with minimum config
        @customElement('app-root3')
        class Ele extends HTMLElement {
            data = 'none';

            constructor() {
                super();
                events.push('constructor');
            }

            connectedCallback() {
                this.data = 'connectedCallback';
                events.push('connectedCallback');
            }

            updatedCallback() {
                events.push('updated');
            }

            render() {
                events.push('render');
                return this.data;
            }

            disconnectedCallback() {
                events.push('disconnectedCallback');
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root3 id="my-element"></app-root3>';

        requestAnimationFrame(() => {
            //check render
            expect(document.getElementById('my-element').textContent).toEqual('connectedCallback');
            // wait for updated to get called

            disconnectedCallback(document.getElementById('my-element'), () => {
                events.push('disconnectedCallbackFN');
            });

            requestAnimationFrame(() => {
                //clear content and check lifecycle
                document.body.innerHTML = '';
                requestAnimationFrame(() => {
                    expect(events[0]).toEqual('constructor');
                    expect(events[1]).toEqual('connectedCallback');
                    expect(events[2]).toEqual('render');
                    expect(events[3]).toEqual('updated');
                    expect(events[4]).toEqual('disconnectedCallbackFN');
                    expect(events[5]).toEqual('disconnectedCallback');
                    done();
                });
            });
        });
    });
});

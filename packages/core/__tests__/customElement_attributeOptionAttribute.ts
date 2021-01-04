/* eslint-disable @typescript-eslint/no-unused-vars */
import { attribute, customElement } from '../src';

describe('customElement attribute with render', () => {
    let attributeChangedCallbacks: string[][] = [];

    beforeAll((done) => {
        @customElement('app-root1')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        class Ele extends HTMLElement {
            @attribute({ attribute: 'my-att' }) somethingElse: string;

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                attributeChangedCallbacks.push([name, oldValue, newValue]);
            }

            render() {
                return 'current attribute is:' + this.getAttribute('my-att');
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element" my-att="initvalue" ></app-root1>';
        requestAnimationFrame(() => {
            done();
        });
    });

    it('see if attribute is set before render', (done) => {
        expect(document.getElementById('my-element').textContent).toEqual(
            'current attribute is:initvalue'
        );
        done();
    });

    it('check attributeChangedCallback initial call', (done) => {
        expect(attributeChangedCallbacks[0]).toEqual(['my-att', null, 'initvalue']);
        done();
    });

    it('check property is in sync', (done) => {
        expect((document.getElementById('my-element') as any).somethingElse).toEqual('initvalue');
        done();
    });

    describe('---> Edit value', () => {
        beforeAll((done) => {
            attributeChangedCallbacks = [];

            // set newvalue so we can also test change trigger
            document.getElementById('my-element').setAttribute('my-att', 'newValue');

            // giv it chance to update
            requestAnimationFrame(() => {
                done();
            });
        });

        it('see if attribute have triggered update', (done) => {
            expect(document.getElementById('my-element').textContent).toEqual(
                'current attribute is:newValue'
            );
            done();
        });

        it('check attributeChangedCallback updated call', (done) => {
            // init set
            expect(attributeChangedCallbacks[0]).toEqual(['my-att', 'initvalue', 'newValue']);
            done();
        });

        it('check property is in sync', (done) => {
            expect((document.getElementById('my-element') as any).somethingElse).toEqual(
                'newValue'
            );
            done();
        });
    });
});

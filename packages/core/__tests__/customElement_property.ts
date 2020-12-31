/* eslint-disable @typescript-eslint/no-unused-vars */
import { customElement, property } from '../src';

describe('customElement property', () => {
    it('property desco', (done) => {
        const valuesChanged: string[][] = [];

        @customElement('app-root1')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        class Ele extends HTMLElement {
            @property() myprop = 'initvalue';

            valuesChangedCallback(type: string, name: string, oldValue: string, newValue: string) {
                valuesChanged.push([type, name, oldValue, newValue]);
            }

            render() {
                return 'render works:' + this.myprop;
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element" ></app-root1>';

        requestAnimationFrame(() => {
            const node = document.getElementById('my-element');

            expect(node.textContent).toEqual('render works:initvalue');

            // set newvalue so we can also test change trigger
            (node as any).myprop = 'newvalue';

            setTimeout(() => {
                // requestAnimationFrame(() => {
                expect(node.textContent).toEqual('render works:newvalue');

                expect(valuesChanged[0]).toEqual(['property', 'myprop', 'initvalue', 'newvalue']);

                // trigger again
                (node as any).myprop = 'more';
                expect(valuesChanged[1]).toEqual(['property', 'myprop', 'newvalue', 'more']);

                done();
                //});
            }, 100);
        });
    });
});

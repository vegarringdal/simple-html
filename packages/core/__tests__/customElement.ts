import { customElement } from '../src';
import { promises } from 'dns';

describe('customElement', () => {
    it('renders on connected', (done) => {
        // get decorator function
        const decorator = customElement('app-root1');

        // our element with minimum config
        const Ele = class extends HTMLElement {
            render() {
                return 'render works';
            }
        };

        // trigger decorator
        decorator(Ele);

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element"></app-root1>';

        requestAnimationFrame(() => {
            expect(document.getElementById('my-element').textContent).toEqual('render works');
            done();
        });
    });

    it('renders on connected with promise', (done) => {
        // get decorator function
        const decorator = customElement('app-root2');

        // our element with minimum config
        const Ele = class extends HTMLElement {
            render() {
                return new Promise((r) => {
                    setTimeout(() => {
                        r('promise render works');
                    }, 30);
                });
            }
        };

        // trigger decorator
        decorator(Ele);

        // add custom element
        document.body.innerHTML = '<app-root2 id="my-element"></app-root2>';

        requestAnimationFrame(() => {
            // lets delay our event longer then element
            setTimeout(() => {
                expect(document.getElementById('my-element').textContent).toEqual(
                    'promise render works'
                );
                done();
            }, 50);
        });
    });
});

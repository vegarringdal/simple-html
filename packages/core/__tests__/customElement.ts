import { customElement } from '../src';

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

    it('check main lifecycle', (done) => {
        // get decorator function
        const decorator = customElement('app-root3');

        const events: string[] = [];

        // our element with minimum config
        const Ele = class extends HTMLElement {
            data = 'none';

            constructor() {
                super();
                events.push('constructor');
            }

            connectedCallback() {
                this.data = 'connectedCallback';
                events.push('connectedCallback');
            }

            updated() {
                events.push('updated');
            }

            render() {
                events.push('render');
                return this.data;
            }

            disconnectedCallback() {
                events.push('disconnectedCallback');
            }
        };

        // trigger decorator
        decorator(Ele);

        // add custom element
        document.body.innerHTML = '<app-root3 id="my-element"></app-root3>';

        requestAnimationFrame(() => {
            //check render
            expect(document.getElementById('my-element').textContent).toEqual('connectedCallback');
            // wait for updated to get called
            requestAnimationFrame(() => {
                //clear content and check lifecycle
                document.body.innerHTML = '';
                requestAnimationFrame(() => {
                    expect(events[0]).toEqual('constructor');
                    expect(events[1]).toEqual('connectedCallback');
                    expect(events[2]).toEqual('render');
                    expect(events[3]).toEqual('updated');
                    expect(events[4]).toEqual('disconnectedCallback');
                    done();
                });
            });
        });
    });
});

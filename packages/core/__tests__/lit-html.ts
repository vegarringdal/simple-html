import { customElement } from '../src';

describe('customElement', () => {
    it('renders on connected', (done) => {
        const decorator = customElement('app-root');

        decorator(
            class extends HTMLElement {
                connectedCallback() {
                    this.id = 'cool';
                }
                render() {
                    return 'wow';
                }
            }
        );

        // add custom element
        document.body.innerHTML = '<app-root></app-root>';

        setTimeout(() => {
            expect(document.getElementById('cool').textContent).toEqual('wow');
            done();
        }, 30);
    });
});

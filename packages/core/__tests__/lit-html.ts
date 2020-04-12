import { customElement } from '../src';

describe('html', () => {
    it('#home === #home', (done) => {
        const deco = customElement('app-root');
        deco(
            class extends HTMLElement {
                render() {
                    return 'wow';
                }
            }
        );
        document.body.innerHTML = '<app-root></app-root>';

        setTimeout(() => {
            expect(document.body.innerHTML).toEqual('<app-root><!---->wow<!----></app-root>');
            done();
        }, 30);
    });
});

import { customElement } from '@simple-html/core';

@customElement('free-grid-cell')
export default class extends HTMLElement {
    render() {
        return 'row';
    }
}

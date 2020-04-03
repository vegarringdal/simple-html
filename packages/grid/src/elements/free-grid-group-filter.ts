import { customElement } from '@simple-html/core';

@customElement('free-grid-group-filter')
export default class extends HTMLElement {
    classList: any = 'free-grid-group-filter'

    render() {
        return 'row';
    }
}

import { customElement } from '@simple-html/core';

@customElement('free-grid-group-label')
export default class extends HTMLElement {
    classList: any = 'free-grid-group-label'

    render() {
        return 'row';
    }
}

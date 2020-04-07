import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';

@customElement('free-grid-footer')
export default class extends HTMLElement {
    classList: any = 'free-grid-footer';
    connector: GridInterface;

    connectedCallback() {
        const config = this.connector.config;
        this.style.height = config.footerHeight + 'px';
    }

    render() {
        return 'footer';
    }
}

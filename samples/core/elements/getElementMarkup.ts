import { html } from 'lit-html';
import './sample-default';
import './sample-no1';
import './sample-no2';
import './sample-no3';
import './sample-no4';

export function getElementMarkup(element: string) {
    switch (element) {
        case 'sample-no1':
            return html`<sample-no1></sample-no1>`;
        case 'sample-no2':
            return html`<sample-no2></sample-no2>`;
        case 'sample-no3':
            return html`<sample-no3></sample-no3>`;
        case 'sample-no4':
            return html`<sample-no4></sample-no4>`;
        default:
            return html`<sample-default></sample-default>`;
    }
}

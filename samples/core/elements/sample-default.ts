import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { viewState } from '../state/viewState';

@customElement('sample-default')
export default class extends HTMLElement {
    render() {
        const [view] = viewState.get();
        return html` <span class="text-xl">${view.toUpperCase()}</span>
            <p>Click on the buttons to the left to try different samples</p>
            <p>
                Core is very simple and olnly here to help write less code and make hmr work better
            </p>
            <p>
                Swicthing views like this is ok for parts of application, but you should look at
                router for better control
            </p>`;
    }
}

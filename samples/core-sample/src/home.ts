import { html } from 'lit-html';
import { Person } from './app-component';
import { customElement, attribute, inject } from '@simple-html/core';

@inject(Person)
@customElement('home-component')
export default class extends HTMLElement {
    constructor(private person: Person) {
        super();
        this.person.sayhello();
    }

    @attribute() myAttribute: number;

    valuesChanged(
        type: 'attribute' | 'property',
        name: string,
        oldValue: string,
        newValue: string
    ) {
        console.log('valuesChanged home component:', type, name, oldValue, newValue);
    }

    click() {
        this.myAttribute++;
        this.myAttribute++;
        this.myAttribute++;
        this.myAttribute++;
        this.myAttribute++;
    }

    updated() {
        console.log('updated home component');
    }

    public render() {
        console.log('render called home component');
        return html`
            <p>My attibutes: ${this.myAttribute}</p>
            <br />
            <button @click=${this.click}>add five (will drop)</button>
        `;
    }
}

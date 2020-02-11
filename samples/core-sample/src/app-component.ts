import { html } from 'lit-html';
import { customElement, property, inject } from '@simple-html/core';

export class Company {
    constructor() {
        console.log('[inject] Company born!');
    }
    work_in() {
        console.log('[inject] hello company');
    }
}

@inject(Company)
export class Person {
    constructor(private company: Company) {
        this.company.work_in();
        console.log('[inject] Im born!');
    }
    sayhello() {
        console.log('[inject] hello from me');
    }
}

@inject(Person, Company)
@customElement('app-component')
export default class extends HTMLElement {
    @property() public counterApp: number = (<any>window).count || 0;
    time: number;

    constructor(private person: Person, private company: Company) {
        super();
        this.person.sayhello();
        this.company.work_in();
    }

    valuesChanged(
        type: 'property' | 'attribute',
        name: string,
        oldValue: string,
        newValue: string
    ) {
        console.log('valuesChanged app-component:', type, name, oldValue, newValue);
    }

    connectedCallback() {
        this.time = setInterval(() => {
            console.log('timer app-component');
            this.counterApp++;
            (<any>window).count = this.counterApp;
        }, 3000);
    }

    disconnectedCallback(){
        console.log('remoooooooooooooooooooooooooooooooooooooooved')
        clearInterval(this.time);
    }

    updated() {
        console.log('updated app-component');
    }

    public render() {
        console.log('render called app-component');
        return html`
            <home-component my-attribute=${this.counterApp}></home-component>
        `;
    }
}

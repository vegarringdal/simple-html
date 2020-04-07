import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';

export type formReturn = { firstName: string; lastName: string; email: string };

@customElement('profile-form')
export class Form1 extends HTMLElement {
    @property() public firstName: string;
    @property() public lastName: string;
    @property() public email: string;

    public action: (form: formReturn) => void;

    buttonClick(event: any) {
        event.preventDefault();
        this.action({
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email
        });
    }

    render() {
        return html`
            <div class="font-mono flex flex-col p-2 bg-gray-700">
                <h1 class="font-semibold text-center text-white m-2 text-3xl">
                    Profile
                </h1>

                <div class="flex flex-col p-2 bg-gray-900 pl-2 pr-2">
                    <label class="text-white mt-1">First name: </label>
                    <input
                        class="p-1"
                        type="text"
                        .value=${this.firstName || ''}
                        @change=${(e: any) => {
                            this.firstName = e.target.value;
                        }}
                    />
                </div>
                <div class="flex flex-col p-2 bg-gray-900 pl-2 pr-2 ">
                    <label class="text-white mt-1">Last name: </label>
                    <input
                        class="p-1"
                        type="text"
                        .value=${this.lastName || ''}
                        @change=${(e: any) => {
                            this.lastName = e.target.value;
                        }}
                    />
                </div>
                <div class="flex flex-col p-2 bg-gray-900 pl-2 pr-2 pb-5">
                    <label class="text-white mt-1">Email: </label>
                    <input
                        class="p-1"
                        type="email"
                        .value=${this.email || ''}
                        @change=${(e: any) => {
                            this.email = e.target.value;
                        }}
                    />
                </div>
                <button
                    class="p-2 font-semibold text-white bg-green-700 mt-3 mb-3 text-xl hover:bg-green-600 focus:outline-none"
                    @click=${this.buttonClick}
                >
                    Update Profile
                </button>
            </div>
        `;
    }
}

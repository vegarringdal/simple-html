import './hmr';
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

import { userFormState, userFormStateType } from './state/userForm';
import { mainUIState } from './state/mainUI';
import { staticDialog } from './wrappers/staticDialog';

import './index.css';
import './userForm';

@customElement('app-root')
export class AppRoot extends HTMLElement {
    render() {
        const [userForm, setUserForm] = userFormState();
        const [, setUiState] = mainUIState();

        return html`
            <div>
                <button
                    class="bg-blue-500 p-2 m-2"
                    @click=${() => {
                        setUiState(Object.assign({ show_dialog: true }, userForm));
                        this.render();
                    }}
                >
                    Open dialog
                </button>

                ${staticDialog(html`
                    <profile-form
                        class=""
                        .firstName=${userForm.firstName}
                        .lastName=${userForm.lastName}
                        .email=${userForm.email}
                        .action=${(userForm: userFormStateType) => {
                            setUserForm(userForm);
                            setUiState(Object.assign({ show_dialog: false }, userForm));
                            this.render();
                        }}
                    ></profile-form>
                `)}
            </div>
        `;
    }
}

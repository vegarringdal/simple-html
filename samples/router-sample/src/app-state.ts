import { publish } from '@simple-html/core';

export class AppState {
    public isAutenticated = false;

    public login() {
        this.isAutenticated = true;
        publish('autentication-changed', true);
    }

    public logout() {
        this.isAutenticated = false;
        publish('autentication-changed', false);
    }
}

import { User } from '../models/user';

export class SharedState {
    public currentUser: User;
    public isAuthenticated: boolean;

    constructor() {
        this.setState();
    }

    public resetState() {
        this.currentUser = new User();
        this.isAuthenticated = false;
    }

    public setState() {
        if (window.localStorage['jwtToken']) {
            const user = window.localStorage[window.localStorage['jwtToken'] + 'currentUser'];
            if (user) {
                this.currentUser = new User(JSON.parse(user));
                this.isAuthenticated = true;
            } else {
                this.currentUser = new User();
                this.isAuthenticated = false;
            }
        }
    }

    public saveState(user: User) {
        if (user) {
            window.localStorage[window.localStorage['jwtToken'] + 'currentUser'] = JSON.stringify(
                user
            );
        }
    }
}

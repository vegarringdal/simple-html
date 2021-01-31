
import './index.css';
import('./elements/app-root').then(() => {
    if (document.body) {
        document.body.innerHTML = '<app-root></app-root>';
    }
});

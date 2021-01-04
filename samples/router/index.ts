import './hmr';
import './index.css';
import('./app-root').then(() => {
    if (document.body) {
        document.body.innerHTML = '<app-root></app-root>';
    }
});

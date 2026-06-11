import './style.css';

const editor = document.getElementById('editor');
editor.focus();

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
    }
});

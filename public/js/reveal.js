// public/js/reveal.js
// Las clases .reveal arrancan con opacity:0 en el CSS.
// Este script les agrega .reveal-visible para que se vean.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.reveal').forEach(el => {
        el.classList.add('reveal-visible');
    });
});

//Esto detecta cuál página estás viendo y marca el link lateral automáticamente
document.querySelectorAll('.nav-link').forEach(link => {
    if (link.href === window.location.href) {
        link.classList.add('active');
    }
});

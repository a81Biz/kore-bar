// frontends/menu/js/app.js

console.log('[Menu] Core autorizó el arranque. Verificando motor React...');

// Como menu.js usa Babel en el navegador, tarda unos milisegundos en compilarse.
// Hacemos un pequeño "poll" para esperar a que Babel termine y exponga nuestra función.
const checkBabel = setInterval(() => {
    if (typeof window.launchMenuApp === 'function') {
        clearInterval(checkBabel);
        console.log('[Menu] Motor listo. Montando interfaz...');
        window.launchMenuApp();
    }
}, 50);
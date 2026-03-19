// shared/js/utils.js

/**
 * Standard utility mapping numbers into strict Mexican Pesos styling.
 * 
 * @param {number} amount - Numerical raw currency payload 
 * @returns {string} Formatted output, e.g., $1,200.00
 */
export function formatCurrency(amount) {
    if (isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

/**
 * Comprime una imagen a formato WebP usando un Canvas HTML5.
 * Diseñado para reducir payloads masivos antes de enviar a la Base de Datos.
 * * @param {File} file - El archivo de imagen original (Ej. e.target.files[0]).
 * @param {number} maxWidth - Ancho máximo deseado en píxeles (default: 800).
 * @param {number} quality - Calidad de compresión de 0.0 a 1.0 (default: 0.7).
 * @returns {Promise<string>} Promesa que resuelve al string Base64 en formato WebP.
 */
export const compressImageToWebP = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No se proporcionó un archivo válido.'));

        // Evitamos procesar archivos que no sean imágenes
        if (!file.type.startsWith('image/')) {
            return reject(new Error('El archivo seleccionado no es una imagen.'));
        }

        const reader = new FileReader();

        reader.onload = (ev) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');

                // Calculamos la proporción para no deformar la foto
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 🟢 LA MAGIA DE WEBP
                const base64WebP = canvas.toDataURL('image/webp', quality);
                resolve(base64WebP);
            };

            img.onerror = () => reject(new Error('Error al decodificar la imagen.'));
            img.src = ev.target.result;
        };

        reader.onerror = () => reject(new Error('Error al leer el archivo del sistema.'));
        reader.readAsDataURL(file);
    });
};
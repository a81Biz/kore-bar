import { UIRules } from './ui.rules.js';
import { showErrorModal } from './ui.js';

/**
 * Binds a frontend form to the strict UI Rules Engine.
 * Automatically handles standard prevents, executes the callback, and applies
 * UI constraints such as `preserveFields` preventing regressions during resests.
 * 
 * @param {string} formId - The HTML ID of the form element
 * @param {Function} submitCallback - The async payload logic to execute
 */
export const bindForm = (formId, submitCallback) => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            // Wait for the custom submission logic to run
            await submitCallback(e);

            // If callback didn't throw, assume success and apply rules
            applyPostSubmitRules(formId, form);
        } catch (error) {
            // Callback threw an error (usually handled by the callback itself, e.g. validation UI)
            console.error(`[FormEngine] Submission failed for ${formId}:`, error);
            showErrorModal(error.message || 'Ha ocurrido un error durante la petición.', 'Error de Formulario');
        }
    });
};

const applyPostSubmitRules = (formId, form) => {
    const rules = UIRules[formId];
    const preserveFields = rules && rules.preserveFields ? rules.preserveFields : [];

    // Iterate over all inputs, selects, and textareas
    // Do NOT use form.reset() as it clears everything abruptly
    const elements = form.querySelectorAll('input, select, textarea');

    elements.forEach(el => {
        // Skip elements explicitly locked by the UI Rules Matrix
        if (preserveFields.includes(el.id)) {
            return;
        }

        // Skip structural components
        if (el.type === 'submit' || el.type === 'button' || el.type === 'hidden') {
            return;
        }

        // Clear values safely
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
        } else {
            el.value = '';
        }
    });

    console.log(`[FormEngine] Rules applied dynamically for ${formId}`);
};

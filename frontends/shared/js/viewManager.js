// shared/js/viewManager.js

/**
 * Lightweight SPA Layout orchestrator clearing and cloning <template> blocks directly against a root wrapper.
 */
class ViewManager {
    constructor(rootSelector) {
        this.root = document.querySelector(rootSelector);
        if (!this.root) throw new Error(`[ViewManager] Cannot identify root constraint: ${rootSelector}`);
    }

    /**
     * Purges current DOM elements inside the root mapping out the requested Template ID.
     * @param {string} templateId - The ID belonging to the hidden <template> logic block.
     * @returns {HTMLElement} The direct parent reference of the injected template.
     */
    mount(templateId) {
        const template = document.getElementById(templateId);
        if (!template) throw new Error(`[ViewManager] Cannot identify requested view template: ${templateId}`);

        // Scrape memory allocations to prevent DOM bleeding
        this.root.innerHTML = '';

        // Deep clone architecture
        const clone = template.content.cloneNode(true);
        this.root.appendChild(clone);

        return this.root;
    }
}

export const viewManager = new ViewManager('#app-root');

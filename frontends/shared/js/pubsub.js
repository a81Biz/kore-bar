// shared/js/pubsub.js

/**
 * A lightweight Event Bus implementation enforcing loose coupling across Frontend modules.
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event topic.
     * @param {string} event - The name of the event topic.
     * @param {function} callback - The function mapped upon execution.
     * @returns {function} Unsubscribe handler function.
     */
    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        return () => {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Publish an event synchronously broadcasting parameters to bound closures.
     * @param {string} event - The topic name to ignite.
     * @param {any} data - Extraneous contextual payload passed to the callback.
     */
    publish(event, data = {}) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(data));
    }
}

// Instantiate Global Bus
export const PubSub = new EventBus();

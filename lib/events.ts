type Listener = (payload?: any) => void;

class EventEmitter {
    private listeners: Listener[] = [];

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    emit(payload?: any) {
        this.listeners.forEach((listener) => listener(payload));
    }
}

export const documentEvents = new EventEmitter();

// Global state to track which documents should be expanded in the sidebar
// This allows deeply nested recursive lists to "know" they should expand when they mount
let activeExpandIds: string[] = [];

export const setActiveExpandIds = (ids: string[]) => {
    activeExpandIds = ids;
};

export const getActiveExpandIds = () => {
    return activeExpandIds;
};

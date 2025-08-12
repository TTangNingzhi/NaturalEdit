/**
 * Log user interaction from frontend.
 * @param event The event name or type.
 * @param data The event data.
 */
export function logInteraction(event: string, data: object) {
    const log = {
        timestamp: Date.now(),
        source: 'frontend',
        event,
        data
    };
    // Send log to backend
    window.vscode?.postMessage({ command: 'interactionLog', ...log });
}

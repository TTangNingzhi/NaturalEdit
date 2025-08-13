function getFormattedTimestamp() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); // Force Eastern Time directly
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
}

/**
 * Log user interaction from frontend.
 * @param event The event name or type.
 * @param data The event data.
 */
export function logInteraction(event: string, data: object) {
    const log = {
        timestamp: getFormattedTimestamp(),
        source: 'frontend',
        event,
        data
    };
    // Send log to backend
    window.vscode?.postMessage({ command: 'interactionLog', ...log });
}
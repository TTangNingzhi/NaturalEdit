/**
 * Utility for communicating with the VSCode extension backend.
 * In development, uses window.parent.postMessage (iframe).
 * In production, uses acquireVsCodeApi().postMessage (webview).
 * All comments are in English.
 */

type MessageHandler = (message: unknown) => void;

interface IVSCodeApi {
    postMessage(message: unknown): void;
}

class VSCodeApi {
    private vscode: IVSCodeApi | undefined;
    private isDev: boolean;

    constructor() {
        // Detect environment
        this.isDev = import.meta.env.MODE === 'development';

        if (!this.isDev && typeof acquireVsCodeApi === 'function') {
            // In production, acquire the VSCode API
            this.vscode = window.vscode || acquireVsCodeApi();
        }
    }

    /**
     * Send a message to the backend.
     * @param message The message object to send.
     */
    postMessage(message: unknown) {
        if (this.isDev) {
            // In development, send to parent (iframe)
            window.parent.postMessage(message, '*');
        } else if (this.vscode) {
            // In production, use VSCode API
            this.vscode.postMessage(message);
        }
    }

    /**
     * Listen for messages from the backend.
     * @param handler The function to call when a message is received.
     */
    onMessage(handler: MessageHandler) {
        window.addEventListener('message', (event: MessageEvent) => {
            // In dev, messages come from parent; in prod, from VSCode backend
            handler(event.data);
        });
    }
}

// Export a singleton instance
export const vscodeApi = new VSCodeApi();

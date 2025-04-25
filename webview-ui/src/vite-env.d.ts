/// <reference types="vite/client" />

/**
 * VSCode webview API global declarations for TypeScript.
 * These are injected at runtime by VSCode, but must be declared for type checking.
 */
declare function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void;
    setState: (state: unknown) => void;
    getState: () => unknown;
};

interface Window {
    vscode?: {
        postMessage: (message: unknown) => void;
        setState?: (state: unknown) => void;
        getState?: () => unknown;
    };
}

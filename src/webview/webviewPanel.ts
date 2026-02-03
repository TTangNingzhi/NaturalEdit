import * as vscode from 'vscode';
import { generateDevHtml, generateProdHtml } from './htmlContent';
import { handleMessage } from './messageHandler';

/**
 * Provides the NaturalEdit webview in the sidebar (activity bar).
 * Implements the WebviewViewProvider interface.
 */
export class NaturalEditViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'naturaledit.sidebarView';

    private _context: vscode.ExtensionContext;
    private _view?: vscode.WebviewView;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    /**
     * Called by VSCode when the view is resolved in the sidebar.
     * @param webviewView The webview view instance
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        // Store reference to the view
        this._view = webviewView;

        // Always enable scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._context.extensionUri, 'webview-ui', 'dist')
            ],
        };

        // Detect development mode using extensionMode
        let isDev = this._context.extensionMode === vscode.ExtensionMode.Development;
        isDev = false; // Force production mode for now

        try {
            // Set HTML content based on environment
            webviewView.webview.html = isDev
                ? generateDevHtml()
                : generateProdHtml(this._context, webviewView.webview);

            // Set up message handler for the webview
            webviewView.webview.onDidReceiveMessage(async message => {
                await handleMessage(message, webviewView);
            });

        } catch (error) {
            vscode.window.showErrorMessage(
                'NaturalEdit: Failed to initialize sidebar webview. ' + (error as Error).message
            );
        }
    }

    /**
     * Notify the webview that a file has changed
     */
    public notifyFileChanged(filePath: string) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fileChanged',
                filePath
            });
        }
    }

    /**
     * Notify the webview that a file was deleted
     */
    public notifyFileDeleted(filePath: string) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'fileDeleted',
                filePath
            });
        }
    }
}

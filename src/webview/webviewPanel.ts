import * as vscode from 'vscode';
import { generateDevHtml, generateProdHtml } from './htmlContent';
import { handleMessage } from './messageHandler';

/**
 * Creates or shows the webview panel
 * @param context Extension context
 * @returns The created webview panel
 */
export function createOrShowWebviewPanel(context: vscode.ExtensionContext) {
    let webviewPanel: vscode.WebviewPanel | undefined = undefined;

    webviewPanel = vscode.window.createWebviewPanel(
        'naturaleditWebview',
        'NaturalEdit',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    // Detect development mode using extensionMode
    let isDev = context.extensionMode === vscode.ExtensionMode.Development;
    isDev = false;

    try {
        // Set HTML content based on environment
        webviewPanel.webview.html = isDev
            ? generateDevHtml()
            : generateProdHtml(context, webviewPanel.webview);

        // Set up message handler
        webviewPanel.webview.onDidReceiveMessage(async message => {
            await handleMessage(message, webviewPanel!);
        });

    } catch (error) {
        vscode.window.showErrorMessage(
            'NaturalEdit: Failed to initialize webview. ' + (error as Error).message
        );
    }

    return webviewPanel;
}

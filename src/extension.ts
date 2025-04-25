import * as vscode from 'vscode';
import { createOrShowWebviewPanel } from './webview/webviewPanel';

export function activate(context: vscode.ExtensionContext) {
	const openWebviewCommand = vscode.commands.registerCommand('naturaledit.openWebview', () => {
		createOrShowWebviewPanel(context);
	});

	context.subscriptions.push(openWebviewCommand);
}

export function deactivate() { }

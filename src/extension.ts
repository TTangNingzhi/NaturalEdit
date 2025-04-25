import * as vscode from 'vscode';
import { createOrShowWebviewPanel } from './webview/webviewPanel';

/**
 * Stores the most recently active text editor.
 * This is updated whenever the active editor changes.
 */
let lastActiveEditor: vscode.TextEditor | undefined = undefined;

/**
 * Returns the most recently active text editor.
 * This is more robust than vscode.window.activeTextEditor,
 * as it persists even when the editor loses focus.
 */
export function getLastActiveEditor(): vscode.TextEditor | undefined {
	return lastActiveEditor;
}

export function activate(context: vscode.ExtensionContext) {
	const openWebviewCommand = vscode.commands.registerCommand('naturaledit.openWebview', () => {
		createOrShowWebviewPanel(context);
	});

	// Listen for changes to the active text editor and update the cache.
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lastActiveEditor = editor;
		}
	});

	context.subscriptions.push(openWebviewCommand);
}

export function deactivate() { }

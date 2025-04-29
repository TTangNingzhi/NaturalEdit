import * as vscode from 'vscode';
import { NaturalEditViewProvider } from './webview/webviewPanel';

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

/**
 * Called when the extension is activated.
 * Registers the NaturalEditViewProvider for the sidebar webview.
 */
export function activate(context: vscode.ExtensionContext) {
	// Register the sidebar webview provider
	const provider = new NaturalEditViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			NaturalEditViewProvider.viewType,
			provider
		)
	);

	// Listen for changes to the active text editor and update the cache.
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lastActiveEditor = editor;
		}
	});
}

export function deactivate() { }

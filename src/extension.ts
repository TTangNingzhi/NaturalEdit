import * as vscode from 'vscode';
import { NaturalEditViewProvider } from './webview/webviewPanel';
import { initialize, updateApiKey } from './llm/llmApi';

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
	// Initialize LLM API
	initialize(context);

	// Register the sidebar webview provider
	const provider = new NaturalEditViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			NaturalEditViewProvider.viewType,
			provider
		)
	);

	// Register command to update API Key
	context.subscriptions.push(
		vscode.commands.registerCommand('pasta.updateApiKey', async () => {
			await updateApiKey();
		})
	);

	// Initialize active text editor
	if (vscode.window.activeTextEditor) {
		lastActiveEditor = vscode.window.activeTextEditor;
	}

	// Listen for changes to the active text editor and update the cache.
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lastActiveEditor = editor;
		}
	});
}

export function deactivate() { }

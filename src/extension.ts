import * as vscode from 'vscode';
import { NaturalEditViewProvider } from './webview/webviewPanel';
import { initialize, updateApiKey } from './llm/llmApi';
import { ASTParser } from './utils/astParser';
import * as path from 'path';

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
export async function activate(context: vscode.ExtensionContext) {
	// Initialize LLM API
	initialize(context);

	// Initialize AST parser with WASM path
	// Block extension activation until parser is ready
	try {
		const astParser = ASTParser.getInstance();
		const wasmPath = path.join(context.extensionPath, 'node_modules', 'tree-sitter-wasms', 'out');
		await astParser.initialize(wasmPath);
		console.log('✓ AST parser initialized successfully');
		vscode.window.showInformationMessage('NaturalEdit: AST-based alignment enabled');
	} catch (error) {
		console.error('Failed to initialize AST parser:', error);
		vscode.window.showErrorMessage('NaturalEdit: AST parser initialization failed. Extension will use limited functionality.');
	}

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
		vscode.commands.registerCommand('naturaledit.updateApiKey', async () => {
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

	// Set up file watcher for code changes
	// This helps detect when code has been edited and summaries may need updating
	const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,tsx,jsx,py}');

	fileWatcher.onDidChange((uri) => {
		// Notify webview that a file has changed
		// The webview can decide whether to invalidate sections for this file
		provider.notifyFileChanged(uri.fsPath);
	});

	fileWatcher.onDidDelete((uri) => {
		// Notify webview that a file was deleted
		provider.notifyFileDeleted(uri.fsPath);
	});

	context.subscriptions.push(fileWatcher);
}

export function deactivate() { }

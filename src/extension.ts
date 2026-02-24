import * as vscode from 'vscode';
import { NaturalEditViewProvider } from './webview/webviewPanel';
import { initialize, updateApiKey } from './llm/llmApi';
import { ASTParser } from './utils/astParser';
import * as path from 'path';
import * as fs from 'fs';
import { scheduleValidationForFile } from './webview/messageHandler';

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
		const distWasmPath = path.join(context.extensionPath, 'dist');
		const nodeModulesWasmPath = path.join(context.extensionPath, 'node_modules', 'tree-sitter-wasms', 'out');

		const wasmPath = fs.existsSync(path.join(distWasmPath, 'tree-sitter-python.wasm'))
			? distWasmPath
			: nodeModulesWasmPath;

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
	// When code is modified, automatically validate all sections for that file
	const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,tsx,jsx,py}');

	fileWatcher.onDidChange((uri) => {
		// Schedule validation for sections associated with this file
		// Uses debouncing (500ms) to avoid redundant checks during rapid edits
		const webview = provider.getWebview();
		if (webview) {
			scheduleValidationForFile(uri.fsPath, webview);
		}
	});

	context.subscriptions.push(fileWatcher);
}

export function deactivate() { }

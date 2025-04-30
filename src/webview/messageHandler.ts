import * as vscode from 'vscode';
import * as path from 'path';
import { getCodeSummary, getCodeFromSummaryEdit, getCodeFromDirectInstruction, getSummaryFromInstruction } from '../llm/llmApi';
import { getLastActiveEditor } from '../extension';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Map to track temp file associations for diff/accept/reject workflow.
 * Key: original file path, Value: { tempFilePath: string, range: vscode.Range }
 */
const diffStateMap: Map<string, { tempFilePath: string }> = new Map();

/**
 * Handles incoming messages from the webview.
 * Accepts either a WebviewPanel (tab) or WebviewView (sidebar).
 * @param message The message received from the webview
 * @param webviewContainer The webview panel or view instance
 */
export async function handleMessage(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    switch (message.command) {
        case 'getSummary':
            await handleGetSummary(message, webviewContainer);
            break;
        case 'summaryPrompt':
            await handleSummaryPrompt(message, webviewContainer);
            break;
        case 'directPrompt':
            await handleDirectPrompt(message, webviewContainer);
            break;
        case 'promptToSummary':
            await handlePromptToSummary(message, webviewContainer);
            break;
    }
}

/**
 * Handles the getSummary command.
 */
async function handleGetSummary(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    const editor = getLastActiveEditor();
    const selectedText = editor?.document.getText(editor.selection) || '';

    if (!selectedText) {
        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            error: 'No code selected.'
        });
        return;
    }

    try {
        const summary = await getCodeSummary(selectedText);
        const { filename, fullPath, lines } = getFileInfo(editor);

        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            data: summary,
            filename,
            fullPath,
            lines,
            title: summary.title,
            concise: summary.concise,
            lastOpened: new Date().toLocaleString(),
            originalCode: selectedText,
            offset: editor ? editor.document.offsetAt(editor.selection.start) : 0
        });
    } catch (err: any) {
        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            error: 'Failed to get summary from LLM: ' + (err?.message || err)
        });
    }
}

/**
 * Handles the promptToSummary command.
 * This operation only updates the summary using the LLM and does not require a code selection.
 */
async function handlePromptToSummary(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    console.log('Apply to summary (promptToSummary) received:', message);
    // Call the LLM to update the summary based on the direct prompt
    const updatedSummary = await getSummaryFromInstruction(
        "", // No code context needed for summary update
        message.summaryText,
        message.summaryLevel,
        message.promptText
    );
    console.log('Updated summary:', updatedSummary);

    // Return the updated summary to the frontend
    webviewContainer.webview.postMessage({
        command: 'editResult',
        sectionId: message.sectionId,
        action: 'promptToSummary',
        newCode: updatedSummary
    });
}

/**
 * Handles the summaryPrompt command with fuzzy patching.
 */
async function handleSummaryPrompt(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    console.log('Summary-mediated prompt received:', message);

    const { originalCode, filename, fullPath } = message;
    if (!originalCode || !(filename || fullPath)) {
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action: 'summaryPrompt',
            error: 'Missing original code or filename.'
        });
        return;
    }

    const newCode = await getCodeFromSummaryEdit(originalCode, message.summaryText, message.summaryLevel);
    await applyCodeChanges(webviewContainer, message, originalCode, newCode, filename, fullPath, 'summaryPrompt');
}

/**
 * Handles the directPrompt command with fuzzy patching.
 */
async function handleDirectPrompt(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    console.log('Direct prompt received:', message);

    const { originalCode, filename, fullPath } = message;
    if (!originalCode || !(filename || fullPath)) {
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action: 'directPrompt',
            error: 'Missing original code or filename.'
        });
        return;
    }

    const newCode = await getCodeFromDirectInstruction(originalCode, message.promptText);
    await applyCodeChanges(webviewContainer, message, originalCode, newCode, filename, fullPath, 'directPrompt');
}

/**
 * Applies a fuzzy patch to the file, replacing the matched region with new code.
 * This function is used by both directPrompt and editSummaryPrompt handlers.
 * Returns { success: boolean, patchedText?: string, error?: string }
 */
async function applyFuzzyPatchAndReplaceInFile(
    fileUri: vscode.Uri,
    document: vscode.TextDocument,
    originalCode: string,
    newCode: string,
    offset: number
): Promise<{ success: boolean; patchedText?: string; error?: string }> {
    try {
        const fileText = document.getText();
        const DiffMatchPatch = require('diff-match-patch');
        const dmp = new DiffMatchPatch();
        const loc = dmp.match_main(fileText, originalCode, offset);

        if (loc === -1) {
            return { success: false, error: "Could not find the original code in the file. The code may have changed too much." };
        }

        const patchList = dmp.patch_make(originalCode, newCode);
        const [patchedText, results] = dmp.patch_apply(patchList, originalCode);

        if (results.some((applied: boolean) => !applied)) {
            return { success: false, error: "Failed to apply patch. The code may have changed too much since the summary was generated." };
        }

        const edit = new vscode.WorkspaceEdit();
        const start = document.positionAt(loc);
        const end = document.positionAt(loc + originalCode.length);
        edit.replace(fileUri, new vscode.Range(start, end), patchedText);

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            return { success: false, error: "Failed to apply edit to the file." };
        }

        return { success: true, patchedText };
    } catch (error) {
        console.error('Error applying patch:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred while applying changes."
        };
    }
}

/**
 * Opens a file and returns its document and URI
 * @param filename The filename to open
 * @param fullPath The full path to the file
 * @returns Object containing the document and URI, or null if file cannot be opened
 */
async function openFile(filename: string, fullPath: string): Promise<{ document: vscode.TextDocument; fileUri: vscode.Uri } | null> {
    const fileUri = fullPath
        ? vscode.Uri.file(fullPath)
        : vscode.Uri.file(path.isAbsolute(filename) ? filename : path.join(vscode.workspace.rootPath || "", filename));

    try {
        // Check if file exists before opening
        let fileExists = true;
        try {
            await vscode.workspace.fs.stat(fileUri);
        } catch (e) {
            fileExists = false;
        }
        if (!fileExists) {
            return null;
        }
        const document = await vscode.workspace.openTextDocument(fileUri);
        return { document, fileUri };
    } catch (err) {
        return null;
    }
}

/**
 * Common function to apply code changes to a file.
 * Accepts either a WebviewPanel or WebviewView as the webview container.
 * @param webviewContainer The webview panel or view instance
 * @param message The original message
 * @param originalCode The original code to be replaced
 * @param newCode The new code to replace with
 * @param filename The filename
 * @param fullPath The full path to the file
 * @param action The action type (directPrompt or editSummaryPrompt)
 */
async function applyCodeChanges(
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView,
    message: any,
    originalCode: string,
    newCode: string,
    filename: string,
    fullPath: string,
    action: 'directPrompt' | 'summaryPrompt'
) {
    try {
        const editor = await getLastActiveEditor();
        if (!editor) {
            webviewContainer.webview.postMessage({
                command: 'editResult',
                sectionId: message.sectionId,
                action,
                error: "No active editor found."
            });
            return;
        }

        const fileInfo = await openFile(filename, fullPath);
        if (!fileInfo) {
            webviewContainer.webview.postMessage({
                command: 'editResult',
                sectionId: message.sectionId,
                action,
                error: `File not found: ${filename}. Please check that the file exists in your workspace.`
            });
            return;
        }

        const { document, fileUri } = fileInfo;
        const offset = typeof message.offset === "number" ? message.offset : 0;

        // --- Save original code to a temp file before patching ---
        // Generate a unique temp file path
        const tempFilePath = path.join(os.tmpdir(), `naturaledit_${uuidv4()}_${filename}`);
        // Write the original code to the temp file
        fs.writeFileSync(tempFilePath, document.getText(), 'utf8');

        // Track the temp file for this file
        diffStateMap.set(fileUri.fsPath, { tempFilePath });

        // --- Apply the patch ---
        const result = await applyFuzzyPatchAndReplaceInFile(fileUri, document, originalCode, newCode, offset);

        if (!result.success) {
            webviewContainer.webview.postMessage({
                command: 'editResult',
                sectionId: message.sectionId,
                action,
                error: result.error
            });
            // Clean up temp file if patch failed
            try { fs.unlinkSync(tempFilePath); } catch { }
            diffStateMap.delete(fileUri.fsPath);
            return;
        }

        // --- Open the diff view between temp file (original) and modified file ---
        const tempFileUri = vscode.Uri.file(tempFilePath);
        await vscode.commands.executeCommand(
            'vscode.diff',
            tempFileUri,
            fileUri,
            `Review Edits: ${filename}`
        );

        // Optionally, focus the diff editor (VSCode will usually do this automatically)

        // --- Notify frontend as before ---
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action,
            newCode: result.patchedText
        });
    } catch (error) {
        console.error('Error applying code changes:', error);
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action,
            error: error instanceof Error ? error.message : "An unexpected error occurred."
        });
    }
}

/**
 * Gets file information from the editor
 */
function getFileInfo(editor: vscode.TextEditor | undefined) {
    let filename = "unknown";
    let fullPath = "";
    let lines = "";

    if (editor) {
        fullPath = editor.document.fileName;
        filename = path.basename(fullPath);
        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        lines = startLine === endLine
            ? `${startLine + 1}`
            : `${startLine + 1}-${endLine + 1}`;
    }

    return { filename, fullPath, lines };
}

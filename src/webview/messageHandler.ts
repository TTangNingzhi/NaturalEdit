import * as vscode from 'vscode';
import * as path from 'path';
import { getLLMSummary, getLLMEditFromSummary, getLLMEditFromDirectPrompt, getLLMEditFromPromptToSummary } from '../llm/llmApi';
import { getLastActiveEditor } from '../extension';

/**
 * Handles incoming messages from the webview
 * @param message The message received from the webview
 * @param webviewPanel The webview panel instance
 */
export async function handleMessage(message: any, webviewPanel: vscode.WebviewPanel) {
    switch (message.command) {
        case 'getSummary':
            await handleGetSummary(message, webviewPanel);
            break;
        case 'editSummary':
            handleEditSummary(message);
            break;
        case 'editSummaryPrompt':
            await handleEditSummaryPrompt(message, webviewPanel);
            break;
        case 'directPrompt':
            await handleDirectPrompt(message, webviewPanel);
            break;
        case 'promptToSummary':
            await handlePromptToSummary(message, webviewPanel);
            break;
    }
}

/**
 * Handles the getSummary command
 */
async function handleGetSummary(message: any, webviewPanel: vscode.WebviewPanel) {
    const editor = getLastActiveEditor();
    const selectedText = editor?.document.getText(editor.selection) || '';

    if (!selectedText) {
        webviewPanel.webview.postMessage({
            command: 'summaryResult',
            error: 'No code selected.'
        });
        return;
    }

    try {
        const summary = await getLLMSummary(selectedText);
        const { filename, lines } = getFileInfo(editor);

        webviewPanel.webview.postMessage({
            command: 'summaryResult',
            data: summary,
            filename,
            lines,
            title: summary.title,
            concise: summary.concise,
            lastOpened: new Date().toLocaleString()
        });
    } catch (err: any) {
        webviewPanel.webview.postMessage({
            command: 'summaryResult',
            error: 'Failed to get summary from LLM: ' + (err?.message || err)
        });
    }
}

/**
 * Handles the editSummary command
 */
function handleEditSummary(message: any) {
    console.log('Edited summary received:', message.data, 'Level:', message.level);
    vscode.window.showInformationMessage('Edited summary received for level: ' + message.level);
}

/**
 * Handles the editSummaryPrompt command
 */
async function handleEditSummaryPrompt(message: any, webviewPanel: vscode.WebviewPanel) {
    console.log('Summary-mediated prompt received:', message);
    const editor = vscode.window.activeTextEditor;
    const originalCode = editor?.document.getText(editor.selection) || '';

    if (!originalCode) {
        webviewPanel.webview.postMessage({
            command: 'editResult',
            error: 'No code selected for edit.'
        });
        return;
    }

    const newCode = await getLLMEditFromSummary(originalCode, message.summaryText, message.summaryLevel);
    const diff = generateDiff(originalCode, newCode);

    webviewPanel.webview.postMessage({
        command: 'editResult',
        newCode,
        diff
    });
}

/**
 * Handles the directPrompt command
 */
async function handleDirectPrompt(message: any, webviewPanel: vscode.WebviewPanel) {
    console.log('Direct prompt received:', message);
    const editor = vscode.window.activeTextEditor;
    const originalCode = editor?.document.getText(editor.selection) || '';

    if (!originalCode) {
        webviewPanel.webview.postMessage({
            command: 'editResult',
            error: 'No code selected for edit.'
        });
        return;
    }

    const newCode = await getLLMEditFromDirectPrompt(originalCode, message.promptText);
    const diff = generateDiff(originalCode, newCode);

    webviewPanel.webview.postMessage({
        command: 'editResult',
        newCode,
        diff
    });
}

/**
 * Handles the promptToSummary command
 */
async function handlePromptToSummary(message: any, webviewPanel: vscode.WebviewPanel) {
    console.log('Prompt to summary received:', message);
    const editor = vscode.window.activeTextEditor;
    const originalCode = editor?.document.getText(editor.selection) || '';

    if (!originalCode) {
        webviewPanel.webview.postMessage({
            command: 'editResult',
            error: 'No code selected for edit.'
        });
        return;
    }

    const newCode = await getLLMEditFromPromptToSummary(
        originalCode,
        message.summaryText,
        message.summaryLevel,
        message.promptText
    );
    const diff = generateDiff(originalCode, newCode);

    webviewPanel.webview.postMessage({
        command: 'editResult',
        newCode,
        diff
    });
}

/**
 * Generates diff between original and new code
 */
function generateDiff(originalCode: string, newCode: string) {
    const DiffMatchPatch = require('diff-match-patch');
    const dmp = new DiffMatchPatch();
    const diff = dmp.diff_main(originalCode, newCode);
    dmp.diff_cleanupSemantic(diff);
    return diff;
}

/**
 * Gets file information from the editor
 */
function getFileInfo(editor: vscode.TextEditor | undefined) {
    let filename = "unknown";
    let lines = "";

    if (editor) {
        const fullPath = editor.document.fileName;
        filename = path.basename(fullPath);
        const startLine = editor.selection.start.line;
        const endLine = editor.selection.end.line;
        lines = startLine === endLine
            ? `${startLine + 1}`
            : `${startLine + 1}-${endLine + 1}`;
    }

    return { filename, lines };
}

import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { logInteraction } from '../utils/telemetry';

/**
 * LLM API utility functions for code summarization and editing.
 */

// Module level variable to store extension context
let extensionContext: vscode.ExtensionContext | undefined;

/**
 * Initialize the extension context
 * @param context Extension context
 */
export function initialize(context: vscode.ExtensionContext) {
    extensionContext = context;
}

// Remove all code block markers (e.g., ``` or ```python) from LLM output.
// This class ensures only the code or summary content remains.
// content: The string returned by the LLM
// returns: Cleaned string with all code block markers removed
function cleanLLMCodeBlock(content: string): string {
    // Remove all lines that start with ```
    return content.replace(/^```[^\n]*\n|^```$/gm, "").trim();
}

/**
 * Update the OpenAI API Key
 * This will prompt the user to enter a new key and store it in global state
 * @returns Promise resolving to true if key was updated, false if cancelled
 */
export async function updateApiKey(): Promise<boolean> {
    if (!extensionContext) {
        throw new Error('Extension context not initialized. Call initialize() first.');
    }

    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your OpenAI API Key. The key will be stored locally only.',
        placeHolder: 'sk-...',
        password: true,
        ignoreFocusOut: true,
        title: 'Update OpenAI API Key',
        validateInput: (value: string) => {
            if (!value.startsWith('sk-')) {
                return 'API Key must start with "sk-"';
            }
            return null;
        }
    });

    if (!apiKey) {
        return false;
    }

    await extensionContext.globalState.update('openaiApiKey', apiKey);
    vscode.window.showInformationMessage('OpenAI API Key updated successfully!');
    return true;
}

/**
 * Get OpenAI API Key with fallback mechanisms
 * 1. Try environment variable
 * 2. Try global state
 * 3. Prompt user to enter key if not found
 * @returns Promise resolving to API Key
 */
async function getApiKey(): Promise<string> {
    if (!extensionContext) {
        throw new Error('Extension context not initialized. Call initialize() first.');
    }

    // First try environment variable
    // const envApiKey = process.env.OPENAI_API_KEY;
    // if (envApiKey) {
    //     console.log('Using environment variable for OpenAI API Key');
    //     return envApiKey;
    // }

    // Try global state first, if not found, keep prompting until user enters a valid key
    while (true) {
        const key = extensionContext.globalState.get<string>('openaiApiKey');
        if (key) {
            return key;
        }
        if (!await updateApiKey()) {
            throw new Error('OpenAI API key is required to use this extension.');
        }
    }
}

/**
 * Common function to call LLM API
 * @param prompt The prompt to send to LLM
 * @param parseJson Whether to parse the response as JSON
 * @returns The LLM response
 */
async function callLLM(prompt: string, parseJson: boolean = false): Promise<any> {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set it in environment variables or enter it when prompted.');
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4.1',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        throw new Error('OpenAI API error: ' + response.statusText);
    }
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    if (parseJson) {
        const cleaned = cleanLLMCodeBlock(content);
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error('Failed to parse LLM response as JSON: ' + cleaned);
        }
    }
    return content;
}

/**
 * Get a single detailed summary of the given code using LLM
 * @param code The code to summarize
 * @param fileContext The file context where the code is located
 * @returns The detailed summary as a string
 */
export async function getCodeSummary(code: string, fileContext: string): Promise<string> {
    const prompt = `
You are an expert code summarizer. For the following code, generate a single detailed summary (one or two sentences) that clearly describes the code's purpose and behavior.

IMPORTANT:
- The file context below is provided ONLY for reference to help understand the code's environment.
- Your summary MUST focus ONLY on the specific code snippet provided.
- Output only the summary, nothing else.

File Context (for reference only):
${fileContext}

Code to summarize:
${code}
`;

    const content = await callLLM(prompt, false);
    logInteraction("summarize_selected_code", {
        selected_code: code,
        summary: content
    });
    return cleanLLMCodeBlock(content);
}

/**
 * Get code changes based on a summary edit
 * @param originalCode The original code to modify
 * @param editedSummary The edited summary that describes the desired changes
 * @param summaryLevel The level of the summary (concise, detailed, or bullets)
 * @param fileContext The file context where the code is located
 * @param originalSummary The original summary before editing
 * @returns The modified code
 */
export async function getCodeFromSummaryEdit(
    originalCode: string,
    editedSummary: string,
    fileContext: string,
    originalSummary: string
): Promise<string> {
    const prompt = `
You are an expert code editor. Given the following original code and an updated summary, update the code to reflect the changes in the new summary.
- The file context below is provided ONLY for reference to help understand the code's environment, and your code changes MUST focus ONLY on the specific code snippet provided.
- Only change the code as needed to match the new summary, and keep the rest of the code unchanged.
- Preserve the leading whitespace (indentation) of each line from the original code in the updated code. For any modified or new lines, match the indentation style and level of the surrounding code.
- Pay close attention to the differences between the original summary and the edited summary, which reflects developer's intent of what the new code should be.
- Output only the updated code, nothing else.

File Context (for reference only):
${fileContext}

Original code:
${originalCode}

Original summary:
${originalSummary}

Updated summary:
${editedSummary}

Updated code:
`;

    const content = await callLLM(prompt);
    logInteraction("modify_summary_mediation", {
        original_code: originalCode,
        original_summary: originalSummary,
        edited_summary: editedSummary,
        updated_code: cleanLLMCodeBlock(content)
    });
    return cleanLLMCodeBlock(content);
}

/**
 * Get code changes based on a direct instruction
 * @param originalCode The original code to modify
 * @param instruction The direct instruction for code changes
 * @param fileContext The file context where the code is located
 * @returns The modified code
 */
export async function getCodeFromDirectInstruction(
    originalCode: string,
    instruction: string,
    fileContext: string
): Promise<string> {
    const prompt = `
You are an expert code editor. Given the following original code and a direct instruction, update the code to fulfill the instruction.
- The file context below is provided ONLY for reference to help understand the code's environment, and your code changes MUST focus ONLY on the specific code snippet provided.
- Only change the code as needed to satisfy the instruction, and keep the rest of the code unchanged.
- Preserve the leading whitespace (indentation) of each line from the original code in the updated code. For any modified or new lines, match the indentation style and level of the surrounding code.
- Output only the updated code, nothing else.

File Context (for reference only):
${fileContext}

Original code:
${originalCode}

Instruction:
${instruction}

Updated code:
`;

    const content = await callLLM(prompt);
    logInteraction("modify_direct_instruction", {
        original_code: originalCode,
        instruction,
        updated_code: cleanLLMCodeBlock(content)
    });
    return cleanLLMCodeBlock(content);
}

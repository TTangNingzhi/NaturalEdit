import * as vscode from 'vscode';
import fetch from 'node-fetch';

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
            model: 'gpt-4o',
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
 * Get a multi-level summary of the given code using LLM
 * @param code The code to summarize
 * @param fileContext The file context where the code is located
 * @returns Object containing title, concise, detailed, and bulleted summaries
 */
export async function getCodeSummary(code: string, fileContext: string): Promise<{
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
}> {
    const prompt = `
You are an expert code summarizer. For the following code, generate a summary in four levels:
1. Title: 3-5 words, no more.
2. Concise: One-sentence summary.
3. Detailed: One detailed sentence.
4. Bulleted: up to 6 bullet points (could be less), each concise. Each bullet in the bullets array must start with a bullet character (•).

IMPORTANT:
- The file context below is provided ONLY for reference to help understand the code's environment.
- Your summary MUST focus ONLY on the specific code snippet provided.
- Return your response as a JSON object with keys: title, concise, detailed, bullets (bullets is an array of strings).

File Context (for reference only):
${fileContext}

Code to summarize:
${code}
`;

    const parsed = await callLLM(prompt, true);
    return {
        title: parsed.title || '',
        concise: parsed.concise || '',
        detailed: parsed.detailed || '',
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    };
}

/**
 * Get a multi-level summary of modified code, referencing the original code and old summary.
 * The new summary should be as close as possible to the old summary, only updating parts affected by the code change.
 * @param newCode The modified code
 * @param originalCode The original code before modification
 * @param oldSummary The old summary object: { title, concise, detailed, bullets }
 * @param fileContext The file context where the code is located
 * @returns Object containing title, concise, detailed, and bulleted summaries
 */
export async function getSummaryWithReference(
    newCode: string,
    originalCode: string,
    oldSummary: { title: string; concise: string; detailed: string; bullets: string[] },
    fileContext: string
): Promise<{
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
}> {
    const prompt = `
You are an expert code summarizer. Your task is to generate a new summary for the MODIFIED code below, using the original code and its previous summary as reference.

Instructions:
- The new summary should be as close as possible to the old summary, only updating the parts that are affected by the code change.
- If a part of the summary is still accurate for the new code, keep it unchanged.
- If a part of the summary is no longer accurate, update only that part to reflect the new code.
- Do NOT add unnecessary changes or rephrase unchanged parts.
- Your summary MUST focus on the code differences between the original and modified code, and clearly reflect those changes in the summary, even if the changes are only in inline comments.
- If possible, make the changed parts of the summary easy to identify (e.g., by being explicit about what changed, or by using wording that highlights the update).
- Return your response as a JSON object with keys: title, concise, detailed, bullets (bullets is an array of strings).

File Context (for reference only):
${fileContext}

Original code:
${originalCode}

Old summary:
{
  "title": "${oldSummary.title}",
  "concise": "${oldSummary.concise}",
  "detailed": "${oldSummary.detailed}",
  "bullets": ${JSON.stringify(oldSummary.bullets)}
}

MODIFIED code:
${newCode}
`;

    const parsed = await callLLM(prompt, true);
    return {
        title: parsed.title || '',
        concise: parsed.concise || '',
        detailed: parsed.detailed || '',
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    };
}

/**
 * Build summary-to-code mapping for a given summary and code using LLM.
 * Supports multiple, possibly non-contiguous code ranges per summary component.
 * @param code The code to map
 * @param summaryText The summary text (concise, detailed, or a bullet)
 */
export async function buildSummaryMapping(
    code: string,
    summaryText: string
): Promise<
    {
        summaryComponent: string;
        codeRanges: [number, number][];
    }[]
> {
    // The prompt now explicitly requires that each summaryComponent must be a substring of the summary.
    const prompt = `
You are an expert at code-to-summary mapping. Given the following code and summary, extract up to 7 key summary components (phrases or semantic units) from the summary.
IMPORTANT:
1. Each summaryComponent you extract MUST be a substring (exact part) of the summary text below.
2. Extract summaryComponents in the exact order they appear in the summary text.
3. Do NOT hallucinate or invent summary components that do not appear in the summary.
4. If a code snippet contains multiple lines, split them into separate strings in the codeSnippets array.

For each summaryComponent, extract one or more relevant code snippets (as string, not line numbers) from the code that best match the meaning of the summary component.
- Prefer to use a complete code statement (such as a full line, assignment, function definition, or block) as the code snippet if it clearly represents the summary component's meaning.
- If a full statement is not appropriate or would be ambiguous, you should use a smaller, relevant fragment (such as a variable, function name, operator, or part of an expression).
- Only include enough code to make the mapping meaningful and unambiguous.
- If a code snippet contains multiple lines, split them into separate strings in the codeSnippets array.

Return as a JSON array of objects:
[
  { "summaryComponent": "...", "codeSnippets": ["code fragment 1", "code fragment 2"] },
  ...
]

Code:
${code}

Summary:
${summaryText}
`;

    const raw = await callLLM(prompt, false);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e1) {
        // Try cleaning code block markers and parse again
        const cleaned = cleanLLMCodeBlock(raw);
        try {
            parsed = JSON.parse(cleaned);
        } catch (e2) {
            throw new Error('Failed to parse LLM response as JSON: ' + cleaned);
        }
    }

    // Post-processing: filter and log any summaryComponent that is not a substring of the summaryText
    if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => {
            if (
                typeof item.summaryComponent === "string" &&
                !summaryText.includes(item.summaryComponent)
            ) {
                // Log a warning if hallucinated summaryComponent is found
                console.warn(
                    `[buildSummaryMapping] summaryComponent not found in summary:`,
                    item.summaryComponent
                );
                return false;
            }
            return true;
        });
        return filtered;
    }
    return [];
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
    summaryLevel: string,
    fileContext: string,
    originalSummary: string
): Promise<string> {
    const prompt = `
You are an expert code editor. Given the following original code and an updated summary (${summaryLevel}), update the code to reflect the changes in the new summary.
- The file context below is provided ONLY for reference to help understand the code's environment, and your code changes MUST focus ONLY on the specific code snippet provided.
- Only change the code as needed to match the new summary, and keep the rest of the code unchanged.
- Preserve the leading whitespace (indentation) of each line from the original code in the updated code. For any modified or new lines, match the indentation style and level of the surrounding code.
- Pay close attention to the differences between the original summary and the edited summary, which reflects developer's intent of what the new code should be.
- Output only the updated code, nothing else.

File Context (for reference only):
${fileContext}

Original code:
${originalCode}

Original summary (${summaryLevel}):
${originalSummary}

Updated summary (${summaryLevel}):
${editedSummary}

Updated code:
`;

    const content = await callLLM(prompt);
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
    return cleanLLMCodeBlock(content);
}

/**
 * Get summary changes based on a direct instruction
 * @param originalCode The original code context
 * @param originalSummary The original summary to modify
 * @param summaryLevel The level of the summary (concise, detailed, or bullets)
 * @param instruction The direct instruction for summary changes
 * @returns The modified summary
 */
export async function getSummaryFromInstruction(
    originalCode: string,
    originalSummary: string,
    summaryLevel: string,
    instruction: string
): Promise<string> {
    const prompt = `
You are an expert at editing code summaries. In this scenario, a developer is using a summary-mediated approach to modify code:
1. Instead of directly editing the code, the developer modifies the summary to express their desired code behavior.
2. The modified summary will later be used to generate the actual code changes.
3. Your task is to integrate the developer's instruction into the summary, making it clear what the new code should do.

Given the following original summary and a direct instruction, update the summary to incorporate the developer's intent:
- The code context below is provided ONLY for reference to help understand the summary's environment.
- Preserve the parts of the original summary that are not affected by the instruction.
- Maintain the original summary format (sentence, bullet points, etc.).
- Make it easy to identify what changed by keeping unchanged parts exactly as they were.
- Integrate the instruction seamlessly into existing sentences or bullet points as much as possible.
- However, add new sentences or bullet points if the instruction cannot be naturally integrated into existing ones.
- The updated summary MUST clearly express what the new code should do, incorporating ALL information from the instruction.
- Output only the updated summary, nothing else.

Code Context (for reference only):
${originalCode}

Original summary (${summaryLevel}):
${originalSummary}

Developer's instruction (integrate this intent fully into the updated summary):
${instruction}

Updated summary:
`;

    const content = await callLLM(prompt);
    return cleanLLMCodeBlock(content);
}

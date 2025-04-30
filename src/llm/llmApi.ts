/**
 * LLM API utility functions for code summarization and editing.
 */

// Remove all code block markers (e.g., ``` or ```python) from LLM output.
// This class ensures only the code or summary content remains.
// content: The string returned by the LLM
// returns: Cleaned string with all code block markers removed
function cleanLLMCodeBlock(content: string): string {
    // Remove all lines that start with ```
    return content.replace(/^```[^\n]*\n|^```$/gm, "").trim();
}

/**
 * Common function to call LLM API
 * @param prompt The prompt to send to LLM
 * @param parseJson Whether to parse the response as JSON
 * @returns The LLM response
 */
async function callLLM(prompt: string, parseJson: boolean = false): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY || '';
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
 * @returns Object containing title, concise, detailed, and bulleted summaries
 */
export async function getCodeSummary(code: string): Promise<{
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
4. Bulleted: up to 6 bullet points, each concise.

Return your response as a JSON object with keys: title, concise, detailed, bullets (bullets is an array of strings).

Code:
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
 * @returns The modified code
 */
export async function getCodeFromSummaryEdit(originalCode: string, editedSummary: string, summaryLevel: string): Promise<string> {
    const prompt = `
You are an expert code editor. Given the following original code and an updated summary (${summaryLevel}), update the code to reflect the new summary.
- Only change the code as needed to match the new summary.
- Keep the rest of the code unchanged.
- Output only the updated code, nothing else.

Original code:
${originalCode}

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
 * @returns The modified code
 */
export async function getCodeFromDirectInstruction(originalCode: string, instruction: string): Promise<string> {
    const prompt = `
You are an expert code editor. Given the following original code and a direct instruction, update the code to fulfill the instruction.
- Only change the code as needed to satisfy the instruction.
- Keep the rest of the code unchanged.
- Output only the updated code, nothing else.

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
 * @param originalCode The original code context (optional)
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
You are an expert at editing summaries. Given the following original summary and a direct instruction, update the summary to fulfill the instruction.
- The new summary must incorporate ALL information from the direct instruction.
- Preserve ALL parts of the original summary that are not affected by the instruction.
- Maintain the original summary format (sentence, bullet points, etc.).
- When possible, integrate the instruction's changes into existing sentences or bullet points.
- Only add new sentences or bullet points if the instruction cannot be naturally integrated into existing ones.
- Make it easy to identify what changed by keeping unchanged parts exactly as they were.
- Output only the updated summary, nothing else.

Original summary (${summaryLevel}):
${originalSummary}

Instruction:
${instruction}

Updated summary:
`;

    const content = await callLLM(prompt);
    return cleanLLMCodeBlock(content);
}

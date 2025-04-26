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
            model: 'gpt-3.5-turbo',
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
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new Error('Failed to parse LLM response as JSON: ' + content);
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
4. Bulleted: 3-4 bullet points, each concise.

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
- Change the parts of the summary that are necessary to satisfy the instruction.
- Keep all other parts of the summary unchanged.
- The goal is to make it easy to see what changed by comparing the old and new summaries.
- If the instruction cannot be integrated into the parts of the summary, directly append it to the end of the summary is fine.
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

/**
 * LLM API utility functions for code summarization and editing.
 */

export async function getLLMSummary(code: string): Promise<{
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
}> {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

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

    // Try to parse the JSON from the LLM response
    try {
        const parsed = JSON.parse(content);
        return {
            title: parsed.title || '',
            concise: parsed.concise || '',
            detailed: parsed.detailed || '',
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
        };
    } catch (e) {
        throw new Error('Failed to parse LLM response as JSON: ' + content);
    }
}

/**
 * Call OpenAI API to edit code based on summary edit.
 * This is a stub function. You must implement the actual LLM call.
 */
export async function getLLMEditFromSummary(originalCode: string, editedSummary: string, summaryLevel: string): Promise<string> {
    // TODO: Replace with actual LLM call using OpenAI API
    // For now, just return the original code with a comment
    return `// [LLM EDITED CODE BASED ON SUMMARY: ${summaryLevel}]\n${originalCode}`;
}

/**
 * Call OpenAI API to edit code based on direct prompt.
 * This is a stub function. You must implement the actual LLM call.
 */
export async function getLLMEditFromDirectPrompt(originalCode: string, promptText: string): Promise<string> {
    // TODO: Replace with actual LLM call using OpenAI API
    // For now, just return the original code with a comment
    return `// [LLM EDITED CODE BASED ON DIRECT PROMPT]\n${originalCode}`;
}

/**
 * Call OpenAI API to edit code based on a direct prompt applied to a summary.
 * This is a stub function. You must implement the actual LLM call.
 */
export async function getLLMEditFromPromptToSummary(
    originalCode: string,
    summaryText: string,
    summaryLevel: string,
    promptText: string
): Promise<string> {
    // TODO: Replace with actual LLM call using OpenAI API
    // For now, just return the original code with a comment
    return `// [LLM EDITED CODE BASED ON PROMPT "${promptText}" APPLIED TO SUMMARY: ${summaryLevel}]\n${originalCode}`;
}

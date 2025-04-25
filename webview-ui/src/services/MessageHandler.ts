import { vscodeApi } from "../utils/vscodeApi";
import { SectionData, SummaryResultMessage } from "../types/sectionTypes.js";

/**
 * Handle messages from VSCode
 */
export const setupMessageHandler = (
    onError: (error: string) => void,
    onNewSection: (section: SectionData) => void
) => {
    const handleMessage = (message: unknown) => {
        if (
            typeof message === "object" &&
            message !== null &&
            "command" in message &&
            (message as { command: string }).command === "summaryResult"
        ) {
            const msg = message as SummaryResultMessage;
            if (msg.error) {
                onError(msg.error);
            } else if (msg.data) {
                const id = Date.now().toString();
                onNewSection({
                    id,
                    filename: msg.filename || "unknown",
                    lines: [parseInt(msg.lines?.split('-')[0] || '0'), parseInt(msg.lines?.split('-')[1] || '0')],
                    title: msg.title || "Untitled",
                    concise: msg.concise || "",
                    lastOpened: msg.lastOpened ? new Date(msg.lastOpened).getTime() : Date.now(),
                    summaryData: msg.data,
                    selectedLevel: "concise",
                    editPromptLevel: null,
                    editPromptValue: "",
                });
            }
        }
    };

    vscodeApi.onMessage(handleMessage);
};

/**
 * Request summary from VSCode
 */
export const requestSummary = () => {
    vscodeApi.postMessage({ command: "getSummary" });
};

/**
 * Send direct prompt to VSCode
 */
export const sendDirectPrompt = (sectionId: string, prompt: string) => {
    vscodeApi.postMessage({ command: "directPrompt", promptText: prompt, sectionId });
};

/**
 * Send edit summary request to VSCode
 */
export const sendEditSummary = (sectionId: string, level: string, value: string) => {
    vscodeApi.postMessage({
        command: "editSummaryPrompt",
        summaryText: value,
        summaryLevel: level,
        sectionId,
    });
};

/**
 * Send prompt to summary request to VSCode
 */
export const sendPromptToSummary = (sectionId: string, level: string, summary: string, prompt: string) => {
    vscodeApi.postMessage({
        command: "promptToSummary",
        summaryText: summary,
        summaryLevel: level,
        promptText: prompt,
        sectionId,
    });
};

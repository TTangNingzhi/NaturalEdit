import { vscodeApi } from "../utils/vscodeApi";
import { SectionData, SummaryResultMessage } from "../types/sectionTypes.js";
import { v4 as uuidv4 } from "uuid";
import { logInteraction } from "../utils/telemetry.js";

/**
 * Handle messages from VSCode, including progress updates.
 * @param onError Callback for error messages
 * @param onNewSection Callback for new summary section
 * @param onEditResult Callback for edit results (optional)
 * @param onProgress Callback for progress updates (optional)
 */
export const setupMessageHandler = (
    onError: (error: string) => void,
    onNewSection: (section: SectionData) => void,
    onEditResult?: (sectionId: string, action: string, newCode: string) => void,
    onProgress?: (stageText: string) => void
) => {
    interface ProgressMessage {
        command: "summaryProgress";
        stageText: string;
    }

    const handleMessage = (message: unknown) => {
        if (
            typeof message === "object" &&
            message !== null
        ) {
            // Handle summary progress updates
            if ("command" in message && message.command === "summaryProgress" && onProgress) {
                // Call the progress callback with the current stage text
                onProgress((message as ProgressMessage).stageText || "Summarizing...");
            } else if ("command" in message && message.command === "summaryResult") {
                const msg = message as SummaryResultMessage;
                if (msg.error) {
                    onError(msg.error);
                } else if (msg.data) {
                    const id = uuidv4();
                    onNewSection({
                        metadata: {
                            id,
                            filename: msg.filename || "unknown",
                            fullPath: msg.fullPath || "",
                            offset: typeof msg.offset === "number" ? msg.offset : 0,
                            originalCode: msg.originalCode || ""
                        },
                        lines: [parseInt(msg.lines?.split('-')[0] || '0'), parseInt(msg.lines?.split('-')[1] || '0')],
                        title: msg.title || "Untitled",
                        createdAt: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
                        summaryData: msg.data,
                        editPromptValue: ""
                    });
                }
            } else if ("command" in message && message.command === "editResult" && onEditResult) {
                // Handle backend edit result (e.g., promptToSummary)
                if (
                    "action" in message &&
                    message.action === "promptToSummary" &&
                    "sectionId" in message &&
                    typeof message.sectionId === "string" &&
                    "newCode" in message &&
                    typeof message.newCode === "string"
                ) {
                    onEditResult(message.sectionId, message.action, message.newCode);
                }
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
 * @param sectionId Section identifier
 * @param prompt Direct instruction text
 * @param originalCode The code to be edited
 * @param filename The file name
 * @param fullPath The full file path
 * @param offset The offset in the file
 */
export const sendDirectPrompt = (
    sectionId: string,
    prompt: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number
) => {
    vscodeApi.postMessage({
        command: "directPrompt",
        promptText: prompt,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset
    });
};

/**
 * Send summary-mediated prompt (edit summary) to VSCode
 * @param sectionId Section identifier
 * @param level Summary level
 * @param value New summary value
 * @param originalCode The code to be edited
 * @param filename The file name
 * @param fullPath The full file path
 * @param offset The offset in the file
 * @param originalSummary The original summary for diff comparison
 */
export const sendEditSummary = (
    sectionId: string,
    level: string,
    value: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number,
    originalSummary: string
) => {
    vscodeApi.postMessage({
        command: "summaryPrompt",
        summaryText: value,
        summaryLevel: level,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset,
        originalSummary
    });
};

/**
 * Create a message handler with state management, including progress updates.
 * @param setLoading Loading state setter
 * @param setError Error state setter
 * @param setSectionList Section list state setter
 * @param setLoadingText Loading text setter (for progress updates)
 * @returns A function to setup the message handler
 */
export const createStatefulMessageHandler = (
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setSectionList: React.Dispatch<React.SetStateAction<SectionData[]>>,
    setLoadingText?: (text: string) => void
): () => void => {
    return () => setupMessageHandler(
        (error) => {
            setLoading(false);
            setError(error);
        },
        (section) => {
            setLoading(false);
            setSectionList(prev => [...prev, section]);
            logInteraction("create_new_section", { section_id: section.metadata.id, section_data: section });
        },
        (sectionId, action, newCode) => {
            if (action === "promptToSummary") {
                setSectionList(prev =>
                    prev.map(s =>
                        s.metadata.id === sectionId
                            ? { ...s, editPromptValue: newCode }
                            : s
                    )
                );
            }
        },
        // Progress callback: update loading text if provided
        setLoadingText
    );
};

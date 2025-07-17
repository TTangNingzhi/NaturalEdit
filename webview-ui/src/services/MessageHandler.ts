import { vscodeApi } from "../utils/vscodeApi";
import { SectionData, SummaryData, SummaryMappings } from "../types/sectionTypes.js";
import { v4 as uuidv4 } from "uuid";

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
    onEditResult?: (sectionId: string, action: string, newCode: string, newCodeRegion?: string) => void,
    onProgress?: (stageText: string) => void
) => {
    const handleMessage = (message: unknown) => {
        const msgObj = message as Record<string, unknown>;
        if (
            typeof msgObj === "object" &&
            msgObj !== null
        ) {
            // Handle summary progress updates
            if ("command" in msgObj && msgObj.command === "summaryProgress" && onProgress) {
                // Call the progress callback with the current stage text
                const stageText = typeof msgObj["stageText"] === "string" ? msgObj["stageText"] : "Summarizing...";
                onProgress(stageText);
            } else if ("command" in msgObj && msgObj.command === "summaryResult") {
                if (msgObj["error"]) {
                    onError(msgObj["error"] as string);
                } else if (msgObj["data"]) {
                    const id = uuidv4();
                    onNewSection({
                        metadata: {
                            id,
                            filename: msgObj["filename"] as string || "unknown",
                            fullPath: msgObj["fullPath"] as string || "",
                            offset: typeof msgObj["offset"] === "number" ? (msgObj["offset"] as number) : 0,
                            originalCode: msgObj["originalCode"] as string || ""
                        },
                        lines: (() => {
                            const linesStr = typeof msgObj["lines"] === "string" ? msgObj["lines"] : "0-0";
                            const [start, end] = linesStr.split("-").map(s => parseInt(s || "0"));
                            return [start || 0, end || 0];
                        })(),
                        title: msgObj["title"] as string || "Untitled",
                        concise: msgObj["concise"] as string || "",
                        createdAt: msgObj["createdAt"] ? new Date(msgObj["createdAt"] as string).getTime() : Date.now(),
                        summaryData: msgObj["data"] as SummaryData,
                        selectedLevel: "concise",
                        editPromptLevel: null,
                        editPromptValue: "",
                        summaryMappings: (typeof msgObj["summaryMappings"] === "object" &&
                            msgObj["summaryMappings"] !== null &&
                            "concise" in (msgObj["summaryMappings"] as object) &&
                            "detailed" in (msgObj["summaryMappings"] as object) &&
                            "bullets" in (msgObj["summaryMappings"] as object)
                        )
                            ? (msgObj["summaryMappings"] as SummaryMappings)
                            : { concise: [], detailed: [], bullets: [] },
                        // Pass oldSummaryData for diff rendering if present and valid
                        ...(
                            msgObj["oldSummaryData"] &&
                                typeof msgObj["oldSummaryData"] === "object" &&
                                msgObj["oldSummaryData"] !== null &&
                                "title" in (msgObj["oldSummaryData"] as object) &&
                                "concise" in (msgObj["oldSummaryData"] as object) &&
                                "detailed" in (msgObj["oldSummaryData"] as object) &&
                                "bullets" in (msgObj["oldSummaryData"] as object)
                                ? { oldSummaryData: msgObj["oldSummaryData"] as SummaryData }
                                : {}
                        )
                    });
                }
            } else if ("command" in msgObj && msgObj.command === "editResult" && onEditResult) {
                // Handle backend edit result (e.g., promptToSummary, summaryPrompt, directPrompt)
                if (
                    "action" in msgObj &&
                    "sectionId" in msgObj &&
                    typeof msgObj.sectionId === "string" &&
                    "newCode" in msgObj &&
                    typeof msgObj.newCode === "string"
                ) {
                    // Always pass newCodeRegion if present
                    onEditResult(
                        msgObj.sectionId as string,
                        msgObj.action as string,
                        msgObj.newCode as string,
                        "newCodeRegion" in msgObj && typeof msgObj.newCodeRegion === "string" ? msgObj.newCodeRegion : undefined
                    );
                }
            }
        }
    };

    vscodeApi.onMessage(handleMessage);
};

/**
 * Request summary from VSCode, optionally with oldSummaryData for diffed rendering.
 * @param oldSummaryData Optional previous summary data to pass for diff rendering
 */
/**
 * Request summary from VSCode, optionally with newCode and oldSummaryData for diffed rendering.
 * @param newCode The new code to summarize (optional)
 * @param oldSummaryData Optional previous summary data to pass for diff rendering
 */
export const requestSummary = (newCode?: string, oldSummaryData?: SummaryData) => {
    if (newCode && oldSummaryData) {
        vscodeApi.postMessage({ command: "getSummary", newCode, oldSummaryData });
    } else if (oldSummaryData) {
        vscodeApi.postMessage({ command: "getSummary", oldSummaryData });
    } else {
        vscodeApi.postMessage({ command: "getSummary" });
    }
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
 * Send prompt to summary request to VSCode
 * @param sectionId Section identifier
 * @param level Summary level
 * @param summary Current summary value
 * @param prompt Direct instruction to apply
 * @param originalCode The code to be edited
 * @param filename The file name
 * @param fullPath The full file path
 * @param offset The offset in the file
 */
export const sendPromptToSummary = (
    sectionId: string,
    level: string,
    summary: string,
    prompt: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number
) => {
    vscodeApi.postMessage({
        command: "promptToSummary",
        summaryText: summary,
        summaryLevel: level,
        promptText: prompt,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset
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
        },
        (sectionId, action, newCode, newCodeRegion) => {
            if (action === "promptToSummary") {
                setSectionList(prev =>
                    prev.map(s =>
                        s.metadata.id === sectionId
                            ? { ...s, editPromptValue: newCode }
                            : s
                    )
                );
            }
            // After an edit (e.g., summaryPrompt or directPrompt), trigger a new summary for the modified code
            if ((action === "summaryPrompt" || action === "directPrompt") && (typeof newCode === "string" || typeof newCodeRegion === "string")) {
                setLoading(true);
                setError(null);
                setLoadingText?.("Summarizing modified code...");
                // Find the previous section by sectionId from the current section list
                let oldSummaryData: {
                    title: string;
                    concise: string;
                    detailed: string;
                    bullets: string[];
                    originalCode: string;
                } | undefined = undefined;
                setSectionList(prev => {
                    const prevSection = prev.find(s => s.metadata.id === sectionId);
                    if (prevSection) {
                        oldSummaryData = {
                            title: prevSection.title,
                            concise: prevSection.summaryData.concise,
                            detailed: prevSection.summaryData.detailed,
                            bullets: prevSection.summaryData.bullets,
                            originalCode: prevSection.metadata.originalCode
                        };
                        // Call requestSummary after state update
                        setTimeout(() => {
                            const codeToSummarize = typeof newCodeRegion === "string" && newCodeRegion.length > 0 ? newCodeRegion : newCode;
                            console.log(
                                "[MessageHandler] Triggering getSummary after editResult:",
                                { codeToSummarize, oldSummaryData }
                            );
                            requestSummary(
                                typeof codeToSummarize === "string" ? codeToSummarize : "",
                                oldSummaryData && typeof oldSummaryData.title === "string"
                                    && typeof oldSummaryData.concise === "string"
                                    && typeof oldSummaryData.detailed === "string"
                                    && Array.isArray(oldSummaryData.bullets)
                                    ? oldSummaryData
                                    : undefined
                            );
                        }, 0);
                    }
                    return prev;
                });
            }
        },
        // Progress callback: update loading text if provided
        setLoadingText
    );
};

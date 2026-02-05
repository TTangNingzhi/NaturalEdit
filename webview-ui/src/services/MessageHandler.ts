import { vscodeApi } from "../utils/vscodeApi";
import {
    SectionData,
    SummaryData,
    SummaryResultMessage,
    SummaryProgressMessage,
    EditResultMessage,
    SectionValidityBatchMessage,
    ExtractedSectionCodeMessage,
    AvailableScopesMessage,
    ASTAnchor,
    ScopeInfo
} from "../types/sectionTypes.js";
import { v4 as uuidv4 } from "uuid";
import { logInteraction } from "../utils/telemetry.js";

/**
 * Handle messages from VSCode, including progress updates.
 * @param onError Callback for error messages
 * @param onNewSection Callback for new summary section
 * @param onEditResult Callback for edit results (optional)
 * @param onProgress Callback for progress updates (optional)
 * @param getOldSummaryData Function to get old summary data by sectionId (optional)
 * @param onSectionValidityBatch Callback for batch section validity updates (optional)
 * @param onAvailableScopes Callback for available scopes update (optional)
 */
export const setupMessageHandler = (
    onError: (error: string) => void,
    onNewSection: (section: SectionData) => void,
    onEditResult?: (sectionId: string, action: string, newCode: string) => void,
    onProgress?: (stageText: string) => void,
    getOldSummaryData?: (sectionId: string) => SummaryData | undefined,
    onSectionValidityBatch?: (results: Array<{ sectionId: string; isCodeValid: boolean; validationError?: string }>) => void,
    onAvailableScopes?: (sectionId: string, scopes: ScopeInfo[]) => void
) => {
    /**
     * Handles incoming messages from VSCode and dispatches to the appropriate callback.
     * Uses discriminated union types for type safety.
     */
    type MessageFromVSCode = SummaryProgressMessage | SummaryResultMessage | EditResultMessage | SectionValidityBatchMessage | ExtractedSectionCodeMessage | AvailableScopesMessage;

    // Type guard to check if an object has a string "command" property
    function isVSCodeMessageWithCommand(obj: unknown): obj is { command: string } {
        return (
            typeof obj === "object" &&
            obj !== null &&
            "command" in obj &&
            typeof (obj as { command: unknown }).command === "string"
        );
    }

    const handleMessage = (message: unknown) => {
        if (!isVSCodeMessageWithCommand(message)) {
            return; // Ignore unknown message shapes
        }

        const msg = message as MessageFromVSCode;

        switch (msg.command) {
            case "summaryProgress":
                if (onProgress) {
                    const stageText = typeof msg.stageText === "string" ? msg.stageText : "Summarizing...";
                    onProgress(stageText);
                }
                break;
            case "summaryResult":
                if (msg.error) {
                    onError(msg.error);
                } else if (msg.data) {
                    // Use sectionId from backend if provided, otherwise generate locally
                    const id = msg.sectionId || uuidv4();
                    onNewSection({
                        metadata: {
                            id,
                            filename: msg.filename || "unknown",
                            fullPath: msg.fullPath || "",
                            offset: typeof msg.offset === "number" ? msg.offset : 0,
                            originalCode: msg.originalCode || "",
                            astAnchor: msg.astAnchor,
                            sessionCodeSegments: msg.sessionCodeSegments
                        },
                        lines: (() => {
                            const linesStr = typeof msg.lines === "string" ? msg.lines : "0-0";
                            const [start, end] = linesStr.split("-").map(s => parseInt(s || "0"));
                            return [start || 0, end || 0];
                        })(),
                        title: msg.title || "Untitled",
                        createdAt: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
                        summaryData: msg.data,
                        oldSummaryData: msg.oldSummaryData,
                        // Selection state, default to medium/unstructured
                        selectedDetailLevel: "medium",
                        selectedStructured: "unstructured",
                        editPromptDetailLevel: null,
                        editPromptStructured: null,
                        editPromptValue: "",
                        summaryMappings: msg.summaryMappings
                            ? msg.summaryMappings
                            : {
                                low_unstructured: [],
                                low_structured: [],
                                medium_unstructured: [],
                                medium_structured: [],
                                high_unstructured: [],
                                high_structured: []
                            }
                    });
                }
                break;
            case "editResult":
                if (onEditResult) {
                    onEditResult(
                        msg.sectionId,
                        msg.action,
                        msg.newCode
                    );
                    // After an edit (e.g., summaryPrompt or directPrompt), trigger a new summary for the modified code
                    if (
                        (msg.action === "summaryPrompt" || msg.action === "directPrompt") &&
                        typeof msg.newCode === "string" &&
                        typeof getOldSummaryData === "function"
                    ) {
                        // Use getOldSummaryData to retrieve the previous summary for diff rendering
                        const oldSummaryData = getOldSummaryData(msg.sectionId);
                        // Set initial loading/progress text before requesting summary
                        if (onProgress) {
                            onProgress("Summarizing modified code...");
                        }
                        requestSummary(
                            msg.newCode,
                            oldSummaryData &&
                                typeof oldSummaryData.title === "string"
                                ? oldSummaryData
                                : undefined
                        );
                    }
                }
                break;
            case "sectionValidityBatch":
                if (onSectionValidityBatch && (msg as SectionValidityBatchMessage).results) {
                    onSectionValidityBatch((msg as SectionValidityBatchMessage).results);
                }
                break;
            case "extractedSectionCode":
                {
                    const msg2 = msg as ExtractedSectionCodeMessage;
                    if (msg2.error) {
                        onError(msg2.error);
                    } else if (msg2.newCode && typeof msg2.newCode === "string") {
                        // Request summary with the extracted new code (brand new summary, no reference)
                        if (onProgress) {
                            onProgress("Regenerating summary...");
                        }
                        requestSummary(msg2.newCode);
                    }
                }
                break;
            case "availableScopes":
                if (onAvailableScopes) {
                    const msg2 = msg as AvailableScopesMessage;
                    onAvailableScopes(msg2.sectionId, msg2.scopes);
                }
                break;
            default:
                // Unknown command, ignore
                break;
        }
    };

    vscodeApi.onMessage(handleMessage);
};

/**
 * Request summary from VSCode, optionally with newCode and oldSummaryData for diffed rendering.
 * @param newCode The new code to summarize (optional)
 * @param oldSummaryData Optional previous summary data to pass for diff rendering
 * @param customInstruction Optional custom instruction to apply to the summary (optional)
 */
export const requestSummary = (newCode?: string, oldSummaryData?: SummaryData, customInstruction?: string) => {
    const message: {
        command: string;
        newCode?: string;
        oldSummaryData?: SummaryData;
        customInstruction?: string;
    } = { command: "getSummary" };
    if (newCode) {
        message.newCode = newCode;
    }
    if (oldSummaryData) {
        message.oldSummaryData = oldSummaryData;
    }
    if (customInstruction && customInstruction.trim()) {
        message.customInstruction = customInstruction.trim();
    }
    vscodeApi.postMessage(message);
};

/**
 * Send direct prompt to VSCode
 * @param sectionId Section identifier
 * @param prompt Direct instruction text
 * @param originalCode The code to be edited
 * @param filename The file name
 * @param fullPath The full file path
 * @param offset The offset in the file
 * @param astAnchor Optional AST anchor for robust code location
 */
export const sendDirectPrompt = (
    sectionId: string,
    prompt: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number,
    astAnchor?: ASTAnchor
) => {
    vscodeApi.postMessage({
        command: "directPrompt",
        promptText: prompt,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset,
        astAnchor
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
 * @param astAnchor Optional AST anchor for robust code location
 */
export const sendEditSummary = (
    sectionId: string,
    detail: string,
    structured: string,
    value: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number,
    originalSummary: string,
    astAnchor?: ASTAnchor
) => {
    vscodeApi.postMessage({
        command: "summaryPrompt",
        summaryText: value,
        detailLevel: detail,
        structuredType: structured,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset,
        originalSummary,
        astAnchor
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
 * @param astAnchor Optional AST anchor for robust code location
 */
export const sendPromptToSummary = (
    sectionId: string,
    detail: string,
    structured: string,
    originalSummary: string,
    prompt: string,
    originalCode: string,
    filename: string,
    fullPath: string,
    offset: number,
    astAnchor?: ASTAnchor
) => {
    vscodeApi.postMessage({
        command: "promptToSummary",
        detailLevel: detail,
        structuredType: structured,
        originalSummary,
        promptText: prompt,
        sectionId,
        originalCode,
        filename,
        fullPath,
        offset,
        astAnchor
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
    // Getter function to retrieve old summary data by sectionId
    const getOldSummaryData = (sectionId: string) => {
        let found: SectionData | undefined;
        // Use a temporary variable to access the latest section list
        setSectionList(prev => {
            found = prev.find(s => s.metadata.id === sectionId);
            return prev;
        });
        if (found) {
            // Return a shallow copy of the summaryData for diff rendering
            return {
                ...found.summaryData,
                title: found.title
            };
        }
        return undefined;
    };

    return () => setupMessageHandler(
        (error) => {
            setLoading(false);
            setError(error);
        },
        (section) => {
            setLoading(false);
            setSectionList(prev => [...prev, section]);
            // Log the complete section data for telemetry/analysis
            logInteraction("create_new_section", { section_id: section.metadata.id, section_data: section });
        },
        (sectionId, action, newCode) => {
            // Only update editPromptValue for promptToSummary action
            if (action === "promptToSummary") {
                setSectionList(prev =>
                    prev.map(s =>
                        s.metadata.id === sectionId
                            ? { ...s, editPromptValue: newCode }
                            : s
                    )
                );
            }
            // No need to trigger requestSummary here; handled in setupMessageHandler
        },
        // Custom progress callback for summaryProgress: update loading state, error, and loading text
        (stageText) => {
            setLoading(true);
            setError(null);
            if (setLoadingText) {
                setLoadingText(stageText || "Summarizing modified code...");
            }
        },
        getOldSummaryData, // Pass getter to setupMessageHandler
        // Callback for section validity batch updates
        (results) => {
            setSectionList(prev =>
                prev.map(s => {
                    const result = results.find(r => r.sectionId === s.metadata.id);
                    if (result) {
                        return {
                            ...s,
                            isCodeValid: result.isCodeValid,
                            validationError: result.validationError,
                            lastValidationTime: Date.now()
                        };
                    }
                    return s;
                })
            );
        },
        // Callback for available scopes update
        (sectionId, scopes) => {
            setSectionList(prev =>
                prev.map(s =>
                    s.metadata.id === sectionId
                        ? { ...s, availableScopes: scopes }
                        : s
                )
            );
        }
    );
};

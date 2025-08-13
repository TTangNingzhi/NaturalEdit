import React, { useState } from "react";
import {
    VSCodeTextArea
} from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryDiffEditor } from "./SummaryDiffEditor";
import { SectionData } from "../types/sectionTypes.js";
import { FONT_SIZE, SPACING, COMMON_STYLES, COLORS } from "../styles/constants.js";
import { usePrompt } from "../hooks/usePrompt.js";
import { ClipLoader } from "react-spinners";
import { logInteraction } from "../utils/telemetry";

interface PromptPanelProps {
    section: SectionData;
    editSummaryValue?: string | null;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
    section,
    editSummaryValue
}) => {
    // Local loading and error state for each action
    const [loading, setLoading] = useState<{ [action: string]: boolean }>({
        prompt1: false,
        prompt2: false,
    });
    const [error, setError] = useState<{ [action: string]: string | null }>({
        prompt1: null,
        prompt2: null,
    });
    const { metadata, editPromptValue } = section;
    const { onDirectPrompt, onSummaryPrompt } = usePrompt(metadata);

    // Direct Prompt state
    const [directPrompt, setDirectPrompt] = useState("");
    // (summary state removed; only currentSummary/originalSummary are used)

    // For summary diff editor (only detailed)
    const [currentSummary, setCurrentSummary] = useState<string>(editPromptValue);
    const [originalSummary, setOriginalSummary] = useState<string>(editPromptValue);

    // Keep summary in sync with editPromptValue
    React.useEffect(() => {
        setCurrentSummary(editPromptValue);
        setOriginalSummary(editPromptValue);
    }, [editPromptValue]);

    // If editSummaryValue is set (from edit button), load it into the diff editor
    React.useEffect(() => {
        if (editSummaryValue !== undefined && editSummaryValue !== null) {
            setCurrentSummary(editSummaryValue);
            setOriginalSummary(editSummaryValue);
        }
    }, [editSummaryValue]);

    // Type guard to check if an error has a string message property
    function isErrorWithMessage(err: unknown): err is { message: string } {
        return (
            typeof err === "object" &&
            err !== null &&
            "message" in err &&
            typeof (err as { message: unknown }).message === "string"
        );
    }

    // Direct prompt send
    const handleDirectPromptSend = async () => {
        logInteraction("commit_direct_instruction", { section_id: metadata.id, instruction: directPrompt });
        const action = "prompt1";
        if (directPrompt.trim()) {
            setLoading(prev => ({ ...prev, [action]: true }));
            setError(prev => ({ ...prev, [action]: null }));
            try {
                await onDirectPrompt(directPrompt.trim());
                setLoading(prev => ({ ...prev, [action]: false }));
                setError(prev => ({ ...prev, [action]: null }));
            } catch (err: unknown) {
                let errorMsg = "Unknown error";
                if (isErrorWithMessage(err)) {
                    errorMsg = err.message;
                }
                setLoading(prev => ({ ...prev, [action]: false }));
                setError(prev => ({ ...prev, [action]: errorMsg }));
            }
        }
    };

    // Commit summary to backend (only detailed)
    const handleSummaryCommit = async () => {
        logInteraction("commit_modified_summary", { section_id: metadata.id, edited_summary: currentSummary, original_summary: originalSummary });
        const action = "prompt2";
        if (currentSummary.trim()) {
            setLoading(prev => ({ ...prev, [action]: true }));
            setError(prev => ({ ...prev, [action]: null }));
            try {
                await onSummaryPrompt(currentSummary.trim(), originalSummary);
                setLoading(prev => ({ ...prev, [action]: false }));
                setError(prev => ({ ...prev, [action]: null }));
            } catch (err: unknown) {
                let errorMsg = "Unknown error";
                if (isErrorWithMessage(err)) {
                    errorMsg = err.message;
                }
                setLoading(prev => ({ ...prev, [action]: false }));
                setError(prev => ({ ...prev, [action]: errorMsg }));
            }
        }
    };

    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
            {/* Direct Instruction Prompt Section */}
            <div style={{ marginBottom: SPACING.SMALL }}>
                <div style={COMMON_STYLES.SECTION_HEADER}>
                    <span style={COMMON_STYLES.SECTION_LABEL}>Edit Instruction</span>
                    {loading.prompt1 ? (
                        <ClipLoader
                            color={COLORS.FOREGROUND}
                            size={FONT_SIZE.SMALL}
                        />
                    ) : (
                        <button
                            title="Send Edit Instruction"
                            onClick={handleDirectPromptSend}
                            disabled={!directPrompt.trim() || loading.prompt1}
                            aria-label="Send Edit Instruction"
                            style={{
                                ...COMMON_STYLES.ICON_BUTTON,
                                opacity: (!directPrompt.trim() || loading.prompt1) ? 0.5 : 1,
                                cursor: (!directPrompt.trim() || loading.prompt1) ? "not-allowed" : "pointer"
                            }}
                        >
                            <span className="codicon codicon-send" style={{ fontSize: FONT_SIZE.ICON }} />
                        </button>
                    )}
                </div>
                <VSCodeTextArea
                    value={directPrompt}
                    onInput={e => setDirectPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ width: "100%", marginBottom: SPACING.TINY, fontFamily: "monospace", fontSize: FONT_SIZE.SMALL }}
                    placeholder="Enter a direct edit instruction."
                    resize="vertical"
                    rows={3}
                    disabled={false}
                />
                {error.prompt1 && (
                    <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
                        {error.prompt1}
                    </div>
                )}
            </div>

            {/* Summary-Mediated Prompt Section */}
            <div>
                <div style={COMMON_STYLES.SECTION_HEADER}>
                    <span style={COMMON_STYLES.SECTION_LABEL}>
                        Modifiable Code Summary
                    </span>
                    {loading.prompt2 ? (
                        <ClipLoader
                            color={COLORS.FOREGROUND}
                            size={FONT_SIZE.SMALL}
                        />
                    ) : (
                        <button
                            style={{
                                ...COMMON_STYLES.ICON_BUTTON,
                                opacity: (!currentSummary.trim() || currentSummary.trim() === originalSummary || loading.prompt2) ? 0.5 : 1,
                                cursor: (!currentSummary.trim() || currentSummary.trim() === originalSummary || loading.prompt2) ? "not-allowed" : "pointer"
                            }}
                            title="Send Modified Summary"
                            onClick={handleSummaryCommit}
                            disabled={!currentSummary.trim() || currentSummary.trim() === originalSummary || loading.prompt2}
                            aria-label="Send Modified Summary"
                        >
                            <span className="codicon codicon-send" style={{ fontSize: FONT_SIZE.ICON }} />
                        </button>
                    )}
                </div>
                <SummaryDiffEditor
                    originalSummary={originalSummary}
                    currentSummary={currentSummary}
                    onChange={newValue => {
                        const valueStr = Array.isArray(newValue) ? newValue.join("\n") : newValue;
                        setCurrentSummary(valueStr);
                    }}
                />
                {error.prompt2 && (
                    <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
                        {error.prompt2}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptPanel;

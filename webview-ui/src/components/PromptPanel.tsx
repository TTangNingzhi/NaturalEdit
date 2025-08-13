import React, { useState, useEffect, useRef } from "react";
import {
    VSCodeButton,
    VSCodeTextArea
} from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryDiffEditor } from "./SummaryDiffEditor";
import { SectionData, DetailLevel, StructuredType } from "../types/sectionTypes.js";
import { FONT_SIZE, SPACING, COMMON_STYLES, COLORS } from "../styles/constants.js";
import { usePrompt } from "../hooks/usePrompt.js";
import { ClipLoader } from "react-spinners";
import { logInteraction } from "../utils/telemetry";

interface PromptPanelProps {
    section: SectionData;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
    section
}) => {
    // Local loading and error state for each action
    const [loading, setLoading] = useState<{ [action: string]: boolean }>({
        applyToSummary: false,
        prompt1: false,
        prompt2: false,
    });
    const [error, setError] = useState<{ [action: string]: string | null }>({
        applyToSummary: null,
        prompt1: null,
        prompt2: null,
    });
    const { metadata, editPromptDetailLevel, editPromptStructured, editPromptValue } = section;
    const { onDirectPrompt, onPromptToSummary, onSummaryPrompt } = usePrompt(metadata);

    // Direct Prompt state
    const [directPrompt, setDirectPrompt] = useState("");
    // Summary state
    const [summary, setSummary] = useState(editPromptValue);

    // For summary diff editor
    const [currentSummary, setCurrentSummary] = useState<string>("");
    const [originalSummary, setOriginalSummary] = useState<string>("");
    const [localEditPromptDetailLevel, setLocalEditPromptDetailLevel] = useState<DetailLevel | null>(null);
    const [localEditPromptStructured, setLocalEditPromptStructured] = useState<StructuredType | null>(null);
    const editPromptValueRef = useRef(editPromptValue);

    // Keep summary in sync with editPromptValue
    useEffect(() => {
        setSummary(editPromptValue);
        setCurrentSummary(editPromptValue);
        editPromptValueRef.current = editPromptValue;
    }, [editPromptValue]);

    // Set originalSummary only when entering edit mode (editPromptDetailLevel/Structured changes from null to a value)
    useEffect(() => {
        if (editPromptDetailLevel && editPromptStructured) {
            setOriginalSummary(editPromptValueRef.current);
            setLocalEditPromptDetailLevel(editPromptDetailLevel);
            setLocalEditPromptStructured(editPromptStructured);
        }
    }, [editPromptDetailLevel, editPromptStructured]);

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
        const action = "prompt1";
        if (directPrompt.trim()) {
            logInteraction("commit_direct_instruction", {
                section_id: metadata.id,
                instruction: directPrompt.trim()
            });
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

    // Apply direct prompt to summary
    const handleApplyToSummary = async () => {
        const action = "applyToSummary";
        if (editPromptDetailLevel && editPromptStructured && directPrompt.trim()) {
            logInteraction("apply_instruction_summary", {
                section_id: metadata.id,
                instruction: directPrompt.trim(),
                detail_level: editPromptDetailLevel,
                structured: editPromptStructured,
                original_summary: originalSummary
            });
            setLoading(prev => ({ ...prev, [action]: true }));
            setError(prev => ({ ...prev, [action]: null }));
            try {
                await onPromptToSummary(editPromptDetailLevel, editPromptStructured, originalSummary, directPrompt.trim());
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

    // Commit summary to backend
    const handleSummaryCommit = async () => {
        const action = "prompt2";
        if (localEditPromptDetailLevel && localEditPromptStructured && currentSummary.trim()) {
            logInteraction("commit_modified_summary", {
                section_id: metadata.id,
                edited_summary: currentSummary.trim(),
                detail_level: localEditPromptDetailLevel,
                structured: localEditPromptStructured,
                original_summary: originalSummary
            });
            setLoading(prev => ({ ...prev, [action]: true }));
            setError(prev => ({ ...prev, [action]: null }));
            try {
                await onSummaryPrompt(localEditPromptDetailLevel, localEditPromptStructured, currentSummary.trim(), originalSummary);
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
            <div style={{ marginBottom: SPACING.MEDIUM }}>
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
                <VSCodeButton
                    appearance="secondary"
                    onClick={handleApplyToSummary}
                    disabled={
                        !directPrompt.trim() ||
                        !editPromptDetailLevel ||
                        !editPromptStructured ||
                        !summary.trim() ||
                        loading.applyToSummary
                    }
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.SMALL
                    }}
                    title="Apply instruction to summary"
                    aria-label="Apply instruction to summary"
                >
                    {loading.applyToSummary ? (
                        <>
                            <ClipLoader
                                color={COLORS.BUTTON_FOREGROUND}
                                size={FONT_SIZE.TINY}
                                cssOverride={{
                                    borderWidth: '2px',
                                    marginRight: SPACING.SMALL
                                }}
                            />
                            Applying...
                        </>
                    ) : (
                        <>
                            <span className="codicon codicon-arrow-down" style={{
                                fontSize: FONT_SIZE.ICON,
                                marginRight: SPACING.SMALL
                            }} />
                            Apply to Summary
                        </>
                    )}
                </VSCodeButton>
                {error.prompt1 && (
                    <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
                        {error.prompt1}
                    </div>
                )}
                {error.applyToSummary && (
                    <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
                        {error.applyToSummary}
                    </div>
                )}
            </div>

            {/* Summary-Mediated Prompt Section */}
            <div>
                <div style={COMMON_STYLES.SECTION_HEADER}>
                    <span style={COMMON_STYLES.SECTION_LABEL}>
                        Modifiable Code Summary
                        {localEditPromptDetailLevel && localEditPromptStructured
                            ? ` (${localEditPromptDetailLevel}, ${localEditPromptStructured})`
                            : ""}
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
                                opacity: (!currentSummary.trim() || currentSummary.trim() === originalSummary || !localEditPromptDetailLevel || !localEditPromptStructured || loading.prompt2) ? 0.5 : 1,
                                cursor: (!currentSummary.trim() || currentSummary.trim() === originalSummary || !localEditPromptDetailLevel || !localEditPromptStructured || loading.prompt2) ? "not-allowed" : "pointer"
                            }}
                            title="Send Modified Summary"
                            onClick={handleSummaryCommit}
                            disabled={!currentSummary.trim() || currentSummary.trim() === originalSummary || !localEditPromptDetailLevel || !localEditPromptStructured || loading.prompt2}
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

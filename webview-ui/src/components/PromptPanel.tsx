import React, { useState, useEffect, useRef } from "react";
import {
    VSCodeButton,
    VSCodeTextArea
} from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryDiffEditor } from "./SummaryDiffEditor";
import { SummaryLevel } from "../types/sectionTypes.js";
import { FONT_SIZE, SPACING, COMMON_STYLES } from "../styles/constants.js";
import { usePrompt } from "../hooks/usePrompt.js";

/**
 * Props for PromptPanel component, including all data required for summary edit backend communication.
 */
interface PromptPanelProps {
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    sectionId: string;
    originalCode: string;
    filename: string;
    fullPath: string;
    offset: number;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
    editPromptLevel,
    editPromptValue,
    sectionId,
    originalCode,
    filename,
    fullPath,
    offset,
}) => {
    const { onDirectPrompt, onPromptToSummary, onSummaryPrompt } = usePrompt();

    // Direct Prompt state
    const [directPrompt, setDirectPrompt] = useState("");
    // Summary state
    const [summary, setSummary] = useState(editPromptValue);

    // For summary diff editor
    const [currentSummary, setCurrentSummary] = useState<string>("");
    const [originalSummary, setOriginalSummary] = useState<string>("");
    const [localEditPromptLevel, setLocalEditPromptLevel] = useState<SummaryLevel | null>(null);
    const editPromptValueRef = useRef(editPromptValue);

    // Keep summary in sync with editPromptValue
    useEffect(() => {
        setSummary(editPromptValue);
        setCurrentSummary(editPromptValue);
        editPromptValueRef.current = editPromptValue;
    }, [editPromptValue]);

    // Set originalSummary only when entering edit mode (editPromptLevel changes from null to a value)
    useEffect(() => {
        if (editPromptLevel) {
            setOriginalSummary(editPromptValueRef.current);
            setLocalEditPromptLevel(editPromptLevel);
        }
    }, [editPromptLevel]);

    // Direct prompt send
    const handleDirectPromptSend = () => {
        if (directPrompt.trim()) {
            onDirectPrompt(sectionId, directPrompt.trim(), originalCode, filename, fullPath, offset);
        }
    };

    // Apply direct prompt to summary
    const handleApplyToSummary = () => {
        if (editPromptLevel && directPrompt.trim()) {
            setSummary(summary);
            onPromptToSummary(sectionId, editPromptLevel, summary, directPrompt.trim(), originalCode, filename, fullPath, offset);
        }
    };

    // Commit summary to backend
    const handleSummaryCommit = () => {
        if (localEditPromptLevel && currentSummary.trim()) {
            onSummaryPrompt(sectionId, localEditPromptLevel, currentSummary.trim(), originalCode, filename, fullPath, offset);
        }
    };

    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
            {/* Direct Instruction Prompt Section */}
            <div style={{ marginBottom: SPACING.MEDIUM }}>
                <div style={COMMON_STYLES.SECTION_HEADER}>
                    <span style={COMMON_STYLES.SECTION_LABEL}>Direct Instruction Prompt</span>
                    <button
                        style={COMMON_STYLES.ICON_BUTTON}
                        title="Send Direct Prompt"
                        onClick={handleDirectPromptSend}
                        disabled={!directPrompt.trim()}
                        aria-label="Send Direct Prompt"
                    >
                        <span className="codicon codicon-send" style={{ fontSize: FONT_SIZE.ICON }} />
                    </button>
                </div>
                <VSCodeTextArea
                    value={directPrompt}
                    onInput={e => setDirectPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ width: "100%", marginBottom: SPACING.TINY, fontFamily: "monospace", fontSize: FONT_SIZE.SMALL }}
                    placeholder="Enter a direct instruction."
                    resize="vertical"
                    rows={3}
                    disabled={false}
                />
                <VSCodeButton
                    appearance="secondary"
                    onClick={handleApplyToSummary}
                    disabled={
                        !directPrompt.trim() ||
                        !editPromptLevel ||
                        !summary.trim()
                    }
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.SMALL
                    }}
                    title="Apply instruction to summary"
                    aria-label="Apply instruction to summary"
                >
                    <span className="codicon codicon-arrow-down" style={{
                        fontSize: FONT_SIZE.ICON,
                        marginRight: SPACING.SMALL
                    }} />
                    Apply to Summary
                </VSCodeButton>
            </div>

            {/* Summary-Mediated Prompt Section */}
            <div>
                <div style={COMMON_STYLES.SECTION_HEADER}>
                    <span style={COMMON_STYLES.SECTION_LABEL}>
                        Summary-Mediated Prompt
                        {localEditPromptLevel ? ` (${localEditPromptLevel.charAt(0).toUpperCase() + localEditPromptLevel.slice(1)})` : ""}
                    </span>
                    <button
                        style={COMMON_STYLES.ICON_BUTTON}
                        title="Send Summary"
                        onClick={handleSummaryCommit}
                        disabled={!currentSummary.trim() || !localEditPromptLevel}
                        aria-label="Send Summary"
                    >
                        <span className="codicon codicon-send" style={{ fontSize: FONT_SIZE.ICON }} />
                    </button>
                </div>
                <SummaryDiffEditor
                    originalSummary={originalSummary}
                    currentSummary={currentSummary}
                    onChange={newValue => {
                        const valueStr = Array.isArray(newValue) ? newValue.join("\n") : newValue;
                        setCurrentSummary(valueStr);
                    }}
                />
            </div>
        </div>
    );
};

export default PromptPanel;

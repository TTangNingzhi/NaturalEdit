import React, { useState, useEffect } from "react";
import {
    VSCodeButton,
    VSCodeTextArea
} from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryLevel } from "../types/sectionTypes.js";
import { FONT_SIZE, SPACING, COMMON_STYLES } from "../styles/constants.js";

/**
 * Props for PromptPanel component
 */
interface PromptPanelProps {
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    onDirectPrompt: (prompt: string) => void;
    onEditSummary: (level: SummaryLevel, value: string) => void;
    onPromptToSummary: (level: SummaryLevel, summary: string, prompt: string) => void;
}


const PromptPanel: React.FC<PromptPanelProps> = ({
    editPromptLevel,
    editPromptValue,
    onDirectPrompt,
    onEditSummary,
    onPromptToSummary,
}) => {
    // Direct Prompt state
    const [directPrompt, setDirectPrompt] = useState("");
    // Summary state
    const [summary, setSummary] = useState(editPromptValue);

    // Keep summary in sync with editPromptValue
    useEffect(() => {
        setSummary(editPromptValue);
    }, [editPromptValue]);

    // Handlers
    const handleDirectPromptSend = () => {
        if (directPrompt.trim()) {
            onDirectPrompt(directPrompt.trim());
            setDirectPrompt("");
        }
    };

    const handleSummaryCommit = () => {
        if (editPromptLevel && summary.trim()) {
            onEditSummary(editPromptLevel, summary.trim());
        }
    };

    const handleApplyToSummary = () => {
        if (editPromptLevel && directPrompt.trim()) {
            onPromptToSummary(editPromptLevel, summary, directPrompt.trim());
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
                    style={{ width: "100%", marginBottom: SPACING.TINY }}
                    placeholder="Enter your instruction for code modification."
                    resize="vertical"
                    rows={3}
                />
                <VSCodeButton
                    appearance="secondary"
                    onClick={handleApplyToSummary}
                    disabled={!directPrompt.trim() || !editPromptLevel}
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
                        {editPromptLevel ? ` (${editPromptLevel.charAt(0).toUpperCase() + editPromptLevel.slice(1)})` : ""}
                    </span>
                    <button
                        style={COMMON_STYLES.ICON_BUTTON}
                        title="Send Summary"
                        onClick={handleSummaryCommit}
                        disabled={!summary.trim() || !editPromptLevel}
                        aria-label="Send Summary"
                    >
                        <span className="codicon codicon-send" style={{ fontSize: FONT_SIZE.ICON }} />
                    </button>
                </div>
                <VSCodeTextArea
                    value={summary}
                    onInput={e => setSummary((e.target as HTMLTextAreaElement).value)}
                    style={{ width: "100%" }}
                    placeholder="Edit the summary."
                    resize="vertical"
                    rows={3}
                    disabled={!editPromptLevel}
                />
            </div>
        </div>
    );
};

export default PromptPanel;

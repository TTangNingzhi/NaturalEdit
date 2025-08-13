import React from "react";
import { FONT_SIZE, COLORS, SPACING, BORDER_RADIUS, COMMON_STYLES } from "../styles/constants.js";
import { logInteraction } from "../utils/telemetry";

/**
 * Props for the SummaryDisplay component (baseline: only a string summary)
 */
interface SummaryDisplayProps {
    summary: string;
    onEditSummary?: (summary: string) => void;
    sectionId: string;
}

/**
 * SummaryDisplay component (baseline)
 * - Shows only the detailed summary as plain text
 * - Includes an edit button to load summary into the Summary-Mediated Prompt editor
 */
const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary, onEditSummary, sectionId }) => {
    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
            {/* Top row: label left, edit button right */}
            <div style={COMMON_STYLES.SECTION_HEADER}>
                <span style={COMMON_STYLES.SECTION_LABEL}>Natural Language Summary</span>
                <button
                    style={COMMON_STYLES.ICON_BUTTON}
                    aria-label="Edit In Prompt"
                    title="Edit In Prompt"
                    onClick={() => {
                        logInteraction("click_edit_in_prompt", { summary, section_id: sectionId });
                        if (onEditSummary) {
                            onEditSummary(summary);
                        }
                    }}
                >
                    <span className="codicon codicon-edit" style={{ fontSize: FONT_SIZE.ICON }} />
                </button>
            </div>
            <div style={{
                marginBottom: SPACING.SMALL,
                background: COLORS.BACKGROUND,
                borderRadius: BORDER_RADIUS.SMALL,
                display: "flex",
                alignItems: "flex-start"
            }}>
                <div style={{ flex: 1 }}>
                    <pre style={{
                        margin: 0,
                        whiteSpace: "pre-line",
                        fontFamily: "var(--vscode-font-family)",
                        fontSize: FONT_SIZE.BODY,
                        color: COLORS.FOREGROUND,
                        minHeight: 40,
                        background: "none",
                        border: "none"
                    }}>
                        {summary || <span style={{ color: COLORS.DESCRIPTION }}>Summary...</span>}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SummaryDisplay;

import React from "react";
import { FONT_SIZE, COLORS, SPACING, BORDER_RADIUS, COMMON_STYLES } from "../styles/constants.js";

/**
 * Props for the SummaryDisplay component (baseline: only a string summary)
 */
interface SummaryDisplayProps {
    summary: string;
}

/**
 * SummaryDisplay component (baseline)
 * - Shows only the detailed summary as plain text
 */
const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary }) => {
    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
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

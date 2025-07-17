import React from "react";
import { VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryData, SummaryLevel, SummaryCodeMapping } from "../types/sectionTypes.js";
import { FONT_SIZE, COLORS, SPACING, BORDER_RADIUS, COMMON_STYLES } from "../styles/constants.js";
import { renderDiffedTextWithMapping } from "../utils/diffRender";

/**
 * Props for the SummaryDisplay component
 */
interface SummaryDisplayProps {
    summary: SummaryData;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    summaryMappings?: {
        concise?: SummaryCodeMapping[];
        detailed?: SummaryCodeMapping[];
        bullets?: SummaryCodeMapping[];
    };
    activeMappingIndex?: number | null;
    onMappingHover?: (index: number | null) => void;
    oldSummaryData?: SummaryData; // Optional: previous summary for diff rendering
}

/**
 * SummaryDisplay component
 * - Shows the summary title (not editable)
 * - Shows a segmented toggle for Concise, Detailed, Bulleted
 * - Shows the selected summary with an "Edit In Prompt" button (except for Title)
 * - Uses VSCode Webview UI Toolkit React components
 */
const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
    summary,
    selectedLevel,
    onLevelChange,
    onEditPrompt,
    summaryMappings = {},
    activeMappingIndex,
    onMappingHover,
    oldSummaryData
}) => {
    // Get the value for the selected summary level
    const getSummaryValue = (level: SummaryLevel) => {
        if (level === "concise") return summary.concise;
        if (level === "detailed") return summary.detailed;
        if (level === "bullets") return summary.bullets.join("\n");
        return "";
    };

    // Handle "Edit In Prompt" button click
    const handleEdit = () => {
        onEditPrompt(selectedLevel, getSummaryValue(selectedLevel));
    };

    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
            {/* Option row: options left, edit button right */}
            <div style={COMMON_STYLES.SECTION_HEADER}>
                <VSCodeRadioGroup
                    orientation="horizontal"
                    value={selectedLevel}
                    onChange={(e: unknown) => {
                        const value = ((e as Event).target as HTMLInputElement).value as SummaryLevel;
                        onLevelChange(value);
                    }}
                    style={{
                        marginBottom: SPACING.MINUS_TINY,
                        marginTop: SPACING.MINUS_TINY
                    }}
                >
                    <VSCodeRadio value="concise">Concise</VSCodeRadio>
                    <VSCodeRadio value="detailed">Detailed</VSCodeRadio>
                    <VSCodeRadio value="bullets">Bulleted</VSCodeRadio>
                </VSCodeRadioGroup>
                <button
                    style={COMMON_STYLES.ICON_BUTTON}
                    aria-label="Edit In Prompt"
                    title="Edit In Prompt"
                    onClick={handleEdit}
                >
                    <span className="codicon codicon-edit" style={{ fontSize: FONT_SIZE.ICON }} />
                </button>
            </div>

            {/* Selected summary card with placeholder */}
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
                        {selectedLevel === "concise" &&
                            renderDiffedTextWithMapping(
                                oldSummaryData && oldSummaryData.concise !== undefined
                                    ? oldSummaryData.concise
                                    : summary.concise || "",
                                summary.concise || "",
                                summaryMappings.concise || [],
                                activeMappingIndex,
                                onMappingHover
                            )
                        }
                        {selectedLevel === "detailed" &&
                            renderDiffedTextWithMapping(
                                oldSummaryData && oldSummaryData.detailed !== undefined
                                    ? oldSummaryData.detailed
                                    : summary.detailed || "",
                                summary.detailed || "",
                                summaryMappings.detailed || [],
                                activeMappingIndex,
                                onMappingHover
                            )
                        }
                        {selectedLevel === "bullets" && (
                            summary.bullets.length > 0
                                ? renderDiffedTextWithMapping(
                                    oldSummaryData && oldSummaryData.bullets !== undefined
                                        ? (oldSummaryData.bullets || []).join("\n")
                                        : summary.bullets.join("\n"),
                                    summary.bullets.join("\n"),
                                    summaryMappings.bullets || [],
                                    activeMappingIndex,
                                    onMappingHover
                                )
                                : <span style={{ color: COLORS.DESCRIPTION }}>Bulleted summary...</span>
                        )}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SummaryDisplay;

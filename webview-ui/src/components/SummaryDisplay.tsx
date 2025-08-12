import React from "react";
import { SummaryData, DetailLevel, StructuredType, SummaryCodeMapping } from "../types/sectionTypes.js";
import { FONT_SIZE, COLORS, SPACING, BORDER_RADIUS, COMMON_STYLES } from "../styles/constants.js";
import { renderDiffedTextWithMapping } from "../utils/diffRender";
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";

/**
 * Props for the SummaryDisplay component
 */
interface SummaryDisplayProps {
    summary: SummaryData;
    selectedDetailLevel: DetailLevel;
    selectedStructured: StructuredType;
    onLevelChange: (detail: DetailLevel, structured: StructuredType) => void;
    onEditPrompt: (detail: DetailLevel, structured: StructuredType, value: string) => void;
    summaryMappings?: {
        [key: string]: SummaryCodeMapping[];
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
    selectedDetailLevel,
    selectedStructured,
    onLevelChange,
    onEditPrompt,
    summaryMappings = {},
    activeMappingIndex,
    onMappingHover,
    oldSummaryData
}) => {
    // Get the value for the selected summary type
    const getSummaryKey = (detail: DetailLevel, structured: StructuredType) =>
        `${detail}_${structured}` as keyof SummaryData;

    const getSummaryValue = (detail: DetailLevel, structured: StructuredType) =>
        summary[getSummaryKey(detail, structured)] || "";

    // --- Disambiguate repeated summary components ---
    function disambiguateSummaryAndMappings(
        summaryText: string,
        mappings: SummaryCodeMapping[]
    ): { disambigSummary: string; disambigMappings: (SummaryCodeMapping & { disambigIndex?: number })[] } {
        // 1. Count occurrences of each summaryComponent
        const countMap: Record<string, number> = {};
        mappings.forEach(m => {
            countMap[m.summaryComponent] = (countMap[m.summaryComponent] || 0) + 1;
        });

        // 2. For repeated components, assign disambigIndex ONLY in mapping, not in summary text
        const seenMap: Record<string, number> = {};
        const disambigMappings = mappings.map(m => {
            const total = countMap[m.summaryComponent];
            if (total > 1) {
                seenMap[m.summaryComponent] = (seenMap[m.summaryComponent] || 0) + 1;
                return {
                    ...m,
                    disambigIndex: seenMap[m.summaryComponent]
                };
            } else {
                return { ...m, disambigIndex: 1 };
            }
        });

        // 3. Keep summaryText unchanged, do not perform any replacements
        return { disambigSummary: summaryText, disambigMappings };
    }

    // Handle "Edit In Prompt" button click
    const handleEdit = () => {
        onEditPrompt(selectedDetailLevel, selectedStructured, getSummaryValue(selectedDetailLevel, selectedStructured));
    };

    // Slider values and labels
    const detailLevels: DetailLevel[] = ["low", "medium", "high"];

    // Mapping key for summaryMappings
    const mappingKey = getSummaryKey(selectedDetailLevel, selectedStructured);

    // Disambiguate summary and mappings for rendering
    const { disambigSummary, disambigMappings } = disambiguateSummaryAndMappings(
        getSummaryValue(selectedDetailLevel, selectedStructured),
        summaryMappings[mappingKey] || []
    );

    return (
        <div style={COMMON_STYLES.SECTION_COMPACT}>
            {/* Option row: slider and toggle left, edit button right */}
            <div style={COMMON_STYLES.SECTION_HEADER}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Structured toggle */}
                    <VSCodeCheckbox
                        className="small-checkbox"
                        checked={selectedStructured === "structured"}
                        onChange={e => {
                            const checked = (e.target as HTMLInputElement).checked;
                            onLevelChange(
                                selectedDetailLevel,
                                checked ? "structured" : "unstructured"
                            );
                        }}
                        aria-label="Structured"
                    >
                        Structured
                    </VSCodeCheckbox>
                    {/* Detail label and slider as a group */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {/* Use theme color for label */}
                        <span style={{ fontSize: "13px", color: COLORS.DESCRIPTION }}>Granularity</span>
                        <input
                            type="range"
                            min={0}
                            max={2}
                            step={1}
                            value={detailLevels.indexOf(selectedDetailLevel)}
                            onChange={e => {
                                const idx = Number(e.target.value);
                                onLevelChange(detailLevels[idx], selectedStructured);
                            }}
                            className="themed-slider"
                            aria-label="Detail Level"
                        />
                    </div>
                </div>
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
                        whiteSpace: "pre-wrap",
                        fontFamily: "var(--vscode-font-family)",
                        fontSize: FONT_SIZE.BODY,
                        color: COLORS.FOREGROUND,
                        minHeight: 40,
                        background: "none",
                        border: "none"
                    }}>
                        {renderDiffedTextWithMapping(
                            oldSummaryData && oldSummaryData[getSummaryKey(selectedDetailLevel, selectedStructured)] !== undefined
                                ? oldSummaryData[getSummaryKey(selectedDetailLevel, selectedStructured)] as string
                                : disambigSummary,
                            disambigSummary,
                            disambigMappings,
                            activeMappingIndex,
                            onMappingHover
                        )}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SummaryDisplay;

import React from "react";
import { VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryData, SummaryLevel, SummaryCodeMapping } from "../types/sectionTypes.js";
import { FONT_SIZE, COLORS, SPACING, BORDER_RADIUS, COMMON_STYLES, SUMMARY_CODE_MAPPING_COLORS } from "../styles/constants.js";
import DiffMatchPatch from "diff-match-patch";

/**
 * Props for the SummaryDisplay component
 */
interface SummaryDisplayProps {
    summary: SummaryData;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    summaryCodeMappings?: SummaryCodeMapping[];
    activeMappingIndex?: number | null;
    onMappingHover?: (index: number | null) => void;
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
    summaryCodeMappings = [],
    activeMappingIndex,
    onMappingHover
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

    /**
     * Renders a summary string with mapping highlights using fuzzy matching (diff-match-patch).
     * This function highlights mapped components in the summary text.
     * The logic is unified for all summary types (concise, detailed, bullets).
     */
    const renderSummaryWithMapping = (
        text: string,
        mappings: SummaryCodeMapping[],
        globalIndices?: number[]
    ) => {
        if (!mappings || mappings.length === 0) {
            // Fallback to plain text if no mapping
            return text || <span style={{ color: COLORS.DESCRIPTION }}>Summary...</span>;
        }

        const dmp = new DiffMatchPatch();
        const used: Array<[number, number]> = [];
        const elements: React.ReactNode[] = [];
        let cursor = 0;

        // Checks if a range overlaps with any used range
        const isOverlapping = (start: number, end: number) =>
            used.some(([uStart, uEnd]) => !(end <= uStart || start >= uEnd));

        // Finds the best match for a component in the text
        const findBestMatch = (comp: string, searchStart: number): [number, number] | null => {
            const BITAP_LIMIT = 32; // limit for fuzzy match

            // 1. Try exact match (case-sensitive)
            let matchIdx = text.indexOf(comp, searchStart);
            if (matchIdx !== -1) {
                return [matchIdx, matchIdx + comp.length];
            }

            // 2. Try exact match (case-insensitive)
            matchIdx = text.toLowerCase().indexOf(comp.toLowerCase(), searchStart);
            if (matchIdx !== -1) {
                return [matchIdx, matchIdx + comp.length];
            }

            // 3. Try fuzzy match if pattern is short enough
            if (comp.length <= BITAP_LIMIT) {
                try {
                    matchIdx = dmp.match_main(text.toLowerCase(), comp.toLowerCase(), searchStart);
                    if (matchIdx !== -1) {
                        return [matchIdx, matchIdx + comp.length];
                    }
                } catch {
                    // If fuzzy match fails, skip to next position
                    return null;
                }
            }

            return null;
        };

        // Process each mapping
        mappings.forEach((mapping: SummaryCodeMapping, localIdx: number) => {
            const comp = mapping.summaryComponent;
            if (!comp) return;

            let searchStart = 0;
            while (searchStart < text.length) {
                const match = findBestMatch(comp, searchStart);
                if (!match) break;

                const [matchIdx, matchEnd] = match;
                if (!isOverlapping(matchIdx, matchEnd)) {
                    // Found a non-overlapping match
                    used.push([matchIdx, matchEnd]);

                    // Add text before the match
                    if (cursor < matchIdx) {
                        elements.push(
                            <span key={`plain-${localIdx}-${cursor}`}>
                                {text.slice(cursor, matchIdx)}
                            </span>
                        );
                    }

                    // Add the highlighted match
                    const globalIdx = globalIndices ? globalIndices[localIdx] : localIdx;
                    elements.push(
                        <span
                            key={`map-${localIdx}`}
                            style={{
                                background: SUMMARY_CODE_MAPPING_COLORS[globalIdx % SUMMARY_CODE_MAPPING_COLORS.length] +
                                    (activeMappingIndex === globalIdx ? "CC" : "40"),
                                borderRadius: BORDER_RADIUS.SMALL,
                                padding: "0 2px",
                                margin: "0 1px",
                                cursor: "pointer",
                                transition: "background 0.15s"
                            }}
                            onMouseEnter={() => onMappingHover && onMappingHover(globalIdx)}
                            onMouseLeave={() => onMappingHover && onMappingHover(null)}
                        >
                            {text.slice(matchIdx, matchEnd)}
                        </span>
                    );

                    cursor = matchEnd;
                    return;
                }

                // If overlapping, continue searching
                searchStart = matchIdx + 1;
            }

            // Log if no match found
            // Only log for non-empty components
            if (comp) {
                console.error(
                    "[SummaryDisplay] Could not match summaryComponent in summary (non-overlapping):",
                    { summaryComponent: comp, summaryText: text }
                );
            }
        });

        // Add remaining text
        if (cursor < text.length) {
            elements.push(
                <span key="plain-end">{text.slice(cursor)}</span>
            );
        }

        return elements;
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
                            renderSummaryWithMapping(summary.concise || "", summaryCodeMappings)
                        }
                        {selectedLevel === "detailed" &&
                            renderSummaryWithMapping(summary.detailed || "", summaryCodeMappings)
                        }
                        {selectedLevel === "bullets" && (
                            summary.bullets.length > 0
                                ? renderSummaryWithMapping(summary.bullets.join("\n"), summaryCodeMappings)
                                : <span style={{ color: COLORS.DESCRIPTION }}>Bulleted summary...</span>
                        )}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SummaryDisplay;

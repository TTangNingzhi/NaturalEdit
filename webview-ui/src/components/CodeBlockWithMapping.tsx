/**
 * @deprecated
 * This component is deprecated and should NOT be used in production code.
 * It is kept only for debugging or future reference.
 * Do NOT import or use this file elsewhere unless you are debugging mapping logic.
 *
 * Deprecated by: summary-to-code highlight feature (see SectionBody/SummaryDisplay).
 *
 * ---------------------------
 * How to use for debugging:
 * ---------------------------
 * To debug summary-code mapping highlights, you can temporarily re-enable this component in SectionBody.tsx.
 * Example usage in SectionBody:
 *
 *   <div style={{ marginBottom: SPACING.MEDIUM }}>
 *     <CodeBlockWithMapping
 *       code={section.metadata.originalCode}
 *       mappings={rawMappings}
 *       activeMappingIndex={activeMappingIndex}
 *     />
 *   </div>
 */

import React from "react";
import { SummaryCodeMapping } from "../types/sectionTypes";
import { FONT_SIZE, BORDER_RADIUS, SUMMARY_CODE_MAPPING_COLORS } from "../styles/constants";
import DiffMatchPatch from "diff-match-patch";

/**
 * Props for the CodeBlockWithMapping component
 */
interface CodeBlockWithMappingProps {
    code: string;
    mappings?: SummaryCodeMapping[];
    activeMappingIndex?: number | null;
}

/**
 * Renders a code block with highlighted segments based on summary-code mappings.
 * Each mapping is visualized with a unique background color.
 */
const CodeBlockWithMapping: React.FC<CodeBlockWithMappingProps> = ({
    code,
    mappings = [],
    activeMappingIndex = null
}) => {
    // Normalize code to \n line endings for all operations
    const normalizedCode = code.replace(/\r\n/g, "\n");
    // Split code into lines for easier mapping
    const codeLines = normalizedCode.split("\n");


    // Only compute highlights for the currently active mapping index
    function getActiveMappingCharRanges(): { start: number; end: number }[] {
        if (
            activeMappingIndex === null ||
            activeMappingIndex === undefined ||
            !mappings[activeMappingIndex]
        ) {
            return [];
        }
        const dmp = new DiffMatchPatch();
        const ranges: { start: number; end: number }[] = [];
        // Use normalized code for all matching
        const codeText = normalizedCode;
        mappings[activeMappingIndex].codeSnippets.forEach(snippet => {
            if (!snippet.trim()) return;
            const pattern = snippet.replace(/\r\n/g, "\n");
            try {
                // 1. Try exact match (case-sensitive)
                let loc = codeText.indexOf(pattern);
                // 2. Try exact match (case-insensitive)
                if (loc === -1) {
                    loc = codeText.toLowerCase().indexOf(pattern.toLowerCase());
                }
                // 3. Try fuzzy match if pattern is short enough for diff-match-patch
                const BITAP_LIMIT = 32;
                if (loc === -1 && pattern.length <= BITAP_LIMIT) {
                    try {
                        loc = dmp.match_main(codeText, pattern, 0);
                        if (loc === -1) {
                            loc = dmp.match_main(codeText.toLowerCase(), pattern.toLowerCase(), 0);
                        }
                    } catch (e) {
                        // Ignore Bitap errors for short patterns
                        console.error("[CodeBlockWithMapping] diff-match-patch error:", e, { codeSnippet: snippet, code });
                    }
                }
                // 4. For long patterns, slide a window and use fuzzy match
                if (loc === -1 && pattern.length > BITAP_LIMIT) {
                    let bestScore = 0;
                    let bestLoc = -1;
                    for (let i = 0; i <= codeText.length - BITAP_LIMIT; i++) {
                        const window = codeText.substr(i, BITAP_LIMIT);
                        let score = 0;
                        try {
                            const diffs = dmp.diff_main(window, pattern.substr(0, BITAP_LIMIT));
                            dmp.diff_cleanupSemantic(diffs);
                            // Calculate similarity: (BITAP_LIMIT - total edit distance) / BITAP_LIMIT
                            let editDistance = 0;
                            diffs.forEach(d => {
                                if (d[0] !== 0) editDistance += d[1].length;
                            });
                            score = (BITAP_LIMIT - editDistance) / BITAP_LIMIT;
                            if (score > bestScore) {
                                bestScore = score;
                                bestLoc = i;
                            }
                        } catch (e) {
                            score = 0;
                            console.error("[CodeBlockWithMapping] diff-match-patch error:", e, { codeSnippet: snippet, code });
                        }
                    }
                    // Accept if similarity is high enough (e.g., >90%)
                    if (bestScore > 0.9) {
                        loc = bestLoc;
                    }
                }
                if (loc !== -1) {
                    ranges.push({
                        start: loc,
                        end: loc + pattern.length
                    });
                } else {
                    // Log all codeSnippets that cannot be matched
                    console.error(
                        "[CodeBlockWithMapping] Could not match codeSnippet in code:",
                        { codeSnippet: snippet, code }
                    );
                }
            } catch (e) {
                // Only log unexpected errors
                if (!/Pattern too long/.test(String(e))) {
                    console.error("[CodeBlockWithMapping] diff-match-patch error:", e, { codeSnippet: snippet, code });
                }
            }
        });
        return ranges;
    }

    /**
     * For a given line, return an array of { startCol, endCol } for all highlights in this line for the active mapping.
     */
    function getHighlightsForLine(lineIdx: number): { startCol: number; endCol: number }[] {
        const highlights: { startCol: number; endCol: number }[] = [];
        const lineStartChar = codeLines.slice(0, lineIdx).reduce((acc, l) => acc + l.length + 1, 0); // +1 for \n
        const lineEndChar = lineStartChar + codeLines[lineIdx].length;
        getActiveMappingCharRanges().forEach(({ start, end }) => {
            // If the highlight overlaps with this line
            if (end > lineStartChar && start < lineEndChar) {
                highlights.push({
                    startCol: Math.max(0, start - lineStartChar),
                    endCol: Math.min(codeLines[lineIdx].length, end - lineStartChar)
                });
            }
        });
        // Sort by startCol
        highlights.sort((a, b) => a.startCol - b.startCol);
        return highlights;
    }

    return (
        <pre
            style={{
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: FONT_SIZE.BODY,
                background: "var(--vscode-editor-background, #1e1e1e)",
                color: "var(--vscode-editor-foreground, #d4d4d4)",
                borderRadius: BORDER_RADIUS.MEDIUM,
                padding: "8px",
                overflowX: "auto",
                margin: 0,
                position: "relative"
            }}
        >
            {codeLines.map((line, idx) => {
                const highlights = getHighlightsForLine(idx);
                if (highlights.length === 0) {
                    return (
                        <div key={idx}>{line}</div>
                    );
                }
                // Render line with highlights
                const segments: React.ReactNode[] = [];
                let lastCol = 0;
                highlights.forEach((hl, i) => {
                    if (hl.startCol > lastCol) {
                        segments.push(
                            <span key={`plain-${i}`}>{line.slice(lastCol, hl.startCol)}</span>
                        );
                    }
                    // Only one mapping is active, so use the color from SUMMARY_CODE_MAPPING_COLORS
                    segments.push(
                        <span
                            key={`hl-${i}`}
                            style={{
                                background: SUMMARY_CODE_MAPPING_COLORS[activeMappingIndex!] + "CC",
                                borderRadius: BORDER_RADIUS.SMALL,
                                transition: "background 0.15s"
                            }}
                        >
                            {line.slice(hl.startCol, hl.endCol)}
                        </span>
                    );
                    lastCol = hl.endCol;
                });
                if (lastCol < line.length) {
                    segments.push(
                        <span key="plain-end">{line.slice(lastCol)}</span>
                    );
                }
                return (
                    <div key={idx}>{segments}</div>
                );
            })}
        </pre>
    );
};

export default CodeBlockWithMapping;

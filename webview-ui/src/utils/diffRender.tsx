// Utility for rendering text diffs using diff-match-patch (dmp).
// New text is rendered in red, deleted text is omitted.

import React from "react";
import DiffMatchPatch from "diff-match-patch";
import { SummaryCodeMapping } from "../types/sectionTypes";
import { SUMMARY_CODE_MAPPING_COLORS, BORDER_RADIUS } from "../styles/constants";

/**
 * Renders the diff between oldText and newText.
 * - New text is wrapped in a <span style="color: red">...</span>
 * - Deleted text is omitted.
 * - Unchanged text is rendered normally.
 * 
 * @param oldText The original text.
 * @param newText The new text.
 * @returns A React node with diffed rendering.
 */
export function renderDiffedText(oldText: string, newText: string): React.ReactNode {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldText || "", newText || "");
  dmp.diff_cleanupSemantic(diffs);

  // Map diffs to React nodes
  return (
    <>
      {diffs.map(([op, data]: [number, string], idx: number) =>
        op === DiffMatchPatch.DIFF_INSERT ? (
          <span key={idx} style={{ color: "red" }}>{data}</span>
        ) : op === DiffMatchPatch.DIFF_DELETE ? null : (
          <span key={idx}>{data}</span>
        )
      )}
    </>
  );
}

/**
 * Renders the diff between oldText and newText, with mapping highlights applied to the new text.
 * - Inserted text is rendered in red, but mapping highlights are still applied.
 * - Deleted text is omitted.
 * - Unchanged text is rendered normally, with mapping highlights if applicable.
 * - Mapping is always applied to the new text, regardless of diff.
 * 
 * @param oldText The original text.
 * @param newText The new text.
 * @param mappings The summary code mappings to highlight.
 * @param activeMappingIndex The currently active mapping index (for hover effect).
 * @param onMappingHover Callback for mapping hover.
 * @returns A React node with diffed and mapping-highlighted rendering.
 */
export function renderDiffedTextWithMapping(
  oldText: string,
  newText: string,
  mappings: SummaryCodeMapping[] = [],
  activeMappingIndex?: number | null,
  onMappingHover?: (index: number | null) => void
): React.ReactNode {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldText || "", newText || "");
  dmp.diff_cleanupSemantic(diffs);

  // Helper to apply mapping highlights to a text segment
  function renderWithMapping(
    text: string,
    mappings: SummaryCodeMapping[],
    colorOverride?: React.CSSProperties
  ): React.ReactNode[] {
    if (!mappings || mappings.length === 0 || !text) {
      return [<span style={colorOverride} key="plain">{text}</span>];
    }

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
              <span key={`plain-${localIdx}-${cursor}`} style={colorOverride}>
                {text.slice(cursor, matchIdx)}
              </span>
            );
          }

          // Add the highlighted match
          elements.push(
            <span
              key={`map-${localIdx}-${matchIdx}`}
              style={{
                background: SUMMARY_CODE_MAPPING_COLORS[localIdx % SUMMARY_CODE_MAPPING_COLORS.length] +
                  (activeMappingIndex === localIdx ? "CC" : "40"),
                borderRadius: BORDER_RADIUS.SMALL,
                padding: "0 2px",
                margin: "0 1px",
                cursor: "pointer",
                transition: "background 0.15s",
                ...colorOverride
              }}
              onMouseEnter={() => onMappingHover && onMappingHover(localIdx)}
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
    });

    // Add remaining text
    if (cursor < text.length) {
      elements.push(
        <span key="plain-end" style={colorOverride}>{text.slice(cursor)}</span>
      );
    }

    return elements;
  }

  // Compose the final output by processing each diff segment
  const output: React.ReactNode[] = [];
  let idx = 0;
  diffs.forEach(([op, data]: [number, string]) => {
    if (op === DiffMatchPatch.DIFF_INSERT) {
      // Inserted text: render in red, but still apply mapping highlights
      output.push(
        ...renderWithMapping(
          data,
          mappings,
          { color: "red" }
        ).map((el, i) => React.cloneElement(el as React.ReactElement, { key: `ins-${idx}-${i}` }))
      );
    } else if (op === DiffMatchPatch.DIFF_EQUAL) {
      // Unchanged text: render normally, but still apply mapping highlights
      output.push(
        ...renderWithMapping(
          data,
          mappings
        ).map((el, i) => React.cloneElement(el as React.ReactElement, { key: `eq-${idx}-${i}` }))
      );
    }
    // Deleted text is omitted
    idx++;
  });

  return <>{output}</>;
}

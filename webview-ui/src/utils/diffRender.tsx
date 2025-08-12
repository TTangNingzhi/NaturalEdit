// Utility for rendering text diffs using diff-match-patch (dmp).
// New text is rendered in red, deleted text is omitted.

import React from "react";
import DiffMatchPatch from "diff-match-patch";
import { SummaryCodeMapping } from "../types/sectionTypes";
import { SUMMARY_CODE_MAPPING_COLORS, BORDER_RADIUS, COLORS, getMappingHighlightBackground } from "../styles/constants";

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
          <span key={idx} style={{ color: COLORS.TEXT_DIFF }}>{data}</span>
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
  mappings: (SummaryCodeMapping & { disambigIndex?: number })[] = [],
  activeMappingIndex?: number | null,
  onMappingHover?: (index: number | null) => void
): React.ReactNode {
  // --- Step 1: Compute diff regions in newText ---
  // Each region: { start, end, type: "equal" | "insert" }
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldText || "", newText || "");
  dmp.diff_cleanupSemantic(diffs);

  // Build diff regions: each with start, end, type
  type DiffRegion = { start: number; end: number; type: "equal" | "insert" };
  const diffRegions: DiffRegion[] = [];
  let cursor = 0;
  for (const [op, data] of diffs as [number, string][]) {
    if (op === DiffMatchPatch.DIFF_DELETE) continue; // Deleted text is omitted
    const len = data.length;
    diffRegions.push({
      start: cursor,
      end: cursor + len,
      type: op === DiffMatchPatch.DIFF_INSERT ? "insert" : "equal",
    });
    cursor += len;
  }

  // --- Step 2: Compute mapping regions in newText ---
  // Each region: { start, end, mappingIndex }
  type MappingRegion = { start: number; end: number; mappingIndex: number };
  const mappingRegions: MappingRegion[] = [];
  if (mappings && mappings.length > 0 && newText) {
    // For each mapping, find the Nth (disambigIndex) occurrence in newText
    const used: Array<[number, number]> = [];
    const isOverlapping = (start: number, end: number) =>
      used.some(([uStart, uEnd]) => !(end <= uStart || start >= uEnd));

    // Helper: find the start index of the nth (1-based) occurrence of subStr in str
    function findNthOccurrence(str: string, subStr: string, n: number): number {
      if (!subStr) return -1;
      let idx = -1;
      let count = 0;
      while (count < n) {
        idx = str.indexOf(subStr, idx + 1);
        if (idx === -1) return -1;
        count++;
      }
      return idx;
    }

    for (let i = 0; i < mappings.length; ++i) {
      const mapping = mappings[i] as SummaryCodeMapping & { disambigIndex?: number };
      const comp = mapping.summaryComponent;
      const disambigIndex = mapping.disambigIndex || 1;
      if (!comp) continue;
      // Find the nth occurrence (case-sensitive only, for precision)
      const matchIdx = findNthOccurrence(newText, comp, disambigIndex);
      if (matchIdx !== -1) {
        const matchEnd = matchIdx + comp.length;
        if (!isOverlapping(matchIdx, matchEnd)) {
          mappingRegions.push({ start: matchIdx, end: matchEnd, mappingIndex: i });
          used.push([matchIdx, matchEnd]);
        }
      }
    }
    // Sort mapping regions by start index
    mappingRegions.sort((a, b) => a.start - b.start);
  }

  // --- Step 3: Render output with unbroken mapping highlights ---
  const output: React.ReactNode[] = [];
  let pos = 0;

  // Helper: render a substring with diff coloring, given a range [start, end)
  function renderDiffColored(start: number, end: number, keyPrefix: string) {
    const nodes: React.ReactNode[] = [];
    let idx = 0;
    for (const region of diffRegions) {
      if (region.end <= start) continue;
      if (region.start >= end) break;
      const segStart = Math.max(region.start, start);
      const segEnd = Math.min(region.end, end);
      if (segStart >= segEnd) continue;
      const text = newText.slice(segStart, segEnd);
      if (!text) continue;
      if (region.type === "insert") {
        nodes.push(
          <span key={`${keyPrefix}-ins-${idx}`} style={{ color: COLORS.TEXT_DIFF }}>
            {text}
          </span>
        );
      } else {
        nodes.push(
          <span key={`${keyPrefix}-eq-${idx}`}>{text}</span>
        );
      }
      idx++;
    }
    return nodes;
  }

  // Merge mapping and non-mapping regions, and render accordingly
  let mappingIdx = 0;
  while (pos < newText.length) {
    // Find the next mapping region that starts at or after pos
    const nextMapping = mappingRegions[mappingIdx] && mappingRegions[mappingIdx].start >= pos
      ? mappingRegions[mappingIdx]
      : mappingRegions.find(m => m.start >= pos);

    if (nextMapping && nextMapping.start === pos) {
      // Render mapping region as a single highlight span, with nested diff coloring
      const { start, end, mappingIndex } = nextMapping;
      const style: React.CSSProperties = {
        ...getMappingHighlightBackground(
          SUMMARY_CODE_MAPPING_COLORS[mappingIndex % SUMMARY_CODE_MAPPING_COLORS.length],
          activeMappingIndex === mappingIndex
        ),
        borderRadius: BORDER_RADIUS.SMALL,
        padding: "0 2px",
        margin: "0 1px",
        cursor: "pointer"
      };
      output.push(
        <span
          key={`map-${mappingIndex}-${start}`}
          style={style}
          onMouseEnter={() => onMappingHover && onMappingHover(mappingIndex)}
          onMouseLeave={() => onMappingHover && onMappingHover(null)}
        >
          {renderDiffColored(start, end, `map-${mappingIndex}-${start}`)}
        </span>
      );
      pos = end;
      mappingIdx = mappingRegions.findIndex(m => m.start > pos) !== -1
        ? mappingRegions.findIndex(m => m.start > pos)
        : mappingRegions.length;
    } else {
      // Render non-mapping region (from pos to next mapping or end)
      const nextStart = nextMapping ? nextMapping.start : newText.length;
      output.push(...renderDiffColored(pos, nextStart, `plain-${pos}`));
      pos = nextStart;
    }
  }

  return <>{output}</>;
}

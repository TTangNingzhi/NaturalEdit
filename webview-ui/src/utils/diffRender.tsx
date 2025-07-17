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
    // For each mapping, find all non-overlapping matches in newText
    const used: Array<[number, number]> = [];
    const isOverlapping = (start: number, end: number) =>
      used.some(([uStart, uEnd]) => !(end <= uStart || start >= uEnd));
    for (let i = 0; i < mappings.length; ++i) {
      const comp = mappings[i].summaryComponent;
      if (!comp) continue;
      let searchStart = 0;
      while (searchStart < newText.length) {
        // Try exact match (case-sensitive)
        let matchIdx = newText.indexOf(comp, searchStart);
        if (matchIdx === -1) {
          // Try exact match (case-insensitive)
          matchIdx = newText.toLowerCase().indexOf(comp.toLowerCase(), searchStart);
        }
        if (matchIdx === -1) break;
        const matchEnd = matchIdx + comp.length;
        if (!isOverlapping(matchIdx, matchEnd)) {
          mappingRegions.push({ start: matchIdx, end: matchEnd, mappingIndex: i });
          used.push([matchIdx, matchEnd]);
          searchStart = matchEnd;
        } else {
          searchStart = matchIdx + 1;
        }
      }
    }
    // Sort mapping regions by start index
    mappingRegions.sort((a, b) => a.start - b.start);
  }

  // --- Step 3: Merge mapping and diff regions into minimal non-overlapping segments ---
  // Each segment: { start, end, mappingIndex: number|null, diffType: "equal"|"insert" }
  type Segment = { start: number; end: number; mappingIndex: number | null; diffType: "equal" | "insert" };

  // Collect all split points (start/end of mapping and diff regions)
  const splitPoints = new Set<number>();
  diffRegions.forEach(r => { splitPoints.add(r.start); splitPoints.add(r.end); });
  mappingRegions.forEach(r => { splitPoints.add(r.start); splitPoints.add(r.end); });
  splitPoints.add(0);
  splitPoints.add(newText.length);
  const sortedPoints = Array.from(splitPoints).sort((a, b) => a - b);

  // For each segment between split points, determine mappingIndex and diffType
  const segments: Segment[] = [];
  for (let i = 0; i < sortedPoints.length - 1; ++i) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];
    if (segStart >= segEnd) continue;
    // Find mappingIndex (if any)
    let mappingIndex: number | null = null;
    for (const m of mappingRegions) {
      if (segStart >= m.start && segEnd <= m.end) {
        mappingIndex = m.mappingIndex;
        break;
      }
    }
    // Find diffType
    let diffType: "equal" | "insert" = "equal";
    for (const d of diffRegions) {
      if (segStart >= d.start && segEnd <= d.end) {
        diffType = d.type;
        break;
      }
    }
    segments.push({ start: segStart, end: segEnd, mappingIndex, diffType });
  }

  // --- Step 4: Render segments ---
  const output: React.ReactNode[] = [];
  for (let i = 0; i < segments.length; ++i) {
    const { start, end, mappingIndex, diffType } = segments[i];
    const text = newText.slice(start, end);
    if (!text) continue;

    // Build style for mapping highlight (if any)
    const style: React.CSSProperties = {};
    if (mappingIndex !== null) {
      style.background =
        SUMMARY_CODE_MAPPING_COLORS[mappingIndex % SUMMARY_CODE_MAPPING_COLORS.length] +
        (activeMappingIndex === mappingIndex ? "CC" : "40");
      style.borderRadius = BORDER_RADIUS.SMALL;
      style.padding = "0 2px";
      style.margin = "0 1px";
      style.cursor = "pointer";
      style.transition = "background 0.15s";
    }
    if (diffType === "insert") {
      style.color = "red";
    }

    // Render with mapping highlight and/or diff coloring
    if (mappingIndex !== null) {
      output.push(
        <span
          key={`map-${i}`}
          style={style}
          onMouseEnter={() => onMappingHover && onMappingHover(mappingIndex)}
          onMouseLeave={() => onMappingHover && onMappingHover(null)}
        >
          {text}
        </span>
      );
    } else {
      output.push(
        <span key={`plain-${i}`} style={style}>
          {text}
        </span>
      );
    }
  }

  return <>{output}</>;
}

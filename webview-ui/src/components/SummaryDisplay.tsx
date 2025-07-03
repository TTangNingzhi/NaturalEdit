import React from "react";
import { SummaryData } from "../types/sectionTypes.js";
import {
  FONT_SIZE,
  COLORS,
  SPACING,
  COMMON_STYLES,
  //BORDER_RADIUS,
} from "../styles/constants.js";

/**
 * Props for the SummaryDisplay component
 */
interface SummaryDisplayProps {
  summary: SummaryData;
  onEditPrompt: (level: string, value: string | string[]) => void;
}

/**
 * SummaryDisplay component
 * - Shows the detailed summary with an "Edit In Prompt" button
 * - Uses VSCode Webview UI Toolkit React components
 */
const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  summary,
  //onEditPrompt,
}) => {
  // Handle "Edit In Prompt" button click
  // const handleEdit = () => {
  //   onEditPrompt("detailed", summary.detailed);
  // };

  /**
   * Renders a summary string without mapping highlights.
   * This function simply returns the text or a placeholder if the text is empty.
   */
  const renderSummary = (text: string) => {
    return (
      text || <span style={{ color: COLORS.DESCRIPTION }}>Summary...</span>
    );
  };

  return (
    <div style={COMMON_STYLES.SECTION_COMPACT}>
      {/* Header with edit button
      <div style={COMMON_STYLES.SECTION_HEADER}>
        <h3 style={{ margin: 0, fontSize: FONT_SIZE.HEADER }}>
          Detailed Summary
        </h3>
        <button
          style={COMMON_STYLES.ICON_BUTTON}
          aria-label="Edit In Prompt"
          title="Edit In Prompt"
          onClick={handleEdit}
        >
          <span
            className="codicon codicon-edit"
            style={{ fontSize: FONT_SIZE.ICON }}
          />
        </button>
      </div> */}

      {/* Detailed summary card with placeholder */}
      <div
        style={{
          marginBottom: SPACING.SMALL,
          background: COLORS.BACKGROUND,
          display: "flex",
          alignItems: "flex-start",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1 }}>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-line",
              fontFamily: "var(--vscode-font-family)",
              fontSize: FONT_SIZE.BODY,
              color: COLORS.FOREGROUND,
              minHeight: 40,
              background: "none",
              border: "none",
              overflow: "hidden",
            }}
          >
            {renderSummary(summary.detailed || "")}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SummaryDisplay;

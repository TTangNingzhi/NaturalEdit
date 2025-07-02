import React, { useState, useEffect, useRef } from "react";
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react/index.js";
import { SummaryDiffEditor } from "./SummaryDiffEditor";
import { SectionData } from "../types/sectionTypes.js";
import {
  FONT_SIZE,
  SPACING,
  COMMON_STYLES,
  COLORS,
} from "../styles/constants.js";
import { usePrompt } from "../hooks/usePrompt.js";

interface PromptPanelProps {
  section: SectionData;
  onEditPrompt?: (level: string, value: string | string[]) => void;
}

const PromptPanel: React.FC<PromptPanelProps> = ({ section, onEditPrompt }) => {
  // Local error state for actions
  const [error, setError] = useState<{ [action: string]: string | null }>({
    applyToSummary: null,
    prompt1: null,
    prompt2: null,
  });

  const { metadata, editPromptValue, summaryData } = section;
  const { onDirectPrompt, onSummaryPrompt } = usePrompt(metadata);

  // Direct Prompt state
  const [directPrompt, setDirectPrompt] = useState("");

  // For summary diff editor
  const [currentSummary, setCurrentSummary] = useState<string>("");
  const [originalSummary, setOriginalSummary] = useState<string>("");
  const editPromptValueRef = useRef(editPromptValue);

  // Keep currentSummary in sync with editPromptValue or summaryData.detailed
  useEffect(() => {
    setCurrentSummary(editPromptValue || summaryData.detailed);
    editPromptValueRef.current = editPromptValue;
  }, [editPromptValue, summaryData.detailed]);

  // Set originalSummary only when entering edit mode (if editPromptValue changes)
  useEffect(() => {
    if (editPromptValue) {
      setOriginalSummary(editPromptValueRef.current);
    } else if (summaryData.detailed) {
      setOriginalSummary(summaryData.detailed);
    }
  }, [editPromptValue, summaryData.detailed]);

  // Type guard to check if an error has a string message property
  function isErrorWithMessage(err: unknown): err is { message: string } {
    return (
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string"
    );
  }

  // Direct prompt send
  const handleDirectPromptSend = async () => {
    const action = "prompt1";
    if (directPrompt.trim()) {
      setError((prev) => ({ ...prev, [action]: null }));
      try {
        await onDirectPrompt(directPrompt.trim());
        setError((prev) => ({ ...prev, [action]: null }));
      } catch (err: unknown) {
        let errorMsg = "Unknown error";
        if (isErrorWithMessage(err)) {
          errorMsg = err.message;
        }
        setError((prev) => ({ ...prev, [action]: errorMsg }));
      }
    }
  };

  // Commit summary to backend
  const handleSummaryCommit = async () => {
    const action = "prompt2";
    if (currentSummary.trim()) {
      setError((prev) => ({ ...prev, [action]: null }));
      try {
        await onSummaryPrompt(
          "detailed", //hardcoded to detailed level
          currentSummary.trim(),
          originalSummary
        );
        if (onEditPrompt) {
          onEditPrompt("detailed", currentSummary.trim());
        }
        setError((prev) => ({ ...prev, [action]: null }));
      } catch (err: unknown) {
        let errorMsg = "Unknown error";
        if (isErrorWithMessage(err)) {
          errorMsg = err.message;
        }
        setError((prev) => ({ ...prev, [action]: errorMsg }));
      }
    }
  };

  return (
    <div style={COMMON_STYLES.SECTION_COMPACT}>
      {/* Direct Instruction Prompt Section */}
      <div style={{ marginBottom: SPACING.MEDIUM }}>
        <div style={COMMON_STYLES.SECTION_HEADER}>
          <span style={COMMON_STYLES.SECTION_LABEL}>
            Direct Instruction Prompt
          </span>
          <button
            title="Send Direct Prompt"
            onClick={handleDirectPromptSend}
            disabled={!directPrompt.trim()}
            aria-label="Send Direct Prompt"
            style={{
              ...COMMON_STYLES.ICON_BUTTON,
              opacity: !directPrompt.trim() ? 0.5 : 1,
              cursor: !directPrompt.trim() ? "not-allowed" : "pointer",
            }}
          >
            <span
              className="codicon codicon-send"
              style={{ fontSize: FONT_SIZE.ICON }}
            />
          </button>
        </div>
        <VSCodeTextArea
          value={directPrompt}
          onInput={(e) =>
            setDirectPrompt((e.target as HTMLTextAreaElement).value)
          }
          style={{
            width: "100%",
            marginBottom: SPACING.TINY,
            fontFamily: "monospace",
            fontSize: FONT_SIZE.SMALL,
          }}
          placeholder="Enter a direct instruction."
          resize="vertical"
          rows={3}
          disabled={false}
        />
        {error.prompt1 && (
          <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
            {error.prompt1}
          </div>
        )}
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--vscode-panel-border)",
          margin: `${SPACING.MEDIUM} 0`,
        }}
      />

      {/* Summary-Mediated Prompt Section */}
      <div>
        <div style={COMMON_STYLES.SECTION_HEADER}>
          <span style={COMMON_STYLES.SECTION_LABEL}>
            Summary-Mediated Prompt (Detailed)
          </span>
          <button
            style={{
              ...COMMON_STYLES.ICON_BUTTON,
              opacity:
                !currentSummary.trim() ||
                currentSummary.trim() === originalSummary
                  ? 0.5
                  : 1,
              cursor:
                !currentSummary.trim() ||
                currentSummary.trim() === originalSummary
                  ? "not-allowed"
                  : "pointer",
            }}
            title="Send Summary Prompt"
            onClick={handleSummaryCommit}
            disabled={
              !currentSummary.trim() ||
              currentSummary.trim() === originalSummary
            }
            aria-label="Send Summary Prompt"
          >
            <span
              className="codicon codicon-send"
              style={{ fontSize: FONT_SIZE.ICON }}
            />
          </button>
        </div>
        <SummaryDiffEditor
          originalSummary={originalSummary}
          currentSummary={currentSummary}
          onChange={(newValue) => {
            const valueStr = Array.isArray(newValue)
              ? newValue.join("\n")
              : newValue;
            setCurrentSummary(valueStr);
          }}
        />
        {error.prompt2 && (
          <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
            {error.prompt2}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptPanel;

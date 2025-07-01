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
import { ClipLoader } from "react-spinners";

interface PromptPanelProps {
  section: SectionData;
}

const PromptPanel: React.FC<PromptPanelProps> = ({ section }) => {
  // Local loading and error state for each action
  const [loading, setLoading] = useState<{ [action: string]: boolean }>({
    applyToSummary: false,
    prompt1: false,
    prompt2: false,
  });
  const [error, setError] = useState<{ [action: string]: string | null }>({
    applyToSummary: null,
    prompt1: null,
    prompt2: null,
  });
  const { metadata, editPromptValue } = section;
  const { onDirectPrompt, onSummaryPrompt } = usePrompt(metadata);

  // Direct Prompt state
  const [directPrompt, setDirectPrompt] = useState("");

  // For summary diff editor
  const [currentSummary, setCurrentSummary] = useState<string>("");
  const [originalSummary, setOriginalSummary] = useState<string>("");
  const editPromptValueRef = useRef(editPromptValue);

  // Keep currentSummary in sync with editPromptValue
  useEffect(() => {
    setCurrentSummary(editPromptValue);
    editPromptValueRef.current = editPromptValue;
  }, [editPromptValue]);

  // Set originalSummary only when entering edit mode (if editPromptValue changes)
  useEffect(() => {
    if (editPromptValue) {
      setOriginalSummary(editPromptValueRef.current);
    }
  }, [editPromptValue]);

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
      setLoading((prev) => ({ ...prev, [action]: true }));
      setError((prev) => ({ ...prev, [action]: null }));
      try {
        await onDirectPrompt(directPrompt.trim());
        setLoading((prev) => ({ ...prev, [action]: false }));
        setError((prev) => ({ ...prev, [action]: null }));
      } catch (err: unknown) {
        let errorMsg = "Unknown error";
        if (isErrorWithMessage(err)) {
          errorMsg = err.message;
        }
        setLoading((prev) => ({ ...prev, [action]: false }));
        setError((prev) => ({ ...prev, [action]: errorMsg }));
      }
    }
  };

  // Apply direct prompt to summary - Removed as per user request to disable direct prompt to summary
  // const handleApplyToSummary = async () => {
  //     const action = "applyToSummary";
  //     if (editPromptLevel && directPrompt.trim()) {
  //         setLoading(prev => ({ ...prev, [action]: true }));
  //         setError(prev => ({ ...prev, [action]: null }));
  //         try {
  //             await onPromptToSummary(editPromptLevel, originalSummary, directPrompt.trim());
  //             setLoading(prev => ({ ...prev, [action]: false }));
  //             setError(prev => ({ ...prev, [action]: null }));
  //         } catch (err: unknown) {
  //             let errorMsg = "Unknown error";
  //             if (isErrorWithMessage(err)) {
  //                 errorMsg = err.message;
  //             }
  //             setLoading(prev => ({ ...prev, [action]: false }));
  //             setError(prev => ({ ...prev, [action]: errorMsg }));
  //         }
  //     }
  // };

  // Commit summary to backend
  const handleSummaryCommit = async () => {
    const action = "prompt2";
    if (currentSummary.trim()) {
      setLoading((prev) => ({ ...prev, [action]: true }));
      setError((prev) => ({ ...prev, [action]: null }));
      try {
        await onSummaryPrompt(
          "detailed", //hardcoded to detailed level
          currentSummary.trim(),
          originalSummary
        );
        setLoading((prev) => ({ ...prev, [action]: false }));
        setError((prev) => ({ ...prev, [action]: null }));
      } catch (err: unknown) {
        let errorMsg = "Unknown error";
        if (isErrorWithMessage(err)) {
          errorMsg = err.message;
        }
        setLoading((prev) => ({ ...prev, [action]: false }));
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
          {loading.prompt1 ? (
            <ClipLoader color={COLORS.FOREGROUND} size={FONT_SIZE.SMALL} />
          ) : (
            <button
              title="Send Direct Prompt"
              onClick={handleDirectPromptSend}
              disabled={!directPrompt.trim() || loading.prompt1}
              aria-label="Send Direct Prompt"
              style={{
                ...COMMON_STYLES.ICON_BUTTON,
                opacity: !directPrompt.trim() || loading.prompt1 ? 0.5 : 1,
                cursor:
                  !directPrompt.trim() || loading.prompt1
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <span
                className="codicon codicon-send"
                style={{ fontSize: FONT_SIZE.ICON }}
              />
            </button>
          )}
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
        {/* Removed Apply to Summary button as per user request to disable direct prompt to summary */}
        {/* <VSCodeButton
                    appearance="secondary"
                    onClick={handleApplyToSummary}
                    disabled={
                        !directPrompt.trim() ||
                        !editPromptLevel ||
                        !summary.trim() ||
                        loading.applyToSummary
                    }
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.SMALL
                    }}
                    title="Apply instruction to summary"
                    aria-label="Apply instruction to summary"
                >
                    {loading.applyToSummary ? (
                        <>
                            <ClipLoader
                                color={COLORS.BUTTON_FOREGROUND}
                                size={FONT_SIZE.TINY}
                                cssOverride={{
                                    borderWidth: '2px',
                                    marginRight: SPACING.SMALL
                                }}
                            />
                            Applying...
                        </>
                    ) : (
                        <>
                            <span className="codicon codicon-arrow-down" style={{
                                fontSize: FONT_SIZE.ICON,
                                marginRight: SPACING.SMALL
                            }} />
                            Apply to Summary
                        </>
                    )}
                </VSCodeButton> */}
        {error.prompt1 && (
          <div style={{ color: COLORS.ERROR, marginTop: SPACING.TINY }}>
            {error.prompt1}
          </div>
        )}
      </div>

      {/* Summary-Mediated Prompt Section */}
      <div>
        <div style={COMMON_STYLES.SECTION_HEADER}>
          <span style={COMMON_STYLES.SECTION_LABEL}>
            Summary-Mediated Prompt (Detailed)
          </span>
          {loading.prompt2 ? (
            <ClipLoader color={COLORS.FOREGROUND} size={FONT_SIZE.SMALL} />
          ) : (
            <button
              style={{
                ...COMMON_STYLES.ICON_BUTTON,
                opacity:
                  !currentSummary.trim() ||
                  currentSummary.trim() === originalSummary ||
                  loading.prompt2
                    ? 0.5
                    : 1,
                cursor:
                  !currentSummary.trim() ||
                  currentSummary.trim() === originalSummary ||
                  loading.prompt2
                    ? "not-allowed"
                    : "pointer",
              }}
              title="Send Summary Prompt"
              onClick={handleSummaryCommit}
              disabled={
                !currentSummary.trim() ||
                currentSummary.trim() === originalSummary ||
                loading.prompt2
              }
              aria-label="Send Summary Prompt"
            >
              <span
                className="codicon codicon-send"
                style={{ fontSize: FONT_SIZE.ICON }}
              />
            </button>
          )}
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

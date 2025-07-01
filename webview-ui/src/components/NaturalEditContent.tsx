import { useState, useEffect } from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "../styles/constants.js";
import { ClipLoader } from "react-spinners";
import Section from "./Section.js";
import { SectionData } from "../types/sectionTypes.js";
import {
  createStatefulMessageHandler,
  requestSummary,
} from "../services/MessageHandler.js";

interface NaturalEditContentProps {
  onSectionChange: (section: SectionData | null) => void;
}

export function NaturalEditContent({
  onSectionChange,
}: NaturalEditContentProps) {
  // State for a single code-summary pair
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State for loading text (progress message)
  const [loadingText, setLoadingText] = useState("Summarizing...");

  // Setup message handler with progress callback
  useEffect(() => {
    createStatefulMessageHandler(
      setLoading,
      setError,
      setSection,
      setLoadingText
    )();
  }, []);

  // Handler: Summarize Selected Code
  const handleRequestSummary = () => {
    setLoading(true);
    setError(null);
    setLoadingText("Summarizing..."); // Reset to default at start
    requestSummary();
  };

  // Reset loading text on error or when not loading
  useEffect(() => {
    if (!loading) {
      setLoadingText("Summarizing...");
    }
  }, [loading]);
  useEffect(() => {
    if (error) {
      setLoadingText("Summarizing...");
    }
  }, [error]);

  // Update parent component when section changes
  useEffect(() => {
    onSectionChange(section);
  }, [section, onSectionChange]);

  return (
    <div style={{ width: "100%" }}>
      <h2
        style={{
          margin: `${SPACING.LARGE} 0 ${SPACING.MEDIUM} 0`,
          color: COLORS.FOREGROUND,
          fontSize: FONT_SIZE.TITLE,
        }}
      >
        NaturalEdit_Baseline
      </h2>
      <div
        style={{
          color: COLORS.DESCRIPTION,
          marginBottom: SPACING.MEDIUM,
          fontSize: FONT_SIZE.SUBTITLE,
        }}
      >
        Transform your code seamlessly by modifying its natural language
        descriptions.
      </div>
      <VSCodeButton
        onClick={handleRequestSummary}
        disabled={loading}
        style={{
          marginBottom: error ? SPACING.MEDIUM : SPACING.LARGE,
          display: "flex",
          alignItems: "center",
        }}
      >
        {loading && (
          <ClipLoader
            color={COLORS.BUTTON_FOREGROUND}
            size={FONT_SIZE.TINY}
            cssOverride={{
              borderWidth: "2px",
              marginRight: SPACING.SMALL,
            }}
          />
        )}
        {/* Show progress text if loading, otherwise default button text */}
        {loading ? loadingText : "Summarize Selected Code"}
      </VSCodeButton>
      {error && (
        <div
          style={{
            color: COLORS.ERROR,
            marginBottom: SPACING.LARGE,
          }}
        >
          {error}
        </div>
      )}
      {section ? (
        <Section
          section={section}
          onEditPrompt={(_, value) => {
            setSection({
              ...section,
              editPromptValue: Array.isArray(value) ? value.join(", ") : value,
            });
          }}
          collapsed={false}
          onToggle={() => {
            /* No-op since single section */
          }}
          onDeleteSection={() => setSection(null)}
        />
      ) : (
        <div style={{ color: COLORS.DESCRIPTION, marginTop: SPACING.MEDIUM }}>
          No summary available. Click "Summarize Selected Code" to create one.
        </div>
      )}
    </div>
  );
}

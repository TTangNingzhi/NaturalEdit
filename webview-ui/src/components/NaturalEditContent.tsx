import { useState, useEffect } from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "../styles/constants.js";
//import { ClipLoader } from "react-spinners";
import SectionList from "./SectionList.js";
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
  // State for multiple code-summary pairs and a single section for parent compatibility
  const [section, setSection] = useState<SectionData | null>(null);
  const [singleSection, setSingleSection] = useState<SectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Setup message handler without progress callback
  useEffect(() => {
    createStatefulMessageHandler(
      (isLoading) => setLoading(isLoading), // Update loading state
      setError,
      setSingleSection // Pass the state setter directly for type compatibility
    )();
  }, []);

  // Handler: Summarize Selected Code
  const handleRequestSummary = () => {
    setError(null);
    setLoading(true);
    requestSummary();
  };

  // Update parent component and sections array when singleSection changes
  useEffect(() => {
    onSectionChange(singleSection);
    if (singleSection) {
      setSection(singleSection);
      setLoading(false); // Ensure loading state is reset after receiving data
    }
  }, [singleSection, onSectionChange]);

  return (
    <div style={{ width: "100%" }}>
      <h2
        style={{
          margin: `${SPACING.LARGE} 0 ${SPACING.MEDIUM} 0`,
          color: COLORS.FOREGROUND,
          fontSize: FONT_SIZE.TITLE,
        }}
      >
        PASTA
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
        Summarize Selected Code
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
      {section !== null ? (
        <SectionList section={section} onSectionChange={setSection} />
      ) : null}
    </div>
  );
}

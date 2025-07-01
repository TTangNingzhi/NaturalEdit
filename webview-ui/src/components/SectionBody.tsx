import React, { useState, useEffect } from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { SectionData } from "../types/sectionTypes.js";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
} from "../styles/constants.js";
import { vscodeApi } from "../utils/vscodeApi"; // Import VSCode API for backend communication

interface SectionBodyProps {
  section: SectionData;
  onEditPrompt: (level: string, value: string | string[]) => void;
  onDeleteSection: () => void; // Handler for deleting the section
}

/**
 * SectionBody component
 * Contains the summary display and prompt panel
 */
/**
 * SectionBody component
 * Contains the summary display and prompt panel, and checks section validity on expand.
 */
const SectionBody: React.FC<SectionBodyProps> = ({
  section,
  onEditPrompt,
  onDeleteSection,
}) => {
  const { summaryData } = section;

  // State for section validity: "pending" | "success" | "file_missing" | "code_not_matched"
  const [validityStatus, setValidityStatus] = useState<
    "pending" | "success" | "file_missing" | "code_not_matched"
  >("pending");

  // Effect: On mount, check section validity with backend
  useEffect(() => {
    // Send message to backend to check file and code validity
    vscodeApi.postMessage({
      command: "checkSectionValidity",
      fullPath: section.metadata.fullPath,
      originalCode: section.metadata.originalCode,
    });

    // Handler for backend response
    function handleMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg && msg.command === "sectionValidityResult") {
        if (msg.status === "success") {
          setValidityStatus("success");
        } else if (msg.status === "file_missing") {
          setValidityStatus("file_missing");
        } else if (msg.status === "code_not_matched") {
          setValidityStatus("code_not_matched");
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [section.metadata.fullPath, section.metadata.originalCode]);

  // Overlay message based on validity status
  let overlayMessage = "";
  if (validityStatus === "file_missing") {
    overlayMessage = "Code file not found.";
  } else if (validityStatus === "code_not_matched") {
    overlayMessage = "Code snippet cannot be matched.";
  }

  return (
    <div
      style={{
        position: "relative",
        padding: SPACING.MEDIUM,
        background: COLORS.BACKGROUND,
      }}
    >
      {/* Main content */}
      <SummaryDisplay summary={summaryData} onEditPrompt={onEditPrompt} />
      <PromptPanel section={section} />

      {/* Overlay for invalid section */}
      {validityStatus !== "success" && validityStatus !== "pending" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.7)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              color: COLORS.ERROR,
              fontSize: FONT_SIZE.HEADER,
              fontWeight: "bold",
              marginBottom: SPACING.MEDIUM,
              textAlign: "center",
            }}
          >
            {overlayMessage}
          </div>
          <button
            onClick={onDeleteSection}
            style={{
              padding: "0.3em 1.2em",
              background: COLORS.ERROR,
              color: "#fff",
              border: "none",
              borderRadius: BORDER_RADIUS.MEDIUM,
              cursor: "pointer",
              fontSize: FONT_SIZE.BODY,
            }}
          >
            Delete Section
          </button>
        </div>
      )}
    </div>
  );
};

export default SectionBody;

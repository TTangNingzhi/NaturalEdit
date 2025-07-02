import React from "react";
import { SectionData } from "../types/sectionTypes.js";
import { SPACING } from "../styles/constants.js";
import PromptPanel from "./PromptPanel.js";

interface SectionProps {
  section: SectionData;
  onEditPrompt: (level: string, value: string | string[]) => void;
}

/**
 * Section component
 * Simplified container for a code section with title and prompt functionality
 */
const Section: React.FC<SectionProps> = ({ section, onEditPrompt }) => {
  return (
    <div
      style={{
        marginBottom: SPACING.MEDIUM,
      }}
    >
      <PromptPanel section={section} onEditPrompt={onEditPrompt} />
    </div>
  );
};

export default Section;

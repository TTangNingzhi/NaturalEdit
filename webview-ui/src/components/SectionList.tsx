import React from "react";
import { SectionData } from "../types/sectionTypes.js";
import Section from "./Section.js";

interface SectionListProps {
  section: SectionData | null;
  onSectionChange: (sections: SectionData) => void;
}

/**
 * SectionList component
 * Manages the list of sections and their interactions.
 * Only one section can be open at a time.
 */
const SectionList: React.FC<SectionListProps> = ({
  section,
  onSectionChange,
}) => {
  // Handler for editing prompts in sections
  const handleEditPrompt = (value: string) => {
    if (!section) return;
    onSectionChange({
      ...section,
      summaryData: {
        detailed: value,
      },
    });
  };

  return section ? (
    <div>
      <Section section={section} onEditPrompt={handleEditPrompt} />
    </div>
  ) : null;
};

export default SectionList;

import React from "react";
import { SectionData } from "../types/sectionTypes.js";
import Section from "./Section.js";

interface SectionListProps {
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
}

/**
 * SectionList component
 * Manages the list of sections and their interactions.
 * Only one section can be open at a time.
 */
const SectionList: React.FC<SectionListProps> = ({
  sections,
  onSectionsChange,
}) => {
  // Handler for editing prompts in sections
  const handleEditPrompt = (
    id: string,
    level: string,
    value: string | string[]
  ) => {
    const updatedSections = sections.map((s) => {
      if (s.metadata.id === id) {
        return {
          ...s,
          summaryData: {
            ...s.summaryData,
            [level]: value,
          },
        };
      }
      return s;
    });
    onSectionsChange(updatedSections);
  };

  return (
    <div>
      {[...sections].reverse().map((section: SectionData) => (
        <Section
          key={section.metadata.id}
          section={section}
          onEditPrompt={(level, value) =>
            handleEditPrompt(section.metadata.id, level, value)
          }
        />
      ))}
    </div>
  );
};

export default SectionList;

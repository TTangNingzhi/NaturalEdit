import React, { useState } from "react";
import { SectionData, SummaryLevel } from "../types/sectionTypes.js";
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
const SectionList: React.FC<SectionListProps> = ({ sections, onSectionsChange }) => {
    // State to track the currently opened section
    const [openedSectionId, setOpenedSectionId] = useState<string | null>(null);

    // Handler for segmented toggle change (per section)
    const handleLevelChange = (id: string, level: SummaryLevel) => {
        onSectionsChange(
            sections.map(s =>
                s.id === id ? { ...s, selectedLevel: level } : s
            )
        );
    };

    // Handler for "Edit In Prompt" button (per section)
    const handleEditPrompt = (id: string, level: SummaryLevel, value: string | string[]) => {
        const stringValue = Array.isArray(value) ? value.join(", ") : value;
        onSectionsChange(
            sections.map(s =>
                s.id === id
                    ? { ...s, editPromptLevel: level, editPromptValue: stringValue }
                    : s
            )
        );
    };

    // Handler for toggling section open/close
    const handleToggleSection = (id: string) => {
        setOpenedSectionId(prevId => (prevId === id ? null : id));
    };

    return (
        <div>
            {[...sections].reverse().map((section: SectionData) => (
                <Section
                    key={section.id}
                    {...section}
                    onLevelChange={(level: SummaryLevel) => handleLevelChange(section.id, level)}
                    onEditPrompt={(level, value) => handleEditPrompt(section.id, level, value)}
                    // Only one section can be open at a time
                    collapsed={section.id !== openedSectionId}
                    onToggle={() => handleToggleSection(section.id)}
                />
            ))}
        </div>
    );
};

export default SectionList;

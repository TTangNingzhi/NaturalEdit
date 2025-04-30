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
                s.metadata.id === id ? { ...s, selectedLevel: level } : s
            )
        );
    };

    // Handler for "Edit In Prompt" button (per section)
    const handleEditPrompt = (id: string, level: SummaryLevel, value: string | string[]) => {
        const stringValue = Array.isArray(value) ? value.join(", ") : value;
        onSectionsChange(
            sections.map(s =>
                s.metadata.id === id
                    ? { ...s, editPromptLevel: level, editPromptValue: stringValue }
                    : s
            )
        );
    };

    // Handler for toggling section open/close
    const handleToggleSection = (id: string) => {
        setOpenedSectionId(prevId => {
            // If the section is being collapsed (was open and is being closed)
            if (prevId === id) {
                // Clear the editPromptValue for the section being collapsed
                onSectionsChange(
                    sections.map(s =>
                        s.metadata.id === id
                            ? { ...s, editPromptValue: "", editPromptLevel: null }
                            : s
                    )
                );
                return null;
            }
            return id;
        });
    };

    return (
        <div>
            {[...sections].reverse().map((section: SectionData) => (
                <Section
                    key={section.metadata.id}
                    section={section}
                    onLevelChange={(level: SummaryLevel) => handleLevelChange(section.metadata.id, level)}
                    onEditPrompt={(level, value) => handleEditPrompt(section.metadata.id, level, value)}
                    collapsed={section.metadata.id !== openedSectionId}
                    onToggle={() => handleToggleSection(section.metadata.id)}
                />
            ))}
        </div>
    );
};

export default SectionList;

import React, { useState, useEffect, useRef } from "react";
import { SectionData, DetailLevel, StructuredType } from "../types/sectionTypes.js";
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
    const [openedSectionId, setOpenedSectionId] = useState<string | null>(null);
    const prevSectionsRef = useRef<SectionData[]>(sections);

    useEffect(() => {
        const prevSections = prevSectionsRef.current;
        if (sections.length > prevSections.length) {
            // Auto open the newly created section
            setOpenedSectionId(sections[sections.length - 1].metadata.id);
        }
        prevSectionsRef.current = sections;
    }, [sections]);

    // Handler for summary type change (per section)
    const handleLevelChange = (id: string, detail: DetailLevel, structured: StructuredType) => {
        onSectionsChange(
            sections.map(s =>
                s.metadata.id === id
                    ? { ...s, selectedDetailLevel: detail, selectedStructured: structured }
                    : s
            )
        );
    };

    // Handler for "Edit In Prompt" button (per section)
    const handleEditPrompt = (id: string, detail: DetailLevel, structured: StructuredType, value: string) => {
        onSectionsChange(
            sections.map(s =>
                s.metadata.id === id
                    ? { ...s, editPromptDetailLevel: detail, editPromptStructured: structured, editPromptValue: value }
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
                            ? { ...s, editPromptValue: "", editPromptDetailLevel: null, editPromptStructured: null }
                            : s
                    )
                );
                return null;
            }
            return id;
        });
    };

    // Handler for deleting a section by id
    // Removes the section from the list and updates the parent
    const handleDeleteSection = (id: string) => {
        onSectionsChange(sections.filter(s => s.metadata.id !== id));
    };

    return (
        <div>
            {[...sections].reverse().map((section: SectionData) => (
                <Section
                    key={section.metadata.id}
                    section={section}
                    onLevelChange={(detail: DetailLevel, structured: StructuredType) =>
                        handleLevelChange(section.metadata.id, detail, structured)
                    }
                    onEditPrompt={(detail: DetailLevel, structured: StructuredType, value: string) =>
                        handleEditPrompt(section.metadata.id, detail, structured, value)
                    }
                    collapsed={section.metadata.id !== openedSectionId}
                    onToggle={() => handleToggleSection(section.metadata.id)}
                    onDeleteSection={() => handleDeleteSection(section.metadata.id)}
                />
            ))}
        </div>
    );
};

export default SectionList;

import React, { useState } from "react";
import { SectionData, SummaryLevel } from "../types/sectionTypes.js";
import Section from "./Section.js";
import { sendDirectPrompt, sendEditSummary, sendPromptToSummary } from "../services/MessageHandler.js";

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
    const handleEditPrompt = (id: string, level: SummaryLevel, value: string) => {
        onSectionsChange(
            sections.map(s =>
                s.id === id
                    ? { ...s, editPromptLevel: level, editPromptValue: value }
                    : s
            )
        );
    };

    // Handler for direct prompt on code (per section)
    const handleDirectPrompt = (id: string, prompt: string) => {
        sendDirectPrompt(id, prompt);
    };

    // Handler for editing a summary directly (per section)
    const handleEditSummary = (id: string, level: SummaryLevel, value: string) => {
        sendEditSummary(id, level, value);
    };

    // Handler for applying a direct prompt to a summary (per section)
    const handlePromptToSummary = (id: string, level: SummaryLevel, summary: string, prompt: string) => {
        sendPromptToSummary(id, level, summary, prompt);
    };

    // Handler for toggling section open/close
    const handleToggleSection = (id: string) => {
        setOpenedSectionId(prevId => (prevId === id ? null : id));
    };

    return (
        <div>
            {[...sections].reverse().map((section) => (
                <Section
                    key={section.id}
                    filename={section.filename}
                    lines={section.lines}
                    title={section.title}
                    concise={section.concise}
                    lastOpened={section.lastOpened}
                    summaryData={section.summaryData}
                    selectedLevel={section.selectedLevel}
                    onLevelChange={(level) => handleLevelChange(section.id, level)}
                    onEditPrompt={(level, value) => handleEditPrompt(section.id, level, value)}
                    editPromptLevel={section.editPromptLevel}
                    editPromptValue={section.editPromptValue}
                    onDirectPrompt={(prompt) => handleDirectPrompt(section.id, prompt)}
                    onEditSummary={(level, value) => handleEditSummary(section.id, level, value)}
                    onPromptToSummary={(level, summary, prompt) => handlePromptToSummary(section.id, level, summary, prompt)}
                    // Only one section can be open at a time
                    collapsed={section.id !== openedSectionId}
                    onToggle={() => handleToggleSection(section.id)}
                />
            ))}
        </div>
    );
};

export default SectionList;

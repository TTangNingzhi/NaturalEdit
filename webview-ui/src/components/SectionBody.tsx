import React, { useState } from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { SectionData, SummaryLevel } from "../types/sectionTypes.js";
import { COLORS, SPACING } from "../styles/constants.js";
import { vscodeApi } from "../utils/vscodeApi"; // Import VSCode API for backend communication

interface SectionBodyProps {
    section: SectionData;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
}

/**
 * SectionBody component
 * Contains the summary display and prompt panel
 */
const SectionBody: React.FC<SectionBodyProps> = ({
    section,
    onLevelChange,
    onEditPrompt
}) => {
    const {
        summaryData,
        selectedLevel,
        summaryMappings
    } = section;

    // State for the currently active mapping index (for bidirectional highlight)
    const [activeMappingIndex, setActiveMappingIndex] = useState<number | null>(null);

    // Get the mapping array for the current summary level
    const rawMappings = summaryMappings?.[selectedLevel] || [];

    /**
     * Handles hover events on summary mapping components.
     * Sends highlight/clear messages to the backend and updates local highlight state.
     * @param index The mapping index being hovered, or null if unhovered
     */
    const handleMappingHover = (index: number | null) => {
        setActiveMappingIndex(index);

        // Get file info from section metadata
        const { filename, fullPath } = section.metadata;

        if (index !== null && rawMappings[index]) {
            // On hover: send highlight message with selected code, ALL code snippets, and color index
            const codeSnippets = rawMappings[index].codeSnippets || [];
            const selectedCode = section.metadata.originalCode || "";
            vscodeApi.postMessage({
                command: "highlightCodeMapping",
                selectedCode, // send the selected code block
                codeSnippets, // send as array
                filename,
                fullPath,
                colorIndex: index
            });
        } else {
            // On unhover: send clear highlight message
            vscodeApi.postMessage({
                command: "clearHighlight",
                filename,
                fullPath
            });
        }
    };

    return (
        <div style={{
            padding: SPACING.MEDIUM,
            background: COLORS.BACKGROUND
        }}>
            <SummaryDisplay
                summary={summaryData}
                selectedLevel={selectedLevel}
                onLevelChange={onLevelChange}
                onEditPrompt={onEditPrompt}
                summaryCodeMappings={rawMappings}
                activeMappingIndex={activeMappingIndex}
                onMappingHover={handleMappingHover}
            />
            <PromptPanel
                section={section}
            />
        </div>
    );
};

export default SectionBody;

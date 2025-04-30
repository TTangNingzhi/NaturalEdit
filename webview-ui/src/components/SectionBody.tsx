import React, { useState } from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import CodeBlockWithMapping from "./CodeBlockWithMapping";
import { SectionData, SummaryLevel } from "../types/sectionTypes.js";
import { COLORS, SPACING } from "../styles/constants.js";

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
                onMappingHover={setActiveMappingIndex}
            />
            {/* Code block with mapping highlights */}
            <div style={{ marginBottom: SPACING.MEDIUM }}>
                <CodeBlockWithMapping
                    code={section.metadata.originalCode}
                    mappings={rawMappings}
                    activeMappingIndex={activeMappingIndex}
                />
            </div>
            <PromptPanel
                section={section}
            />
        </div>
    );
};

export default SectionBody;

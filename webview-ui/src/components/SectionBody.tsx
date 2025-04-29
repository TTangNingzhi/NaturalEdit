import React from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
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
    } = section;

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
            />
            <PromptPanel
                section={section}
            />
        </div>
    );
};

export default SectionBody;

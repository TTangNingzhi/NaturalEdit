import React from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { SummaryData, SummaryLevel } from "../types/sectionTypes.js";
import { COLORS, SPACING } from "../styles/constants.js";

interface SectionBodyProps {
    summaryData: SummaryData;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    onDirectPrompt: (prompt: string) => void;
    onEditSummary: (level: SummaryLevel, value: string) => void;
    onPromptToSummary: (level: SummaryLevel, summary: string, prompt: string) => void;
}

/**
 * SectionBody component
 * Contains the summary display and prompt panel
 */
const SectionBody: React.FC<SectionBodyProps> = ({
    summaryData,
    selectedLevel,
    onLevelChange,
    onEditPrompt,
    editPromptLevel,
    editPromptValue,
    onDirectPrompt,
    onEditSummary,
    onPromptToSummary
}) => {
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
                editPromptLevel={editPromptLevel}
                editPromptValue={editPromptValue}
                onDirectPrompt={onDirectPrompt}
                onEditSummary={onEditSummary}
                onPromptToSummary={onPromptToSummary}
            />
        </div>
    );
};

export default SectionBody;

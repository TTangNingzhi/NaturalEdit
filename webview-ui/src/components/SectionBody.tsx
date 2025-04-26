import React from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { SummaryData, SummaryLevel } from "../types/sectionTypes.js";
import { COLORS, SPACING } from "../styles/constants.js";

interface SectionBodyProps {
    sectionId: string;
    filename: string;
    summaryData: SummaryData;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    originalCode: string;
    fullPath: string;
    offset: number;
}

/**
 * SectionBody component
 * Contains the summary display and prompt panel
 */
const SectionBody: React.FC<SectionBodyProps> = ({
    sectionId,
    filename,
    summaryData,
    selectedLevel,
    onLevelChange,
    onEditPrompt,
    editPromptLevel,
    editPromptValue,
    originalCode,
    fullPath,
    offset
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
                sectionId={sectionId}
                originalCode={originalCode}
                filename={filename}
                fullPath={fullPath}
                offset={offset}
            />
        </div>
    );
};

export default SectionBody;

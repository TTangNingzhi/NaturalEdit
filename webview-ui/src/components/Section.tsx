import React from "react";
import { SummaryData, SummaryLevel } from "../types/sectionTypes.js";
import { SPACING } from "../styles/constants.js";
import SectionHeader from "./SectionHeader.js";
import SectionBody from "./SectionBody.js";

/**
 * Props for a collapsible Section representing a code-summary pair.
 * The open/close state is controlled by the parent via 'collapsed' and 'onToggle'.
 */
interface SectionProps {
    title: string;
    filename: string;
    lines: [number, number];
    summaryData: SummaryData;
    lastOpened: number;
    concise: string;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string) => void;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    onDirectPrompt: (prompt: string) => void;
    onEditSummary: (level: SummaryLevel, value: string) => void;
    onPromptToSummary: (level: SummaryLevel, summary: string, prompt: string) => void;
    collapsed: boolean;
    onToggle: () => void;
}

/**
 * Section component
 * Main container for a code section with summary and prompt functionality
 */
const Section: React.FC<SectionProps> = ({
    title,
    filename,
    lines,
    summaryData,
    lastOpened,
    concise,
    selectedLevel,
    onLevelChange,
    onEditPrompt,
    editPromptLevel,
    editPromptValue,
    onDirectPrompt,
    onEditSummary,
    onPromptToSummary,
    collapsed,
    onToggle
}) => {
    // The open/close state is controlled by the parent via props.
    // 'collapsed' determines if the section is closed.
    // 'onToggle' is called when the header is clicked.

    return (
        <div style={{
            marginBottom: SPACING.MEDIUM,
            borderRadius: "5px",
            overflow: "hidden",
            boxShadow: "0 2px 4px var(--vscode-widget-shadow), 0 0 0 1px var(--vscode-panel-border)"
        }}>
            <SectionHeader
                title={title}
                filename={filename}
                lines={lines}
                concise={concise}
                lastOpened={lastOpened}
                collapsed={collapsed}
                onToggle={onToggle}
            />
            {!collapsed && (
                <SectionBody
                    summaryData={summaryData}
                    selectedLevel={selectedLevel}
                    onLevelChange={onLevelChange}
                    onEditPrompt={onEditPrompt}
                    editPromptLevel={editPromptLevel}
                    editPromptValue={editPromptValue}
                    onDirectPrompt={onDirectPrompt}
                    onEditSummary={onEditSummary}
                    onPromptToSummary={onPromptToSummary}
                />
            )}
        </div>
    );
};

export default Section;

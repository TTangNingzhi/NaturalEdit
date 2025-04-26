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
    id: string;
    title: string;
    filename: string;
    lines: [number, number];
    summaryData: SummaryData;
    lastOpened: number;
    concise: string;
    selectedLevel: SummaryLevel;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    originalCode: string;
    fullPath: string;
    offset: number;
    collapsed: boolean;
    onToggle: () => void;
}

/**
 * Section component
 * Main container for a code section with summary and prompt functionality
 */
const Section: React.FC<SectionProps> = ({
    id,
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
    collapsed,
    onToggle,
    originalCode,
    fullPath,
    offset
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
                    sectionId={id}
                    filename={filename}
                    summaryData={summaryData}
                    selectedLevel={selectedLevel}
                    onLevelChange={onLevelChange}
                    onEditPrompt={onEditPrompt}
                    editPromptLevel={editPromptLevel}
                    editPromptValue={editPromptValue}
                    originalCode={originalCode}
                    fullPath={fullPath}
                    offset={offset}
                />
            )}
        </div>
    );
};

export default Section;

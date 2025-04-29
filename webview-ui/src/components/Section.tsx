import React from "react";
import { SectionData, SummaryLevel } from "../types/sectionTypes.js";
import { SPACING } from "../styles/constants.js";
import SectionHeader from "./SectionHeader.js";
import SectionBody from "./SectionBody.js";

interface SectionProps {
    section: SectionData;
    onLevelChange: (level: SummaryLevel) => void;
    onEditPrompt: (level: SummaryLevel, value: string | string[]) => void;
    collapsed: boolean;
    onToggle: () => void;
}

/**
 * Section component
 * Main container for a code section with summary and prompt functionality
 */
const Section: React.FC<SectionProps> = ({
    section,
    onLevelChange,
    onEditPrompt,
    collapsed,
    onToggle
}) => {
    const {
        metadata,
        lines,
        title,
        concise,
        lastOpened,
    } = section;

    return (
        <div style={{
            marginBottom: SPACING.MEDIUM,
            borderRadius: "5px",
            overflow: "hidden",
            boxShadow: "0 2px 4px var(--vscode-widget-shadow), 0 0 0 1px var(--vscode-panel-border)"
        }}>
            <SectionHeader
                title={title}
                filename={metadata.filename}
                lines={lines}
                concise={concise}
                lastOpened={lastOpened}
                collapsed={collapsed}
                onToggle={onToggle}
            />
            {!collapsed && (
                <SectionBody
                    section={section}
                    onLevelChange={onLevelChange}
                    onEditPrompt={onEditPrompt}
                />
            )}
        </div>
    );
};

export default Section;

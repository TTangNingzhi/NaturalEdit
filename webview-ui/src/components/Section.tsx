import React from "react";
import { SectionData, DetailLevel, StructuredType } from "../types/sectionTypes.js";
import { SPACING } from "../styles/constants.js";
import SectionHeader from "./SectionHeader.js";
import SectionBody from "./SectionBody.js";

interface SectionProps {
    section: SectionData;
    onLevelChange: (detail: DetailLevel, structured: StructuredType) => void;
    onEditPrompt: (detail: DetailLevel, structured: StructuredType, value: string) => void;
    collapsed: boolean;
    onToggle: () => void;
    onDeleteSection: () => void;
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
    onToggle,
    onDeleteSection
}) => {
    return (
        <div style={{
            marginBottom: SPACING.MEDIUM,
            borderRadius: "5px",
            overflow: "hidden",
            boxShadow: "0 2px 4px var(--vscode-widget-shadow), 0 0 0 1px var(--vscode-panel-border)"
        }}>
            <SectionHeader
                section={section}
                collapsed={collapsed}
                onToggle={onToggle}
                onDeleteSection={onDeleteSection}
            />
            {!collapsed && (
                <SectionBody
                    section={section}
                    onLevelChange={onLevelChange}
                    onEditPrompt={onEditPrompt}
                    onDeleteSection={onDeleteSection}
                />
            )}
        </div>
    );
};

export default Section;

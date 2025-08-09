import React, { useState } from "react";
import { getFileIcon } from "../utils/fileIcons.js";
import { FONT_SIZE, COLORS, SPACING, COMMON_STYLES } from "../styles/constants.js";
import { SectionData } from "../types/sectionTypes.js";
import { renderDiffedText } from "../utils/diffRender";

interface SectionHeaderProps {
    section: SectionData;
    collapsed: boolean;
    onToggle: () => void;
    onDeleteSection: () => void;
}

interface HeaderContentProps {
    section: SectionData;
    showChevron: boolean;
    chevronDirection: 'right' | 'down';
    collapsed: boolean;
    onDeleteSection: () => void;
    headerHovered: boolean;
}

const HeaderContent: React.FC<HeaderContentProps> = ({
    section,
    showChevron,
    chevronDirection,
    collapsed,
    onDeleteSection,
    headerHovered
}) => {
    const { metadata, title, summaryData, createdAt, lines, oldSummaryData } = section;
    const concise = summaryData.low_unstructured;
    const { filename } = metadata;

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const getFileBase = (path: string) => {
        return path.split('/').pop() || path;
    };

    const getLineRange = (lines: [number, number]) => {
        return `${lines[0]}-${lines[1]}`;
    };

    return (
        <div>
            {/* Row 1: Chevron + time (left) + file location (right) */}
            <div style={{
                display: "flex",
                alignItems: "center",
                marginBottom: SPACING.TINY
            }}>
                {showChevron && (
                    <span
                        className={`codicon codicon-chevron-${chevronDirection}`}
                        style={{
                            fontSize: FONT_SIZE.ICON_SMALL,
                            marginRight: SPACING.MEDIUM,
                            color: COLORS.ICON
                        }}
                    />
                )}
                <span style={{
                    color: COLORS.DESCRIPTION,
                    fontSize: FONT_SIZE.SMALL,
                    marginRight: SPACING.MEDIUM
                }}>
                    {formatTime(createdAt)}
                </span>
                <span style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: FONT_SIZE.BODY,
                    color: COLORS.DESCRIPTION,
                    marginLeft: "auto"
                }}>
                    <span style={{ ...COMMON_STYLES.FILE_INFO }}>
                        {(() => {
                            const icon = getFileIcon(filename);
                            return icon.type === 'svg'
                                ? <img src={icon.value} alt="" style={{
                                    width: 18,
                                    height: 18,
                                    marginRight: SPACING.TINY,
                                    opacity: 0.95,
                                    verticalAlign: 'middle',
                                    display: 'inline-block'
                                }} />
                                : <span className={`codicon ${icon.value}`} style={{
                                    fontSize: 18,
                                    marginRight: SPACING.TINY,
                                    opacity: 0.95,
                                    verticalAlign: 'middle',
                                    display: 'inline-block'
                                }} />;
                        })()}
                        <span style={{
                            fontSize: FONT_SIZE.SMALL,
                            whiteSpace: "nowrap"
                        }}>
                            {getFileBase(filename)}
                        </span>
                        <span style={{
                            color: COLORS.DESCRIPTION,
                            opacity: 0.7,
                            fontSize: FONT_SIZE.SMALL,
                            marginLeft: SPACING.TINY
                        }}>
                            ({getLineRange(lines)})
                        </span>
                    </span>
                </span>
            </div>
            {/* Row 2: Title and Delete Button (inline, flex row) */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    fontSize: FONT_SIZE.HEADER,
                    marginBottom: collapsed && concise ? SPACING.SMALL : 0,
                    color: COLORS.FOREGROUND
                }}
            >
                <span>
                    {section.oldSummaryData
                        ? renderDiffedText(section.oldSummaryData.title, title)
                        : (title || "Untitled")}
                </span>
                {/* Only show delete button when header is hovered and section is expanded */}
                {!collapsed && headerHovered && (
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation(); // Prevent triggering collapse/expand
                            onDeleteSection();
                        }}
                        title="Delete Section"
                        aria-label="Delete Section"
                        style={{
                            ...COMMON_STYLES.ICON_BUTTON,
                        }}
                    >
                        <span
                            className="codicon codicon-trash"
                            style={{
                                fontSize: FONT_SIZE.ICON,
                            }}
                        />
                    </button>
                )}
            </div>
            {/* Row 3: Concise summary when collapsed */}
            {collapsed && concise && (
                <div style={{
                    color: COLORS.DESCRIPTION,
                    fontStyle: "italic",
                    fontSize: FONT_SIZE.SMALL,
                    marginTop: 0
                }}>
                    {oldSummaryData
                        ? renderDiffedText(oldSummaryData.low_unstructured, concise)
                        : concise}
                </div>
            )}
        </div>
    );
};

/**
 * SectionHeader component
 * Displays the header of a section with title, file info, and collapse/expand functionality
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({
    section,
    collapsed,
    onToggle,
    onDeleteSection
}) => {
    // Track mouse hover state for header
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={COMMON_STYLES.HEADER}
            onClick={onToggle}
            title={collapsed ? "Expand section" : "Collapse section"}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <HeaderContent
                section={section}
                showChevron={true}
                chevronDirection={collapsed ? 'right' : 'down'}
                collapsed={collapsed}
                onDeleteSection={onDeleteSection}
                headerHovered={hovered}
            />
        </div>
    );
};

export default SectionHeader;

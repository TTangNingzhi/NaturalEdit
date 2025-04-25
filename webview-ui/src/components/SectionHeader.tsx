import React from "react";
import { getFileIcon } from "../utils/fileIcons.js";
import { FONT_SIZE, COLORS, SPACING, COMMON_STYLES } from "../styles/constants.js";

interface SectionHeaderProps {
    title: string;
    filename: string;
    lines: [number, number];
    concise: string;
    lastOpened: number;
    collapsed: boolean;
    onToggle: () => void;
}

interface HeaderContentProps {
    title: string;
    filename: string;
    lines: [number, number];
    lastOpened: number;
    concise?: string;
    showChevron: boolean;
    chevronDirection: 'right' | 'down';
    collapsed: boolean;
}

const HeaderContent: React.FC<HeaderContentProps> = ({
    title,
    filename,
    lines,
    lastOpened,
    concise,
    showChevron,
    chevronDirection,
    collapsed
}) => {
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
                    {formatTime(lastOpened)}
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
            {/* Row 2: Title */}
            <div style={{
                fontWeight: 600,
                fontSize: FONT_SIZE.HEADER,
                marginBottom: collapsed && concise ? SPACING.SMALL : 0,
                color: COLORS.FOREGROUND
            }}>
                {title || "Untitled"}
            </div>
            {/* Row 3: Concise summary when collapsed */}
            {collapsed && concise && (
                <div style={{
                    color: COLORS.DESCRIPTION,
                    fontStyle: "italic",
                    fontSize: FONT_SIZE.SMALL,
                    marginTop: 0
                }}>
                    {concise}
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
    title,
    filename,
    lines,
    concise,
    lastOpened,
    collapsed,
    onToggle
}) => {
    return (
        <div
            style={COMMON_STYLES.HEADER}
            onClick={onToggle}
            title={collapsed ? "Expand section" : "Collapse section"}
        >
            <HeaderContent
                title={title}
                filename={filename}
                lines={lines}
                lastOpened={lastOpened}
                concise={concise}
                showChevron={true}
                chevronDirection={collapsed ? 'right' : 'down'}
                collapsed={collapsed}
            />
        </div>
    );
};

export default SectionHeader;

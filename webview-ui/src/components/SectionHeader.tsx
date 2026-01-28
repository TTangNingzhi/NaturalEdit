import React, { useEffect, useRef, useState } from "react";
import { getFileIcon } from "../utils/fileIcons.js";
import { FONT_SIZE, COLORS, SPACING, COMMON_STYLES } from "../styles/constants.js";
import { SectionData } from "../types/sectionTypes.js";
import { renderDiffedText } from "../utils/diffRender";
import { vscodeApi } from "../utils/vscodeApi";

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
    const [menuOpen, setMenuOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [fileButtonHovered, setFileButtonHovered] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileButtonRef = useRef<HTMLButtonElement>(null);

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

    const menuItems = [
        { id: "file", label: "File", icon: "codicon-file" },
        { id: "class", label: "Class", icon: "codicon-symbol-class" },
        { id: "method", label: "Method", icon: "codicon-symbol-method" }
    ];

    useEffect(() => {
        if (!menuOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        };

        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                fileButtonRef.current &&
                !fileButtonRef.current.contains(target)
            ) {
                setMenuOpen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("mousedown", onMouseDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("mousedown", onMouseDown);
        };
    }, [menuOpen]);

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
                    marginLeft: "auto",
                    position: "relative"
                }}>
                    <button
                        ref={fileButtonRef}
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            setMenuOpen(open => !open);
                        }}
                        onMouseEnter={() => setFileButtonHovered(true)}
                        onMouseLeave={() => setFileButtonHovered(false)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={`section-file-menu-${section.metadata.id}`}
                        style={{
                            ...COMMON_STYLES.FILE_INFO,
                            cursor: "pointer",
                            backgroundColor: fileButtonHovered ? 'var(--vscode-list-hoverBackground)' : 'var(--vscode-editor-background)',
                            transition: 'background-color 0.15s ease'
                        }}
                    >
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
                            color: COLORS.FOREGROUND,
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
                    </button>
                    {menuOpen && (
                        <div
                            ref={menuRef}
                            id={`section-file-menu-${section.metadata.id}`}
                            role="menu"
                            style={COMMON_STYLES.MENU_PANEL}
                        >
                            {menuItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="menuitem"
                                    onClick={event => {
                                        event.stopPropagation();
                                        setMenuOpen(false);
                                    }}
                                    onMouseEnter={() => setHoveredItem(item.id)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    style={{
                                        ...COMMON_STYLES.MENU_ITEM,
                                        backgroundColor: hoveredItem === item.id ? 'var(--vscode-list-hoverBackground)' : 'transparent',
                                        transition: 'background-color 0.15s ease'
                                    }}
                                >
                                    <span className={`codicon ${item.icon}`} style={{
                                        fontSize: FONT_SIZE.SMALL,
                                        color: COLORS.ICON
                                    }} />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
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
            {/* Row 2.5: Code validity badge with regenerate button */}
            {section.isCodeValid === false && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: SPACING.SMALL,
                    marginTop: SPACING.SMALL,
                    padding: `${SPACING.TINY} ${SPACING.SMALL}`,
                    backgroundColor: "var(--vscode-inputValidation-warningBackground)",
                    borderLeft: `3px solid var(--vscode-inputValidation-warningBorder)`,
                    borderRadius: "3px",
                    justifyContent: "space-between"
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.SMALL
                    }}>
                        <span className="codicon codicon-warning" style={{
                            color: "var(--vscode-inputValidation-warningBorder)",
                            fontSize: FONT_SIZE.BODY
                        }} />
                        <span style={{
                            color: "var(--vscode-inputValidation-warningBorder)",
                            fontSize: FONT_SIZE.SMALL,
                            fontWeight: 500
                        }}>
                            Code Changed
                        </span>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering collapse/expand
                            // Extract current section code from file and regenerate summary
                            vscodeApi.postMessage({
                                command: 'extractCurrentSectionCode',
                                sectionId: section.metadata.id,
                                fullPath: section.metadata.fullPath,
                                sessionCodeSegments: section.metadata.sessionCodeSegments
                            });
                        }}
                        style={{
                            padding: "0.25em 0.75em",
                            backgroundColor: "var(--vscode-inputValidation-warningBorder)",
                            color: "var(--vscode-editor-background)",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: FONT_SIZE.SMALL,
                            whiteSpace: "nowrap",
                            transition: "opacity 0.2s"
                        }}
                        onMouseOver={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
                        }}
                        onMouseOut={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                        }}
                    >
                        Regenerate Summary
                    </button>
                </div>
            )
            }
            {/* Row 3: Concise summary when collapsed */}
            {collapsed && concise && (
                <div style={{
                    color: COLORS.DESCRIPTION,
                    fontStyle: "italic",
                    fontSize: FONT_SIZE.SMALL,
                    marginTop: SPACING.TINY
                }}>
                    {oldSummaryData
                        ? renderDiffedText(oldSummaryData.low_unstructured, concise)
                        : concise}
                </div>
            )}
        </div >
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

/**
 * Font size constants for consistent typography
 */
export const FONT_SIZE = {
    TITLE: '20px',
    SUBTITLE: '14px',
    HEADER: '15px',
    BODY: '14px',
    SMALL: '12px',
    TINY: '10px',
    ICON: '16px',
    ICON_SMALL: '14px'
} as const;

/**
 * Color constants for consistent theming
 */
export const COLORS = {
    FOREGROUND: 'var(--vscode-editor-foreground)',
    DESCRIPTION: 'var(--vscode-descriptionForeground)',
    ICON: 'var(--vscode-icon-foreground)',
    ERROR: 'var(--vscode-errorForeground)',
    BACKGROUND: 'var(--vscode-panel-background)',
    BORDER: 'var(--vscode-panel-border)',
    ACTIVE_BACKGROUND: 'var(--vscode-editorGroupHeader-tabsBackground)',
    BUTTON_FOREGROUND: 'var(--vscode-button-foreground)',
    TEXT_DIFF: 'var(--vscode-editorWarning-foreground)'
} as const;

/**
 * Color palette for summary-code mapping highlights (up to 7 mappings).
 * These are high-contrast, visually distinct colors.
 */
export const SUMMARY_CODE_MAPPING_COLORS = [
    "#FFB3C6", // pink
    "#B9FBC0", // green
    "#FFD6A5", // orange
    "#D0BFFF", // purple
    "#A3D3FF", // blue
    "#FFDAC1", // peach
    "#FFFACD", // yellow
    "#E0BBE4", // lavender
    "#FEC8D8", // pastel rose
    "#C7CEEA", // periwinkle
    "#B5EAD7", // mint
] as const;

/**
 * Returns a CSS background for mapping highlights using color-mix with fallback.
 * @param baseColor - The pastel color (hex)
 * @param isActive - Whether the mapping is active (hovered)
 * @returns CSSProperties with background and fallback
 */
export function getMappingHighlightBackground(baseColor: string, isActive: boolean): React.CSSProperties {
    // Use color-mix for modern browsers, fallback to alpha hex for older environments
    const pastelAlpha = isActive ? "CC" : "40"; // 40 = 25% alpha, CC = 80% alpha
    return {
        background: `color-mix(in srgb, var(--vscode-editor-background) 70%, ${baseColor})`,
        backgroundColor: `${baseColor}${pastelAlpha}`,
        backgroundBlendMode: "multiply",
        transition: "background 0.15s"
    };
}

/**
 * Spacing constants for consistent layout
 */
export const SPACING = {
    MINUS_TINY: '-2px',
    TINY: '2px',
    SMALL: '4px',
    MEDIUM: '8px',
    LARGE: '16px',
    XLARGE: '24px'
} as const;

/**
 * Border radius constants
 */
export const BORDER_RADIUS = {
    SMALL: '4px',
    MEDIUM: '6px',
    LARGE: '8px'
} as const;

/**
 * Common style objects
 */
const SECTION = {
    border: `1px solid ${COLORS.BORDER}`,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.LARGE,
    background: COLORS.BACKGROUND,
    boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
    overflow: 'hidden',
    padding: SPACING.MEDIUM
};

export const COMMON_STYLES = {
    SECTION,
    SECTION_COMPACT: {
        ...SECTION,
        marginBottom: SPACING.SMALL
    },
    HEADER: {
        cursor: 'pointer',
        padding: `${SPACING.MEDIUM} ${SPACING.LARGE}`,
        background: COLORS.ACTIVE_BACKGROUND
    },
    SECTION_HEADER: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.MEDIUM
    },
    SECTION_LABEL: {
        fontWeight: 600,
        color: COLORS.DESCRIPTION,
        fontSize: FONT_SIZE.BODY
    },
    FILE_INFO: {
        display: 'flex',
        alignItems: 'center',
        border: `1.5px solid ${COLORS.BORDER}`,
        borderRadius: BORDER_RADIUS.MEDIUM,
        padding: '0px 2px 0px 2px',
        background: 'var(--vscode-editor-background)',
        minWidth: 0
    },
    ICON_BUTTON: {
        background: 'none',
        border: 'none',
        padding: 0,
        marginLeft: SPACING.MEDIUM,
        cursor: 'pointer',
        color: COLORS.ICON,
        display: 'flex',
        alignItems: 'center',
        fontSize: FONT_SIZE.ICON,
        lineHeight: 1
    }
} as const;

// Types and utilities for section data and summaries

// Summary types
export type SummaryData = {
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
};

export type SummaryLevel = "concise" | "detailed" | "bullets";

/**
 * Metadata for a code section.
 * Groups all section-related identifiers and file info.
 */
export interface SectionMetadata {
    id: string;
    filename: string;
    fullPath: string;
    offset: number;
    originalCode: string;
}

/**
 * Data structure for a code section with its summary and state.
 */
export interface SectionData {
    metadata: SectionMetadata;
    lines: [number, number];
    title: string;
    concise: string;
    lastOpened: number;
    summaryData: SummaryData;
    selectedLevel: SummaryLevel;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
}

// Message from VSCode containing summary data
export interface SummaryResultMessage {
    command: string;
    error?: string;
    data?: SummaryData;
    filename?: string;
    lines?: string;
    title?: string;
    concise?: string;
    lastOpened?: string;
    originalCode?: string;
    fullPath?: string;
    offset?: number;
}
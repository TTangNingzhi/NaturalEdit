// Types and utilities for section data and summaries

/**
 * Represents the summary data for a code section (baseline: only detailed summary).
 */
export type SummaryData = string;

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
 * Data structure for a code section with its summary and state (baseline).
 */
export interface SectionData {
    metadata: SectionMetadata;
    lines: [number, number];
    title: string;
    createdAt: number;
    summaryData: SummaryData; // string
    editPromptValue: string;
}

// Message from VSCode containing summary data (baseline)
export interface SummaryResultMessage {
    command: string;
    error?: string;
    data?: SummaryData; // string
    filename?: string;
    lines?: string;
    title?: string;
    createdAt?: string;
    originalCode?: string;
    fullPath?: string;
    offset?: number;
}

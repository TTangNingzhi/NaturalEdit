// Types and utilities for section data and summaries

/**
 * Represents the summary data for a code section.
 */
export type SummaryData = {
    title: string;
    // 6 combinations: [detail][structured]
    low_unstructured: string;
    low_structured: string;
    medium_unstructured: string;
    medium_structured: string;
    high_unstructured: string;
    high_structured: string;
};

/**
 * Represents a mapping between a summary component and one or more code segments.
 * - summaryComponent: The phrase or component from the summary.
 * - codeSegments: An array of code fragments with their line numbers for precise mapping.
 */
export interface SummaryCodeMapping {
    summaryComponent: string;
    codeSegments: { code: string; line: number }[]; // Each code fragment with its line number
}

export type DetailLevel = "low" | "medium" | "high";
export type StructuredType = "structured" | "unstructured";

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
    createdAt: number;
    summaryData: SummaryData;
    oldSummaryData?: SummaryData;
    // Selection state
    selectedDetailLevel: DetailLevel;
    selectedStructured: StructuredType;
    editPromptDetailLevel: DetailLevel | null;
    editPromptStructured: StructuredType | null;
    editPromptValue: string;
    // 6-way mapping
    summaryMappings: {
        low_unstructured: SummaryCodeMapping[];
        low_structured: SummaryCodeMapping[];
        medium_unstructured: SummaryCodeMapping[];
        medium_structured: SummaryCodeMapping[];
        high_unstructured: SummaryCodeMapping[];
        high_structured: SummaryCodeMapping[];
    };
}

/**
 * Message from VSCode indicating summary progress.
 */
export interface SummaryProgressMessage {
    command: "summaryProgress";
    stageText?: string;
}

/**
 * Message from VSCode containing summary data.
 */
export interface SummaryResultMessage {
    command: "summaryResult";
    data?: SummaryData;
    filename?: string;
    fullPath?: string;
    lines?: string;
    title?: string;
    createdAt?: string;
    originalCode?: string;
    offset?: number;
    summaryMappings?: {
        low_unstructured: SummaryCodeMapping[];
        low_structured: SummaryCodeMapping[];
        medium_unstructured: SummaryCodeMapping[];
        medium_structured: SummaryCodeMapping[];
        high_unstructured: SummaryCodeMapping[];
        high_structured: SummaryCodeMapping[];
    };
    error?: string;
    oldSummaryData?: SummaryData; // Optional: previous summary for diff rendering
}

/**
 * Message from VSCode indicating an edit result.
 */
export interface EditResultMessage {
    command: "editResult";
    action: string;
    sectionId: string;
    newCode: string;
}

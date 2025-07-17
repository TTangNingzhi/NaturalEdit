// Types and utilities for section data and summaries

/**
 * Represents the summary data for a code section.
 */
export type SummaryData = {
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
};

/**
 * Represents a mapping between a summary component and one or more code segments.
 * - summaryComponent: The phrase or component from the summary.
 * - codeSnippets: An array of code fragments (to be fuzzy-matched to code ranges in frontend).
 *
 * Example (one-shot, based on the classic screenshot):
 * summary: "Find the name of the continent with the highest average population by country."
 * code: (lines 0-13)
 * summaryMappings: {
 *   concise: [
 *     { summaryComponent: "name of the continent", codeSnippets: ["..."] },
 *     { summaryComponent: "highest", codeSnippets: ["..."] },
 *     { summaryComponent: "average population", codeSnippets: ["..."] },
 *     { summaryComponent: "by country", codeSnippets: ["..."] }
 *   ],
 *   detailed: [...],
 *   bulleted: [...]
 * }
 */
export interface SummaryCodeMapping {
    summaryComponent: string;
    codeSnippets: string[]; // Array of code fragments (to be fuzzy-matched to code ranges in frontend)
}

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
    createdAt: number;
    summaryData: SummaryData;
    oldSummaryData?: SummaryData; // If present, stores the previous summary data for diffed rendering.
    selectedLevel: SummaryLevel;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    summaryMappings: {
        concise: SummaryCodeMapping[];
        detailed: SummaryCodeMapping[];
        bullets: SummaryCodeMapping[];
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
    concise?: string;
    createdAt?: string;
    originalCode?: string;
    offset?: number;
    summaryMappings?: {
        concise: SummaryCodeMapping[];
        detailed: SummaryCodeMapping[];
        bullets: SummaryCodeMapping[];
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
    newCodeRegion?: string;
}

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
    lastOpened: number;
    summaryData: SummaryData;
    selectedLevel: SummaryLevel;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    /**
     * Mappings for each summary level (concise, detailed, bulleted).
     */
    summaryMappings: {
        concise: SummaryCodeMapping[];
        detailed: SummaryCodeMapping[];
        bullets: SummaryCodeMapping[];
    };
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
    /**
     * Mappings for each summary level (concise, detailed, bulleted).
     */
    summaryMappings?: {
        concise: SummaryCodeMapping[];
        detailed: SummaryCodeMapping[];
        bullets: SummaryCodeMapping[];
    };
}

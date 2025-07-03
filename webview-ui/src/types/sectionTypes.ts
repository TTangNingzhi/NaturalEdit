// Types and utilities for section data and summaries

/**
 * Represents the summary data for a code section.
 */
export type SummaryData = {
  detailed: string;
};

/**
 * Represents a mapping between a summary component and one or more code segments.
 * - summaryComponent: The phrase or component from the summary.
 * - codeSnippets: An array of code fragments (to be fuzzy-matched to code ranges in frontend).
 *
 * Example:
 * summary: "Find the name of the continent with the highest average population by country."
 * summaryMappings: {
 *   detailed: [
 *     { summaryComponent: "name of the continent", codeSnippets: ["..."] },
 *     { summaryComponent: "highest", codeSnippets: ["..."] },
 *     { summaryComponent: "average population", codeSnippets: ["..."] },
 *     { summaryComponent: "by country", codeSnippets: ["..."] }
 *   ]
 * }
 */
export interface SummaryCodeMapping {
  summaryComponent: string;
  codeSnippets: string[]; // Array of code fragments (to be fuzzy-matched to code ranges in frontend)
}

export type SummaryLevel = "detailed";

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
  selectedLevel: SummaryLevel;
  editPromptValue: string;
  summaryMappings: {
    detailed: SummaryCodeMapping[];
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
  createdAt?: string;
  originalCode?: string;
  fullPath?: string;
  offset?: number;
  summaryMappings?: {
    detailed: SummaryCodeMapping[];
  };
}

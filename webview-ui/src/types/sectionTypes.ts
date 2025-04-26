// Types and utilities for section data and summaries

// Summary types
export type SummaryData = {
    title: string;
    concise: string;
    detailed: string;
    bullets: string[];
};

export type SummaryLevel = "concise" | "detailed" | "bullets";

// Data structure for a code section with its summary
export interface SectionData {
    id: string;
    filename: string;
    lines: [number, number];
    title: string;
    concise: string;
    lastOpened: number;
    summaryData: SummaryData;
    selectedLevel: SummaryLevel;
    editPromptLevel: SummaryLevel | null;
    editPromptValue: string;
    originalCode: string;
    fullPath: string;
    offset: number;
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

// Convert a line range string to a tuple of numbers
export const parseLineRange = (lineStr: string | undefined): [number, number] => {
    if (!lineStr) return [0, 0];
    const [start, end] = lineStr.split('-').map(Number);
    return [start, end];
};

// Convert a timestamp string to milliseconds
export const parseTimestamp = (timestamp: string | undefined): number => {
    return timestamp ? new Date(timestamp).getTime() : Date.now();
};

import { createContext } from 'react';
import { DetailLevel, StructuredType, SectionMetadata } from '../types/sectionTypes.js';

/**
 * PromptContextType provides handler factories that bind section metadata.
 * Each handler returns a function that only needs the minimal arguments.
 */
export interface PromptContextType {
    onDirectPrompt: (metadata: SectionMetadata) => (prompt: string) => Promise<void>;
    onPromptToSummary: (metadata: SectionMetadata) => (
        detail: DetailLevel,
        structured: StructuredType,
        originalSummary: string,
        prompt: string
    ) => Promise<void>;
    onSummaryPrompt: (metadata: SectionMetadata) => (
        detail: DetailLevel,
        structured: StructuredType,
        value: string,
        originalSummary: string
    ) => Promise<void>;
}

export const PromptContext = createContext<PromptContextType | null>(null);

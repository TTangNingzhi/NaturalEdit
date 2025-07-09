import { createContext } from 'react';
import { SectionMetadata } from '../types/sectionTypes.js';

/**
 * PromptContextType now provides handler factories that bind section metadata.
 * Each handler returns a function that only needs the minimal arguments.
 * For the baseline, all handlers operate only on the "detailed" summary.
 */
export interface PromptContextType {
    onDirectPrompt: (metadata: SectionMetadata) => (prompt: string) => Promise<void>;
    onSummaryPrompt: (metadata: SectionMetadata) => (value: string, originalSummary: string) => Promise<void>;
}

export const PromptContext = createContext<PromptContextType | null>(null);

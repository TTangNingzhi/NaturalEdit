import { createContext } from 'react';
import { SummaryLevel, SectionMetadata } from '../types/sectionTypes.js';

/**
 * PromptContextType now provides handler factories that bind section metadata.
 * Each handler returns a function that only needs the minimal arguments.
 */
export interface PromptContextType {
    onDirectPrompt: (metadata: SectionMetadata) => (prompt: string) => Promise<void>;
    onPromptToSummary: (metadata: SectionMetadata) => (level: SummaryLevel, summary: string, prompt: string) => Promise<void>;
    onSummaryPrompt: (metadata: SectionMetadata) => (level: SummaryLevel, value: string) => Promise<void>;
}

export const PromptContext = createContext<PromptContextType | null>(null);

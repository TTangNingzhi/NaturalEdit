import { createContext } from 'react';
import { SummaryLevel } from '../types/sectionTypes.js';

export interface PromptContextType {
    onDirectPrompt: (sectionId: string, prompt: string, originalCode: string, filename: string, fullPath: string, offset: number) => void;
    onPromptToSummary: (sectionId: string, level: SummaryLevel, summary: string, prompt: string, originalCode: string, filename: string, fullPath: string, offset: number) => void;
    onSummaryPrompt: (sectionId: string, level: SummaryLevel, value: string, originalCode: string, filename: string, fullPath: string, offset: number) => void;
}

export const PromptContext = createContext<PromptContextType | null>(null); 
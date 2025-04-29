import React from 'react';
import { PromptContext, PromptContextType } from './PromptContext.js';
import { sendDirectPrompt, sendPromptToSummary, sendEditSummary } from '../services/MessageHandler.js';

import { SectionMetadata, SummaryLevel } from '../types/sectionTypes.js';

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value: PromptContextType = {
        onDirectPrompt: (metadata: SectionMetadata) => (prompt: string) => {
            sendDirectPrompt(
                metadata.id,
                prompt,
                metadata.originalCode,
                metadata.filename,
                metadata.fullPath,
                metadata.offset
            );
        },
        onPromptToSummary: (metadata: SectionMetadata) => (level: SummaryLevel, summary: string, prompt: string) => {
            sendPromptToSummary(
                metadata.id,
                level,
                summary,
                prompt,
                metadata.originalCode,
                metadata.filename,
                metadata.fullPath,
                metadata.offset
            );
        },
        onSummaryPrompt: (metadata: SectionMetadata) => (level: SummaryLevel, value: string) => {
            sendEditSummary(
                metadata.id,
                level,
                value,
                metadata.originalCode,
                metadata.filename,
                metadata.fullPath,
                metadata.offset
            );
        }
    };

    return (
        <PromptContext.Provider value={value}>
            {children}
        </PromptContext.Provider>
    );
};

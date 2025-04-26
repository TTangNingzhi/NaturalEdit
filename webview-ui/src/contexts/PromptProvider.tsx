import React from 'react';
import { PromptContext, PromptContextType } from './PromptContext.js';
import { sendDirectPrompt, sendPromptToSummary, sendEditSummary } from '../services/MessageHandler.js';

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value: PromptContextType = {
        onDirectPrompt: (sectionId, prompt, originalCode, filename, fullPath, offset) => {
            sendDirectPrompt(sectionId, prompt, originalCode, filename, fullPath, offset);
        },
        onPromptToSummary: (sectionId, level, summary, prompt, originalCode, filename, fullPath, offset) => {
            sendPromptToSummary(sectionId, level, summary, prompt, originalCode, filename, fullPath, offset);
        },
        onSummaryPrompt: (sectionId, level, value, originalCode, filename, fullPath, offset) => {
            sendEditSummary(sectionId, level, value, originalCode, filename, fullPath, offset);
        }
    };

    return (
        <PromptContext.Provider value={value}>
            {children}
        </PromptContext.Provider>
    );
}; 
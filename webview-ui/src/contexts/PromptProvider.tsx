import React from 'react';
import { PromptContext, PromptContextType } from './PromptContext.js';
import { sendDirectPrompt, sendPromptToSummary, sendEditSummary } from '../services/MessageHandler.js';

import { SectionMetadata } from '../types/sectionTypes.js';

export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value: PromptContextType = {
        onDirectPrompt: (metadata: SectionMetadata) => (prompt: string) => {
            return new Promise<void>((resolve, reject) => {
                const listener = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'editResult' && message.sectionId === metadata.id) {
                        window.removeEventListener('message', listener);
                        if (message.error) {
                            reject(new Error(message.error));
                        } else {
                            resolve();
                        }
                    }
                };
                window.addEventListener('message', listener);
                sendDirectPrompt(
                    metadata.id,
                    prompt,
                    metadata.originalCode,
                    metadata.filename,
                    metadata.fullPath,
                    metadata.offset
                );
            });
        },
        onPromptToSummary: (metadata: SectionMetadata) => (summary: string, prompt: string) => {
            return new Promise<void>((resolve, reject) => {
                const listener = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'editResult' && message.sectionId === metadata.id) {
                        window.removeEventListener('message', listener);
                        if (message.error) {
                            reject(new Error(message.error));
                        } else {
                            resolve();
                        }
                    }
                };
                window.addEventListener('message', listener);
                sendPromptToSummary(
                    metadata.id,
                    "detailed",
                    summary,
                    prompt,
                    metadata.originalCode,
                    metadata.filename,
                    metadata.fullPath,
                    metadata.offset
                );
            });
        },
        onSummaryPrompt: (metadata: SectionMetadata) => (value: string, originalSummary: string) => {
            return new Promise<void>((resolve, reject) => {
                const listener = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'editResult' && message.sectionId === metadata.id) {
                        window.removeEventListener('message', listener);
                        if (message.error) {
                            reject(new Error(message.error));
                        } else {
                            resolve();
                        }
                    }
                };
                window.addEventListener('message', listener);
                sendEditSummary(
                    metadata.id,
                    "detailed",
                    value,
                    metadata.originalCode,
                    metadata.filename,
                    metadata.fullPath,
                    metadata.offset,
                    originalSummary
                );
            });
        }
    };

    return (
        <PromptContext.Provider value={value}>
            {children}
        </PromptContext.Provider>
    );
};

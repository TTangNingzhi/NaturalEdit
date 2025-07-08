import { useContext } from 'react';
import { PromptContext } from '../contexts/PromptContext.js';
import { SectionMetadata } from '../types/sectionTypes.js';

/**
 * Custom hook to get prompt handlers bound to a specific section's metadata.
 * Returns handler functions that only require the minimal arguments.
 */
export const usePrompt = (metadata: SectionMetadata) => {
    const context = useContext(PromptContext);
    if (!context) {
        throw new Error('usePrompt must be used within a PromptProvider');
    }
    return {
        onDirectPrompt: context.onDirectPrompt(metadata),
        onSummaryPrompt: context.onSummaryPrompt(metadata),
    };
};

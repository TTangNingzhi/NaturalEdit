import { useContext } from 'react';
import { PromptContext } from '../contexts/PromptContext.js';

export const usePrompt = () => {
    const context = useContext(PromptContext);
    if (!context) {
        throw new Error('usePrompt must be used within a PromptProvider');
    }
    return context;
}; 
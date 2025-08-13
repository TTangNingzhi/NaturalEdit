import React, { useState, useEffect } from "react";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { SectionData, DetailLevel, StructuredType } from "../types/sectionTypes.js";
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from "../styles/constants.js";
import { vscodeApi } from "../utils/vscodeApi"; // Import VSCode API for backend communication
import { logInteraction } from "../utils/telemetry";

interface SectionBodyProps {
    section: SectionData;
    onLevelChange: (detail: DetailLevel, structured: StructuredType) => void;
    onEditPrompt: (detail: DetailLevel, structured: StructuredType, value: string) => void;
    onDeleteSection: () => void; // Handler for deleting the section
}

/**
 * SectionBody component
 * Contains the summary display and prompt panel, and checks section validity on expand.
 */
const SectionBody: React.FC<SectionBodyProps> = ({
    section,
    onLevelChange,
    onEditPrompt,
    onDeleteSection
}) => {
    const {
        summaryData,
        selectedDetailLevel,
        selectedStructured,
        summaryMappings
    } = section;

    // State for the currently active mapping index (for bidirectional highlight)
    const [activeMappingIndex, setActiveMappingIndex] = useState<number | null>(null);

    // State for section validity: "pending" | "success" | "file_missing" | "code_not_matched"
    const [validityStatus, setValidityStatus] = useState<"pending" | "success" | "file_missing" | "code_not_matched">("pending");

    // Get the mapping array for the current summary type
    const mappingKey = `${selectedDetailLevel}_${selectedStructured}` as keyof typeof summaryMappings;
    const rawMappings = summaryMappings?.[mappingKey] || [];

    /**
     * Handles hover events on summary mapping components.
     * Sends highlight/clear messages to the backend and updates local highlight state.
     * @param index The mapping index being hovered, or null if unhovered
     */
    const handleMappingHover = (index: number | null) => {
        setActiveMappingIndex(index);

        // Log mapping hover/unhover interaction for telemetry analysis
        if (index !== null && rawMappings[index]) {
            logInteraction("mapping_hover", {
                section_id: section.metadata.id,
                mapping_index: index,
                detail_level: selectedDetailLevel,
                structured_type: selectedStructured
            });
        } else {
            logInteraction("mapping_unhover", {
                section_id: section.metadata.id,
                detail_level: selectedDetailLevel,
                structured_type: selectedStructured
            });
        }

        // Get file info from section metadata
        const { filename, fullPath } = section.metadata;

        if (index !== null && rawMappings[index]) {
            // On hover: send highlight message with selected code, ALL code snippets, and color index
            const codeSegments = Array.isArray(rawMappings[index].codeSegments)
                ? rawMappings[index].codeSegments.filter(
                    seg => typeof seg.line === "number" && seg.line > 0
                )
                : [];
            const selectedCode = section.metadata.originalCode || "";
            vscodeApi.postMessage({
                command: "highlightCodeMapping",
                selectedCode,
                codeSegments,
                filename,
                fullPath,
                colorIndex: index
            });
        } else {
            // On unhover: send clear highlight message
            vscodeApi.postMessage({
                command: "clearHighlight",
                filename,
                fullPath
            });
        }
    };

    // Effect: On mount, check section validity with backend
    useEffect(() => {
        // Send message to backend to check file and code validity
        vscodeApi.postMessage({
            command: "checkSectionValidity",
            fullPath: section.metadata.fullPath,
            originalCode: section.metadata.originalCode
        });

        // Handler for backend response
        function handleMessage(event: MessageEvent) {
            const msg = event.data;
            if (msg && msg.command === "sectionValidityResult") {
                if (msg.status === "success") {
                    setValidityStatus("success");
                } else if (msg.status === "file_missing") {
                    setValidityStatus("file_missing");
                } else if (msg.status === "code_not_matched") {
                    setValidityStatus("code_not_matched");
                }
            }
        }

        window.addEventListener("message", handleMessage);
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [section.metadata.fullPath, section.metadata.originalCode]);

    // Overlay message based on validity status
    let overlayMessage = "";
    if (validityStatus === "file_missing") {
        overlayMessage = "Code file not found.";
    } else if (validityStatus === "code_not_matched") {
        overlayMessage = "Code snippet cannot be matched.";
    }

    return (
        <div style={{
            position: "relative",
            padding: SPACING.MEDIUM,
            background: COLORS.BACKGROUND
        }}>
            {/* Main content */}
            <SummaryDisplay
                summary={summaryData}
                selectedDetailLevel={selectedDetailLevel}
                selectedStructured={selectedStructured}
                onLevelChange={onLevelChange}
                onEditPrompt={onEditPrompt}
                summaryMappings={summaryMappings}
                activeMappingIndex={activeMappingIndex}
                onMappingHover={handleMappingHover}
                oldSummaryData={section.oldSummaryData}
            />
            <PromptPanel section={section} />

            {/* Overlay for invalid section */}
            {validityStatus !== "success" && validityStatus !== "pending" && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: "rgba(255,255,255,0.7)",
                        zIndex: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "auto"
                    }}
                >
                    <div style={{
                        color: COLORS.ERROR,
                        fontSize: FONT_SIZE.HEADER,
                        fontWeight: "bold",
                        marginBottom: SPACING.MEDIUM,
                        textAlign: "center"
                    }}>
                        {overlayMessage}
                    </div>
                    <button
                        onClick={() => { onDeleteSection(); }}
                        style={{
                            padding: "0.3em 1.2em",
                            background: COLORS.ERROR,
                            color: "#fff",
                            border: "none",
                            borderRadius: BORDER_RADIUS.MEDIUM,
                            cursor: "pointer",
                            fontSize: FONT_SIZE.BODY
                        }}
                    >
                        Delete Section
                    </button>
                </div>
            )}
        </div>
    );
};

export default SectionBody;

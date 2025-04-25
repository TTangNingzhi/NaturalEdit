import { useState, useEffect } from "react";
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "./styles/constants.js";
import SectionList from "./components/SectionList.js";
import { SectionData } from "./types/sectionTypes.js";
import { setupMessageHandler, requestSummary } from "./services/MessageHandler.js";

function App() {
  // State for all code-summary pairs
  const [sectionList, setSectionList] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup message handler
  useEffect(() => {
    setupMessageHandler(
      (error) => {
        setLoading(false);
        setError(error);
      },
      (section) => {
        setLoading(false);
        setSectionList(prev => [...prev, section]);
      }
    );
  }, []);

  // Handler: Summarize Selected Code
  const handleRequestSummary = () => {
    setLoading(true);
    setError(null);
    requestSummary();
  };

  return (
    <div style={{ width: "100%" }}>
      <h2 style={{
        margin: `${SPACING.MEDIUM} 0 ${SPACING.MEDIUM} 0`,
        color: COLORS.FOREGROUND,
        fontSize: FONT_SIZE.TITLE
      }}>
        NaturalEdit
      </h2>
      <div style={{
        color: COLORS.DESCRIPTION,
        marginBottom: SPACING.MEDIUM,
        fontSize: FONT_SIZE.SUBTITLE
      }}>
        Transform your code seamlessly by modifying its natural language descriptions.
      </div>
      <VSCodeButton
        onClick={handleRequestSummary}
        disabled={loading}
        style={{
          marginBottom: SPACING.LARGE,
          display: "flex",
          alignItems: "center",
        }}
      >
        {loading && (
          <VSCodeProgressRing
            style={{
              width: 16,
              height: 16,
              marginRight: 8
            }}
          />
        )}
        {loading ? "Summarizing..." : "Summarize Selected Code"}
      </VSCodeButton>
      {error && (
        <div style={{
          color: COLORS.ERROR,
          marginBottom: SPACING.LARGE
        }}>
          {error}
        </div>
      )}
      <SectionList
        sections={sectionList}
        onSectionsChange={setSectionList}
      />
    </div>
  );
}

export default App;

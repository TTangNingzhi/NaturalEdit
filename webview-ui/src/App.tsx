import { PromptProvider } from "./contexts/PromptProvider.js";
import { NaturalEditContent } from "./components/NaturalEditContent.js";

function App() {
  return (
    <PromptProvider>
      <NaturalEditContent />
    </PromptProvider>
  );
}

export default App;

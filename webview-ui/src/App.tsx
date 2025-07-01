import { PromptProvider } from "./contexts/PromptProvider.js";
import { NaturalEditContent } from "./components/NaturalEditContent.js";

function App() {
  return (
    <PromptProvider>
      <NaturalEditContent onSectionChange={() => {}} />
    </PromptProvider>
  );
}

export default App;

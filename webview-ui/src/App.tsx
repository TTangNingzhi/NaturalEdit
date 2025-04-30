import { PromptProvider } from "./contexts/PromptProvider.js";
import { NaturalEditContent } from "./components/NaturalEditContent.js";

function App() {
  return (
    <PromptProvider>
      <NaturalEditContent onSectionsChange={() => { }} />
    </PromptProvider>
  );
}

export default App;

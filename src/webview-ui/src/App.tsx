import { useState, useEffect } from 'react'

function App() {
  const [messageFromVSCode, setMessageFromVSCode] = useState('')

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.command === 'hello') {
        setMessageFromVSCode(message.text)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const sendMessageToVSCode = () => {
    window.parent.postMessage(
      { command: 'hello', text: 'Hello from Webview!' },
      '*'
    );
  }

  return (
    <>
      <h1>ModMap</h1>
      <p id="from-vscode">
        {messageFromVSCode || 'Waiting for VSCode message...'}
      </p>
      <button id="send-button" onClick={sendMessageToVSCode}>Hello to VSCode</button>
    </>
  )
}

export default App

import './App.css';
import { ThemeProvider } from '@/lib/theme';
import { ChatStoreProvider } from '@/stores/chat-store';
import { ChatLayout } from '@/components/chat/ChatLayout';

function App() {
  return (
    <ThemeProvider>
      <ChatStoreProvider>
        <ChatLayout />
      </ChatStoreProvider>
    </ThemeProvider>
  );
}

export default App;

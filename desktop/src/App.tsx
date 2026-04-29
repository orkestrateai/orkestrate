import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ThemeProvider } from '@/lib/theme';
import { ChatStoreProvider } from '@/stores/chat-store';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

function AppContent() {
  const [appState, setAppState] = useState<'loading' | 'onboarding' | 'ready'>('loading');

  useEffect(() => {
    invoke<string>('get_auth_state')
      .then(state => {
        if (state === 'authenticated') {
          setAppState('ready');
        } else {
          setAppState('onboarding');
        }
      })
      .catch(() => setAppState('onboarding'));
  }, []);

  const handleSignOut = () => {
    invoke('sign_out').catch(() => {});
    setAppState('onboarding');
  };

  if (appState === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <span className="text-sm text-foreground/50">Starting Orkestrate...</span>
        </div>
      </div>
    );
  }

  if (appState === 'onboarding') {
    return (
      <OnboardingFlow onComplete={() => setAppState('ready')} />
    );
  }

  return <ChatLayout onSignOut={handleSignOut} />;
}

function App() {
  return (
    <ThemeProvider>
      <ChatStoreProvider>
        <AppContent />
      </ChatStoreProvider>
    </ThemeProvider>
  );
}

export default App;

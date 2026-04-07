interface VoiceTextHistoryItem {
  id: string;
  text: string;
  voiceId: string;
  voiceName: string;
  createdAt: string;
}

const STORAGE_KEY = 'web_speech_text_history';
const MAX_ITEMS = 20;

export function useVoiceTextHistory() {
  const getHistory = (): VoiceTextHistoryItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const addToHistory = (text: string, voiceId: string, voiceName: string) => {
    const history = getHistory();
    const newItem: VoiceTextHistoryItem = {
      id: Date.now().toString(),
      text,
      voiceId,
      voiceName,
      createdAt: new Date().toISOString()
    };

    // Remove duplicates of same text
    const filtered = history.filter(h => h.text !== text);

    // Add at beginning and limit to MAX_ITEMS
    const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return { getHistory, addToHistory, clearHistory };
}

export type { VoiceTextHistoryItem };

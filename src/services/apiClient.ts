/**
 * Client for backend AI API. Keeps GEMINI_API_KEY secure on server.
 */
import { API_BASE } from '../config';

export interface WordInfo {
  word?: string;
  translation: string;
  transcription: string;
  example: string;
  example_translation?: string;
  mnemonic: string;
}

const api = async (path: string, body: object) => {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
};

export async function getWordDetails(word: string): Promise<WordInfo> {
  return api("/api/ai/word-details", { word });
}

export async function generateWordImage(word: string): Promise<string | null> {
  const { image } = await api("/api/ai/word-image", { word });
  return image ?? null;
}

export async function generateSpeech(text: string): Promise<string | null> {
  const { base64 } = await api("/api/ai/speech", { text });
  return base64 ?? null;
}

export async function generateSmartStory(words: string[]): Promise<string> {
  const { story } = await api("/api/ai/story", { words });
  return story ?? "";
}

export async function getChatResponse(
  message: string,
  history: { role: string; text: string }[],
  targetWords: string[]
): Promise<string> {
  const { response } = await api("/api/ai/chat", {
    message,
    history,
    targetWords,
  });
  return response ?? "";
}

export async function generateWordsByTopic(
  topic: string,
  count: number = 5
): Promise<WordInfo[]> {
  const { words } = await api("/api/ai/words-by-topic", { topic, count });
  return words ?? [];
}

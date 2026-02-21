import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface WordInfo {
  translation: string;
  transcription: string;
  example: string;
  mnemonic: string;
}

export async function getWordDetails(word: string, targetLang: string = "Russian"): Promise<WordInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the word "${word}" for a language learner. Target language: ${targetLang}. Provide translation, IPA transcription, a simple example sentence, and a short mnemonic hint.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translation: { type: Type.STRING },
          transcription: { type: Type.STRING },
          example: { type: Type.STRING },
          mnemonic: { type: Type.STRING },
        },
        required: ["translation", "transcription", "example", "mnemonic"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function generateWordImage(word: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: `A vibrant, minimalist 3D icon representing the word "${word}" for a language learning app. High quality, clean background.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return null;
}

export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (e) {
    console.error("Speech generation failed", e);
    return null;
  }
}

export async function generateSmartStory(words: string[]): Promise<string> {
  if (words.length === 0) return "Нет слов для генерации истории.";
  
  const prompt = `Напиши короткую, увлекательную историю (максимум 150 слов) на английском языке уровня B2-C1 (академический/профессиональный стиль), которая естественно включает следующие слова: ${words.join(', ')}. 
  Слова из списка должны быть выделены жирным шрифтом (в формате **слово**). 
  После английского текста добавь пустую строку и напиши качественный литературный перевод на русский язык.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Не удалось сгенерировать историю.";
  } catch (e) {
    console.error("Story generation failed", e);
    return "Произошла ошибка при генерации истории.";
  }
}

export async function getChatResponse(message: string, history: {role: string, text: string}[], targetWords: string[]): Promise<string> {
  const systemInstruction = `Ты — элитный преподаватель английского языка в МГИМО. Твоя задача — вести диалог с учеником на профессиональные темы (дипломатия, экономика, право, общество). 
  Твоя ГЛАВНАЯ ЦЕЛЬ — мягко провоцировать ученика использовать следующие слова в его ответах: ${targetWords.join(', ')}. 
  Отвечай кратко (1-3 предложения). Если ученик делает грамматические ошибки, деликатно исправляй их в конце своего ответа. Если ученик успешно использовал целевое слово, похвали его.`;

  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));
  
  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction
      }
    });
    return response.text || "I'm sorry, I didn't catch that.";
  } catch (e) {
    console.error("Chat failed", e);
    return "Connection error. Let's try again.";
  }
}

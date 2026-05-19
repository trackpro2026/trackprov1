import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function stripBase64DataUrl(data: string): { mimeType: string; data: string } {
  const trimmed = data.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { mimeType: match[1], data: match[2].replace(/\s/g, '') };
  }
  return { mimeType: 'image/jpeg', data: trimmed.replace(/\s/g, '') };
}

export function parseJsonFromText<T>(text: string): T | null {
  if (!text?.trim()) return null;
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export type GenerateJsonOptions = {
  imageBase64?: string;
  mimeType?: string;
};

export async function generateJson<T>(
  systemPrompt: string,
  userPayload: unknown,
  options: GenerateJsonOptions = {},
): Promise<T | null> {
  const ai = getClient();
  if (!ai) return null;

  const userText = `${systemPrompt}\n\nInput JSON:\n${JSON.stringify(userPayload)}`;

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: userText },
    ];

    if (options.imageBase64) {
      const { mimeType, data } = stripBase64DataUrl(options.imageBase64);
      parts.push({
        inlineData: {
          mimeType: options.mimeType || mimeType,
          data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text ?? '';
    return parseJsonFromText<T>(text);
  } catch {
    return null;
  }
}

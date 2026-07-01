import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { models } from '../../models/index.js';

export function createJudgeModel(modelName: string): BaseChatModel {
  const configuredModel = models[modelName];
  if (configuredModel) {
    return configuredModel.factory() as BaseChatModel;
  }

  if (modelName.startsWith('google:')) {
    return new ChatGoogleGenerativeAI({ model: modelName.slice('google:'.length), temperature: 0 });
  }

  if (modelName.startsWith('gemini')) {
    return new ChatGoogleGenerativeAI({ model: modelName, temperature: 0 });
  }

  if (modelName.startsWith('openrouter:')) {
    return new ChatOpenAI({
      model: modelName.slice('openrouter:'.length),
      temperature: 0,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
  }

  if (modelName.includes('/')) {
    return new ChatOpenAI({
      model: modelName,
      temperature: 0,
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    });
  }

  if (modelName.startsWith('openai:')) {
    return new ChatOpenAI({ model: modelName.slice('openai:'.length), temperature: 0 });
  }

  return new ChatOpenAI({ model: modelName, temperature: 0 });
}

export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part === 'object' && part !== null && 'text' in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    }).join('');
  }
  return String(content ?? '');
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try {
      const parsed = JSON.parse(objectMatch[0]) as unknown;
      return isJsonObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

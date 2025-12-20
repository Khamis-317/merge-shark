import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';

export type ModelFactory = () => LanguageModelLike;

function openRouterModelFactory(model: string): () => LanguageModelLike {
  return () =>
    new ChatOpenAI({
      model,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });
}

function googleModelFactory(model: string): () => LanguageModelLike {
  return () => new ChatGoogleGenerativeAI({ model });
}

export interface Model {
  name: string;
  factory: ModelFactory;
}

export const models: Record<string, Model> = {
  'gemini-3-flash': {
    name: 'Gemini 3 Flash',
    factory: googleModelFactory('gemini-3-flash-preview'),
  },
  'claude-4.5-sonnet': {
    name: 'Claude 4.5 Sonnet',
    factory: openRouterModelFactory('anthropic/claude-sonnet-4.5'),
  },
  'kimi-k2-thinking': {
    name: 'Kimi K2 Thinking',
    factory: openRouterModelFactory('moonshotai/kimi-k2-thinking'),
  },
  'minimax-m2': {
    name: 'Minimax M2',
    factory: openRouterModelFactory('minimax/minimax-m2'),
  },
  'glm-4.6': {
    name: 'GLM 4.6',
    factory: openRouterModelFactory('z-ai/glm-4.6:exacto'),
  },
  'devstral-2-free': {
    name: 'Devstral 2 Free',
    factory: openRouterModelFactory('mistralai/devstral-2512:free'),
  },
  'devstral-2': {
    name: 'Devstral 2',
    factory: openRouterModelFactory('mistralai/devstral-2512'),
  },
};

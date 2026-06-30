import { OpenAIEmbeddings } from '@langchain/openai';

export type EmbeddingModelFactory = () => {
  embedQuery(text: string): Promise<number[]>;
};

function openRouterModelFactory(
  model: string,
  dimensions?: number
): EmbeddingModelFactory {
  return () =>
    new OpenAIEmbeddings({
      model,
      ...(dimensions ? { dimensions } : {}),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });
}

export interface EmbeddingModel {
  factory: EmbeddingModelFactory;
  dimensions: number;
}

export const embeddingModels: Record<string, EmbeddingModel> = {
  'nvidia-nemotron-embed': {
    factory: openRouterModelFactory(
      'nvidia/llama-nemotron-embed-vl-1b-v2-20260224:free',
      768
    ),
    dimensions: 768,
  },
  'gemini-embedding-001': {
    factory: openRouterModelFactory('google/gemini-embedding-001', 768),
    dimensions: 768,
  },
  'gemini-embedding-2': {
    factory: openRouterModelFactory('google/gemini-embedding-2', 768),
    dimensions: 768,
  },
  'text-embedding-3-large': {
    factory: openRouterModelFactory('openai/text-embedding-3-large', 768),
    dimensions: 768,
  },
};

let activeEmbedder: { embedQuery(text: string): Promise<number[]> } | null =
  null;

export function setEmbeddingModel(key: string): void {
  const embedderDef = embeddingModels[key];
  if (!embedderDef) throw new Error(`Unknown embedding model: ${key}`);
  activeEmbedder = embedderDef.factory();
}

export async function createEmbedding(text: string): Promise<number[]> {
  if (!activeEmbedder) throw new Error('Embedding model not configured');
  return activeEmbedder.embedQuery(text);
}

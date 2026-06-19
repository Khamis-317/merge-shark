import { render } from 'ink';
import { LiveResolution } from './components/live-resolution.js';
import type { Model } from '../models/index.js';

export async function start(
  repoPath: string,
  model: Model,
  yolo: boolean = false,
  jdtlsPath?: string,
  jdltlsDataPath?: string
) {
  render(
    <LiveResolution
      repoPath={repoPath}
      llm={model.factory()}
      model={model.name}
      yolo={yolo}
      jdtlsPath={jdtlsPath ?? ''}
      jdltlsDataPath={jdltlsDataPath ?? ''}
    />
  );
}

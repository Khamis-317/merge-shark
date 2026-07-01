export {
  ConflictRepository,
  type Conflict,
  type IConflictRepository,
} from './db.js';
export { getEmbedder, type Embedder } from './embedder.js';
export {
  parseConflictBlock,
  extractAllConflicts,
  type ParsedConflict,
} from '../utils/parse-conflicts.js';
export {
  queryPreviousResolutions,
  formatPreviousResolution,
} from './retrieval.js';

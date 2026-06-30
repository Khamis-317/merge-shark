export {
  ConflictRepository,
  type Conflict,
  type IConflictRepository,
} from './db.js';
export { createEmbedding } from './embedder.js';
export {
  parseConflictBlock,
  extractAllConflicts,
  type ParsedConflict,
} from '../utils/parse-conflicts.js';
export { queryPreviousResolutions } from './retrieval.js';

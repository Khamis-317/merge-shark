export interface Conflict {
  conflict: string;
  resolution: string;
}

export interface FileConflicts {
  name: string;
  conflicts: Conflict[];
}

export interface Resolutions {
  files: FileConflicts[];
}

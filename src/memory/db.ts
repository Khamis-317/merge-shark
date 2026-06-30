import * as lancedb from '@lancedb/lancedb';

export interface Conflict {
  id: string;
  embeddedConflict: number[];
  baseBranch: string;
  incomingBranch: string;
  baseChange: string;
  incomingChange: string;
  resolution: string;
  resolvedAt: string;
  fileType: string;
}

export interface IConflictRepository {
  connect(): Promise<void>;
  save(conflict: Conflict): Promise<void>;
  findSimilar(
    vector: number[],
    fileType: string,
    limit: number
  ): Promise<Conflict[]>;
}

export class ConflictRepository implements IConflictRepository {
  private db: lancedb.Connection | null = null;
  private tableName = 'conflicts';

  constructor(private uri: string = './.lancedb') {}

  async connect(): Promise<void> {
    this.db = await lancedb.connect(this.uri);
  }

  async save(conflict: Conflict): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    const tables = await this.db.tableNames();
    if (!tables.includes(this.tableName)) {
      // automatically infer the conflict schema from the conflict object
      await this.db.createTable(this.tableName, [{ ...conflict }]);
    } else {
      const table = await this.db.openTable(this.tableName);
      await table.add([{ ...conflict }]);
    }
  }

  async findSimilar(
    vector: number[],
    fileType: string,
    limit: number = 3
  ): Promise<Conflict[]> {
    if (!this.db) throw new Error('Database not connected');

    const tables = await this.db.tableNames();
    if (!tables.includes(this.tableName)) return [];

    const table = await this.db.openTable(this.tableName);
    const results: Conflict[] = await (
      table.search(vector) as lancedb.VectorQuery
    )
      .distanceType('cosine')
      .where(`fileType = "${fileType}"`)
      .limit(limit)
      .toArray();

    return results;
  }
}

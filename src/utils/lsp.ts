import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import * as rpc from 'vscode-jsonrpc/node';

export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

enum Severity {
  None = 0,
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface LSPDiagnostic {
  range: LSPRange;
  severity?: number;
  code?: string;
  source?: string;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: LSPDiagnostic[];
}

export interface LSPCommand {
  command: string;
  args: string[];
}

export function getJdtlsCommand(
  jdtlsPath: string,
  dataPath?: string
): LSPCommand {
  const osPlatform = os.platform();
  let configOs = 'linux';
  if (osPlatform === 'win32') {
    configOs = 'win';
  } else if (osPlatform === 'darwin') {
    configOs = 'mac';
  }

  if (!dataPath || dataPath.trim() === '') {
    dataPath = path.join(process.cwd(), 'tmp', 'javalsp');
  }

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  const pluginsPath = path.join(jdtlsPath, 'plugins');
  if (!fs.existsSync(pluginsPath)) {
    throw new Error('JDTLS plugins folder not found in the provided path');
  }

  const launcherFiles = fs
    .readdirSync(pluginsPath)
    .filter(
      (file) =>
        file.startsWith('org.eclipse.equinox.launcher_') &&
        file.endsWith('.jar')
    );

  if (launcherFiles.length === 0 || !launcherFiles[0]) {
    throw new Error('JDTLS launcher jar not found in plugins folder');
  }
  const launcherJar = path.join(pluginsPath, launcherFiles[0]);
  const configPath = path.join(jdtlsPath, `config_${configOs}`);

  return {
    command: 'java',
    args: [
      '-Declipse.application=org.eclipse.jdt.ls.core.id1',
      '-Dosgi.bundles.defaultStartLevel=4',
      '-Declipse.product=org.eclipse.jdt.ls.core.product',
      '-Dlog.level=ALL',
      '-Xmx1G',
      '--add-modules=ALL-SYSTEM',
      '--add-opens',
      'java.base/java.util=ALL-UNNAMED',
      '--add-opens',
      'java.base/java.lang=ALL-UNNAMED',
      '-jar',
      launcherJar,
      '-configuration',
      configPath,
      '-data',
      dataPath,
    ],
  };
}

export function getPyrightCommand(): LSPCommand {
  const pyrightPath = path.resolve(
    __dirname,
    '..',
    '..',
    'node_modules',
    'pyright',
    'langserver.index.js'
  );
  return {
    command: 'node',
    args: [pyrightPath, '--stdio'],
  };
}

export function getTsServerCommand(): LSPCommand {
  const tsServerPath = path.resolve(
    __dirname,
    '..',
    '..',
    'node_modules',
    'typescript-language-server',
    'lib',
    'cli.mjs'
  );
  return {
    command: 'node',
    args: [tsServerPath, '--stdio'],
  };
}

export function getClangdCommand(): LSPCommand {
  return {
    command: 'clangd',
    args: [],
  };
}

export function getLSPCommand(
  filePath: string,
  jdtlsPath?: string,
  jdltlsDataPath?: string
): LSPCommand | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.java':
      if (!jdtlsPath) {
        throw new Error('JDTLS path must be provided for Java files');
      }
      return getJdtlsCommand(jdtlsPath, jdltlsDataPath);
    case '.py':
      return getPyrightCommand();
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      return getTsServerCommand();
    case '.c':
    case '.cpp':
    case '.h':
    case '.hpp':
      return getClangdCommand();
    default:
      return null;
  }
}

function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.java':
      return 'java';
    case '.py':
      return 'python';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.c':
    case '.cpp':
    case '.h':
    case '.hpp':
      return 'cpp';
    default:
      return 'plaintext';
  }
}

interface ManagedLSP {
  process: ChildProcess;
  connection: rpc.MessageConnection;
  initialized: boolean;
  //Document version counter for didChange notifications, keyed by URI
  documentVersions: Map<string, number>;
}

/**
 * Timeout (ms) to wait for diagnostics after opening/changing a document.
 * Some LSPs emit diagnostics very quickly while others (like jdtls) may take
 * several seconds.  We use a generous upper bound and resolve early as soon as
 * diagnostics are received.
 */
const DIAGNOSTICS_TIMEOUT_MS = 15_000;

export class LSPManager {
  private servers: Map<string, ManagedLSP> = new Map();

  constructor(
    private repoPath: string,
    private jdtlsPath?: string,
    private jdltlsDataPath?: string
  ) {}

  hasLSPSupport(filePath: string): boolean {
    return (
      getLSPCommand(filePath, this.jdtlsPath, this.jdltlsDataPath) !== null
    );
  }

  async validate(filePath: string): Promise<string> {
    const absolutePath = path.resolve(filePath);
    const languageId = getLanguageId(absolutePath);
    const commandInfo = getLSPCommand(
      absolutePath,
      this.jdtlsPath,
      this.jdltlsDataPath
    );

    if (!commandInfo) {
      return `No LSP configured for file extension ${path.extname(absolutePath)}`;
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const managed = await this.getOrCreateServer(languageId, commandInfo);
    const documentUri = `file://${absolutePath}`;

    return this.openAndCollectDiagnostics(
      managed,
      documentUri,
      languageId,
      content
    );
  }

  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    for (const [langId, managed] of this.servers.entries()) {
      shutdownPromises.push(
        (async () => {
          try {
            await managed.connection.sendRequest('shutdown');
            await managed.connection.sendNotification('exit');
          } catch {
            // Server may already be dead
          } finally {
            managed.connection.end();
            managed.connection.dispose();
            managed.process.kill();
            this.servers.delete(langId);
          }
        })()
      );
    }

    await Promise.allSettled(shutdownPromises);
  }

  private async getOrCreateServer(
    languageId: string,
    commandInfo: LSPCommand
  ): Promise<ManagedLSP> {
    const existing = this.servers.get(languageId);
    if (existing?.initialized) {
      return existing;
    }

    const childProcess = spawn(commandInfo.command, commandInfo.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(childProcess.stdout!),
      new rpc.StreamMessageWriter(childProcess.stdin!)
    );

    const managed: ManagedLSP = {
      process: childProcess,
      connection,
      initialized: false,
      documentVersions: new Map(),
    };

    connection.listen();

    const rootUri = `file://${path.resolve(this.repoPath)}`;

    await connection.sendRequest('initialize', {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true,
          },
        },
      },
      workspaceFolders: [
        {
          uri: rootUri,
          name: path.basename(this.repoPath),
        },
      ],
    });

    connection.sendNotification('initialized', {});

    managed.initialized = true;
    this.servers.set(languageId, managed);
    return managed;
  }

  private async openAndCollectDiagnostics(
    managed: ManagedLSP,
    documentUri: string,
    languageId: string,
    content: string
  ): Promise<string> {
    const currentVersion = managed.documentVersions.get(documentUri);
    const isAlreadyOpen = currentVersion !== undefined;

    if (isAlreadyOpen) {
      const nextVersion = currentVersion + 1;
      managed.documentVersions.set(documentUri, nextVersion);

      managed.connection.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: documentUri,
          version: nextVersion,
        },
        contentChanges: [{ text: content }],
      });
    } else {
      managed.documentVersions.set(documentUri, 1);

      managed.connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: documentUri,
          languageId,
          version: 1,
          text: content,
        },
      });
    }

    const diagnostics = await this.waitForDiagnostics(managed, documentUri);

    if (diagnostics.length === 0) {
      return 'No syntax or validation errors found.';
    }

    const errors = diagnostics
      .map(
        (d) =>
          `[${Severity[d.severity ?? 0]}] Line ${d.range.start.line + 1}: ${d.message}`
      )
      .join('\n');

    return `Validation issues found:\n${errors}`;
  }

  private waitForDiagnostics(
    managed: ManagedLSP,
    documentUri: string
  ): Promise<LSPDiagnostic[]> {
    return new Promise<LSPDiagnostic[]>((resolve) => {
      let resolved = false;
      let latestDiagnostics: LSPDiagnostic[] = [];

      /** Some servers push multiple diagnostic rounds (e.g. syntax first, then
            semantic).  We use a "debounce" approach: every time we get diagnostics
            we reset a short timer; if no new diagnostics arrive within the settle
            window we resolve. 
          */
      let settleTimer: ReturnType<typeof setTimeout> | null = null;
      let diagnosticsTimeout: ReturnType<typeof setTimeout> | null = null;

      const SETTLE_MS = 2_000;

      const handler = (params: PublishDiagnosticsParams) => {
        if (params.uri !== documentUri) return;

        latestDiagnostics = params.diagnostics;

        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (diagnosticsTimeout) clearTimeout(diagnosticsTimeout);
            managed.connection.onNotification(
              'textDocument/publishDiagnostics',
              () => {}
            );
            resolve(latestDiagnostics);
          }
        }, SETTLE_MS);
      };

      managed.connection.onNotification(
        'textDocument/publishDiagnostics',
        handler
      );

      diagnosticsTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (settleTimer) clearTimeout(settleTimer);
          managed.connection.onNotification(
            'textDocument/publishDiagnostics',
            () => {}
          );
          resolve(latestDiagnostics);
        }
      }, DIAGNOSTICS_TIMEOUT_MS);
    });
  }
}

import { spawn } from 'child_process';
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

export async function validateWithLSP(
  filePath: string,
  content: string,
  jdtlsPath?: string,
  jdltlsDataPath?: string
): Promise<string> {
  const commandInfo = getLSPCommand(filePath, jdtlsPath, jdltlsDataPath);
  if (!commandInfo) {
    return `No LSP configured for file extension ${path.extname(filePath)}`;
  }

  return new Promise((resolve, reject) => {
    const childProcess = spawn(commandInfo.command, commandInfo.args);

    const connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(childProcess.stdout),
      new rpc.StreamMessageWriter(childProcess.stdin)
    );

    let diagnosticsResult: LSPDiagnostic[] = [];
    let resolved = false;

    connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: PublishDiagnosticsParams) => {
        diagnosticsResult = params.diagnostics;
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          connection.end();
          childProcess.kill();
          if (diagnosticsResult.length === 0) {
            resolve('No syntax or validation errors found.');
          } else {
            const errors = diagnosticsResult
              .map(
                (d) =>
                  `[${d.severity === 1 ? 'Error' : 'Warning'}] Line ${d.range.start.line + 1}: ${d.message}`
              )
              .join('\n');
            resolve(`Validation issues found:\n${errors}`);
          }
        }, 1000);
      }
    );

    connection.listen();

    const documentUri = `file://${path.resolve(filePath)}`;

    const initializeParams = {
      processId: process.pid,
      rootUri: `file://${process.cwd()}`,
      capabilities: {},
      workspaceFolders: [
        {
          uri: `file://${process.cwd()}`,
          name: 'workspace',
        },
      ],
    };

    connection
      .sendRequest('initialize', initializeParams)
      .then(() => {
        connection.sendNotification('initialized', {});
        connection.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri: documentUri,
            languageId: getLanguageId(filePath),
            version: 1,
            text: content,
          },
        });
      })
      .catch((err: unknown) => {
        childProcess.kill();
        reject(err);
      });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        connection.end();
        childProcess.kill();
        if (diagnosticsResult && diagnosticsResult.length > 0) {
          const errors = diagnosticsResult
            .map(
              (d: LSPDiagnostic) =>
                `[${d.severity === 1 ? 'Error' : 'Warning'}] Line ${d.range.start.line + 1}: ${d.message}`
            )
            .join('\n');
          resolve(`Validation issues found:\n${errors}`);
        } else {
          resolve(
            'LSP validation found no errors (or timed out without errors).'
          );
        }
      }
    }, 3000);
  });
}

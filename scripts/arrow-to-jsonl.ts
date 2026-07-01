import fs from 'node:fs/promises';
import path from 'node:path';
import { tableFromIPC } from 'apache-arrow';

async function main() {
  const mergesDir = path.resolve(process.cwd(), 'eval_datasets/merges');
  
  let entries;
  try {
    entries = await fs.readdir(mergesDir, { withFileTypes: true });
  } catch {
    console.error(`Could not read ${mergesDir}. Make sure dataset is downloaded.`);
    return;
  }
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const testDir = path.join(mergesDir, entry.name, 'dataset/test');
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        if (!file.endsWith('.arrow')) continue;
        
        const arrowPath = path.join(testDir, file);
        const jsonlPath = arrowPath.replace('.arrow', '.jsonl');
        
        console.log(`Converting ${arrowPath} to JSONL...`);
        const arrowData = await fs.readFile(arrowPath);
        const table = tableFromIPC(arrowData);
        
        const fd = await fs.open(jsonlPath, 'w');
        for (let i = 0; i < table.numRows; i++) {
          const row = table.get(i);
          if (row) {
            await fd.write(JSON.stringify(row) + '\n');
          }
        }
        await fd.close();
      }
    } catch {
      continue;
    }
  }
}

main().catch(console.error);

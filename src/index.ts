import { Command, Option } from '@commander-js/extra-typings';
import { resolveConflicts } from './agent/index.js';

const program = new Command();

program
  .name('shark')
  .description('AI-powered Git conflict resolver.')
  .version('0.0.1')
  .command('resolve')
  .description('resolves the current conflict if any')
  .addOption(
    new Option('-r, --repo <repo>', 'path for the Git repository').default(
      process.cwd(),
      'current working directory'
    )
  )
  .action(async (options) => {
    console.log(`Resolving conflict in ${options.repo}`);
    await resolveConflicts(options.repo);
  });

await program.parseAsync(process.argv);

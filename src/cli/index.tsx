import { render } from 'ink';
import dedent from 'dedent';
import { SharkApp } from './components/shark-app.js';

export async function start(repoPath: string) {
  console.log(`Resolving conflict in ${repoPath}`);

  // FIXME: Use agent to resolve conflicts and parse its output instead of static data.
  // await resolveConflicts(repoPath);

  const resolutions = {
    files: [
      {
        name: 'api.mjs',
        conflicts: [
          {
            conflict: dedent`
                <<<<<<< HEAD
                export function getUser(id = 1) {
                    return fetch(\`https://jsonplaceholder.typicode.com/users/\${id}\`);
                =======
                export function getUser(random = false) {
                    let userID = 1;
                    if (random) {
                        userID = Math.floor(Math.random() * 10) + 1;
                    }

                    return fetch(\`https://jsonplaceholder.typicode.com/users/\${userID}\`);
                >>>>>>> feat/random
                }
            `,
            resolution: dedent`
                export function getUser(param = 1) {
                    let userID = 1;

                    if (typeof param === 'boolean') {
                        if (param === true) {
                            userID = Math.floor(Math.random() * 10) + 1;
                        }
                    } else if (typeof param === 'number') {
                        userID = param;
                    }

                    return fetch(\`https://jsonplaceholder.typicode.com/users/\${userID}\`);
                }
            `,
          },
        ],
      },
      {
        name: 'index.mjs',
        conflicts: [
          {
            conflict: dedent`
                <<<<<<< HEAD
                const user = await getUser(8);
                =======
                const user = await getUser(true);
                >>>>>>> feat/random
            `,
            resolution: dedent`
                const user = await getUser(true);
            `,
          },
        ],
      },
    ],
  };

  render(<SharkApp resolutions={resolutions} />);
}

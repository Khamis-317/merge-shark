import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import { getMergeBase, getMergeTarget } from '../utils/git-utils.js';


export function makeGetMergeInfoTool(repoPath: string) {
  const mergeInfoSchema = z.object({});
  return tool(
    async ({}) => {
      try {
        const mergeTarget = await getMergeTarget(repoPath);
        const mergeBase = await getMergeBase(repoPath, "HEAD", mergeTarget);
        return formatMergeInfoAsXML(mergeTarget, mergeBase);
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error retrieving merge info: ${err.message}`;
        }
        return `An unknown error occurred: ${err}`;
      }
    },
    {
      name: 'get_merge_info',
      description: dedent`
        Gets both the merge target (MERGE_HEAD) and merge base commit hashes.
        
        Input:
        - No input required

        Output:
        Returns merge information in XML format exactly as shown:
        <merge_info>
          <merge_target>
            <hash>merge_target_commit_hash</hash>
          </merge_target>
          <merge_base>
            <hash>merge_base_commit_hash</hash>
          </merge_base>
        </merge_info>

        When to use:
        - To get both the commit being merged (MERGE_HEAD) and the common ancestor (merge base)
        - Essential for understanding the full context of a merge conflict
        - The merge target shows what changes are being brought in
        - The merge base shows the common starting point for both branches
        - Both hashes can be used with other git tools for detailed analysis
      `,
      schema: mergeInfoSchema,
    }
  );
}



function formatMergeInfoAsXML(mergeTarget: string, mergeBase: string): string {
  return `<merge_info>
  <merge_target>
    <hash>${mergeTarget}</hash>
  </merge_target>
  <merge_base>
    <hash>${mergeBase}</hash>
  </merge_base>
</merge_info>`;
}
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dedent from 'dedent';
import {
  getMergeBase,
  getMergeTarget,
  formatMergeInfo,
} from '../utils/git-utils.js';

export function makeGetMergeInfoTool(repoPath: string) {
  const mergeInfoSchema = z.object({});
  return tool(
    async () => {
      try {
        const mergeTarget = await getMergeTarget(repoPath);
        const mergeBase = await getMergeBase(repoPath, 'HEAD', mergeTarget);

        return formatMergeInfo(mergeTarget, mergeBase);
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
        - Essential for understanding the full context of a merge conflict
        - The merge target shows what changes are being brought in
        - The merge base shows the common starting point for both branches
        - Use the returned hashes with "get_commit_metadata", "get_changed_files_in_commit", "get_diff", or "get_recent_commits_for_file" for detailed analysis
      `,
      schema: mergeInfoSchema,
    }
  );
}
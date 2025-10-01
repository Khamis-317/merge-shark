import { useState } from 'react';
import { ResolutionReviewer } from './resolution-reviewer.js';
import { beep } from '../utils/beep.js';
import { editFile, type FileEditOptions } from '../../utils/edit-file.js';

export interface SharkAppProps {
  edits: FileEditOptions[];
  repoPath: string;
}

export function SharkApp({ edits, repoPath }: SharkAppProps) {
  const [activeEditIndex, setActiveEditIndex] = useState(0);

  const handleNext = () => {
    const currentEdit = edits[activeEditIndex];
    if (!currentEdit) return beep();

    if (activeEditIndex + 1 >= edits.length) return beep();

    setActiveEditIndex((current) => current + 1);
  };

  const handlePrevious = () => {
    if (activeEditIndex === 0) {
      return beep();
    }

    return setActiveEditIndex((current) => current - 1);
  };

  const handleApply = (edit: FileEditOptions) => {
    editFile(edit.path, edit.oldText, edit.newText, edit.replaceAll);
    handleNext();
  };

  const handleReject = () => {
    // FIXME: Handle rejection
    beep();
    handleNext();
  };

  const handleApplyAll = () => {
    edits.forEach((edit) => {
      editFile(edit.path, edit.oldText, edit.newText, edit.replaceAll);
    });
  };

  const handleRejectAll = () => {
    beep();
  };

  const handleExit = () => {
    process.exit(0);
  };

  return (
    <ResolutionReviewer
      repoPath={repoPath}
      edits={edits}
      activeEditIndex={activeEditIndex}
      onApply={handleApply}
      onReject={handleReject}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onApplyAll={handleApplyAll}
      onRejectAll={handleRejectAll}
      onExit={handleExit}
    />
  );
}

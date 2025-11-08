import { useState } from 'react';
import { ResolutionReviewer } from './resolution-reviewer.js';
import { beep } from '../utils/beep.js';
import { editFile, type FileEditOptions } from '../../utils/edit-file.js';

export interface SharkAppProps {
  edits: FileEditOptions[];
  repoPath: string;
}

type EditStatus = 'pending' | 'accepted' | 'rejected';

export function SharkApp({ edits, repoPath }: SharkAppProps) {
  const [activeEditIndex, setActiveEditIndex] = useState(0);
  const [editStatuses, setEditStatuses] = useState<EditStatus[]>(
    edits.map(() => 'pending')
  );

  const allProcessed = editStatuses.every(
    (status) => status === 'accepted' || status === 'rejected'
  );

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
    editFile(edit);
    setEditStatuses((statuses) => {
      const newStatuses = [...statuses];
      newStatuses[activeEditIndex] = 'accepted';
      return newStatuses;
    });
  };

  const handleReject = () => {
    setEditStatuses((statuses) => {
      const newStatuses = [...statuses];
      newStatuses[activeEditIndex] = 'rejected';
      return newStatuses;
    });
  };

  const handleApplyAll = () => {
    edits.forEach((edit) => {
      editFile(edit);
    });
    setEditStatuses(edits.map(() => 'accepted'));
  };

  const handleRejectAll = () => {
    setEditStatuses(edits.map(() => 'rejected'));
  };

  const handleExit = () => {
    process.exit(0);
  };

  return (
    <ResolutionReviewer
      repoPath={repoPath}
      edits={edits}
      activeEditIndex={activeEditIndex}
      allProcessed={allProcessed}
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

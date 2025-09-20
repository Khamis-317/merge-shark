import { useState } from 'react';
import type { Resolutions } from '../../model/resolution.js';
import { ResolutionReviewer } from './resolution-reviewer.js';
import { beep } from '../utils/beep.js';

export interface SharkAppProps {
  resolutions: Resolutions;
}

export function SharkApp({ resolutions }: SharkAppProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activeConflictIndex, setActiveConflictIndex] = useState(0);

  const handleNext = () => {
    const currentFile = resolutions.files[activeFileIndex];
    if (!currentFile) {
      return beep();
    }

    if (activeConflictIndex + 1 < currentFile.conflicts.length) {
      return setActiveConflictIndex((current) => current + 1);
    }

    if (activeFileIndex + 1 >= resolutions.files.length) {
      return beep();
    }

    setActiveFileIndex((current) => current + 1);
    setActiveConflictIndex(0);
  };

  const handlePrevious = () => {
    if (activeConflictIndex !== 0) {
      return setActiveConflictIndex((current) => current - 1);
    }

    if (activeFileIndex === 0) {
      return beep();
    }

    // Move to previous file
    const previousFileIndex = activeFileIndex - 1;
    const previousFile = resolutions.files[previousFileIndex];
    if (!previousFile) {
      return beep();
    }
    setActiveFileIndex(previousFileIndex);
    setActiveConflictIndex(previousFile.conflicts.length - 1);
  };

  const handleApply = (fileIndex: number, conflictIndex: number) => {
    // TODO: Implement actual conflict resolution logic
    console.log(`Applied conflict ${conflictIndex} in file ${fileIndex}`);
  };

  const handleReject = (fileIndex: number, conflictIndex: number) => {
    // TODO: Implement actual conflict rejection logic
    console.log(`Rejected conflict ${conflictIndex} in file ${fileIndex}`);
  };

  const handleApplyAll = () => {
    // TODO: Implement apply all logic
    console.log('Applied all conflicts');
  };

  const handleRejectAll = () => {
    // TODO: Implement reject all logic
    console.log('Rejected all conflicts');
  };

  const handleExit = () => {
    process.exit(0);
  };

  return (
    <ResolutionReviewer
      resolutions={resolutions}
      activeFileIndex={activeFileIndex}
      activeConflictIndex={activeConflictIndex}
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

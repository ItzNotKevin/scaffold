import React from 'react';
import Button from './Button';

interface BackButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, children, className = '' }) => {
  return (
    <Button
      variant="ghost"
      size="md"
      onClick={onClick}
      className={`flex items-center gap-2 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {children}
    </Button>
  );
};

export default BackButton;

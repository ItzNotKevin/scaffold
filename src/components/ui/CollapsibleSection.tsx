import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  renderHeader?: (isExpanded: boolean, toggle: () => void) => React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  defaultExpanded = true,
  children,
  className = '',
  headerClassName = '',
  renderHeader
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = () => setIsExpanded(!isExpanded);

  return (
    <div className={className}>
      {renderHeader ? (
        renderHeader(isExpanded, toggle)
      ) : (
        <button
          onClick={toggle}
          className={`w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors touch-manipulation min-h-[56px] ${headerClassName}`}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
            {count !== undefined && (
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                {count}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {isExpanded && (
        <div className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;


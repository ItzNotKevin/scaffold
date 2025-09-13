import React from 'react';
import TopBar from './TopBar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  onMenuClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Construction PM',
  onMenuClick 
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={title} onMenuClick={onMenuClick} />
      <main className="px-4 sm:px-6 py-4 pb-safe">
        {children}
      </main>
    </div>
  );
};

export default Layout;


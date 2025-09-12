import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { taskReminderService, ReminderSettings } from './taskReminders';
import { useAuth } from './useAuth';

interface TaskReminderContextType {
  settings: ReminderSettings;
  isActive: boolean;
  updateSettings: (newSettings: Partial<ReminderSettings>) => void;
  startReminders: () => void;
  stopReminders: () => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

const TaskReminderContext = createContext<TaskReminderContextType | undefined>(undefined);

export const useTaskReminders = () => {
  const context = useContext(TaskReminderContext);
  if (context === undefined) {
    throw new Error('useTaskReminders must be used within a TaskReminderProvider');
  }
  return context;
};

interface TaskReminderProviderProps {
  children: ReactNode;
}

export const TaskReminderProvider: React.FC<TaskReminderProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<ReminderSettings>(taskReminderService.getDefaultSettings());
  const [isActive, setIsActive] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Start/stop reminders when user changes
  useEffect(() => {
    if (currentUser) {
      startReminders();
    } else {
      stopReminders();
    }

    return () => {
      stopReminders();
    };
  }, [currentUser]);

  const updateSettings = (newSettings: Partial<ReminderSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const startReminders = () => {
    if (currentUser && !isActive) {
      console.log('Starting task reminders for user:', currentUser.uid);
      taskReminderService.startReminderService(currentUser.uid, settings);
      setIsActive(true);
    }
  };

  const stopReminders = () => {
    if (isActive) {
      console.log('Stopping task reminders');
      taskReminderService.stopReminderService();
      setIsActive(false);
    }
  };

  const saveSettings = async () => {
    try {
      localStorage.setItem('taskReminderSettings', JSON.stringify(settings));
      console.log('Task reminder settings saved');
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const saved = localStorage.getItem('taskReminderSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(parsedSettings);
        console.log('Task reminder settings loaded');
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  };

  const value: TaskReminderContextType = {
    settings,
    isActive,
    updateSettings,
    startReminders,
    stopReminders,
    saveSettings,
    loadSettings
  };

  return (
    <TaskReminderContext.Provider value={value}>
      {children}
    </TaskReminderContext.Provider>
  );
};

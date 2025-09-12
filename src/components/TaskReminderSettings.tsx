import React, { useState } from 'react';
import { useTaskReminders } from '../lib/useTaskReminders';

const TaskReminderSettings: React.FC = () => {
  const { settings, updateSettings, saveSettings, isActive } = useTaskReminders();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings();
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addReminderTime = () => {
    const newTimes = [...settings.dueDateReminders.times, 2]; // Default to 2 hours
    updateSettings({
      dueDateReminders: {
        ...settings.dueDateReminders,
        times: newTimes
      }
    });
  };

  const removeReminderTime = (index: number) => {
    const newTimes = settings.dueDateReminders.times.filter((_, i) => i !== index);
    updateSettings({
      dueDateReminders: {
        ...settings.dueDateReminders,
        times: newTimes
      }
    });
  };

  const updateReminderTime = (index: number, value: number) => {
    const newTimes = [...settings.dueDateReminders.times];
    newTimes[index] = value;
    updateSettings({
      dueDateReminders: {
        ...settings.dueDateReminders,
        times: newTimes
      }
    });
  };

  const addScheduledTime = () => {
    const newTimes = [...settings.scheduledReminders.customTimes, '12:00'];
    updateSettings({
      scheduledReminders: {
        ...settings.scheduledReminders,
        customTimes: newTimes
      }
    });
  };

  const removeScheduledTime = (index: number) => {
    const newTimes = settings.scheduledReminders.customTimes.filter((_, i) => i !== index);
    updateSettings({
      scheduledReminders: {
        ...settings.scheduledReminders,
        customTimes: newTimes
      }
    });
  };

  const updateScheduledTime = (index: number, value: string) => {
    const newTimes = [...settings.scheduledReminders.customTimes];
    newTimes[index] = value;
    updateSettings({
      scheduledReminders: {
        ...settings.scheduledReminders,
        customTimes: newTimes
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Task Reminders</span>
        {isActive && (
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Task Reminder Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Due Date Reminders */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Due Date Reminders</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dueDateReminders.enabled}
                      onChange={(e) => updateSettings({
                        dueDateReminders: {
                          ...settings.dueDateReminders,
                          enabled: e.target.checked
                        }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {settings.dueDateReminders.enabled && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Get notified before tasks are due:</p>
                    {settings.dueDateReminders.times.map((time, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={time}
                          onChange={(e) => updateReminderTime(index, parseInt(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">hours before due</span>
                        <button
                          onClick={() => removeReminderTime(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addReminderTime}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add reminder time
                    </button>
                  </div>
                )}
              </div>

              {/* Overdue Reminders */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Overdue Alerts</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.overdueReminders.enabled}
                      onChange={(e) => updateSettings({
                        overdueReminders: {
                          ...settings.overdueReminders,
                          enabled: e.target.checked
                        }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {settings.overdueReminders.enabled && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">How often to remind about overdue tasks:</p>
                    <select
                      value={settings.overdueReminders.frequency}
                      onChange={(e) => updateSettings({
                        overdueReminders: {
                          ...settings.overdueReminders,
                          frequency: e.target.value as 'immediate' | 'daily' | 'weekly'
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="immediate">Immediately</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Scheduled Reminders */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Scheduled Reminders</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scheduledReminders.enabled}
                      onChange={(e) => updateSettings({
                        scheduledReminders: {
                          ...settings.scheduledReminders,
                          enabled: e.target.checked
                        }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {settings.scheduledReminders.enabled && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Get daily reminders at these times:</p>
                    {settings.scheduledReminders.customTimes.map((time, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => updateScheduledTime(index, e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => removeScheduledTime(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addScheduledTime}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add reminder time
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskReminderSettings;

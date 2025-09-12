// Task Reminder Service
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  assignedTo: string;
  projectId: string;
  createdAt: any;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  parentTaskId?: string; // Reference to the original task for recurring tasks
}

export interface ReminderSettings {
  dueDateReminders: {
    enabled: boolean;
    times: number[]; // hours before due date (e.g., [24, 1] for 24h and 1h before)
  };
  overdueReminders: {
    enabled: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  scheduledReminders: {
    enabled: boolean;
    customTimes: string[]; // custom reminder times (e.g., ['09:00', '17:00'])
  };
}

export class TaskReminderService {
  private static instance: TaskReminderService;
  private reminderInterval: NodeJS.Timeout | null = null;
  private lastOverdueCheck: Date = new Date();

  private constructor() {}

  public static getInstance(): TaskReminderService {
    if (!TaskReminderService.instance) {
      TaskReminderService.instance = new TaskReminderService();
    }
    return TaskReminderService.instance;
  }

  // Start the reminder service
  public startReminderService(userId: string, settings: ReminderSettings): void {
    console.log('Starting task reminder service for user:', userId);
    
    // Clear existing interval
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }

    // Check reminders every 5 minutes
    this.reminderInterval = setInterval(async () => {
      try {
        await this.checkDueDateReminders(userId, settings);
        await this.checkOverdueTasks(userId, settings);
        await this.checkScheduledReminders(userId, settings);
      } catch (error) {
        console.error('Error checking reminders:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Run initial check
    this.checkDueDateReminders(userId, settings);
    this.checkOverdueTasks(userId, settings);
    this.checkScheduledReminders(userId, settings);
  }

  // Stop the reminder service
  public stopReminderService(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    console.log('Task reminder service stopped');
  }

  // Check for due date reminders
  private async checkDueDateReminders(userId: string, settings: ReminderSettings): Promise<void> {
    if (!settings.dueDateReminders.enabled) return;

    try {
      const tasks = await this.getUserTasks(userId);
      const now = new Date();

      for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const timeUntilDue = dueDate.getTime() - now.getTime();

        for (const reminderHours of settings.dueDateReminders.times) {
          const reminderTime = reminderHours * 60 * 60 * 1000; // Convert to milliseconds
          const timeDiff = Math.abs(timeUntilDue - reminderTime);

          // Check if we're within 5 minutes of the reminder time
          if (timeDiff <= 5 * 60 * 1000 && timeUntilDue > 0) {
            await this.sendDueDateReminder(task, reminderHours);
          }
        }
      }
    } catch (error) {
      console.error('Error checking due date reminders:', error);
    }
  }

  // Check for overdue tasks
  private async checkOverdueTasks(userId: string, settings: ReminderSettings): Promise<void> {
    if (!settings.overdueReminders.enabled) return;

    try {
      const tasks = await this.getUserTasks(userId);
      const now = new Date();
      const overdueTasks = tasks.filter(task => 
        !task.completed && 
        task.dueDate && 
        new Date(task.dueDate) < now
      );

      if (overdueTasks.length > 0) {
        // Check if we should send overdue reminder based on frequency
        const shouldSendReminder = this.shouldSendOverdueReminder(settings.overdueReminders.frequency);
        
        if (shouldSendReminder) {
          await this.sendOverdueReminder(overdueTasks);
        }
      }
    } catch (error) {
      console.error('Error checking overdue tasks:', error);
    }
  }

  // Check for scheduled reminders
  private async checkScheduledReminders(userId: string, settings: ReminderSettings): Promise<void> {
    if (!settings.scheduledReminders.enabled) return;

    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

      for (const reminderTime of settings.scheduledReminders.customTimes) {
        if (this.isTimeMatch(currentTime, reminderTime)) {
          await this.sendScheduledReminder(userId);
        }
      }
    } catch (error) {
      console.error('Error checking scheduled reminders:', error);
    }
  }

  // Get user's tasks
  private async getUserTasks(userId: string): Promise<Task[]> {
    try {
      // Get all projects for the user
      const projectsQuery = query(
        collection(db, 'projects'),
        where('companyId', '==', userId) // Assuming userId is the companyId
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectIds = projectsSnapshot.docs.map(doc => doc.id);

      if (projectIds.length === 0) return [];

      // Get all tasks for these projects
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', 'in', projectIds),
        where('assignedTo', '==', userId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      return tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      return [];
    }
  }

  // Send due date reminder
  private async sendDueDateReminder(task: Task, hoursBefore: number): Promise<void> {
    const timeText = hoursBefore === 1 ? '1 hour' : `${hoursBefore} hours`;
    
    // Show notification (will be implemented later)
    console.log('Task Due Soon:', `"${task.title}" is due in ${timeText}`);
  }

  // Send overdue reminder
  private async sendOverdueReminder(overdueTasks: Task[]): Promise<void> {
    const taskCount = overdueTasks.length;
    const taskText = taskCount === 1 ? 'task' : 'tasks';
    
    // Show notification (will be implemented later)
    console.log('Overdue Tasks:', `You have ${taskCount} overdue ${taskText} that need attention`);
  }

  // Send scheduled reminder
  private async sendScheduledReminder(userId: string): Promise<void> {
    try {
      const tasks = await this.getUserTasks(userId);
      const incompleteTasks = tasks.filter(task => !task.completed);
      const taskCount = incompleteTasks.length;

      if (taskCount > 0) {
        // Show notification (will be implemented later)
        console.log('Daily Task Reminder:', `You have ${taskCount} incomplete tasks to work on today`);
      }
    } catch (error) {
      console.error('Error sending scheduled reminder:', error);
    }
  }

  // Check if we should send overdue reminder based on frequency
  private shouldSendOverdueReminder(frequency: string): boolean {
    const now = new Date();
    
    switch (frequency) {
      case 'immediate':
        return true;
      case 'daily':
        return now.getTime() - this.lastOverdueCheck.getTime() >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return now.getTime() - this.lastOverdueCheck.getTime() >= 7 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  // Check if current time matches reminder time (within 5 minutes)
  private isTimeMatch(currentTime: string, reminderTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const reminder = this.timeToMinutes(reminderTime);
    const diff = Math.abs(current - reminder);
    
    return diff <= 5; // Within 5 minutes
  }

  // Convert time string (HH:MM) to minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Get default reminder settings
  public getDefaultSettings(): ReminderSettings {
    return {
      dueDateReminders: {
        enabled: true,
        times: [24, 1] // 24 hours and 1 hour before due
      },
      overdueReminders: {
        enabled: true,
        frequency: 'daily'
      },
      scheduledReminders: {
        enabled: true,
        customTimes: ['09:00', '17:00'] // 9 AM and 5 PM
      }
    };
  }
}

// Export singleton instance
export const taskReminderService = TaskReminderService.getInstance();

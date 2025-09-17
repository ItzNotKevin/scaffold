// Push Notification Service
export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Check if push notifications are supported
  public isSupported(): boolean {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    console.log('Push notification support check:', {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      supported
    });
    return supported;
  }

  // Request permission for notifications
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  }

  // Register service worker
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported()) {
      throw new Error('Service workers are not supported in this browser');
    }

    try {
      console.log('Registering service worker at /sw.js...');
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered successfully:', this.registration);
      console.log('Service worker scope:', this.registration.scope);
      console.log('Service worker state:', this.registration.active?.state);
      return this.registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      console.error('Error details:', error);
      throw error;
    }
  }

  // Subscribe to push notifications
  public async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    if (!this.registration) {
      throw new Error('Service worker registration failed');
    }

    try {
      // Check if we already have a subscription
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('Already subscribed to push notifications');
        return this.subscription;
      }

      // Get VAPID key and validate
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      console.log('VAPID Key from env:', vapidKey ? 'Present' : 'Missing');
      console.log('VAPID Key value:', vapidKey);
      console.log('All env vars:', import.meta.env);
      
      if (!vapidKey) {
        throw new Error('VAPID public key is not configured. Please add VITE_VAPID_PUBLIC_KEY to your environment variables.');
      }

      // Create new subscription
      const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
      console.log('Application server key created:', applicationServerKey.length, 'bytes');

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('Push subscription created:', this.subscription);
      
      return this.subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  public async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const result = await this.subscription.unsubscribe();
      this.subscription = null;
      console.log('Unsubscribed from push notifications');
      return result;
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      throw error;
    }
  }

  // Get current subscription
  public getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  // Send subscription to server
  public async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          userId: this.getCurrentUserId()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('Subscription sent to server successfully');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  // Show local notification
  public showNotification(title: string, options?: NotificationOptions): void {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/scaffold-logo.png',
        badge: '/scaffold-logo.png',
        tag: 'scaffold-notification',
        requireInteraction: true,
        ...options
      });
    }
  }

  // Show task update notification
  public showTaskNotification(taskTitle: string, action: string, projectName: string): void {
    this.showNotification('Task Update', {
      body: `Task "${taskTitle}" was ${action} in project "${projectName}"`,
      data: {
        type: 'task-update',
        taskTitle,
        action,
        projectName
      }
    });
  }

  // Show project update notification
  public showProjectNotification(projectName: string, action: string): void {
    this.showNotification('Project Update', {
      body: `Project "${projectName}" was ${action}`,
      data: {
        type: 'project-update',
        projectName,
        action
      }
    });
  }

  // Show comment notification
  public showCommentNotification(commenterName: string, taskTitle: string): void {
    this.showNotification('New Comment', {
      body: `${commenterName} commented on task "${taskTitle}"`,
      data: {
        type: 'comment',
        commenterName,
        taskTitle
      }
    });
  }

  // Convert VAPID key from base64 to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    console.log('Converting VAPID key:', base64String ? 'Present' : 'Missing');
    
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get current user ID (you'll need to implement this based on your auth system)
  private getCurrentUserId(): string | null {
    // This should return the current user's ID
    // You can get this from your auth context or localStorage
    return localStorage.getItem('userId') || null;
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

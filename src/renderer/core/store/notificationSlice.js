import { create } from 'zustand';

export const createNotificationSlice = (set, get) => ({
  notifications: [],

  /**
   * Add a new notification
   * @param {string} message - The message to display
   * @param {'success' | 'error' | 'warning' | 'info'} type - The type of notification
   * @param {number} duration - Duration in ms (default 4000)
   */
  notify: (message, type = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, message, type, duration }
      ]
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }));
  }
});

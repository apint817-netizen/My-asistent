// Nova Reminder Engine — проверяет задачи с dueTime и отправляет уведомления
import { useStore } from '../store/useStore';

let reminderInterval = null;
let notificationSound = null;

// Инициализация звука напоминания
function getReminderSound() {
  if (!notificationSound) {
    notificationSound = new Audio('/sounds/blip.mp3');
    notificationSound.volume = 0.6;
  }
  return notificationSound;
}

// Запросить разрешение на уведомления
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('[Reminders] Notifications not supported');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Показать уведомление
function showNotification(title, body, tag) {
  // Звук
  try {
    const sound = getReminderSound();
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch (e) { /* ignore */ }

  // Браузерное уведомление
  if (Notification.permission === 'granted') {
    try {
      // Через Service Worker для PWA
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/vite.svg',
            badge: '/vite.svg',
            vibrate: [200, 100, 200],
            tag: tag || 'nova-reminder',
          });
        });
      } else {
        // Fallback: обычное уведомление
        new Notification(title, { body, icon: '/vite.svg', tag });
      }
    } catch (e) {
      console.warn('[Reminders] Notification error:', e);
    }
  }

  // Toast внутри приложения
  const addToast = useStore.getState().addToast;
  if (addToast) {
    addToast(`⏰ ${title}: ${body}`, 'info');
  }
}

// Проверка задач — вызывается каждую минуту
function checkReminders() {
  const state = useStore.getState();
  const tasks = state.tasks || [];
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const task of tasks) {
    if (task.completed || task.postponed || !task.dueTime) continue;
    
    // Задача на сегодня или без даты (= сегодня)
    const taskDate = task.dueDate || today;
    if (taskDate !== today) continue;

    const [h, m] = task.dueTime.split(':').map(Number);
    const taskMinutes = h * 60 + m;
    const diff = taskMinutes - currentMinutes; // минут до дедлайна

    const sentReminders = task.remindersSent || [];

    // Проверяем каждый тип напоминания
    const reminders = task.reminders || [];
    
    for (const rem of reminders) {
      if (sentReminders.includes(rem)) continue;

      let triggerMinutes;
      if (rem === '1h') triggerMinutes = 60;
      else if (rem === '30m') triggerMinutes = 30;
      else if (rem === '15m') triggerMinutes = 15;
      else continue;

      // Триггер: осталось <= triggerMinutes и ещё не просрочено
      if (diff <= triggerMinutes && diff > -5) {
        const timeLabel = rem === '1h' ? 'через 1 час' : rem === '30m' ? 'через 30 минут' : 'через 15 минут';
        showNotification(
          '⏰ Напоминание',
          `«${task.title}» ${diff <= 0 ? 'прямо сейчас!' : timeLabel}`,
          `reminder-${task.id}-${rem}`
        );
        state.markReminderSent(task.id, rem);
      }
    }

    // Бонус: уведомление при наступлении дедлайна
    if (diff === 0 && !sentReminders.includes('now')) {
      showNotification(
        '🔔 Время выполнять!',
        `«${task.title}» — пора!`,
        `reminder-${task.id}-now`
      );
      state.markReminderSent(task.id, 'now');
    }
  }
}

// Запуск движка
export function startReminderEngine() {
  if (reminderInterval) return;
  
  // Проверка сразу при старте
  setTimeout(checkReminders, 3000);
  
  // Далее каждую минуту
  reminderInterval = setInterval(checkReminders, 60000);
  
  console.log('[Reminders] Engine started');
}

// Остановка
export function stopReminderEngine() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Reminders] Engine stopped');
  }
}

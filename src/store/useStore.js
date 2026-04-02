import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { playPremiumDing, playAddSound, playRewardSound } from '../utils/sound';

// Dynamic storage key based on user ID
let currentStorageKey = 'nova-storage-v2.1';

export const setStorageKey = (userId) => {
  currentStorageKey = userId ? `nova-storage-${userId}` : 'nova-storage-v2.1';
};

export const getStorageKey = () => currentStorageKey;

export const TASK_CATEGORIES = [
  { id: 'urgent', name: 'Срочные', icon: 'Flame', color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'important', name: 'Важные', icon: 'Star', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'work', name: 'Рабочие', icon: 'Briefcase', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'personal', name: 'Личные', icon: 'Home', color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'health', name: 'Здоровье', icon: 'Heart', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'learning', name: 'Обучение', icon: 'BookOpen', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'habit', name: 'Привычки', icon: 'Target', color: 'text-accent', bg: 'bg-accent/10' },
];

const getInitialState = () => ({
  tokens: 0,
  aiTokensUsed: 0,
  streak: 0,
  lastActiveDate: null,
  tasks: [],
  rewards: [],
  pointsHistory: [],
  purchaseHistory: [],
  chatMessages: [],
  analysisMessages: [],
  chatDraft: '',
  analysisDraft: '',
  draftPlan: {
    today: [],
    future: [],
    regular: [],
    rewards: []
  },
  apiKey: '',
  aiKeysCount: 1,
  googleModel: 'gemini-2.0-flash',
  aiProvider: 'google',
  proxyParams: {
    url: 'http://127.0.0.1:8045/v1',
    model: 'gemini-2.0-flash',
    key: 'sk-9c00aee346154596bda23aa319d6cbf1'
  },
  userProfile: {
    bio: '',
    goals: '',
    interests: ''
  },
  aiPersona: {
    gender: 'female',
    tone: 'friendly',
    role: 'mentor'
  },
  calendarTasks: {},
  version: 2,
  showMobileMenu: false,
  user: null,
  session: null,
  hasCompletedOnboarding: false,
  hasSeenTour: false,
  toasts: [],
  activeTab: 'dashboard',
  isRewardStoreOpen: true,
  showAISettings: false,
  showAnalysisModal: false,
  showPointsHistory: false,
  tourDemoTaskText: '',
  tourDemoAIText: '',
  taskProposals: [],
  calendarProposals: [],
  rewardProposals: [],
  lastAiProvider: 'inactive', // 'google' | 'openrouter' | 'offline' | 'inactive'
  forcedAiProvider: 'auto', // 'auto' | 'google' | 'openrouter' | 'offline'
});

export const useStore = create(
  persist(
    (set, get) => ({
      ...getInitialState(),

      // Actions
      setUserSession: (session) => set({
        session: session,
        user: session?.user || null
      }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      completeTour: () => set({ hasSeenTour: true }),
      setHasSeenTour: (value) => set({ hasSeenTour: value }),
      setApiKey: (key) => set({ apiKey: key }),
      setGoogleModel: (model) => set({ googleModel: model }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setProxyParams: (params) => set((state) => ({ proxyParams: { ...state.proxyParams, ...params } })),
      updateUserProfile: (profile) => set((state) => ({ userProfile: { ...state.userProfile, ...profile } })),
      setAiPersona: (personaUpdate) => set((state) => ({ aiPersona: { ...state.aiPersona, ...personaUpdate } })),
      setShowMobileMenu: (show) => set({ showMobileMenu: show }),
      addToast: (message, type = 'success') => {
        const id = Date.now().toString() + Math.random();
        set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => {
          set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, 3000);
      },
      removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      // UI Control Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setIsRewardStoreOpen: (open) => set({ isRewardStoreOpen: open }),
      setShowAISettings: (show) => set({ showAISettings: show }),
      setShowAnalysisModal: (show) => set({ showAnalysisModal: show }),
      setShowPointsHistory: (show) => set({ showPointsHistory: show }),
      setTourDemoTaskText: (text) => set({ tourDemoTaskText: text }),
      setTourDemoAIText: (text) => set({ tourDemoAIText: text }),
      setLastAiProvider: (provider) => set({ lastAiProvider: provider }),
      setForcedAiProvider: (provider) => set({ forcedAiProvider: provider }),

      setAiKeysCount: (count) => set({ aiKeysCount: count }),
      addAiTokensUsed: (amount) => set((state) => ({ aiTokensUsed: (state.aiTokensUsed || 0) + amount })),
      addTokens: (amount, title = 'Выполнение задачи') => set((state) => ({
        tokens: state.tokens + amount,
        pointsHistory: [{
          id: Date.now().toString() + Math.random(),
          title: title,
          amount: amount,
          type: 'earn',
          date: new Date().toISOString()
        }, ...state.pointsHistory]
      })),
      spendTokens: (amount, title = 'Покупка награды') => set((state) => ({
        tokens: Math.max(0, state.tokens - amount),
        pointsHistory: [{
          id: Date.now().toString() + Math.random(),
          title: title,
          amount: amount,
          type: 'spend',
          date: new Date().toISOString()
        }, ...state.pointsHistory]
      })),
      resetTokens: () => set((state) => ({
        tokens: 0,
        pointsHistory: [{
          id: Date.now().toString() + Math.random(),
          title: 'Сброс баланса',
          amount: state.tokens,
          type: 'reset',
          date: new Date().toISOString()
        }, ...state.pointsHistory]
      })),
      clearPointsHistory: () => set({ pointsHistory: [] }),
      clearSystemLogs: () => set(state => ({ chatMessages: state.chatMessages.filter(m => m.role !== 'system') })),

      toggleTask: (taskId) => {
        const state = get();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        const willComplete = !task.completed;
        const newTasks = state.tasks.map(t => t.id === taskId ? { ...t, completed: willComplete } : t);

        if (willComplete) {
          // Задача выполнена -> начисляем очки
          state.addTokens(task.value, `Выполнение задачи: ${task.title}`);
          
          // Звуковой эффект
          try { playPremiumDing(); } catch (e) { /* ignore audio errors */ }
          
          // Для важных задач (>= 30 очков) — пуш системного события для похвалы от ИИ
          if (task.value >= 30) {
            set((s) => ({
              chatMessages: [...s.chatMessages, {
                role: 'system',
                content: `[SYSTEM_TASK_COMPLETED] Пользователь выполнил задачу "${task.title}" и заработал ${task.value} очков! Текущий баланс: ${s.tokens + task.value}. Серия дней: ${s.streak}.`
              }]
            }));
          }
        } else {
          // Отмена выполнения -> списываем очки
          set((s) => ({
            tokens: Math.max(0, s.tokens - task.value),
            pointsHistory: [{
              id: Date.now().toString() + Math.random(),
              title: `Отмена: ${task.title}`,
              amount: task.value,
              type: 'spend',
              date: new Date().toISOString()
            }, ...s.pointsHistory]
          }));
        }

        set({ tasks: newTasks });
      },

      addTask: (title, value, category = null, extra = {}) => {
        playAddSound();
        set((state) => ({
          tasks: [...state.tasks, {
            id: Date.now().toString(), title, completed: false, value, category,
            dueDate: extra.dueDate || null,
            dueTime: extra.dueTime || null,
            postponed: extra.postponed || false,
            reminders: extra.reminders || [],
            remindersSent: []
          }]
        }));
      },

      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      })),

      reorderTasks: (oldIndex, newIndex) => set((state) => {
        const tasks = [...state.tasks];
        const [removed] = tasks.splice(oldIndex, 1);
        tasks.splice(newIndex, 0, removed);
        return { tasks };
      }),

      editTaskPoints: (taskId, newPoints) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, value: newPoints } : t
        )
      })),

      editTaskCategory: (taskId, category) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, category } : t
        )
      })),

      // Перенос задачи на другую дату
      rescheduleTask: (taskId, newDate) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, dueDate: newDate, postponed: false } : t
        )
      })),

      // Отложить "на потом"
      postponeTask: (taskId) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, postponed: true } : t
        )
      })),

      // Вернуть из "на потом"
      unpostponeTask: (taskId) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, postponed: false } : t
        )
      })),

      // Установить время и напоминания
      setTaskTime: (taskId, dueTime, reminders = []) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, dueTime, reminders, remindersSent: [] } : t
        )
      })),

      // Пометить напоминание как отправленное
      markReminderSent: (taskId, reminderKey) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId ? { ...t, remindersSent: [...(t.remindersSent || []), reminderKey] } : t
        )
      })),

      deleteTaskWithReason: (taskId, reason) => set((state) => {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return state;

        const systemMsg = `[СИСТЕМНОЕ СООБЩЕНИЕ] Пользователь удалил невыполненную задачу "${task.title}". Причина: ${reason}`;

        return {
          tasks: state.tasks.filter(t => t.id !== taskId),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

      addProposal: (title, points, category = null) => set((state) => ({
        taskProposals: [...state.taskProposals, { id: Date.now().toString() + Math.random(), title, points, category }]
      })),
      approveProposal: (id) => set((state) => {
        const proposal = state.taskProposals.find(p => p.id === id);
        if (!proposal) return state;
        return {
          taskProposals: state.taskProposals.filter(p => p.id !== id),
          tasks: [...state.tasks, {
            id: Date.now().toString(), title: proposal.title, completed: false,
            value: proposal.points, category: proposal.category || null,
            dueDate: proposal.dueDate || null, dueTime: null,
            postponed: false, reminders: [], remindersSent: []
          }]
        };
      }),
      rejectProposal: (id) => set((state) => {
        const proposal = state.taskProposals.find(p => p.id === id);
        if (!proposal) return state;
        const systemMsg = `[СИСТЕМНОЕ СООБЩЕНИЕ] Пользователь отказался брать на себя предложенную цель "${proposal.title}". Узнай почему, возможно она слишком сложная и её надо разбить.`;
        return {
          taskProposals: state.taskProposals.filter(p => p.id !== id),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

      addCalendarProposal: (title, points, date, category = null) => set((state) => ({
        calendarProposals: [...state.calendarProposals, { id: Date.now().toString() + Math.random(), title, points, date, category }]
      })),
      approveCalendarProposal: (id) => set((state) => {
        const proposal = state.calendarProposals.find(p => p.id === id);
        if (!proposal) return state;

        const dateStr = proposal.date;
        const tasksForDate = state.calendarTasks[dateStr] || [];

        return {
          calendarProposals: state.calendarProposals.filter(p => p.id !== id),
          calendarTasks: {
            ...state.calendarTasks,
            [dateStr]: [...tasksForDate, { id: Date.now().toString(), title: proposal.title, completed: false, value: proposal.points, category: proposal.category || null }]
          }
        };
      }),
      rejectCalendarProposal: (id) => set((state) => {
        const proposal = state.calendarProposals.find(p => p.id === id);
        if (!proposal) return state;
        const systemMsg = `[СИСТЕМНОЕ СООБЩЕНИЕ] Пользователь отказался планировать задачу "${proposal.title}" на ${proposal.date}. Выясни почему.`;
        return {
          calendarProposals: state.calendarProposals.filter(p => p.id !== id),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

      addRewardProposal: (title, cost) => set((state) => ({
        rewardProposals: [...state.rewardProposals, { id: Date.now().toString() + Math.random(), title, cost }]
      })),
      approveRewardProposal: (id) => set((state) => {
        const proposal = state.rewardProposals.find(p => p.id === id);
        if (!proposal) return state;
        return {
          rewardProposals: state.rewardProposals.filter(p => p.id !== id),
          rewards: [...state.rewards, { id: Date.now().toString(), title: proposal.title, cost: proposal.cost }]
        };
      }),
      rejectRewardProposal: (id) => set((state) => {
        const proposal = state.rewardProposals.find(p => p.id === id);
        if (!proposal) return state;
        const systemMsg = `[СИСТЕМНОЕ СООБЩЕНИЕ] Пользователь отказался добавлять предложенную награду "${proposal.title}".`;
        return {
          rewardProposals: state.rewardProposals.filter(p => p.id !== id),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

      addReward: (reward) => set((state) => ({
        rewards: [...state.rewards, { ...reward, id: Date.now().toString() }]
      })),
      updateReward: (rewardId, updates) => set((state) => ({
        rewards: state.rewards.map(r => r.id === rewardId ? { ...r, ...updates } : r)
      })),
      deleteRewardWithReason: (rewardId, reason) => set((state) => {
        const reward = state.rewards.find(r => r.id === rewardId);
        const systemMsg = reward
          ? `Награда "${reward.title}" удалена. Причина: "${reason}"`
          : `Награда удалена. Причина: "${reason}"`;
        return {
          rewards: state.rewards.filter(r => r.id !== rewardId),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),
      addPurchase: (reward) => set((state) => ({
        purchaseHistory: [{
          ...reward,
          purchaseId: Date.now().toString(),
          date: new Date().toISOString(),
          status: 'active'
        }, ...state.purchaseHistory]
      })),
      refundPurchase: (purchaseId, reason) => set((state) => {
        const purchase = state.purchaseHistory.find(p => p.purchaseId === purchaseId);
        if (!purchase || purchase.status !== 'active') return state;

        return {
          tokens: state.tokens + purchase.cost,
          pointsHistory: [{
            id: Date.now().toString() + Math.random(),
            title: `Возврат: ${purchase.title}`,
            amount: purchase.cost,
            type: 'earn',
            date: new Date().toISOString()
          }, ...state.pointsHistory],
          purchaseHistory: state.purchaseHistory.map(p =>
            p.purchaseId === purchaseId
              ? { ...p, status: 'refunded', refundReason: reason }
              : p
          )
        };
      }),
      usePurchase: (purchaseId) => set((state) => ({
        purchaseHistory: state.purchaseHistory.map(p =>
          p.purchaseId === purchaseId
            ? { ...p, status: 'used' }
            : p
        )
      })),

      buyRewardById: (rewardId) => {
        playRewardSound();
        set((state) => {
        const reward = state.rewards.find(r => r.id === rewardId);
        if (!reward || state.tokens < reward.cost) return state;
        return {
          tokens: state.tokens - reward.cost,
          pointsHistory: [{
            id: Date.now().toString() + Math.random(),
            title: `Покупка: ${reward.title}`,
            amount: reward.cost,
            type: 'spend',
            date: new Date().toISOString()
          }, ...state.pointsHistory],
          purchaseHistory: [{
            ...reward,
            purchaseId: Date.now().toString(),
            date: new Date().toISOString(),
            status: 'active'
          }, ...state.purchaseHistory],
          chatMessages: [...state.chatMessages, {
            role: 'system',
            content: `Вы потратили ${reward.cost} очков на "${reward.title}" через Nova. Наслаждайтесь!`
          }]
        };
      });
      },

      addCalendarTask: (dateStr, title, value, category = null) => set((state) => {
        const tasksForDate = state.calendarTasks[dateStr] || [];
        return {
          calendarTasks: {
            ...state.calendarTasks,
            [dateStr]: [...tasksForDate, { id: Date.now().toString() + Math.random(), title, completed: false, value, category }]
          }
        };
      }),
      deleteCalendarTask: (dateStr, taskId) => set((state) => {
        const tasksForDate = state.calendarTasks[dateStr] || [];
        const taskToDelete = tasksForDate.find(t => t.id === taskId);

        let newTasks = state.tasks;
        if (taskToDelete) {
          newTasks = state.tasks.filter(t => t.id !== taskId && t.title !== taskToDelete.title);
        }

        return {
          tasks: newTasks,
          calendarTasks: {
            ...state.calendarTasks,
            [dateStr]: tasksForDate.filter(t => t.id !== taskId)
          }
        };
      }),
      toggleCalendarTask: (dateStr, taskId) => set((state) => {
        const tasksForDate = state.calendarTasks[dateStr] || [];
        return {
          calendarTasks: {
            ...state.calendarTasks,
            [dateStr]: tasksForDate.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
          }
        };
      }),
      moveCalendarTask: (oldDateStr, taskId, newDateStr) => set((state) => {
        if (oldDateStr === newDateStr) return state;
        const oldTasks = state.calendarTasks[oldDateStr] || [];
        const taskToMove = oldTasks.find(t => t.id === taskId);
        if (!taskToMove) return state;

        const newTasks = state.calendarTasks[newDateStr] || [];
        return {
          calendarTasks: {
            ...state.calendarTasks,
            [oldDateStr]: oldTasks.filter(t => t.id !== taskId),
            [newDateStr]: [...newTasks, taskToMove]
          }
        };
      }),

      addRegularTask: (title, value, period, category = null) => set((state) => {
        const newCalendarTasks = { ...state.calendarTasks };
        const newTasks = [...state.tasks];
        const todayStr = new Date().toISOString().split('T')[0];
        const daysStr = String(period || 'everyday').toLowerCase();

        let targetDays = [];
        if (daysStr.includes('everyday') || daysStr.includes('every_day') || daysStr.includes('кажд')) {
          targetDays = [1, 2, 3, 4, 5, 6, 7];
        } else if (daysStr.includes('work_days') || daysStr.includes('workdays') || daysStr.includes('будн')) {
          targetDays = [1, 2, 3, 4, 5];
        } else if (daysStr.includes('weekends') || daysStr.includes('выходн')) {
          targetDays = [6, 7];
        } else {
          targetDays = daysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 7);
          if (targetDays.length === 0) targetDays = [1, 2, 3, 4, 5, 6, 7];
        }

        const taskTitle = title.endsWith('🔄') ? title : `${title} 🔄`;

        for (let i = 0; i < 30; i++) {
          const trackDate = new Date();
          trackDate.setDate(trackDate.getDate() + i);
          const isoDay = trackDate.getDay() === 0 ? 7 : trackDate.getDay();

          if (targetDays.includes(isoDay)) {
            const dateStr = trackDate.toISOString().split('T')[0];
            const habitTask = {
              id: Date.now().toString() + Math.random() + i,
              title: taskTitle,
              completed: false,
              value,
              isHabit: true,
              category: category || 'habit' // Defaults to habit if not set
            };

            if (dateStr === todayStr) {
              newTasks.push({ ...habitTask });
            } else {
              if (!newCalendarTasks[dateStr]) newCalendarTasks[dateStr] = [];
              newCalendarTasks[dateStr].push({ ...habitTask });
            }
          }
        }

        return {
          tasks: newTasks,
          calendarTasks: newCalendarTasks,
          chatMessages: [...state.chatMessages, {
            role: 'system',
            content: `Добавлена регулярная задача "${title}" (${period}) на ближайшие 30 дней.`
          }]
        };
      }),

      addChatMessage: (msg) => set((state) => ({
        chatMessages: [...state.chatMessages, { ...msg, timestamp: msg.timestamp || new Date().toISOString() }]
      })),
      clearChatMessages: () => set({
        chatMessages: [
          { role: 'assistant', content: 'Привет! Я Nova, твой личный ИИ-ассистент. Я здесь, чтобы помочь тебе не сбиться с пути и заработать на свои любимые награды. Давай сделаем сегодня отличный день!', timestamp: new Date().toISOString() }
        ]
      }),
      addAnalysisMessage: (msg) => set((state) => ({
        analysisMessages: [...state.analysisMessages, { ...msg, timestamp: msg.timestamp || new Date().toISOString() }]
      })),
      clearAnalysisMessages: () => set({ analysisMessages: [] }),

      setChatDraft: (text) => set({ chatDraft: text }),
      setAnalysisDraft: (text) => set({ analysisDraft: text }),

      updateDraftPlan: (planUpdate) => set((state) => ({
        draftPlan: { ...state.draftPlan, ...planUpdate }
      })),
      clearDraftPlan: () => set({
        draftPlan: { today: [], future: [], regular: [], rewards: [] }
      }),
      commitDraftPlan: () => set((state) => {
        const newTasks = state.draftPlan.today.map(t => ({
          id: Date.now().toString() + Math.random(),
          title: t.title,
          completed: false,
          value: t.points || 10,
          category: t.category || null
        }));

        const newCalendarTasks = { ...state.calendarTasks };
        state.draftPlan.future.forEach(ft => {
          if (!newCalendarTasks[ft.date]) newCalendarTasks[ft.date] = [];
          newCalendarTasks[ft.date].push({
            id: Date.now().toString() + Math.random(),
            title: ft.title,
            completed: false,
            value: ft.points || 10,
            category: ft.category || null
          });
        });

        const newHabitsForToday = [];
        const todayStr = new Date().toISOString().split('T')[0];

        state.draftPlan.regular.forEach(r => {
          const title = r.title + " 🔄";
          const value = r.points || 5;
          const daysStr = String(r.schedule || r.days || 'everyday').toLowerCase();

          let targetDays = [];
          if (daysStr.includes('everyday') || daysStr.includes('every_day') || daysStr.includes('кажд')) {
            targetDays = [1, 2, 3, 4, 5, 6, 7];
          } else if (daysStr.includes('work_days') || daysStr.includes('workdays') || daysStr.includes('будн')) {
            targetDays = [1, 2, 3, 4, 5];
          } else if (daysStr.includes('weekends') || daysStr.includes('выходн')) {
            targetDays = [6, 7];
          } else {
            targetDays = daysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 7);
            if (targetDays.length === 0) targetDays = [1, 2, 3, 4, 5, 6, 7];
          }

          for (let i = 0; i < 30; i++) {
            const trackDate = new Date();
            trackDate.setDate(trackDate.getDate() + i);
            const isoDay = trackDate.getDay() === 0 ? 7 : trackDate.getDay();

            if (targetDays.includes(isoDay)) {
              const dateStr = trackDate.toISOString().split('T')[0];
              const habitTask = {
                id: Date.now().toString() + Math.random() + i,
                title,
                completed: false,
                value,
                isHabit: true,
                category: r.category || 'habit'
              };

              if (dateStr === todayStr) {
                newHabitsForToday.push({ ...habitTask });
              } else {
                if (!newCalendarTasks[dateStr]) newCalendarTasks[dateStr] = [];
                newCalendarTasks[dateStr].push({ ...habitTask });
              }
            }
          }
        });

        const newRewards = (state.draftPlan.rewards || []).map(r => ({
          id: Date.now().toString() + Math.random(),
          title: r.title,
          cost: r.cost || 50
        }));

        return {
          tasks: [...state.tasks, ...newTasks, ...newHabitsForToday],
          rewards: [...state.rewards, ...newRewards],
          calendarTasks: newCalendarTasks,
          draftPlan: { today: [], future: [], regular: [], rewards: [] }
        };
      }),

      // Apply data loaded from Supabase
      applyRemoteData: (remoteData) => set((state) => {
        if (!remoteData) return state;
        const merged = { ...state };
        for (const key of Object.keys(remoteData)) {
          if (remoteData[key] !== undefined) {
            merged[key] = remoteData[key];
          }
        }
        return merged;
      }),

      // Reset store for a new/different user
      resetStoreForNewUser: () => set({
        ...getInitialState(),
      }),

      clearSystemAnalysisLogs: () => set(state => ({
        analysisMessages: state.analysisMessages.filter(m => m.role !== 'system')
      })),

      updateActivity: () => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        if (state.lastActiveDate !== today) {
          const plannedToday = (state.calendarTasks[today] || []).map(t => ({
            ...t,
            fromCalendar: true
          }));

          // Preserve uncompleted tasks from previous day, remove completed ones
          const carriedTasks = state.tasks.filter(t => !t.completed);
          const completedTasks = state.tasks.filter(t => t.completed);

          let newCalendarTasks = { ...state.calendarTasks };
          if (state.lastActiveDate && completedTasks.length > 0) {
            const oldCalendarTasks = newCalendarTasks[state.lastActiveDate] || [];
            const map = new Map();
            oldCalendarTasks.forEach(t => map.set(t.id, t));
            completedTasks.forEach(t => map.set(t.id, t)); // Overwrite with completed status
            newCalendarTasks[state.lastActiveDate] = Array.from(map.values());
          }

          // Calculate streak using local date parsing to avoid timezone bugs
          let newStreak = 1;
          if (state.lastActiveDate) {
            const [ly, lm, ld] = state.lastActiveDate.split('-').map(Number);
            const [ty, tm, td] = today.split('-').map(Number);
            const lastDate = new Date(ly, lm - 1, ld);
            const todayDate = new Date(ty, tm - 1, td);
            const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
            newStreak = diffDays === 1 ? state.streak + 1 : 1;
          }

          const carriedCount = carriedTasks.length;
          const plannedCount = plannedToday.length;
          // Дедупликация: проверяем, не было ли уже SYSTEM_NEW_DAY с сегодняшней датой
          const alreadyHasNewDay = state.chatMessages.some(m =>
            m.role === 'system' && m.content && m.content.includes('[SYSTEM_NEW_DAY]') && m.content.includes(today)
          );

          let newChatMessages = [...state.chatMessages];
          if (!alreadyHasNewDay) {
            let dayMessage = `[SYSTEM_NEW_DAY] Пользователь зашел в новый день. Сегодняшняя дата: ${today}. Серия дней: ${newStreak}. `;
            if (carriedCount > 0 && plannedCount > 0) {
              dayMessage += `Перенесено ${carriedCount} незавершённых задач с прошлого дня, и запланировано ${plannedCount} на сегодня. `;
            } else if (carriedCount > 0) {
              dayMessage += `Перенесено ${carriedCount} незавершённых задач с прошлого дня. `;
            } else if (plannedCount > 0) {
              dayMessage += `На сегодня из календаря запланировано ${plannedCount} задач.`;
            } else {
              dayMessage += 'Список чист.';
            }
            newChatMessages.push({ role: 'system', content: dayMessage, timestamp: new Date().toISOString() });
          }

          // Возвращаем отложенные задачи с dueDate == today
          const allTasks = [...carriedTasks, ...plannedToday];
          const updatedTasks = allTasks.map(t => {
            if (t.postponed && t.dueDate === today) return { ...t, postponed: false };
            if (t.dueDate && t.dueDate < today && !t.completed) return { ...t, dueDate: null };
            return t;
          });

          return {
            lastActiveDate: today,
            streak: newStreak,
            tasks: updatedTasks,
            calendarTasks: newCalendarTasks,
            chatMessages: newChatMessages
          };
        }
        return state;
      })
    }),
    {
      name: currentStorageKey,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const val = localStorage.getItem(currentStorageKey);
          return val;
        },
        setItem: (name, value) => {
          localStorage.setItem(currentStorageKey, value);
        },
        removeItem: (name) => {
          localStorage.removeItem(currentStorageKey);
        }
      })),
      version: 2,
      migrate: (persistedState, version) => {
        const oldModels = ['gemini-1.5-flash', 'gemini-3-flash', 'gemini-2.0-flash-exp'];
        if (persistedState && oldModels.includes(persistedState.googleModel)) {
          persistedState.googleModel = 'gemini-2.5-flash';
        }
        if (persistedState?.proxyParams && oldModels.includes(persistedState.proxyParams.model)) {
          persistedState.proxyParams = { ...persistedState.proxyParams, model: 'gemini-2.5-flash' };
        }
        return persistedState;
      }
    }
  )
);

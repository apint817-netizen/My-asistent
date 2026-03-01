import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      tokens: 0,
      aiTokensUsed: 0,
      streak: 0,
      lastActiveDate: null,
      tasks: [
        { id: '1', title: 'Выпить стакан воды с утра', completed: false, value: 5 },
        { id: '2', title: 'Сфокусированная работа (2 часа)', completed: false, value: 50 },
        { id: '3', title: 'Прочитать 10 страниц', completed: false, value: 15 },
      ],
      rewards: [
        { id: '1', title: 'Поиграть в игры 1 час', cost: 100 },
        { id: '2', title: 'Заказать любимую еду', cost: 300 },
        { id: '3', title: 'Вечер отдыха без чувства вины', cost: 500 },
      ],
      pointsHistory: [],
      purchaseHistory: [],
      chatMessages: [
        { role: 'assistant', content: 'Привет! Я Nova, твой личный ИИ-ассистент. Я здесь, чтобы помочь тебе не сбиться с пути и заработать на свои любимые награды. Давай сделаем сегодня отличный день!', timestamp: new Date().toISOString() }
      ],
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
      googleModel: 'gemini-2.0-flash',
      aiProvider: 'google', // 'google' or 'proxy'
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
      calendarTasks: {},
      version: 2,
      showMobileMenu: false,
      // Тосты
      toasts: [],

      // Actions
      setApiKey: (key) => set({ apiKey: key }),
      setGoogleModel: (model) => set({ googleModel: model }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setProxyParams: (params) => set((state) => ({ proxyParams: { ...state.proxyParams, ...params } })),
      updateUserProfile: (profile) => set((state) => ({ userProfile: { ...state.userProfile, ...profile } })),
      setShowMobileMenu: (show) => set({ showMobileMenu: show }),
      addToast: (message, type = 'success') => {
        const id = Date.now().toString() + Math.random();
        set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => {
          set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, 3000);
      },
      removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
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
      clearSystemLogs: () => set(state => ({ chatMessages: state.chatMessages.filter(m => m.role !== 'system') })),

      toggleTask: (taskId) => set((state) => {
        const tasks = state.tasks.map(t => {
          if (t.id === taskId) {
            const completed = !t.completed;
            return { ...t, completed };
          }
          return t;
        });
        return { tasks };
      }),

      addTask: (title, value) => set((state) => ({
        tasks: [...state.tasks, { id: Date.now().toString(), title, completed: false, value }]
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

      deleteTaskWithReason: (taskId, reason) => set((state) => {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return state;

        const systemMsg = `[СИСТЕМНОЕ СООБЩЕНИЕ] Пользователь удалил невыполненную задачу "${task.title}". Причина: ${reason}`;

        return {
          tasks: state.tasks.filter(t => t.id !== taskId),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

      taskProposals: [],
      addProposal: (title, points) => set((state) => ({
        taskProposals: [...state.taskProposals, { id: Date.now().toString() + Math.random(), title, points }]
      })),
      approveProposal: (id) => set((state) => {
        const proposal = state.taskProposals.find(p => p.id === id);
        if (!proposal) return state;
        return {
          taskProposals: state.taskProposals.filter(p => p.id !== id),
          tasks: [...state.tasks, { id: Date.now().toString(), title: proposal.title, completed: false, value: proposal.points }]
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

      calendarProposals: [],
      addCalendarProposal: (title, points, date) => set((state) => ({
        calendarProposals: [...state.calendarProposals, { id: Date.now().toString() + Math.random(), title, points, date }]
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
            [dateStr]: [...tasksForDate, { id: Date.now().toString(), title: proposal.title, completed: false, value: proposal.points }]
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

      rewardProposals: [],
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
          status: 'active' // active, refunded, used
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

      buyRewardById: (rewardId) => set((state) => {
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
      }),

      addCalendarTask: (dateStr, title, value) => set((state) => {
        const tasksForDate = state.calendarTasks[dateStr] || [];
        return {
          calendarTasks: {
            ...state.calendarTasks,
            [dateStr]: [...tasksForDate, { id: Date.now().toString() + Math.random(), title, completed: false, value }]
          }
        };
      }),
      deleteCalendarTask: (dateStr, taskId) => set((state) => {
        const tasksForDate = state.calendarTasks[dateStr] || [];
        // Находим задачу, чтобы извлечь оригинальный Title или ID (если это связано с глобальными тасками)
        const taskToDelete = tasksForDate.find(t => t.id === taskId);

        let newTasks = state.tasks;
        // Если у нас в tasks есть задача с таким же названием, удаляем её тоже (связность)
        // Либо, если taskId совпадает (хотя для календаря генерятся свои ID, но мы попытаемся по названию)
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

      addRegularTask: (title, value, period) => set((state) => {
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
              isHabit: true
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

      chatDraft: '',
      setChatDraft: (text) => set({ chatDraft: text }),

      analysisDraft: '',
      setAnalysisDraft: (text) => set({ analysisDraft: text }),

      updateDraftPlan: (planUpdate) => set((state) => ({
        draftPlan: { ...state.draftPlan, ...planUpdate }
      })),
      clearDraftPlan: () => set({
        draftPlan: { today: [], future: [], regular: [], rewards: [] }
      }),
      commitDraftPlan: () => set((state) => {
        // Here we handle transferring items from draftPlan into active tasks/calendar.
        // For 'today' tasks -> state.tasks
        const newTasks = state.draftPlan.today.map(t => ({
          id: Date.now().toString() + Math.random(),
          title: t.title,
          completed: false,
          value: t.points || 10
        }));

        // For 'future' tasks -> state.calendarTasks
        const newCalendarTasks = { ...state.calendarTasks };
        state.draftPlan.future.forEach(ft => {
          if (!newCalendarTasks[ft.date]) newCalendarTasks[ft.date] = [];
          newCalendarTasks[ft.date].push({
            id: Date.now().toString() + Math.random(),
            title: ft.title,
            completed: false,
            value: ft.points || 10
          });
        });

        // For regular habits -> distribute to calendar based on days
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

          // Add to next 30 days
          for (let i = 0; i < 30; i++) {
            const trackDate = new Date();
            trackDate.setDate(trackDate.getDate() + i);
            const isoDay = trackDate.getDay() === 0 ? 7 : trackDate.getDay(); // 1=Mon, 7=Sun

            if (targetDays.includes(isoDay)) {
              const dateStr = trackDate.toISOString().split('T')[0];
              const habitTask = {
                id: Date.now().toString() + Math.random() + i,
                title,
                completed: false,
                value,
                isHabit: true
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

        // For rewards -> state.rewards
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

      updateActivity: () => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        if (state.lastActiveDate !== today) {
          // New day => reset tasks, transfer from calendar (but keep them in calendar too)
          const plannedToday = (state.calendarTasks[today] || []).map(t => ({
            ...t,
            fromCalendar: true
          }));

          return {
            lastActiveDate: today,
            streak: state.lastActiveDate ? state.streak + 1 : 1,
            tasks: [...plannedToday],
            chatMessages: [
              ...state.chatMessages,
              { role: 'assistant', content: `Доброе утро! Наступил новый день, список задач сброшен. ${plannedToday.length > 0 ? `В календаре у нас было запланировано ${plannedToday.length} задач на сегодня - они перенесены в активный список.` : 'На сегодня ничего не было запланировано.'} Какие еще у нас цели на сегодня? Расскажи, и я помогу тебе их сформировать.` }
            ]
          };
        }
        return state;
      })
    }),
    {
      name: 'nova-storage-v2.1',
      version: 2,
      migrate: (persistedState, version) => {
        // Миграция: сбрасываем несуществующие/старые модели на gemini-2.5-flash
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

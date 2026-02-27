import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      tokens: 0,
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
        model: 'gemini-3-flash',
        key: 'sk-9c00aee346154596bda23aa319d6cbf1'
      },
      calendarTasks: {},

      // Actions
      setApiKey: (key) => set({ apiKey: key }),
      setGoogleModel: (model) => set({ googleModel: model }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setProxyParams: (params) => set((state) => ({ proxyParams: { ...state.proxyParams, ...params } })),
      addTokens: (amount) => set((state) => ({ tokens: state.tokens + amount })),
      spendTokens: (amount) => set((state) => ({ tokens: Math.max(0, state.tokens - amount) })),

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
        return {
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

        // For regular habits -> right now we just append them to today as a simplicity,
        // or we could add a new 'habits' concept. We'll add them to today.
        const newHabits = state.draftPlan.regular.map(r => ({
          id: Date.now().toString() + Math.random(),
          title: r.title + " 🔄",
          completed: false,
          value: r.points || 5
        }));

        // For rewards -> state.rewards
        const newRewards = (state.draftPlan.rewards || []).map(r => ({
          id: Date.now().toString() + Math.random(),
          title: r.title,
          cost: r.cost || 50
        }));

        return {
          tasks: [...state.tasks, ...newTasks, ...newHabits],
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
      name: 'nova-storage-v2.1', // Changed storage key to load new defaults
    }
  )
);

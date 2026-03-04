import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Dynamic storage key based on user ID
let currentStorageKey = 'nova-storage-v2.1';

export const setStorageKey = (userId) => {
  currentStorageKey = userId ? `nova-storage-${userId}` : 'nova-storage-v2.1';
};

export const getStorageKey = () => currentStorageKey;

// Initial state factory вЂ” used for resetting store on new user
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
});

export const useStore = create(
  persist(
    (set) => ({
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

      addAiTokensUsed: (amount) => set((state) => ({ aiTokensUsed: (state.aiTokensUsed || 0) + amount })),
      addTokens: (amount, title = 'Р’С‹РїРѕР»РЅРµРЅРёРµ Р·Р°РґР°С‡Рё') => set((state) => ({
        tokens: state.tokens + amount,
        pointsHistory: [{
          id: Date.now().toString() + Math.random(),
          title: title,
          amount: amount,
          type: 'earn',
          date: new Date().toISOString()
        }, ...state.pointsHistory]
      })),
      spendTokens: (amount, title = 'РџРѕРєСѓРїРєР° РЅР°РіСЂР°РґС‹') => set((state) => ({
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
          title: 'РЎР±СЂРѕСЃ Р±Р°Р»Р°РЅСЃР°',
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

        const systemMsg = `[РЎРРЎРўР•РњРќРћР• РЎРћРћР‘Р©Р•РќРР•] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»РёР» РЅРµРІС‹РїРѕР»РЅРµРЅРЅСѓСЋ Р·Р°РґР°С‡Сѓ "${task.title}". РџСЂРёС‡РёРЅР°: ${reason}`;

        return {
          tasks: state.tasks.filter(t => t.id !== taskId),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

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
        const systemMsg = `[РЎРРЎРўР•РњРќРћР• РЎРћРћР‘Р©Р•РќРР•] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕС‚РєР°Р·Р°Р»СЃСЏ Р±СЂР°С‚СЊ РЅР° СЃРµР±СЏ РїСЂРµРґР»РѕР¶РµРЅРЅСѓСЋ С†РµР»СЊ "${proposal.title}". РЈР·РЅР°Р№ РїРѕС‡РµРјСѓ, РІРѕР·РјРѕР¶РЅРѕ РѕРЅР° СЃР»РёС€РєРѕРј СЃР»РѕР¶РЅР°СЏ Рё РµС‘ РЅР°РґРѕ СЂР°Р·Р±РёС‚СЊ.`;
        return {
          taskProposals: state.taskProposals.filter(p => p.id !== id),
          chatMessages: [...state.chatMessages, { role: 'system', content: systemMsg }]
        };
      }),

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
        const systemMsg = `[РЎРРЎРўР•РњРќРћР• РЎРћРћР‘Р©Р•РќРР•] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕС‚РєР°Р·Р°Р»СЃСЏ РїР»Р°РЅРёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ "${proposal.title}" РЅР° ${proposal.date}. Р’С‹СЏСЃРЅРё РїРѕС‡РµРјСѓ.`;
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
        const systemMsg = `[РЎРРЎРўР•РњРќРћР• РЎРћРћР‘Р©Р•РќРР•] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕС‚РєР°Р·Р°Р»СЃСЏ РґРѕР±Р°РІР»СЏС‚СЊ РїСЂРµРґР»РѕР¶РµРЅРЅСѓСЋ РЅР°РіСЂР°РґСѓ "${proposal.title}".`;
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
          ? `РќР°РіСЂР°РґР° "${reward.title}" СѓРґР°Р»РµРЅР°. РџСЂРёС‡РёРЅР°: "${reason}"`
          : `РќР°РіСЂР°РґР° СѓРґР°Р»РµРЅР°. РџСЂРёС‡РёРЅР°: "${reason}"`;
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
            title: `Р’РѕР·РІСЂР°С‚: ${purchase.title}`,
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
            title: `РџРѕРєСѓРїРєР°: ${reward.title}`,
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
            content: `Р’С‹ РїРѕС‚СЂР°С‚РёР»Рё ${reward.cost} РѕС‡РєРѕРІ РЅР° "${reward.title}" С‡РµСЂРµР· Nova. РќР°СЃР»Р°Р¶РґР°Р№С‚РµСЃСЊ!`
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

      addRegularTask: (title, value, period) => set((state) => {
        const newCalendarTasks = { ...state.calendarTasks };
        const newTasks = [...state.tasks];
        const todayStr = new Date().toISOString().split('T')[0];
        const daysStr = String(period || 'everyday').toLowerCase();

        let targetDays = [];
        if (daysStr.includes('everyday') || daysStr.includes('every_day') || daysStr.includes('РєР°Р¶Рґ')) {
          targetDays = [1, 2, 3, 4, 5, 6, 7];
        } else if (daysStr.includes('work_days') || daysStr.includes('workdays') || daysStr.includes('Р±СѓРґРЅ')) {
          targetDays = [1, 2, 3, 4, 5];
        } else if (daysStr.includes('weekends') || daysStr.includes('РІС‹С…РѕРґРЅ')) {
          targetDays = [6, 7];
        } else {
          targetDays = daysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 7);
          if (targetDays.length === 0) targetDays = [1, 2, 3, 4, 5, 6, 7];
        }

        const taskTitle = title.endsWith('рџ”„') ? title : `${title} рџ”„`;

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
            content: `Р”РѕР±Р°РІР»РµРЅР° СЂРµРіСѓР»СЏСЂРЅР°СЏ Р·Р°РґР°С‡Р° "${title}" (${period}) РЅР° Р±Р»РёР¶Р°Р№С€РёРµ 30 РґРЅРµР№.`
          }]
        };
      }),

      addChatMessage: (msg) => set((state) => ({
        chatMessages: [...state.chatMessages, { ...msg, timestamp: msg.timestamp || new Date().toISOString() }]
      })),
      clearChatMessages: () => set({
        chatMessages: [
          { role: 'assistant', content: 'РџСЂРёРІРµС‚! РЇ Nova, С‚РІРѕР№ Р»РёС‡РЅС‹Р№ РР-Р°СЃСЃРёСЃС‚РµРЅС‚. РЇ Р·РґРµСЃСЊ, С‡С‚РѕР±С‹ РїРѕРјРѕС‡СЊ С‚РµР±Рµ РЅРµ СЃР±РёС‚СЊСЃСЏ СЃ РїСѓС‚Рё Рё Р·Р°СЂР°Р±РѕС‚Р°С‚СЊ РЅР° СЃРІРѕРё Р»СЋР±РёРјС‹Рµ РЅР°РіСЂР°РґС‹. Р”Р°РІР°Р№ СЃРґРµР»Р°РµРј СЃРµРіРѕРґРЅСЏ РѕС‚Р»РёС‡РЅС‹Р№ РґРµРЅСЊ!', timestamp: new Date().toISOString() }
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
          value: t.points || 10
        }));

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

        const newHabitsForToday = [];
        const todayStr = new Date().toISOString().split('T')[0];

        state.draftPlan.regular.forEach(r => {
          const title = r.title + " рџ”„";
          const value = r.points || 5;
          const daysStr = String(r.schedule || r.days || 'everyday').toLowerCase();

          let targetDays = [];
          if (daysStr.includes('everyday') || daysStr.includes('every_day') || daysStr.includes('РєР°Р¶Рґ')) {
            targetDays = [1, 2, 3, 4, 5, 6, 7];
          } else if (daysStr.includes('work_days') || daysStr.includes('workdays') || daysStr.includes('Р±СѓРґРЅ')) {
            targetDays = [1, 2, 3, 4, 5];
          } else if (daysStr.includes('weekends') || daysStr.includes('РІС‹С…РѕРґРЅ')) {
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
        // Merge remote data with current state, preferring remote data
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

          return {
            lastActiveDate: today,
            streak: state.lastActiveDate ? state.streak + 1 : 1,
            tasks: [...plannedToday],
            chatMessages: [
              ...state.chatMessages,
              { role: 'assistant', content: `Р”РѕР±СЂРѕРµ СѓС‚СЂРѕ! РќР°СЃС‚СѓРїРёР» РЅРѕРІС‹Р№ РґРµРЅСЊ, СЃРїРёСЃРѕРє Р·Р°РґР°С‡ СЃР±СЂРѕС€РµРЅ. ${plannedToday.length > 0 ? `Р’ РєР°Р»РµРЅРґР°СЂРµ Сѓ РЅР°СЃ Р±С‹Р»Рѕ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ ${plannedToday.length} Р·Р°РґР°С‡ РЅР° СЃРµРіРѕРґРЅСЏ - РѕРЅРё РїРµСЂРµРЅРµСЃРµРЅС‹ РІ Р°РєС‚РёРІРЅС‹Р№ СЃРїРёСЃРѕРє.` : 'РќР° СЃРµРіРѕРґРЅСЏ РЅРёС‡РµРіРѕ РЅРµ Р±С‹Р»Рѕ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ.'} РљР°РєРёРµ РµС‰Рµ Сѓ РЅР°СЃ С†РµР»Рё РЅР° СЃРµРіРѕРґРЅСЏ? Р Р°СЃСЃРєР°Р¶Рё, Рё СЏ РїРѕРјРѕРіСѓ С‚РµР±Рµ РёС… СЃС„РѕСЂРјРёСЂРѕРІР°С‚СЊ.` }
            ]
          };
        }
        return state;
      })
    }),
    {
      name: currentStorageKey,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          // Use current key dynamically
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

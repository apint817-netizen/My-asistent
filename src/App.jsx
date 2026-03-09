import { useEffect, useState, useRef } from 'react';
import { useStore, setStorageKey } from './store/useStore';
import { Trophy, CheckCircle, MessageSquare, Plus, Activity, Calendar as CalendarIcon, ListTodo, ChevronUp, ChevronDown, HelpCircle, Settings, FileText, LogOut, Users, Shield, UserCircle } from 'lucide-react';
import TaskManager from './components/TaskManager';
import RewardStore from './components/RewardStore';
import AIAssistant from './components/AIAssistant';
import TaskProposalModal from './components/TaskProposalModal';
import RewardProposalModal from './components/RewardProposalModal';
import CalendarView from './components/CalendarView';
import AnalysisModal from './components/AnalysisModal';
import ResumeView from './components/ResumeView';
import HelpView from './components/HelpView';
import AISettingsModal from './components/AISettingsModal';
import PointsHistoryModal from './components/PointsHistoryModal';
import AuthView from './components/AuthView';
import OnboardingView from './components/OnboardingView';
import DashboardTour from './components/DashboardTour';
import Tooltip from './components/Tooltip';
import FriendsView from './components/FriendsView';
import GroupsView from './components/GroupsView';
import SocialView from './components/SocialView';
import ProfileView from './components/ProfileView';
import MobileHeader from './components/MobileHeader';
import NovaFAB from './components/NovaFAB';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { loadUserData, debouncedSave, flushSave, clearLocalData } from './lib/supabaseSync';
import ToastContainer from './components/ToastContainer';
import BottomNavigation from './components/BottomNavigation';

function App() {
  const tokens = useStore(state => state.tokens);
  const streak = useStore(state => state.streak);
  const updateActivity = useStore(state => state.updateActivity);

  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const isRewardStoreOpen = useStore(state => state.isRewardStoreOpen);
  const setIsRewardStoreOpen = useStore(state => state.setIsRewardStoreOpen);
  const showAISettings = useStore(state => state.showAISettings);
  const setShowAISettings = useStore(state => state.setShowAISettings);
  const showAnalysisModal = useStore(state => state.showAnalysisModal);
  const setShowAnalysisModal = useStore(state => state.setShowAnalysisModal);
  const showPointsHistory = useStore(state => state.showPointsHistory);
  const setShowPointsHistory = useStore(state => state.setShowPointsHistory);

  const [showHelp, setShowHelp] = useState(false);
  // Mobile settings bottom sheet
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const hasCompletedOnboarding = useStore(state => state.hasCompletedOnboarding);
  const syncUnsubRef = useRef(null);

  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // Initialize user data from Supabase
  const initUserData = async (userId) => {
    if (!userId) return;

    setDataLoading(true);
    try {
      // Set dynamic storage key for this user
      setStorageKey(userId);

      // FAST: Load from localStorage first — show UI immediately
      const localKey = `nova-storage-${userId}`;
      const localData = localStorage.getItem(localKey);
      let hasLocalData = false;

      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (parsed?.state) {
            useStore.setState(parsed.state);
            hasLocalData = true;
          }
        } catch (e) {
          console.warn('[App] Failed to parse local data:', e);
        }
      }

      // If we have local data, stop blocking UI — sync Supabase in background
      if (hasLocalData) {
        setDataLoading(false);
        // Background sync from Supabase (non-blocking)
        loadUserData(userId).then(remoteData => {
          if (remoteData) {
            useStore.getState().applyRemoteData(remoteData);
            console.log('[App] Background sync: applied remote data');
          }
        }).catch(err => {
          console.warn('[App] Background sync failed:', err.message);
        });
      } else {
        // No local data — must wait for Supabase (with 5s timeout)
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase load timeout')), 5000)
          );
          const remoteData = await Promise.race([
            loadUserData(userId),
            timeoutPromise
          ]);
          if (remoteData) {
            useStore.getState().applyRemoteData(remoteData);
            console.log('[App] Applied remote data from Supabase');
          } else {
            useStore.getState().resetStoreForNewUser();
            console.log('[App] New user — clean state');
          }
        } catch (timeoutErr) {
          console.warn('[App] Supabase load timed out:', timeoutErr.message);
          useStore.getState().resetStoreForNewUser();
        }
      }
    } catch (err) {
      console.error('[App] Error initializing user data:', err);
    } finally {
      setDataLoading(false);
    }

    // Subscribe to store changes for auto-save
    if (syncUnsubRef.current) {
      syncUnsubRef.current();
    }
    syncUnsubRef.current = useStore.subscribe(() => {
      debouncedSave(userId, useStore.getState);
    });
  };

  const currentUserIdRef = useRef(null);

  // Supabase auth listener
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setAuthLoading(false);
      return;
    }

    // Auth check with timeout (5s max — fast fail)
    const authTimeout = setTimeout(() => {
      console.warn('[App] Auth check timed out, proceeding without auth');
      setAuthLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(authTimeout);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      currentUserIdRef.current = currentUser?.id || null;

      if (currentUser) {
        await initUserData(currentUser.id);
      }
      setAuthLoading(false);
    }).catch((err) => {
      clearTimeout(authTimeout);
      console.error('[App] Auth error:', err);
      setAuthLoading(false);
    });

    // Capacitor Deep Link handler for OAuth
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', async (event) => {
          if (event.url.includes('login-callback')) {
            import('@capacitor/browser').then(({ Browser }) => {
              Browser.close().catch(console.error);
            });
            
            if (event.url.includes('#')) {
              const hashParams = new URL(event.url).hash.substring(1);
              const params = new URLSearchParams(hashParams);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');

              if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
              }
            }
          }
        });
      }).catch(console.error);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null;

      if (_event === 'SIGNED_OUT') {
        if (syncUnsubRef.current) {
          syncUnsubRef.current();
          syncUnsubRef.current = null;
        }
        useStore.getState().resetStoreForNewUser();
        setStorageKey(null);
        setUser(null);
        currentUserIdRef.current = null;
        return;
      }

      if (newUser && newUser.id !== currentUserIdRef.current) {
        currentUserIdRef.current = newUser.id;
        setUser(newUser);
        await initUserData(newUser.id);
      } else if (newUser && newUser.id === currentUserIdRef.current) {
        setUser(newUser);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (syncUnsubRef.current) {
        syncUnsubRef.current();
      }
    };
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      const currentUser = user;
      if (currentUser) {
        await flushSave(currentUser.id, useStore.getState());
      }
      await supabase.auth.signOut();
      setUser(null);
    }
  };

  // Show auth screen if Supabase is configured and user is not logged in
  if (isSupabaseConfigured() && !user && !authLoading) {
    return <AuthView />;
  }

  // Show onboarding if logged in but hasn't completed it
  if (isSupabaseConfigured() && user && !hasCompletedOnboarding && !dataLoading) {
    return <OnboardingView />;
  }

  // Loading
  if ((authLoading || dataLoading) && isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
        <span className="text-text-secondary text-sm">{dataLoading ? 'Загрузка данных...' : 'Авторизация...'}</span>
      </div>
    );
  }

  // Helper: check if mobile
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Render mobile-specific content
  const renderMobileContent = () => {
    switch (activeTab) {
      case 'social':
        return <SocialView />;
      case 'profile':
        return (
          <ProfileView
            user={user}
            onLogout={handleLogout}
            onShowAISettings={() => setShowAISettings(true)}
            onShowHelp={() => setShowHelp(true)}
            onShowPointsHistory={() => setShowPointsHistory(true)}
            onShowAnalysis={() => setShowAnalysisModal(true)}
          />
        );
      default:
        return null;
    }
  };

  // Check if we are on a mobile-only tab
  const isMobileOnlyTab = activeTab === 'social' || activeTab === 'profile';

  return (
    <div className="container mx-auto max-w-7xl min-h-screen flex flex-col relative overflow-hidden">
      <ToastContainer />
      <TaskProposalModal />
      <RewardProposalModal />
      <DashboardTour />
      <HelpView isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <AISettingsModal isOpen={showAISettings} onClose={() => setShowAISettings(false)} />
      <PointsHistoryModal isOpen={showPointsHistory} onClose={() => setShowPointsHistory(false)} />
      <AnalysisModal isOpen={showAnalysisModal} onClose={() => setShowAnalysisModal(false)} />

      {/* ===== MOBILE LAYOUT ===== */}
      <div className="lg:hidden flex flex-col flex-1 pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
        {/* Mobile Header — compact 56px */}
        <MobileHeader
          onShowSettings={() => setShowMobileSettings(true)}
          onShowPointsHistory={() => setShowPointsHistory(true)}
        />

        {/* Mobile settings bottom sheet */}
        {showMobileSettings && (
          <div className="fixed inset-0 z-[55] animate-fade-in" onClick={() => setShowMobileSettings(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="absolute bottom-0 left-0 right-0 bg-bg-primary border-t border-border rounded-t-2xl p-4 animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="flex flex-col gap-1">
                <button onClick={() => { setShowAISettings(true); setShowMobileSettings(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/5 transition-colors text-left">
                  <Settings size={18} className="text-accent" />
                  <span className="text-sm font-medium text-white">Настройки ИИ</span>
                </button>
                <button onClick={() => { setShowHelp(true); setShowMobileSettings(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/5 transition-colors text-left">
                  <HelpCircle size={18} className="text-blue-400" />
                  <span className="text-sm font-medium text-white">Справка</span>
                </button>
                {user && (
                  <button onClick={() => { handleLogout(); setShowMobileSettings(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/5 transition-colors text-left">
                    <LogOut size={18} className="text-danger/70" />
                    <span className="text-sm font-medium text-danger/70">Выйти</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile main content area */}
        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {isMobileOnlyTab ? (
            renderMobileContent()
          ) : activeTab === 'calendar' ? (
            <CalendarView />
          ) : (
            /* Dashboard tab */
            <div className="flex flex-col gap-6">
              {/* Tasks section */}
              <section className="glass-panel p-4 flex-1 flex flex-col">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle size={18} className="text-accent shrink-0" />
                    <span className="truncate">Цели и Привычки</span>
                  </h2>
                  <button
                    id="tour-analysis-btn"
                    onClick={() => setShowAnalysisModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95 shrink-0"
                  >
                    🧠 Анализ
                  </button>
                </div>
                <TaskManager />
              </section>

              {/* Rewards section — collapsible with CSS grid animation */}
              <section id="tour-rewards" className="glass-panel p-4 flex flex-col shrink-0">
                <div
                  className="flex justify-between items-center cursor-pointer group select-none"
                  onClick={() => setIsRewardStoreOpen(!isRewardStoreOpen)}
                >
                  <h2 className="text-lg font-bold flex items-center gap-2 group-active:text-warning transition-colors">
                    <Trophy size={18} className="text-warning" />
                    Магазин Наград
                  </h2>
                  <button className="text-text-secondary bg-white/5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:bg-white/10 transition-colors">
                    <ChevronDown size={20} className={`transition-transform duration-300 ${isRewardStoreOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className={`collapsible-grid ${isRewardStoreOpen ? 'open' : ''}`}>
                  <div className="collapsible-content">
                    <div className="pt-4 mt-4 border-t border-white/5">
                      <RewardStore />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Nova FAB */}
        <NovaFAB />
      </div>

      {/* ===== DESKTOP LAYOUT (unchanged) ===== */}
      <div className="hidden lg:flex flex-col flex-1 p-8 gap-8">
        {/* Desktop Header Widget */}
        <header id="tour-header" className="glass-panel p-6 lg:p-8 flex flex-row items-center justify-between gap-6 animate-fade-in relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-3xl lg:text-4xl font-bold text-gradient mb-3 tracking-tight">Ассистент Nova</h1>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-sm font-semibold rounded-full border border-success/20">
                <Activity size={14} />
                Серия: {streak} {streak === 1 ? 'день' : (streak >= 2 && streak <= 4) ? 'дня' : 'дней'}
              </span>
              <span className="text-text-secondary text-sm">Продолжайте в том же духе!</span>
            </div>
          </div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <button
                id="tour-settings"
                onClick={() => setShowAISettings(true)}
                className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/50 transition-all hover:scale-110"
                title="Настройки ИИ"
              >
                <Settings size={18} />
              </button>
              {user && (
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary hover:text-danger hover:border-danger/50 transition-all hover:scale-110"
                  title="Выйти"
                >
                  <LogOut size={18} />
                </button>
              )}
              <button
                onClick={() => setShowHelp(true)}
                className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/50 transition-all hover:scale-110"
                title="Справка"
              >
                <HelpCircle size={18} />
              </button>
            </div>
            
            <button
              id="tour-points"
              onClick={() => setShowPointsHistory(true)}
              className="bg-bg-primary/50 backdrop-blur-md border border-border pl-4 pr-6 py-3 rounded-2xl flex items-center gap-4 shadow-lg shadow-black/20 hover:bg-bg-primary hover:border-warning/30 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-warning/30 to-warning/10 border border-warning/20 flex items-center justify-center text-warning group-hover:scale-105 transition-transform"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.4))' }}
                >
                  <Trophy size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-2xl leading-none text-white">{tokens}</span>
                  <span className="text-text-secondary text-[11px] uppercase tracking-widest font-bold mt-1 group-hover:text-warning/80 transition-colors">Очков</span>
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Desktop Tab Navigation */}
        <div id="tour-summary" className="flex bg-black/40 p-1.5 rounded-2xl border border-border w-full max-w-full shadow-inner z-50 relative overflow-x-auto custom-scrollbar snap-x snap-mandatory">
          <Tooltip text="Добавляйте задачи на сегодня и обменивайте очки на награды" position="bottom">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap snap-center ${activeTab === 'dashboard' ? 'bg-accent/20 text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <ListTodo size={18} />
              Главная
            </button>
          </Tooltip>
          <Tooltip text="Планируйте задачи на будущие дни и следите за нагрузкой" position="bottom">
            <button
              id="tour-calendar-tab"
              onClick={() => setActiveTab('calendar')}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap snap-center ${activeTab === 'calendar' ? 'bg-accent/20 text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <CalendarIcon size={18} />
              Календарь
            </button>
          </Tooltip>
          <Tooltip text="Настройте свой профиль и получите персональный план от ИИ" position="bottom">
            <button
              id="tour-resume-tab"
              onClick={() => setActiveTab('resume')}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap snap-center ${activeTab === 'resume' ? 'bg-accent/20 text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <FileText size={18} />
              Резюме
            </button>
          </Tooltip>
          <Tooltip text="Общайтесь с друзьями и следите за их успехами" position="bottom">
            <button
              id="tour-friends-tab"
              onClick={() => setActiveTab('friends')}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap snap-center ${activeTab === 'friends' ? 'bg-accent/20 text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <Users size={18} />
              Друзья
            </button>
          </Tooltip>
          <Tooltip text="Организуйте команды и распределяйте задачи" position="bottom">
            <button
              id="tour-teams-tab"
              onClick={() => setActiveTab('teams')}
              className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all whitespace-nowrap snap-center ${activeTab === 'teams' ? 'bg-accent/20 text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <Shield size={18} />
              Команды
            </button>
          </Tooltip>
        </div>

        {/* Desktop Content */}
        {
          activeTab === 'resume' ? (
            <ResumeView />
          ) : activeTab === 'friends' ? (
            <FriendsView />
          ) : activeTab === 'teams' ? (
            <GroupsView />
          ) : (
            <main className="grid grid-cols-5 gap-6 flex-1 items-start">
              {/* Left Column: Content Area */}
              <div className="col-span-3 flex flex-col gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                {activeTab === 'dashboard' ? (
                  <>
                    <section className="glass-panel p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <CheckCircle size={20} className="text-accent" />
                          Цели и Привычки
                        </h2>
                        <button
                          id="tour-analysis-btn"
                          onClick={() => setShowAnalysisModal(true)}
                          className="ml-auto flex items-center gap-2 text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] hover:-translate-y-0.5"
                          title="Открыть стратегический анализ"
                        >
                          <span className="text-lg">🧠</span> Анализ плана
                        </button>
                      </div>
                      <TaskManager />
                    </section>

                    <section id="tour-rewards" className="glass-panel p-6 flex flex-col transition-all duration-300 shrink-0">
                      <div
                        className="flex justify-between items-center cursor-pointer group select-none mb-0"
                        onClick={() => setIsRewardStoreOpen(!isRewardStoreOpen)}
                      >
                        <h2 className="text-xl font-bold flex items-center gap-2 group-hover:text-warning transition-colors">
                          <Trophy size={20} className="text-warning" />
                          Магазин Наград
                        </h2>
                        <button className="text-text-secondary hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-white/10 shrink-0">
                          <ChevronDown size={20} className={`transition-transform duration-300 ${isRewardStoreOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      <div className={`collapsible-grid ${isRewardStoreOpen ? 'open' : ''}`}>
                        <div className="collapsible-content">
                          <div className="pt-6 mt-6 border-t border-white/[0.06]">
                            <RewardStore />
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <CalendarView />
                )}
              </div>

              {/* Right Column: AI Assistant (Desktop only) */}
              <div className="col-span-2 sticky top-8 self-start max-h-[calc(100vh-4rem)] flex flex-col">
                <AIAssistant />
              </div>
            </main>
          )
        }
      </div>

      <BottomNavigation />
    </div>
  );
}

export default App;

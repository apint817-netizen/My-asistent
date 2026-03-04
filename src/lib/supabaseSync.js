import { supabase, isSupabaseConfigured } from './supabase';

// Поля, которые синхронизируются с Supabase (пользовательские данные)
const SYNC_FIELDS = [
    'tokens', 'aiTokensUsed', 'streak', 'lastActiveDate',
    'tasks', 'rewards', 'pointsHistory', 'purchaseHistory',
    'chatMessages', 'analysisMessages', 'draftPlan',
    'apiKey', 'googleModel', 'aiProvider', 'proxyParams',
    'userProfile', 'calendarTasks',
    'hasCompletedOnboarding', 'hasSeenTour',
    'taskProposals', 'calendarProposals', 'rewardProposals',
    'version'
];

/**
 * Извлечь только синхронизируемые поля из стейта
 */
function extractSyncData(state) {
    const data = {};
    for (const key of SYNC_FIELDS) {
        if (state[key] !== undefined) {
            data[key] = state[key];
        }
    }
    return data;
}

/**
 * Загрузить данные пользователя из Supabase
 * @returns {Object|null} данные пользователя или null
 */
export async function loadUserData(userId) {
    if (!isSupabaseConfigured() || !userId) return null;

    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('id', userId)
            .single();

        if (error) {
            // PGRST116 = no rows found — новый пользователь
            if (error.code === 'PGRST116') {
                console.log('[Sync] New user, no data in Supabase yet');
                return null;
            }
            console.error('[Sync] Error loading user data:', error);
            return null;
        }

        console.log('[Sync] Loaded user data from Supabase');
        return data?.data || null;
    } catch (err) {
        console.error('[Sync] Unexpected error loading data:', err);
        return null;
    }
}

/**
 * Сохранить данные пользователя в Supabase (upsert)
 */
export async function saveUserData(userId, state) {
    if (!isSupabaseConfigured() || !userId) return false;

    try {
        const syncData = extractSyncData(state);

        const { error } = await supabase
            .from('user_data')
            .upsert({
                id: userId,
                data: syncData,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });

        if (error) {
            console.error('[Sync] Error saving user data:', error);
            return false;
        }

        console.log('[Sync] Saved user data to Supabase');
        return true;
    } catch (err) {
        console.error('[Sync] Unexpected error saving data:', err);
        return false;
    }
}

/**
 * Очистить localStorage для текущего пользователя
 */
export function clearLocalData() {
    // Удаляем все ключи nova-storage-*
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nova-storage')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[Sync] Cleared local storage');
}

// --- Debounce утилита ---
let saveTimeout = null;
let currentUserId = null;

/**
 * Debounced сохранение — вызывается из store subscribe
 */
export function debouncedSave(userId, getState) {
    currentUserId = userId;

    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
        if (currentUserId) {
            const state = typeof getState === 'function' ? getState() : getState;
            saveUserData(currentUserId, state);
        }
    }, 2000); // 2 секунды дебаунс
}

/**
 * Немедленное сохранение (перед выходом)
 */
export async function flushSave(userId, state) {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (userId && state) {
        await saveUserData(userId, extractSyncData(state));
    }
}

export { SYNC_FIELDS, extractSyncData };

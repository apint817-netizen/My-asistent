/**
 * Profile cache — avoids repeated Supabase queries to profiles table.
 * Uses RPC functions (SECURITY DEFINER) to bypass RLS.
 * Now with localStorage persistence for instant loading.
 */
import { supabase } from './supabase';

// In-memory cache: id -> { display_name, avatar_url, user_tag, ... }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const LOCAL_CACHE_KEY = 'nova-profile-cache';

// Load from localStorage on startup
try {
    const stored = localStorage.getItem(LOCAL_CACHE_KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        for (const [id, profile] of Object.entries(parsed)) {
            // Allow localStorage cache up to 30 min
            if (now - (profile._ts || 0) < 30 * 60 * 1000) {
                cache.set(id, profile);
            }
        }
    }
} catch { /* ignore */ }

// Persist to localStorage
function persistToLocalStorage() {
    try {
        const obj = {};
        for (const [id, profile] of cache.entries()) {
            obj[id] = profile;
        }
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(obj));
    } catch { /* quota exceeded, etc */ }
}

/**
 * Get multiple profiles by IDs. Uses RPC to bypass RLS.
 * Returns cached profiles instantly, fetches missing ones via RPC.
 */
export async function getProfilesByIds(ids) {
    if (!ids || ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)];
    const now = Date.now();
    const result = [];
    const missingIds = [];

    // Check cache first
    for (const id of uniqueIds) {
        const cached = cache.get(id);
        if (cached && (now - cached._ts) < CACHE_TTL) {
            result.push(cached);
        } else {
            missingIds.push(id);
        }
    }

    // Fetch missing from Supabase via RPC
    if (missingIds.length > 0) {
        try {
            const { data, error } = await supabase.rpc('get_profiles_by_ids', {
                profile_ids: missingIds
            });

            if (error) {
                console.error('[ProfileCache] RPC error, falling back to direct query:', error);
                // Fallback: try direct query with tight limit
                const { data: fallback } = await supabase
                    .from('profiles')
                    .select('id, display_name, avatar_url, user_tag')
                    .in('id', missingIds)
                    .limit(missingIds.length);
                if (fallback) {
                    for (const profile of fallback) {
                        profile._ts = now;
                        cache.set(profile.id, profile);
                        result.push(profile);
                    }
                    persistToLocalStorage();
                }
            } else if (data) {
                for (const profile of data) {
                    profile._ts = now;
                    cache.set(profile.id, profile);
                    result.push(profile);
                }
                persistToLocalStorage();
            }
        } catch (err) {
            console.error('[ProfileCache] Failed to fetch profiles:', err);
            // Return stale cache data if available (even expired)
            for (const id of missingIds) {
                const stale = cache.get(id);
                if (stale) result.push(stale);
            }
        }
    }

    return result;
}

/**
 * Get single profile by ID.
 */
export async function getProfileById(id) {
    if (!id) return null;
    const results = await getProfilesByIds([id]);
    return results[0] || null;
}

/**
 * Search profiles by tag. Always fetches fresh.
 */
export async function searchProfilesByTag(tag, currentUserId) {
    if (!tag || tag.length < 2) return [];

    try {
        const { data, error } = await supabase.rpc('search_profiles_by_tag', {
            search_tag: tag,
            current_user_id: currentUserId
        });

        if (error) {
            console.error('[ProfileCache] Search RPC error, falling back:', error);
            // Fallback
            const { data: fallback } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, user_tag')
                .ilike('user_tag', `%${tag}%`)
                .neq('id', currentUserId)
                .limit(20);
            return fallback || [];
        }

        return data || [];
    } catch (err) {
        console.error('[ProfileCache] Search failed:', err);
        return [];
    }
}

/**
 * Invalidate cache for specific profile.
 */
export function invalidateProfile(id) {
    cache.delete(id);
    persistToLocalStorage();
}

/**
 * Clear entire cache.
 */
export function clearProfileCache() {
    cache.clear();
    localStorage.removeItem(LOCAL_CACHE_KEY);
}

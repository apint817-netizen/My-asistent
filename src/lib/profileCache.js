/**
 * Profile cache — avoids repeated Supabase queries to profiles table.
 * Uses RPC functions (SECURITY DEFINER) to bypass RLS.
 */
import { supabase } from './supabase';

// In-memory cache: id -> { display_name, avatar_url, user_tag, ... }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
                }
            } else if (data) {
                for (const profile of data) {
                    profile._ts = now;
                    cache.set(profile.id, profile);
                    result.push(profile);
                }
            }
        } catch (err) {
            console.error('[ProfileCache] Failed to fetch profiles:', err);
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
}

/**
 * Clear entire cache.
 */
export function clearProfileCache() {
    cache.clear();
}

-- МАСТЕР-СКРИПТ ДЛЯ ОЧИСТКИ ВСЕХ ДУБЛИКАТОВ И КОНФЛИКТОВ RLS
-- Этот скрипт удалит абсолютно все перемешанные политики и создаст их "с чистого листа"

-- 1. ДИНАМИЧЕСКИ УДАЛЯЕМ ВСЕ СУЩЕСТВУЮЩИЕ ПОЛИТИКИ
-- Проходим по всем социальным таблицам и сносим старые правила, чтобы они не конфликтовали
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN (
              'profiles', 'friendships', 'groups', 
              'group_members', 'group_messages', 'group_tasks', 'message_reactions'
          )
    ) LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename); 
    END LOOP; 
END $$;

-- 2. ПЕРЕСОЗДАЕМ ФУНКЦИИ БЕЗ РЕКУРСИИ
CREATE OR REPLACE FUNCTION public.check_group_member(_group_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = _group_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.check_group_admin(_group_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = _group_id AND user_id = auth.uid() AND role IN ('admin', 'owner'));
$$;

CREATE OR REPLACE FUNCTION public.check_group_owner(_group_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = _group_id AND user_id = auth.uid() AND role = 'owner');
$$;

-- 3. СОЗДАЕМ ЧИСТЫЕ И БЕЗОПАСНЫЕ ПОЛИТИКИ (без дублей)

-- === PROFILES ===
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- === FRIENDSHIPS ===
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can update own friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- === GROUPS ===
CREATE POLICY "Users can view public groups and their own" ON public.groups FOR SELECT USING (is_private = false OR public.check_group_member(id));
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update groups" ON public.groups FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete groups" ON public.groups FOR DELETE USING (auth.uid() = creator_id);

-- === GROUP MEMBERS ===
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT USING (public.check_group_member(group_id));
CREATE POLICY "Users can join groups or be added by admins" ON public.group_members FOR INSERT WITH CHECK (
    auth.uid() = user_id OR public.check_group_admin(group_id)
);
CREATE POLICY "Owners can update roles" ON public.group_members FOR UPDATE USING (public.check_group_owner(group_id));
CREATE POLICY "Users can leave or admins can remove" ON public.group_members FOR DELETE USING (
    auth.uid() = user_id OR public.check_group_admin(group_id)
);

-- === GROUP MESSAGES ===
CREATE POLICY "Members can view messages" ON public.group_messages FOR SELECT USING (public.check_group_member(group_id));
CREATE POLICY "Members can insert messages" ON public.group_messages FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.check_group_member(group_id)
);

-- === GROUP TASKS ===
CREATE POLICY "Members can view tasks" ON public.group_tasks FOR SELECT USING (public.check_group_member(group_id));
CREATE POLICY "Members can insert tasks" ON public.group_tasks FOR INSERT WITH CHECK (public.check_group_member(group_id));
CREATE POLICY "Members can update tasks" ON public.group_tasks FOR UPDATE USING (public.check_group_member(group_id));
CREATE POLICY "Admins and creators can delete tasks" ON public.group_tasks FOR DELETE USING (
    created_by = auth.uid() OR public.check_group_admin(group_id)
);

-- === MESSAGE REACTIONS ===
CREATE POLICY "Users can see reactions in their groups" ON public.message_reactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.id = message_reactions.message_id AND public.check_group_member(gm.group_id))
);
CREATE POLICY "Users can add reactions in their groups" ON public.message_reactions FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.id = message_id AND public.check_group_member(gm.group_id))
);
CREATE POLICY "Users can delete own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

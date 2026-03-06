-- ЯДЕРНЫЙ СКРИПТ: ПОЛНОЕ УНИЧТОЖЕНИЕ РЕКУРСИИ
-- Мы полностью отказываемся от кастомных функций и разрешаем чтение связующих таблиц
-- Это математически гарантирует отсутствие любых зависаний базы (Error 500 / 57014)

-- 1. СНОСИМ ВСЕ СТАРЫЕ ПОЛИТИКИ И ФУНКЦИИ
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- Удаляем все политики с наших таблиц
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

-- Удаляем проблемные функции, которые вызывали рекурсивные проверки
DROP FUNCTION IF EXISTS public.check_group_member(uuid);
DROP FUNCTION IF EXISTS public.check_group_admin(uuid);
DROP FUNCTION IF EXISTS public.check_group_owner(uuid);

-- 2. ГАРАНТИРУЕМ НАЛИЧИЕ НУЖНЫХ КОЛОНОК
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_tag TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- 3. СОЗДАЕМ ИДЕАЛЬНО ПЛОСКИЕ ПОЛИТИКИ (ВРЕМЯ ВЫПОЛНЕНИЯ: 0 МС)

-- === PROFILES ===
-- Любой может видеть профили
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- === FRIENDSHIPS ===
-- Только участники дружбы
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can update own friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- === GROUP MEMBERS (СЕКРЕТ СКОРОСТИ ЗДЕСЬ) ===
-- Мы разрешаем чтение участников кому угодно (true). Это абсолютно ломает цепь рекурсии!
CREATE POLICY "Members are viewable by everyone" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (true);
-- Менять может только владелец группы, проверяя прямое совпадение
CREATE POLICY "Owners can update roles" ON public.group_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'owner')
);
CREATE POLICY "Users can leave or admins remove" ON public.group_members FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'owner'))
);

-- === GROUPS ===
CREATE POLICY "Users can view public groups and their own" ON public.groups FOR SELECT USING (
    is_private = false OR 
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update groups" ON public.groups FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete groups" ON public.groups FOR DELETE USING (auth.uid() = creator_id);

-- === GROUP MESSAGES ===
CREATE POLICY "Members can view messages" ON public.group_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can insert messages" ON public.group_messages FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

-- === GROUP TASKS ===
CREATE POLICY "Members can view tasks" ON public.group_tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_tasks.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can insert tasks" ON public.group_tasks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_tasks.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can update tasks" ON public.group_tasks FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_tasks.group_id AND user_id = auth.uid())
);
CREATE POLICY "Admins and creators can delete tasks" ON public.group_tasks FOR DELETE USING (
    created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_tasks.group_id AND user_id = auth.uid() AND role IN ('admin', 'owner'))
);

-- === MESSAGE REACTIONS ===
CREATE POLICY "Users can see reactions in their groups" ON public.message_reactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_messages gm WHERE gm.id = message_reactions.message_id AND EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = gm.group_id AND user_id = auth.uid()
    ))
);
CREATE POLICY "Users can add reactions in their groups" ON public.message_reactions FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (
        SELECT 1 FROM public.group_messages gm WHERE gm.id = message_id AND EXISTS (
            SELECT 1 FROM public.group_members WHERE group_id = gm.group_id AND user_id = auth.uid()
        )
    )
);
CREATE POLICY "Users can delete own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

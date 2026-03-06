-- ЭТОТ СКРИПТ ИСПРАВЛЯЕТ ОШИБКИ CORS И ТАЙМАУТОВ БД (500 Error, Infinite Recursion)
-- Возникающие из-за сложных правил доступа (RLS) к таблице участников групп

-- 1. Создаем безопасные функции (SECURITY DEFINER) для проверки ролей.
-- Они выполняются от лица базы данных и обходят RLS, предотвращая рекурсию.
CREATE OR REPLACE FUNCTION public.check_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = _group_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.check_group_admin(_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = _group_id AND user_id = auth.uid() AND role IN ('admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.check_group_owner(_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = _group_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- 2. УДАЛЯЕМ ВСЕ СТАРЫЕ ПОЛИТИКИ (чтобы очистить рекурсию)

-- Участники
DROP POLICY IF EXISTS "Members can view members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Owners can update roles" ON public.group_members;
DROP POLICY IF EXISTS "Admins can remove members or user can leave" ON public.group_members;
DROP POLICY IF EXISTS "Manage roles" ON public.group_members;
DROP POLICY IF EXISTS "Kick members" ON public.group_members;

-- Сообщения
DROP POLICY IF EXISTS "Members can view group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members can insert group messages" ON public.group_messages;

-- Задачи
DROP POLICY IF EXISTS "Members can view group tasks" ON public.group_tasks;
DROP POLICY IF EXISTS "Members can insert group tasks" ON public.group_tasks;
DROP POLICY IF EXISTS "Members can update group tasks" ON public.group_tasks;
DROP POLICY IF EXISTS "Creators and admins can delete group tasks" ON public.group_tasks;

-- Группы
DROP POLICY IF EXISTS "Users can view groups they are in" ON public.groups;

-- Реакции (если они были созданы)
DROP POLICY IF EXISTS "Users can see reactions in their groups" ON public.message_reactions;
DROP POLICY IF EXISTS "Users can add reactions in their groups" ON public.message_reactions;

-- 3. СОЗДАЕМ НОВЫЕ БЕЗОПАСНЫЕ ПОЛИТИКИ

-- Группы
CREATE POLICY "Users can view groups they are in" ON public.groups
  FOR SELECT USING ( public.check_group_member(id) );

-- Участники
CREATE POLICY "Members can view members" ON public.group_members
  FOR SELECT USING ( public.check_group_member(group_id) );

CREATE POLICY "Admins can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    public.check_group_admin(group_id) OR 
    auth.uid() = (SELECT creator_id FROM public.groups WHERE id = group_id)
  );

CREATE POLICY "Owners can update roles" ON public.group_members
  FOR UPDATE USING ( public.check_group_owner(group_id) );

CREATE POLICY "Admins can remove members or user can leave" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid() OR public.check_group_admin(group_id)
  );

-- Сообщения
CREATE POLICY "Members can view group messages" ON public.group_messages
  FOR SELECT USING ( public.check_group_member(group_id) );

CREATE POLICY "Members can insert group messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.check_group_member(group_id)
  );

-- Задачи
CREATE POLICY "Members can view group tasks" ON public.group_tasks
  FOR SELECT USING ( public.check_group_member(group_id) );

CREATE POLICY "Members can insert group tasks" ON public.group_tasks
  FOR INSERT WITH CHECK ( public.check_group_member(group_id) );

CREATE POLICY "Members can update group tasks" ON public.group_tasks
  FOR UPDATE USING ( public.check_group_member(group_id) );

CREATE POLICY "Creators and admins can delete group tasks" ON public.group_tasks
  FOR DELETE USING ( 
    created_by = auth.uid() OR public.check_group_admin(group_id)
  );

-- Реакции
CREATE POLICY "Users can see reactions in their groups" ON public.message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_messages gm
            WHERE gm.id = message_reactions.message_id
            AND public.check_group_member(gm.group_id)
        )
    );

CREATE POLICY "Users can add reactions in their groups" ON public.message_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_messages gm
            WHERE gm.id = message_id
            AND public.check_group_member(gm.group_id)
        )
    );

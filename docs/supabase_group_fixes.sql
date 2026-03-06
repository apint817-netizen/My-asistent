-- Этот скрипт нужно выполнить в Supabase SQL Editor для исправления прав управления участниками и группами.

-- 1. Политика для изменения ролей участников (UPDATE).
-- Кто может обновлять роли? Только если этот человек сам owner или admin в этой группе.
CREATE POLICY "Manage roles" ON public.group_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('admin', 'owner')
  )
);

-- 2. Политика для удаления участников из команды (DELETE).
-- Кто может удалять? Сам участник (выход) ИЛИ owner/admin.
CREATE POLICY "Kick members" ON public.group_members
FOR DELETE USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('admin', 'owner')
  )
);

-- 3. Политика для удаления самой группы (DELETE).
-- Кто может удалить? Только создатель группы. (group_members удалятся сами благодаря ON DELETE CASCADE)
CREATE POLICY "Delete group" ON public.groups
FOR DELETE USING (auth.uid() = creator_id);

-- 4. Добавление колонки due_date в group_tasks для Календаря Команд
ALTER TABLE public.group_tasks ADD COLUMN IF NOT EXISTS due_date DATE;

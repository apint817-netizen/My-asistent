# Настройка таблицы Задач Команды

Скопируйте весь SQL-код ниже, зайдите в Supabase -> **SQL Editor** -> **New query**, вставьте код и нажмите **RUN**.
Это создаст таблицу `group_tasks`, настроит политики доступа (RLS) и включит Realtime.

```sql
-- 1. Таблица групповых задач
CREATE TABLE public.group_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  value INTEGER DEFAULT 10,
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;

-- ======== ПОЛИТИКИ ДЛЯ GROUP_TASKS ========

-- Члены группы могут видеть задачи группы
CREATE POLICY "Members can view group tasks" ON public.group_tasks
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Члены группы могут создавать задачи (или только админы/оунеры - пока сделаем всем)
CREATE POLICY "Members can insert group tasks" ON public.group_tasks
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Члены группы могут обновлять (отмечать выполненными) задачи
CREATE POLICY "Members can update group tasks" ON public.group_tasks
  FOR UPDATE USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Только создатель задачи, или админы/оунеры группы могут удалять задачи
CREATE POLICY "Creators and admins can delete group tasks" ON public.group_tasks
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = group_tasks.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Включаем Realtime для таблицы group_tasks
alter publication supabase_realtime add table public.group_tasks;
```

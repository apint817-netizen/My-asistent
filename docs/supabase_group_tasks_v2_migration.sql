-- Обновление таблицы group_tasks для продвинутых опций
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- 1. Добавляем новые колонки
ALTER TABLE public.group_tasks
ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'points' CHECK (reward_type IN ('points', 'money', 'duty')),
ADD COLUMN IF NOT EXISTS reward_amount bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'normal' CHECK (category IN ('normal', 'urgent', 'important', 'urgent_important'));

-- Примечание: Мы сохраняем старую колонку 'value' для обратной совместимости, 
-- но в новом коде можно использовать reward_amount для большей ясности,
-- либо продолжать использовать 'value' для очков, а 'reward_amount' для денег.
-- Если reward_type = 'money', то reward_amount это зарплата, если 'points', это очки, если 'duty', то 0.

-- 2. Обновляем существующие RLS политики, если требуется.
-- Текущие политики разрешают доступ (чтение/запись) всем членам группы.
-- Для `assigned_to` нужно убедиться, что только assigned_user или admin/owner могут отмечать задачу как выполненную.
-- Создаем новую политику для обновления статуса завершения:

-- Сначала удаляем старую политику обновления, если она слишком общая
-- Обеспечьте безопасность, убедившись, что у вас есть бэкап или вы понимаете текущие политики.
-- DROP POLICY IF EXISTS "Group members can update group tasks" ON public.group_tasks;

-- Новая, более строгая политика обновления:
-- Пользователь может обновить задачу, если он:
-- 1. Член этой группы И
-- 2. (Он является admin/owner этой группы ИЛИ он assigned_to этой задачи ИЛИ assigned_to IS NULL)

CREATE OR REPLACE FUNCTION public.check_task_update_permission(task_group_id uuid, task_assigned_to uuid, requesting_user_id uuid)
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role 
    FROM public.group_members 
    WHERE group_id = task_group_id AND user_id = requesting_user_id;

    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    IF user_role IN ('owner', 'admin') THEN
        RETURN true;
    END IF;

    IF task_assigned_to IS NULL OR task_assigned_to = requesting_user_id THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Убедитесь, что политика на Обновление (UPDATE) использует эту функцию
-- Для этого вам может понадобиться пересоздать политику UPDATE на group_tasks:
-- DROP POLICY IF EXISTS "Group members can update group tasks" ON public.group_tasks;
-- CREATE POLICY "Update group tasks permission" ON public.group_tasks
--     FOR UPDATE
--     USING (check_task_update_permission(group_id, assigned_to, auth.uid()));

-- Не забудьте обновить кэш схемы в вашем Data API, если это необходимо.

-- Выполните этот скрипт в разделе SQL Editor в Supabase

-- 1. Добавляем нужные поля для продвинутых задач
ALTER TABLE public.group_tasks
ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'points',
ADD COLUMN IF NOT EXISTS reward_amount int DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS category text DEFAULT 'normal';

-- 2. Мигрируем старые данные ценности задач в новую колонку reward_amount
UPDATE public.group_tasks SET reward_amount = value WHERE reward_amount = 0;

-- 3. Добавляем таблицу для реакций в чате (Этап 4)
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid REFERENCES public.group_messages(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(message_id, user_id, emoji)
);

-- Настраиваем RLS для реакций
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see reactions in their groups" ON public.message_reactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.group_messages gm
            JOIN public.group_members m ON gm.group_id = m.group_id
            WHERE gm.id = message_reactions.message_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add reactions in their groups" ON public.message_reactions
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.group_messages gm
            JOIN public.group_members m ON gm.group_id = m.group_id
            WHERE gm.id = message_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove their own reactions" ON public.message_reactions
    FOR DELETE
    USING (auth.uid() = user_id);

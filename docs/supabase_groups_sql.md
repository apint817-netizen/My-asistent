# Настройка таблиц для Групп (Команд)

Скопируйте весь SQL-код ниже, зайдите в Supabase -> **SQL Editor** -> **New query**, вставьте код и нажмите **RUN**.
Это создаст нужные таблицы (`groups`, `group_members`, `group_messages`) и пропишет безопасные политики доступа (RLS).

```sql
-- 1. Таблица групп
CREATE TABLE public.groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  creator_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Таблица участников групп (с ролями)
CREATE TABLE public.group_members (
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- 3. Таблица групповых сообщений
CREATE TABLE public.group_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- ======== ПОЛИТИКИ ДЛЯ GROUPS ========

-- Любой авторизованный пользователь может создавать группы
CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Пользователи могут видеть группы, в которых состоят
CREATE POLICY "Users can view their groups" ON public.groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Только создатель (или админы) могут обновлять группу
CREATE POLICY "Owners and admins can update groups" ON public.groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Создатель может удалять группу
CREATE POLICY "Owners can delete groups" ON public.groups
  FOR DELETE USING (auth.uid() = creator_id);

-- ======== ПОЛИТИКИ ДЛЯ GROUP_MEMBERS ========

-- Члены группы могут видеть других членов
CREATE POLICY "Members can view members" ON public.group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Оунеры и админы могут добавлять участников
CREATE POLICY "Admins can add members" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.uid() = (SELECT creator_id FROM public.groups WHERE id = group_members.group_id) -- fallback для создателя при создании группы
  );

-- Оунеры могут изменять роли
CREATE POLICY "Owners can update roles" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Оунеры и админы могут удалять участников (плюс участник может выйти сам)
CREATE POLICY "Admins can remove members or user can leave" ON public.group_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ======== ПОЛИТИКИ ДЛЯ GROUP_MESSAGES ========

-- Члены могут читать сообщения
CREATE POLICY "Members can view group messages" ON public.group_messages
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Члены могут писать сообщения
CREATE POLICY "Members can insert group messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

-- Включаем Realtime для сообщений группы
begin;
  -- Удаляем publication если он уже был создан для других таблиц и пересоздаем
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.group_messages;
```

### Действие 2: Подписание на изменения `group_messages`
Если последние 4 строчки (настройка `supabase_realtime`) выдадут ошибку, значит у вас уже настроен Realtime. 
Чтобы 100% включить Realtime для групповых чатов, зайдите в Supabase:
**Database** -> **Replication** -> **supabase_realtime** (кликнуть "1 tables" или "0 tables") -> поставить галочку возле таблицы `group_messages`.

-- 1. Таблица профилей (связывается с auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  display_name text,
  avatar_url text,
  bio text,
  level integer default 1,
  total_points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) для profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Функция-триггер для автоматического создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Сам триггер (ВНИМАНИЕ: Если триггер уже существует, строка ниже выдаст ошибку, это нормально. Можно просто пропустить)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Таблица дружбы (friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id1 uuid references public.profiles(id) not null,
  user_id2 uuid references public.profiles(id) not null,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  action_user_id uuid references public.profiles(id) not null, -- тот, кто отправил запрос или заблокировал
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(user_id1, user_id2)
);

-- RLS для friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING ( auth.uid() = user_id1 OR auth.uid() = user_id2 );

CREATE POLICY "Users can insert friendships involving themselves"
  ON public.friendships FOR INSERT
  WITH CHECK ( auth.uid() = user_id1 OR auth.uid() = user_id2 );

CREATE POLICY "Users can update their own friendships"
  ON public.friendships FOR UPDATE
  USING ( auth.uid() = user_id1 OR auth.uid() = user_id2 );

CREATE POLICY "Users can delete their own friendships"
  ON public.friendships FOR DELETE
  USING ( auth.uid() = user_id1 OR auth.uid() = user_id2 );


-- 3. Сообщения для P2P чатов (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id),
  group_id uuid, -- для будущих групповых чатов (может быть null)
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS для chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.chat_messages FOR SELECT
  USING ( auth.uid() = sender_id OR auth.uid() = receiver_id );

CREATE POLICY "Users can insert messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK ( auth.uid() = sender_id );


-- 4. Группы/Субботники (groups)
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  avatar_url text,
  creator_id uuid references public.profiles(id) not null,
  is_private boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public groups are viewable by everyone"
  ON public.groups FOR SELECT
  USING ( is_private = false OR auth.uid() = creator_id );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

CREATE POLICY "Creator can update group"
  ON public.groups FOR UPDATE
  USING ( auth.uid() = creator_id );


-- 5. Участники групп (group_members)
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('admin', 'moderator', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(group_id, user_id)
);

-- RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members are viewable by everyone"
  ON public.group_members FOR SELECT
  USING ( true );

CREATE POLICY "Users can join public groups or get invited"
  ON public.group_members FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

CREATE POLICY "Users can leave groups"
  ON public.group_members FOR DELETE
  USING ( auth.uid() = user_id );

-- Enable Realtime (очень важно для чата!)
-- Запустите этот запрос, если Realtime не включен автоматически
-- alter publication supabase_realtime add table chat_messages;
-- alter publication supabase_realtime add table friendships;

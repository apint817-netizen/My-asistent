-- Добавление недостающих колонок для таблицы profiles, которые запрашивает фронтенд

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_tag TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS online_at TIMESTAMPTZ DEFAULT now();

-- Комментарии к колонкам для самодокументации
COMMENT ON COLUMN public.profiles.is_online IS 'Индикатор онлайна пользователя';
COMMENT ON COLUMN public.profiles.user_tag IS 'Уникальный тег пользователя (например, для поиска)';
COMMENT ON COLUMN public.profiles.online_at IS 'Время последней активности (для статуса Был недавно в сети)';

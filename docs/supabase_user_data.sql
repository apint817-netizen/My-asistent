-- ================================================
-- Nova Assistant: Supabase Setup Script
-- Выполните этот SQL в Supabase Dashboard → SQL Editor
-- ================================================

-- Таблица для хранения данных пользователей
CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: каждый пользователь видит только СВОИ данные
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON user_data
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid() = id);

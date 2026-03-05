# Настройка авторизации через социальные сети в Supabase

Чтобы кнопка входа через Google заработала, вам необходимо включить провайдер в панели управления Supabase и настроить Google Cloud Platform.

## Шаг 1: Настройка в Google Cloud
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/).
2. Создайте новый проект или выберите существующий.
3. В меню слева перейдите в **APIs & Services** -> **OAuth consent screen** (Окно доступа OAuth).
   - Выберите тип пользователя **External** (Внешний) и нажмите Create.
   - Заполните обязательные поля: App name (например, "Ассистент Nova"), User support email и Developer contact information. Нажмите **Save and Continue**.
4. Перейдите в **APIs & Services** -> **Credentials** (Учетные данные).
5. Нажмите **Create Credentials** -> **OAuth client ID**.
6. Выберите Application type: **Web application**.
7. В поле **Name** введите название.
8. В секции **Authorized JavaScript origins** добавьте ваш домен (или `http://localhost:5173` для локальной разработки).
9. Откройте новую вкладку с панелью **Supabase -> Authentication -> Providers -> Google**. Скопируйте оттуда `Callback URL (for OAuth)`.
10. Вернитесь в Google Cloud. В секции **Authorized redirect URIs** вставьте скопированный Callback URL.
11. Нажмите **Create**. Выведется окно с вашими `Client ID` и `Client Secret`. Скопируйте их.

## Шаг 2: Связь Google и Supabase
1. Вернитесь в панель **Supabase -> Authentication -> Providers -> Google**.
2. Включите ползунок **Enable Google provider**.
3. Вставьте скопированный из Google Cloud `Client ID` в поле **Client ID**.
4. Вставьте `Client Secret` в поле **Client Secret**.
5. Нажмите **Save**.

Готово! Авторизация через Google настроена.

## Шаг 3: Настройка Email Шаблона (для входа по паролю и Magic Link)
1. В панели **Supabase -> Authentication -> Email Templates**.
2. Раскройте секцию **Confirm signup**.
3. Замените весь HTML код в редакторе на код из файла `supabase_email_template.html`, который я для вас сгенерировал.
4. По желанию повторите это для **Magic Link** и **Reset Password**.
5. Нажмите **Save**.

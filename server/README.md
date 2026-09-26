# MeshVoice Server

Единый бэкенд приложения: аккаунты, друзья, личные/групповые чаты (REST + socket.io)
и сигналинг голосовых комнат INTERNET CALL. База — SQLite-файл `meshvoice.db` рядом
с сервером (для бэкапа достаточно скопировать файл).

## Требования

- Node.js **22.5+** (используется встроенный `node:sqlite`, ничего компилировать не нужно)

## Запуск

```bash
cd server
npm install
npm run build
npm start          # порт 3000
```

Переменные окружения (необязательные):

| Переменная   | Назначение                                   | По умолчанию            |
|--------------|----------------------------------------------|-------------------------|
| `PORT`       | Порт сервера                                 | `3000`                  |
| `JWT_SECRET` | Секрет токенов                               | генерируется в `.jwt-secret` |
| `DB_PATH`    | Путь к файлу базы                            | `server/meshvoice.db`   |

После запуска в приложении во вкладке **PROFILE** укажите адрес сервера,
например `http://ВАШ_IP:3000`.

## Деплой в Docker (рекомендуется — сервер всегда в доступе)

Самый простой способ держать бэкенд онлайн 24/7: контейнер с
`restart: unless-stopped` (сам поднимается после падения и ребута) и
персистентными томами для БД и загрузок. Файлы уже в репозитории:
`server/Dockerfile`, `docker-compose.yml` (в корне), `server/Caddyfile`,
`.env.example`.

**Что переживает пересборку образа** (лежит в именованных Docker-томах):
`mv-data` → `meshvoice.db`, `mv-uploads` → каталог `uploads/`.
`JWT_SECRET` задаётся через `.env` (стабилен, не теряется).

### 1. Настройка

```bash
cp .env.example .env          # в корне репозитория
# впишите JWT_SECRET (openssl rand -hex 32), а для https ещё DOMAIN
```

### 2а. Запуск (HTTP — для отладки или за внешним прокси)

```bash
docker compose up -d --build         # слушает :3000
docker compose logs -f server        # логи
```

### 2б. Запуск с автоматическим HTTPS (нужно для release Android/iOS)

Заведите домен (например DuckDNS-поддомен) с A-записью на IP сервера,
впишите его в `DOMAIN` в `.env`, затем:

```bash
docker compose --profile https up -d --build
```

Поднимутся два контейнера: `meshvoice-server` и `meshvoice-caddy`. Caddy сам
выпустит и продлит сертификат Let's Encrypt и проксирует `443 → server:3000`.
В облаке/файрволе откройте порты **80 и 443** (для Oracle — ещё iptables, см.
ниже). В приложении в `lib/config.ts` пропишите `https://ваш-домен`.

### Обновление кода

```bash
git pull
docker compose up -d --build         # (--profile https, если с Caddy)
```

Данные в томах сохраняются. Бэкап: `docker run --rm -v moto-voice-chat_mv-data:/d
-v "$PWD":/b alpine tar czf /b/db-backup.tgz -C /d .` (аналогично для `mv-uploads`).

## Развёртывание на Oracle Cloud (Always Free)

Бесплатный VPS 24/7. Порядок:

1. **Регистрация**: https://signup.oraclecloud.com — нужна зарубежная карта
   (только проверка, списаний нет). Home Region выбирайте ближайший к
   пользователям (например Germany Central — Frankfurt) — Always Free
   ресурсы привязаны к нему навсегда.
2. **Создать VM**: Compute → Instances → Create. Image: Ubuntu 24.04.
   Shape: `VM.Standard.A1.Flex` (ARM, до 4 CPU / 24 ГБ — бесплатно; если
   «Out of capacity», пробуйте позже или shape `VM.Standard.E2.1.Micro`).
   Скачайте приватный SSH-ключ при создании.
3. **Открыть порты в облаке**: Instance → Subnet → Security List →
   Add Ingress Rules: TCP 80 и 443 (source 0.0.0.0/0).
4. **На самой VM** (Ubuntu-образы Oracle режут порты ещё и iptables):

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Node 22 + сервер
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo git clone https://github.com/arcwagner1337/moto-voice-chat.git /opt/moto-voice-chat
cd /opt/moto-voice-chat/server && sudo npm install && sudo npm run build
```

5. **HTTPS через Caddy + DuckDNS** (обязательно: release-сборки Android и
   iOS блокируют обычный http):
   - https://www.duckdns.org — бесплатный поддомен, укажите IP вашей VM.
   - На VM: `sudo apt-get install -y caddy`, в `/etc/caddy/Caddyfile`:

```
ваш-домен.duckdns.org {
    reverse_proxy localhost:3000
}
```

   - `sudo systemctl restart caddy` — сертификат выпустится сам.
6. Включить systemd-юнит из раздела ниже и прописать
   `https://ваш-домен.duckdns.org` в `BACKEND_URL` (`lib/config.ts`).

## Автозапуск через systemd (на своём сервере)

`/etc/systemd/system/meshvoice.service`:

```ini
[Unit]
Description=MeshVoice server
After=network.target

[Service]
WorkingDirectory=/opt/moto-voice-chat/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now meshvoice
```

## API кратко

- `POST /api/register`, `POST /api/login` → `{token, user}`
- `GET/PUT /api/me`
- `GET /api/users/search?q=`
- `GET /api/friends`, `POST /api/friends/request`, `POST /api/friends/respond`, `DELETE /api/friends/:userId`
- `GET /api/chats`, `POST /api/chats/dm`, `POST /api/chats/group`
- `POST /api/chats/:id/members` (добавить друзей в группу), `POST /api/chats/:id/call` (позвать в голосовую комнату)
- `GET/POST /api/chats/:id/messages`, `POST /api/chats/:id/read`
- `POST /api/location` (позиция; фоновый трекинг шлёт сюда), `GET /api/locations` (друзья)
- `POST /api/rides` (создать заезд), `GET /api/rides/active`, `GET /api/rides/:id` (лидерборд),
  `POST /api/rides/:id/join|track|finish`, `DELETE /api/rides/:id` (track/finish/delete — только организатор)

Статистика заездов (дистанция, макс/средняя скорость, чекпоинты трассы)
считается сервером по входящим позициям — клиенту достаточно слать координаты.

Realtime-события (socket.io, auth: `{token}`): `chat:new`, `chats:update`,
`friends:update`, `friend:request`, `friend:accepted`, `call:incoming`,
`rides:update`, `loc:friend`, `loc:friend-stop`; клиент шлёт
`loc:update`/`loc:stop`. Анонимные подключения работают как раньше — только
голосовой сигналинг (`join-room`, `signal`, `chat`).

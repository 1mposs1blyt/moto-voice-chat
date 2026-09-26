// Единый общий бэкенд MeshVoice (аккаунты, чаты, карта, сигналинг INTERNET CALL).
// Пользователь этот адрес не меняет. При переезде сервера меняется только эта
// константа — это JS-код, нативная пересборка APK/IPA не требуется.
//
// Прод: Docker-контейнер meshvoice-server (:3000) за общим nginx-прокси
// (global-reverse-proxy, сеть proxy-network), HTTPS через Let's Encrypt.
// Деплой: docker-compose.yml в корне + server/Dockerfile; nginx-блок для
// mesh-voice.duckdns.org в config/nginx.conf прокси. Домен на DuckDNS.
export const BACKEND_URL = 'https://mesh-voice.duckdns.org';

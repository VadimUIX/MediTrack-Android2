# Сборка APK через GitHub

1. Создай репозиторий на GitHub и залей в него содержимое этой папки (с папками `.github` и `android`).
2. Открой вкладку **Actions** → **Build Android APK** → **Run workflow**
   (сборка также стартует сама при push в `main`/`master`).
3. Когда сборка зелёная (3–6 минут), открой запуск и внизу в **Artifacts**
   скачай `meditrack-debug-apk` → внутри `app-debug.apk`.
4. Установи на телефон (разреши «Установку из неизвестных источников»).

Локально: `npm ci && npm run cap:sync && cd android && ./gradlew assembleDebug`

Идентификатор приложения: `app.meditrack.diary` (меняется в `capacitor.config.ts`
и `android/app/build.gradle`).

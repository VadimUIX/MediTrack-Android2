# MediTrack Android

Android-версия MediTrack на React + Capacitor. Интерфейс и бизнес-логика находятся в `src/`, нативная Android-оболочка в `android/`.

## Сборка APK через GitHub Actions

1. Открой вкладку **Actions**.
2. Выбери **Build Android APK** и нажми **Run workflow**. Сборка также запускается автоматически при push и pull request в `main` или `master`.
3. Дождись успешного завершения workflow.
4. В разделе **Artifacts** скачай `meditrack-debug-apk`.
5. Распакуй архив и установи `app-debug.apk` на Android.

## Локальная сборка

Требуются Node.js 22, JDK 21 и Android SDK с платформой Android 35.

```bash
npm ci
npm run build:mobile
npx cap sync android
cd android
./gradlew assembleDebug
```

APK появится в `android/app/build/outputs/apk/debug/app-debug.apk`.

## Параметры Android

- Application ID: `app.meditrack.diary`
- Минимальная версия: Android 8.0 (API 26)
- Compile SDK / Target SDK: 35
- Web assets: `dist/client`

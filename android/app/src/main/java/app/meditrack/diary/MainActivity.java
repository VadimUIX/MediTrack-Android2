package app.meditrack.diary;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        createDoseChannels();
        registerPlugin(PdfExportPlugin.class);
        registerPlugin(DoseNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new Event(\u0027meditrack:android-back\u0027))", null);
                }
            }
        });
    }

    private void createDoseChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        createChannel(manager, "meditrack_dose_sound_vibrate_v3", true, true);
        createChannel(manager, "meditrack_dose_sound_v3", true, false);
        createChannel(manager, "meditrack_dose_vibrate_v3", false, true);
        createChannel(manager, "meditrack_dose_silent_v3", false, false);
    }

    private void createChannel(NotificationManager manager, String id, boolean sound, boolean vibration) {
        if (manager.getNotificationChannel(id) != null) return;
        NotificationChannel channel = new NotificationChannel(id, "Напоминания о приёме лекарств", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Напоминания MediTrack о времени приёма препаратов");
        channel.enableVibration(vibration);
        if (sound) {
            channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
        } else {
            channel.setSound(null, null);
        }
        manager.createNotificationChannel(channel);
    }
}

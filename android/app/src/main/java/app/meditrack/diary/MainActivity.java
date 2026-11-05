package app.meditrack.diary;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String DOSE_CHANNEL_ID = "meditrack_dose_alerts_v2";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        createDoseNotificationChannel();
        super.onCreate(savedInstanceState);
    }

    private void createDoseNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (manager.getNotificationChannel(DOSE_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            DOSE_CHANNEL_ID,
            "Напоминания о приёме лекарств",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Звуковые напоминания о времени приёма препаратов");
        channel.enableVibration(true);
        channel.setSound(
            Settings.System.DEFAULT_NOTIFICATION_URI,
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        manager.createNotificationChannel(channel);
    }
}

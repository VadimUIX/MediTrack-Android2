package app.meditrack.diary

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

class DoseAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 0)
        if (id == 0) return
        DoseNotificationManager.onAlarmDelivered(context, id)
        val record = JSONObject().apply {
            put("id", id)
            put("doseKey", intent.getStringExtra("doseKey") ?: "")
            put("title", intent.getStringExtra("title") ?: "Пора принять")
            put("body", intent.getStringExtra("body") ?: "")
            put("channelId", intent.getStringExtra("channelId") ?: "meditrack_dose_sound_vibrate_v3")
            put("medicationId", intent.getStringExtra("medicationId") ?: "")
            put("profileId", intent.getStringExtra("profileId") ?: "")
            put("date", intent.getStringExtra("date") ?: "")
            put("time", intent.getStringExtra("time") ?: "")
            put("scheduledTime", intent.getStringExtra("scheduledTime") ?: "")
        }
        DoseNotificationManager.showDoseNotification(context, record)
    }
}

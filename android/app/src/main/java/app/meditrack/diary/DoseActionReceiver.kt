package app.meditrack.diary

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.util.UUID

class DoseActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val actionId = intent.getStringExtra("actionId") ?: return
        if (actionId != "taken" && actionId != "snooze") return
        val notificationId = intent.getIntExtra("notificationId", 0)
        val doseKey = intent.getStringExtra("doseKey") ?: return
        if (notificationId != 0) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.cancel(notificationId)
        }

        DoseNotificationManager.cancelDose(context, doseKey)

        val now = System.currentTimeMillis()
        val event = JSONObject().apply {
            put("eventId", UUID.randomUUID().toString())
            put("actionId", actionId)
            put("medicationId", intent.getStringExtra("medicationId") ?: "")
            put("profileId", intent.getStringExtra("profileId") ?: "")
            put("date", intent.getStringExtra("date") ?: "")
            put("time", intent.getStringExtra("time") ?: "")
            put("scheduledTime", intent.getStringExtra("scheduledTime") ?: "")
            put("actedAt", now)
        }

        if (actionId == "snooze") {
            val source = JSONObject().apply {
                put("id", notificationId)
                put("doseKey", doseKey)
                put("title", intent.getStringExtra("title") ?: "Пора принять")
                put("body", intent.getStringExtra("body") ?: "")
                put("channelId", intent.getStringExtra("channelId") ?: "meditrack_dose_sound_vibrate_v3")
                put("medicationId", intent.getStringExtra("medicationId") ?: "")
                put("profileId", intent.getStringExtra("profileId") ?: "")
                put("date", intent.getStringExtra("date") ?: "")
                put("time", intent.getStringExtra("time") ?: "")
                put("scheduledTime", intent.getStringExtra("scheduledTime") ?: "")
            }
            val snoozeUntil = DoseNotificationManager.scheduleSnooze(context, source)
            event.put("snoozeUntil", snoozeUntil)
        }

        DoseNotificationManager.appendAction(context, event)
    }
}

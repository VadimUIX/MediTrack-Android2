package app.meditrack.diary

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DoseAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 0)
        if (id == 0) return

        // Reject alarms that no longer belong to the current MediTrack schedule.
        // Use the persisted record, not stale text/extras carried by the broadcast.
        val expectedDoseKey = intent.getStringExtra("doseKey")
        val record = DoseNotificationManager.consumeScheduledAlarm(context, id, expectedDoseKey)
        if (record == null) {
            DoseNotificationManager.discardStaleAlarm(context, id)
            return
        }

        DoseNotificationManager.showDoseNotification(context, record)
    }
}

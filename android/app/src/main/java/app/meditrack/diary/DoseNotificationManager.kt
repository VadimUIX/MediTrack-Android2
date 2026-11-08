package app.meditrack.diary

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

object DoseNotificationManager {
    private const val PREFS = "meditrack_native_dose_notifications"
    private const val KEY_SCHEDULED = "scheduled"
    private const val KEY_ACTIVE = "active_notifications"
    private const val KEY_ACTIONS = "actions"
    private const val KEY_SNOOZE_MIN = "snooze_min"
    private const val KEY_TAKEN_LABEL = "taken_label"
    private const val KEY_SNOOZE_LABEL = "snooze_label"
    private const val ALARM_ACTION = "app.meditrack.diary.DOSE_ALARM"
    private const val ACTION_TAKEN = "taken"
    private const val ACTION_SNOOZE = "snooze"

    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return manager.canScheduleExactAlarms()
    }

    @Synchronized
    fun scheduleAll(
        context: Context,
        notifications: JSONArray,
        snoozeMin: Int,
        takenLabel: String,
        snoozeLabel: String
    ): Int {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous = readScheduled(context)
        previous.forEach { cancelAlarm(context, it.optInt("id")) }
        val nextDoseKeys = (0 until notifications.length())
            .mapNotNull { notifications.optJSONObject(it)?.optString("doseKey") }
            .toSet()
        val active = readActive(context)
        val retainedActive = active.filter { record ->
            if (nextDoseKeys.contains(record.optString("doseKey"))) true
            else {
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(record.optInt("id"))
                false
            }
        }
        writeActive(context, retainedActive)

        prefs.edit()
            .putString(KEY_SCHEDULED, notifications.toString())
            .putInt(KEY_SNOOZE_MIN, snoozeMin.coerceIn(5, 30))
            .putString(KEY_TAKEN_LABEL, takenLabel)
            .putString(KEY_SNOOZE_LABEL, snoozeLabel)
            .apply()

        if (!canScheduleExactAlarms(context)) return 0

        var count = 0
        val now = System.currentTimeMillis()
        for (i in 0 until notifications.length()) {
            val item = notifications.optJSONObject(i) ?: continue
            if (item.optLong("at") <= now) continue
            scheduleAlarm(context, item)
            count++
        }
        return count
    }

    @Synchronized
    fun rescheduleSaved(context: Context) {
        if (!canScheduleExactAlarms(context)) return
        val now = System.currentTimeMillis()
        readScheduled(context).forEach { item ->
            if (item.optLong("at") > now) scheduleAlarm(context, item)
        }
    }

    private fun readScheduled(context: Context): List<JSONObject> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SCHEDULED, "[]") ?: "[]"
        val array = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    private fun writeScheduled(context: Context, records: List<JSONObject>) {
        val array = JSONArray()
        records.forEach { array.put(it) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SCHEDULED, array.toString()).apply()
    }

    private fun readActive(context: Context): List<JSONObject> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ACTIVE, "[]") ?: "[]"
        val array = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
        return (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }

    private fun writeActive(context: Context, records: List<JSONObject>) {
        val array = JSONArray()
        records.forEach { array.put(it) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_ACTIVE, array.toString()).apply()
    }

    private fun alarmPendingIntent(context: Context, record: JSONObject): PendingIntent {
        val id = record.optInt("id")
        val intent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = ALARM_ACTION
            data = Uri.parse("meditrack://dose-alarm/$id")
            putExtra("id", id)
            putExtra("doseKey", record.optString("doseKey"))
            putExtra("title", record.optString("title"))
            putExtra("body", record.optString("body"))
            putExtra("channelId", record.optString("channelId"))
            putExtra("medicationId", record.optString("medicationId"))
            putExtra("profileId", record.optString("profileId"))
            putExtra("date", record.optString("date"))
            putExtra("time", record.optString("time"))
            putExtra("scheduledTime", record.optString("scheduledTime"))
        }
        return PendingIntent.getBroadcast(
            context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun scheduleAlarm(context: Context, record: JSONObject) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = alarmPendingIntent(context, record)
        try {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                record.optLong("at"),
                pendingIntent
            )
        } catch (_: SecurityException) {
            // Exact-alarm access may have been revoked between the permission check and scheduling.
        }
    }

    private fun cancelAlarm(context: Context, id: Int) {
        if (id == 0) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, DoseAlarmReceiver::class.java).apply {
            action = ALARM_ACTION
            data = Uri.parse("meditrack://dose-alarm/$id")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, id, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    /**
     * Atomically accepts an alarm only while its ID and dose key are still present
     * in the current schedule. AlarmManager can retain a PendingIntent after the
     * app's data changes, so the broadcast payload alone is never trusted.
     */
    @Synchronized
    fun consumeScheduledAlarm(context: Context, id: Int, expectedDoseKey: String?): JSONObject? {
        val scheduled = readScheduled(context)
        val delivered = scheduled.firstOrNull { it.optInt("id") == id }
        if (delivered == null || expectedDoseKey.isNullOrBlank() ||
            delivered.optString("doseKey") != expectedDoseKey
        ) {
            return null
        }

        writeScheduled(context, scheduled.filter { it.optInt("id") != id })
        val active = readActive(context).filter { it.optInt("id") != id } + delivered
        writeActive(context, active)
        return JSONObject(delivered.toString())
    }

    @Synchronized
    fun discardStaleAlarm(context: Context, id: Int) {
        if (id == 0) return
        cancelAlarm(context, id)
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(id)
    }

    @Synchronized
    fun cancelDose(context: Context, doseKey: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val remaining = readScheduled(context).filter { record ->
            if (record.optString("doseKey") == doseKey) {
                cancelAlarm(context, record.optInt("id"))
                notificationManager.cancel(record.optInt("id"))
                false
            } else true
        }
        writeScheduled(context, remaining)
        val activeRemaining = readActive(context).filter { record ->
            if (record.optString("doseKey") == doseKey) {
                notificationManager.cancel(record.optInt("id"))
                false
            } else true
        }
        writeActive(context, activeRemaining)
    }

    @Synchronized
    fun scheduleSnooze(context: Context, source: JSONObject): Long {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val minutes = prefs.getInt(KEY_SNOOZE_MIN, 15).coerceIn(5, 30)
        val at = System.currentTimeMillis() + minutes * 60_000L
        val doseKey = source.optString("doseKey")
        val id = positiveId("$doseKey|snooze|$at")
        val record = JSONObject().apply {
            put("id", id)
            put("at", at)
            put("doseKey", doseKey)
            put("title", source.optString("title"))
            put("body", source.optString("body"))
            put("channelId", source.optString("channelId"))
            put("medicationId", source.optString("medicationId"))
            put("profileId", source.optString("profileId"))
            put("date", source.optString("date"))
            put("time", source.optString("time"))
            put("scheduledTime", source.optString("scheduledTime"))
        }
        if (canScheduleExactAlarms(context)) {
            val updated = readScheduled(context).filter { it.optString("doseKey") != doseKey } + record
            writeScheduled(context, updated)
            scheduleAlarm(context, record)
        }
        return at
    }

    private fun positiveId(value: String): Int {
        var hash = 7
        value.forEach { hash = hash * 31 + it.code }
        return (hash and 0x7fffffff).coerceAtLeast(1)
    }

    fun showDoseNotification(context: Context, record: JSONObject) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return

        val id = record.optInt("id")
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context, id, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, record.optString("channelId", "meditrack_dose_sound_vibrate_v3"))
        } else {
            Notification.Builder(context)
        }
        builder.setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(record.optString("title"))
            .setContentText(record.optString("body"))
            .setStyle(Notification.BigTextStyle().bigText(record.optString("body")))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setShowWhen(true)

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val takenLabel = prefs.getString(KEY_TAKEN_LABEL, "Принято") ?: "Принято"
        val snoozeLabel = prefs.getString(KEY_SNOOZE_LABEL, "Отложить") ?: "Отложить"
        builder.addAction(
            Notification.Action.Builder(
                android.graphics.drawable.Icon.createWithResource(context, android.R.drawable.checkbox_on_background),
                takenLabel,
                actionPendingIntent(context, record, ACTION_TAKEN)
            ).build()
        )
        builder.addAction(
            Notification.Action.Builder(
                android.graphics.drawable.Icon.createWithResource(context, android.R.drawable.ic_lock_idle_alarm),
                snoozeLabel,
                actionPendingIntent(context, record, ACTION_SNOOZE)
            ).build()
        )
        manager.notify(id, builder.build())
    }

    private fun actionPendingIntent(context: Context, record: JSONObject, action: String): PendingIntent {
        val id = record.optInt("id")
        val requestCode = positiveId("$id|$action")
        val intent = Intent(context, DoseActionReceiver::class.java).apply {
            this.action = "app.meditrack.diary.DOSE_ACTION.$action"
            data = Uri.parse("meditrack://dose-action/$id/$action")
            putExtra("actionId", action)
            putExtra("notificationId", id)
            putExtra("doseKey", record.optString("doseKey"))
            putExtra("title", record.optString("title"))
            putExtra("body", record.optString("body"))
            putExtra("channelId", record.optString("channelId"))
            putExtra("medicationId", record.optString("medicationId"))
            putExtra("profileId", record.optString("profileId"))
            putExtra("date", record.optString("date"))
            putExtra("time", record.optString("time"))
            putExtra("scheduledTime", record.optString("scheduledTime"))
        }
        return PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    @Synchronized
    fun appendAction(context: Context, event: JSONObject) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = try { JSONArray(prefs.getString(KEY_ACTIONS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        current.put(event)
        val trimmed = JSONArray()
        val start = (current.length() - 200).coerceAtLeast(0)
        for (i in start until current.length()) trimmed.put(current.getJSONObject(i))
        prefs.edit().putString(KEY_ACTIONS, trimmed.toString()).apply()
    }

    fun pendingActions(context: Context): JSONArray {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ACTIONS, "[]") ?: "[]"
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    @Synchronized
    fun acknowledgeActions(context: Context, ids: Set<String>) {
        val remaining = JSONArray()
        val current = pendingActions(context)
        for (i in 0 until current.length()) {
            val item = current.optJSONObject(i) ?: continue
            if (!ids.contains(item.optString("eventId"))) remaining.put(item)
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_ACTIONS, remaining.toString()).apply()
    }
}

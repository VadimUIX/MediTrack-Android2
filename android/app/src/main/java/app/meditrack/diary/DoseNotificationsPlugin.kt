package app.meditrack.diary

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "DoseNotifications")
class DoseNotificationsPlugin : Plugin() {
    @PluginMethod
    fun schedule(call: PluginCall) {
        val notifications = call.getArray("notifications") ?: JSArray()
        val snoozeMin = call.getInt("snoozeMin", 15) ?: 15
        val takenLabel = call.getString("takenLabel", "Принято") ?: "Принято"
        val snoozeLabel = call.getString("snoozeLabel", "Отложить") ?: "Отложить"
        val count = DoseNotificationManager.scheduleAll(
            context,
            JSONArray(notifications.toString()),
            snoozeMin,
            takenLabel,
            snoozeLabel
        )
        val result = JSObject()
        result.put("scheduled", count)
        result.put("exactAlarmPermission", DoseNotificationManager.canScheduleExactAlarms(context))
        call.resolve(result)
    }

    @PluginMethod
    fun getPendingActions(call: PluginCall) {
        val result = JSObject()
        result.put("actions", DoseNotificationManager.pendingActions(context))
        call.resolve(result)
    }

    @PluginMethod
    fun acknowledgeActions(call: PluginCall) {
        val values = call.getArray("eventIds") ?: JSArray()
        val ids = mutableSetOf<String>()
        for (i in 0 until values.length()) {
            val value = values.optString(i, "")
            if (value.isNotBlank()) ids.add(value)
        }
        DoseNotificationManager.acknowledgeActions(context, ids)
        call.resolve()
    }

    @PluginMethod
    fun checkExactAlarmPermission(call: PluginCall) {
        val result = JSObject()
        result.put("granted", DoseNotificationManager.canScheduleExactAlarms(context))
        call.resolve(result)
    }

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve()
            return
        }
        try {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (error: Exception) {
            call.reject("Не удалось открыть настройки точных будильников.", error)
        }
    }
}

package com.dynamiqes.gabay

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * The `gabay/location` channel (FF-4, AC-65): one current fix and its accuracy, while the app is in
 * use, from Android's own location service. The Dart side is `location_source.dart`; the two agree
 * on these names and codes.
 *
 *  - `getCurrentFix {timeoutMs}` -> `{latitude, longitude, accuracyM}`, or a PlatformException coded
 *    `permission_denied`, `location_off`, `timeout` or `no_fix`.
 *  - `requestPermission` -> `granted` | `denied`. Granted when either the precise or the approximate
 *    permission is held ("While using" and "Only this time" both count; the fix's own accuracy tells
 *    how coarse it is). Never a background or "Always" permission (foreground rule).
 */
class LocationChannel(
    private val activity: Activity,
    messenger: BinaryMessenger,
) : MethodChannel.MethodCallHandler {
    private val channel = MethodChannel(messenger, CHANNEL_NAME)
    private val permissionAsks = mutableListOf<MethodChannel.Result>()
    private val fixAsks = mutableListOf<MethodChannel.Result>()
    private var fixInFlight: OneShotFix? = null

    init {
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getCurrentFix" -> getCurrentFix(call, result)
            "requestPermission" -> requestPermission(result)
            else -> result.notImplemented()
        }
    }

    /** Called from the activity's `onRequestPermissionsResult`; ignores other requests' codes. */
    fun onPermissionRequestFinished(requestCode: Int) {
        if (requestCode != PERMISSION_REQUEST_CODE) return
        val answer = if (hasAnyLocationPermission()) "granted" else "denied"
        val waiting = permissionAsks.toList()
        permissionAsks.clear()
        waiting.forEach { it.success(answer) }
    }

    /** The activity is going away: stop the ask in flight and drop the handler. */
    fun dispose() {
        channel.setMethodCallHandler(null)
        fixInFlight?.cancel()
        fixInFlight = null
        // Dropping the queued results unanswered is fine: the FlutterActivity's engine dies with it.
        fixAsks.clear()
        permissionAsks.clear()
    }

    private fun requestPermission(result: MethodChannel.Result) {
        if (hasAnyLocationPermission()) {
            result.success("granted")
            return
        }
        permissionAsks.add(result)
        // One system dialog however many asks queue behind it. Both permissions in one request:
        // on Android 12+ the shopper may grant only the approximate one.
        if (permissionAsks.size == 1) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                PERMISSION_REQUEST_CODE,
            )
        }
    }

    private fun getCurrentFix(call: MethodCall, result: MethodChannel.Result) {
        val timeoutMs = call.argument<Int>("timeoutMs")
        if (timeoutMs == null || timeoutMs <= 0) {
            result.error("bad_arguments", "timeoutMs must be a positive number of milliseconds", null)
            return
        }
        if (!hasAnyLocationPermission()) {
            result.error("permission_denied", "Location permission is not granted", null)
            return
        }
        val manager = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        if (!LocationManagerCompat.isLocationEnabled(manager)) {
            result.error("location_off", "Location is switched off on this device", null)
            return
        }
        // A fix is already being fetched: this ask waits for it and gets the same answer (its own
        // timeoutMs does not apply; the Dart side's reply grace still bounds the wait).
        if (fixInFlight != null) {
            fixAsks.add(result)
            return
        }
        val providers = enabledProviders(manager)
        fixAsks.add(result)
        val fix = OneShotFix(
            manager = manager,
            executor = ContextCompat.getMainExecutor(activity),
            providers = providers,
            timeoutMs = timeoutMs.toLong(),
            onFix = { location ->
                val reply = mapOf(
                    "latitude" to location.latitude,
                    "longitude" to location.longitude,
                    "accuracyM" to location.accuracy.toDouble(),
                )
                takeFixAsks().forEach { it.success(reply) }
            },
            onFailure = { code -> takeFixAsks().forEach { it.error(code, null, null) } },
        )
        fixInFlight = fix
        fix.start()
    }

    /** The ask in flight has ended: hands back everyone who waited on it, exactly once. */
    private fun takeFixAsks(): List<MethodChannel.Result> {
        fixInFlight = null
        val waiting = fixAsks.toList()
        fixAsks.clear()
        return waiting
    }

    /**
     * Which providers to ask. From Android 12 the system's own fused provider (it combines GNSS,
     * Wi-Fi and cell; no Play services). Before that, or if it is off: GNSS (only with the precise
     * permission, which that provider needs) and the network provider together.
     */
    private fun enabledProviders(manager: LocationManager): List<String> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            manager.isProviderEnabled(LocationManager.FUSED_PROVIDER)
        ) {
            return listOf(LocationManager.FUSED_PROVIDER)
        }
        val candidates = buildList {
            if (isGranted(Manifest.permission.ACCESS_FINE_LOCATION)) add(LocationManager.GPS_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
        }
        return candidates.filter { manager.isProviderEnabled(it) }
    }

    private fun hasAnyLocationPermission() =
        isGranted(Manifest.permission.ACCESS_FINE_LOCATION) || isGranted(Manifest.permission.ACCESS_COARSE_LOCATION)

    private fun isGranted(permission: String) =
        ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED

    companion object {
        const val CHANNEL_NAME = "gabay/location"
        private const val PERMISSION_REQUEST_CODE = 4101
    }
}

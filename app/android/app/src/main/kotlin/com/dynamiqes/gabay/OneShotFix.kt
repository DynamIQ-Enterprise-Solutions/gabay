package com.dynamiqes.gabay

import android.annotation.SuppressLint
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import androidx.core.location.LocationManagerCompat
import androidx.core.util.Consumer
import java.util.concurrent.Executor

/**
 * One current fix from Android's own location service (no Google Play services), asked of one or
 * more providers at once: the first fix that carries an accuracy wins and the other asks are
 * cancelled. Ends exactly once, with a fix, with [CODE_NO_FIX] (every provider answered with
 * nothing) or with [CODE_TIMEOUT] (nothing came inside [timeoutMs]). Everything runs on the
 * thread of [executor], which must be the main thread's, so no locking is needed.
 *
 * The caller has already checked the location permission and that location is switched on.
 */
internal class OneShotFix(
    private val manager: LocationManager,
    private val executor: Executor,
    private val providers: List<String>,
    private val timeoutMs: Long,
    private val onFix: (Location) -> Unit,
    private val onFailure: (code: String) -> Unit,
) {
    // One signal per provider: a CancellationSignal carries a single cancel listener.
    private val signals = providers.map { CancellationSignal() }
    private val timeout = Runnable { finish { onFailure(CODE_TIMEOUT) } }
    private val handler = Handler(Looper.getMainLooper())
    private var awaiting = providers.size // asks not yet answered
    private var finished = false

    @SuppressLint("MissingPermission") // checked by the caller before this is created
    fun start() {
        handler.postDelayed(timeout, timeoutMs)
        providers.forEachIndexed { index, provider ->
            try {
                LocationManagerCompat.getCurrentLocation(
                    manager, provider, signals[index], executor,
                    Consumer<Location?> { answer(it) },
                )
            } catch (_: SecurityException) { // this provider needs a permission the shopper did not give
                awaiting--
            } catch (_: IllegalArgumentException) { // no such provider on this device
                awaiting--
            }
        }
        if (awaiting == 0) finish { onFailure(CODE_NO_FIX) }
    }

    /** Ends the ask without calling back (the activity is going away). */
    fun cancel() = finish {}

    private fun answer(location: Location?) {
        if (finished) return
        if (location != null && location.hasAccuracy()) {
            finish { onFix(location) }
            return
        }
        awaiting--
        if (awaiting == 0) finish { onFailure(CODE_NO_FIX) }
    }

    private fun finish(report: () -> Unit) {
        if (finished) return
        finished = true
        handler.removeCallbacks(timeout)
        signals.forEach { it.cancel() }
        report()
    }

    companion object {
        const val CODE_NO_FIX = "no_fix"
        const val CODE_TIMEOUT = "timeout"
    }
}

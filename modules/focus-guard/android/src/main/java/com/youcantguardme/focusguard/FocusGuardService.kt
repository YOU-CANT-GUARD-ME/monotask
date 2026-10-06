package com.youcantguardme.focusguard

import android.app.*
import android.content.*
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.*
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

class FocusGuardService : Service() {
  companion object {
    const val ACTION_START = "focusguard.START"
    const val ACTION_STOP = "focusguard.STOP"
    const val ACTION_APP_STATE = "focusguard.APP_STATE"
    const val EXTRA_START_TIME = "startTime"
    const val EXTRA_FOREGROUND = "foreground"
    const val EXTRA_BG = "bg"
    const val EXTRA_TITLE_COLOR = "titleColor"
    const val EXTRA_TIMER_COLOR = "timerColor"
    const val EXTRA_DESC_COLOR = "descColor"
    const val EXTRA_BUTTON_BG = "buttonBg"
    const val EXTRA_BUTTON_TEXT_COLOR = "buttonTextColor"
    private const val CHANNEL_ID = "focus-session-timer-v2"
    private const val NOTIFICATION_ID = 7284
    private const val PROGRESS_MAX_MS = 2 * 60 * 60 * 1000L
  }

  private val handler = Handler(Looper.getMainLooper())
  private var startTime = 0L
  private var sessionActive = false
  private var appInForeground = true
  private var overlay: View? = null
  private var timerText: TextView? = null
  private var ring: RingProgressView? = null
  private lateinit var windowManager: WindowManager

  private var bgColor = Color.rgb(32, 37, 27)
  private var titleColor = Color.rgb(224, 216, 196)
  private var timerColor = Color.rgb(135, 152, 106)
  private var descColor = Color.rgb(190, 194, 176)
  private var buttonBgColor = Color.rgb(106, 122, 82)
  private var buttonTextColor = Color.WHITE

  private fun safeParseColor(hex: String?, fallback: Int): Int {
    if (hex.isNullOrBlank()) return fallback
    return try {
      Color.parseColor(hex)
    } catch (_: Exception) {
      fallback
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        Intent.ACTION_SCREEN_OFF -> {
          handler.removeCallbacks(showOverlayRunnable)
          hideOverlay()
        }
        Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT -> {
          if (!appInForeground) scheduleOverlay()
        }
      }
    }
  }

  private val showOverlayRunnable = Runnable {
    if (!appInForeground && isScreenUsable()) showOverlay()
  }

  private val tick = object : Runnable {
    override fun run() {
      val elapsed = System.currentTimeMillis() - startTime
      timerText?.text = formatElapsed(elapsed)
      ring?.setProgress((elapsed.toFloat() / PROGRESS_MAX_MS).coerceIn(0f, 1f))
      handler.postDelayed(this, 1000)
    }
  }

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    registerReceiver(screenReceiver, filter)
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        startTime = intent.getLongExtra(EXTRA_START_TIME, System.currentTimeMillis())
        sessionActive = true
        appInForeground = true

        bgColor = safeParseColor(intent.getStringExtra(EXTRA_BG), bgColor)
        titleColor = safeParseColor(intent.getStringExtra(EXTRA_TITLE_COLOR), titleColor)
        timerColor = safeParseColor(intent.getStringExtra(EXTRA_TIMER_COLOR), timerColor)
        descColor = safeParseColor(intent.getStringExtra(EXTRA_DESC_COLOR), descColor)
        buttonBgColor = safeParseColor(intent.getStringExtra(EXTRA_BUTTON_BG), buttonBgColor)
        buttonTextColor = safeParseColor(intent.getStringExtra(EXTRA_BUTTON_TEXT_COLOR), buttonTextColor)

        startForeground(NOTIFICATION_ID, buildNotification())
      }
      ACTION_APP_STATE -> {
        if (!sessionActive) {
          handler.removeCallbacks(showOverlayRunnable)
          hideOverlay()
          stopSelf()
          return START_NOT_STICKY
        }

        appInForeground = intent.getBooleanExtra(EXTRA_FOREGROUND, true)
        if (appInForeground) {
          handler.removeCallbacks(showOverlayRunnable)
          hideOverlay()
        } else {
          scheduleOverlay()
        }
      }
      ACTION_STOP -> stopGuard()
    }
    return START_NOT_STICKY
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "집중 타이머",
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = "진행 중인 집중 세션의 실제 시간을 표시합니다."
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Monotask 집중 중")
      .setContentText("집중 시간이 기록되고 있어요")
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STOPWATCH)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setWhen(startTime)
      .setUsesChronometer(true)
      .setShowWhen(true)
      .build()
  }

  private fun scheduleOverlay() {
    handler.removeCallbacks(showOverlayRunnable)
    handler.postDelayed(showOverlayRunnable, 700)
  }

  private fun isScreenUsable(): Boolean {
    val power = getSystemService(POWER_SERVICE) as PowerManager
    val keyguard = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
    return power.isInteractive && !keyguard.isKeyguardLocked
  }

  // Semi-transparent version of timerColor, used for the ring's background track.
  private fun trackColor(): Int {
    val r = Color.red(timerColor)
    val g = Color.green(timerColor)
    val b = Color.blue(timerColor)
    return Color.argb(60, r, g, b)
  }

  private fun showOverlay() {
    if (overlay != null || !Settings.canDrawOverlays(this)) return

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(48, 96, 48, 64)
      setBackgroundColor(bgColor)
    }

    val dot = View(this).apply {
      val d = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(timerColor)
      }
      background = d
    }
    root.addView(dot, LinearLayout.LayoutParams(16.dp, 16.dp).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      bottomMargin = 16.dp
    })

    root.addView(TextView(this).apply {
      text = "FOCUS MODE"
      setTextColor(descColor)
      textSize = 12f
      letterSpacing = 0.2f
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(-2, -2).apply { bottomMargin = 40.dp })

    val ringWrap = FrameLayout(this)
    val ringView = RingProgressView(this, trackColor(), timerColor).apply {
      setProgress((System.currentTimeMillis() - startTime).toFloat() / PROGRESS_MAX_MS)
    }
    ring = ringView
    ringWrap.addView(ringView, FrameLayout.LayoutParams(220.dp, 220.dp))

    val ringCenter = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
    }
    timerText = TextView(this).apply {
      text = formatElapsed(System.currentTimeMillis() - startTime)
      setTextColor(titleColor)
      textSize = 38f
      setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
      gravity = Gravity.CENTER
    }
    ringCenter.addView(timerText)
    ringCenter.addView(TextView(this).apply {
      text = "앱 밖에 있어요"
      setTextColor(descColor)
      textSize = 13f
      gravity = Gravity.CENTER
      setPadding(0, 8.dp, 0, 0)
    })
    ringWrap.addView(
      ringCenter,
      FrameLayout.LayoutParams(-2, -2, Gravity.CENTER)
    )

    root.addView(ringWrap, LinearLayout.LayoutParams(220.dp, 220.dp).apply {
      gravity = Gravity.CENTER_HORIZONTAL
      bottomMargin = 40.dp
    })

    root.addView(TextView(this).apply {
      text = "집중 세션 진행 중"
      setTextColor(titleColor)
      textSize = 16f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 8.dp)
    })
    root.addView(TextView(this).apply {
      text = "다른 앱 대신 Monotask로 돌아가 집중을 계속하세요.\n화면을 잠그는 것은 집중 이탈로 처리하지 않아요."
      setTextColor(descColor)
      textSize = 14f
      gravity = Gravity.CENTER
    })

    val spacer = View(this)
    root.addView(spacer, LinearLayout.LayoutParams(-1, 0, 1f))

    root.addView(Button(this).apply {
      text = "집중 화면으로 돌아가기"
      isAllCaps = false
      setTextColor(buttonTextColor)
      textSize = 15f
      background = GradientDrawable().apply {
        cornerRadius = 18.dp.toFloat()
        setColor(buttonBgColor)
      }
      setOnClickListener { returnToApp() }
    }, LinearLayout.LayoutParams(-1, 58.dp))

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.OPAQUE
    ).apply { gravity = Gravity.CENTER }

    try {
      windowManager.addView(root, params)
      overlay = root
      handler.removeCallbacks(tick)
      handler.post(tick)
    } catch (_: Exception) {
      overlay = null
      timerText = null
      ring = null
    }
  }

  private fun returnToApp() {
    hideOverlay()
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(it)
    }
  }

  private fun hideOverlay() {
    handler.removeCallbacks(tick)
    overlay?.let {
      try { windowManager.removeView(it) } catch (_: Exception) {}
    }
    overlay = null
    timerText = null
    ring = null
  }

  private fun stopGuard() {
    sessionActive = false
    startTime = 0L
    appInForeground = true
    handler.removeCallbacksAndMessages(null)
    hideOverlay()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun formatElapsed(ms: Long): String {
    val seconds = maxOf(0L, ms / 1000)
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val secs = seconds % 60
    return if (hours > 0) String.format(Locale.US, "%d:%02d:%02d", hours, minutes, secs)
    else String.format(Locale.US, "%02d:%02d", minutes, secs)
  }

  private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    hideOverlay()
    try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    super.onDestroy()
  }

  override fun onBind(intent: Intent?) = null

  // Draws the two-ring progress circle seen on the in-app focus screen:
  // a faint background track plus a rounded progress arc on top.
  private class RingProgressView(
    context: Context,
    private val trackColor: Int,
    private val progressColor: Int
  ) : View(context) {
    private var progress = 0f
    private val strokeWidth = 10f * resources.displayMetrics.density
    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = this@RingProgressView.strokeWidth
      color = trackColor
    }
    private val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = this@RingProgressView.strokeWidth
      strokeCap = Paint.Cap.ROUND
      color = progressColor
    }
    private val rect = RectF()

    fun setProgress(value: Float) {
      progress = value.coerceIn(0f, 1f)
      invalidate()
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val pad = strokeWidth / 2
      rect.set(pad, pad, width - pad, height - pad)
      canvas.drawOval(rect, trackPaint)
      canvas.drawArc(rect, -90f, 360f * progress, false, progressPaint)
    }
  }
}
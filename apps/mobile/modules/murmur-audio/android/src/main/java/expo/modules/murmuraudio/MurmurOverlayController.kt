package expo.modules.murmuraudio

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

internal class MurmurOverlayController(private val context: Context) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val windowManager = context.getSystemService(WindowManager::class.java)
  @Volatile private var visible = false
  @Volatile private var currentCaption = ""
  private var rootView: View? = null
  private var captionView: TextView? = null
  private var windowParams: WindowManager.LayoutParams? = null

  fun show() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post(::show)
      return
    }
    if (visible || !hasPermission(context)) {
      return
    }

    val root = createView()
    val params = WindowManager.LayoutParams(
      dp(300),
      WindowManager.LayoutParams.WRAP_CONTENT,
      overlayWindowType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(16)
      y = dp(96)
    }

    try {
      windowManager.addView(root, params)
    } catch (_: RuntimeException) {
      return
    }
    rootView = root
    windowParams = params
    visible = true
  }

  fun hide() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post(::hide)
      return
    }
    val root = rootView
    if (root != null) {
      try {
        windowManager.removeView(root)
      } catch (_: IllegalArgumentException) {
      }
    }
    rootView = null
    captionView = null
    windowParams = null
    currentCaption = ""
    visible = false
  }

  fun updateCaption(caption: String, rtl: Boolean) {
    val boundedCaption = caption.trim().take(MAX_CAPTION_LENGTH)
    currentCaption = boundedCaption
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { updateCaption(boundedCaption, rtl) }
      return
    }
    if (!visible) {
      show()
    }
    val captionTextView = captionView ?: return
    captionTextView.text = boundedCaption
    val direction = if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
    captionTextView.layoutDirection = direction
    captionTextView.textDirection = direction
    captionTextView.gravity = if (rtl) Gravity.END else Gravity.START
  }

  fun state(context: Context): Map<String, Any?> = mapOf(
    "overlay_permission_granted" to hasPermission(context),
    "overlay_visible" to visible,
    "caption_updated" to (visible && currentCaption.isNotEmpty())
  )

  companion object {
    private const val MAX_CAPTION_LENGTH = 240

    fun hasPermission(context: Context): Boolean {
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(context)
    }
  }

  private fun createView(): View {
    val background = GradientDrawable().apply {
      setColor(Color.rgb(24, 24, 27))
      cornerRadius = dp(16).toFloat()
      setStroke(dp(1), Color.rgb(108, 108, 116))
    }
    val container = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16), dp(10), dp(12), dp(12))
      background = background
      elevation = dp(8).toFloat()
    }
    val header = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val label = TextView(context).apply {
      text = "Murmur"
      setTextColor(Color.rgb(255, 206, 84))
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }
    val dismiss = TextView(context).apply {
      text = "×"
      contentDescription = "Dismiss captions"
      setTextColor(Color.WHITE)
      textSize = 24f
      gravity = Gravity.CENTER
      isClickable = true
      layoutParams = LinearLayout.LayoutParams(dp(32), dp(32))
    }
    dismiss.setOnClickListener { hide() }
    header.addView(label)
    header.addView(dismiss)

    val caption = TextView(context).apply {
      setTextColor(Color.WHITE)
      textSize = 16f
      maxLines = 4
      ellipsize = TextUtils.TruncateAt.END
      setLineSpacing(0f, 1.08f)
      gravity = Gravity.START
      text = currentCaption
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(2) }
    }
    captionView = caption
    container.addView(header)
    container.addView(caption)
    container.setOnTouchListener(DragTouchListener())
    return container
  }

  private inner class DragTouchListener : View.OnTouchListener {
    private var downX = 0f
    private var downY = 0f
    private var startX = 0
    private var startY = 0

    override fun onTouch(view: View, event: MotionEvent): Boolean {
      val params = windowParams ?: return false
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX
          downY = event.rawY
          startX = params.x
          startY = params.y
          return true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + (event.rawX - downX).toInt()
          params.y = startY + (event.rawY - downY).toInt()
          try {
            windowManager.updateViewLayout(view, params)
          } catch (_: IllegalArgumentException) {
          }
          return true
        }
      }
      return true
    }
  }

  private fun overlayWindowType(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      WindowManager.LayoutParams.TYPE_PHONE
    }
  }

  private fun dp(value: Int): Int {
    return (value * context.resources.displayMetrics.density).toInt()
  }
}

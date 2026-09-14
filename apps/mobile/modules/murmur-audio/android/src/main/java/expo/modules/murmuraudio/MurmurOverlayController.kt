package expo.modules.murmuraudio

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

internal class MurmurOverlayController(private val context: Context) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val windowManager = context.getSystemService(WindowManager::class.java)
  @Volatile private var visible = false
  @Volatile private var currentCaption = ""
  @Volatile private var dismissedForSession = false
  private var rootView: View? = null
  private var captionView: TextView? = null
  private var captionScrollView: ScrollView? = null
  private var windowParams: WindowManager.LayoutParams? = null

  fun show() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post(::show)
      return
    }
    dismissedForSession = false
    showIfAllowed()
  }

  private fun showIfAllowed() {
    if (visible || dismissedForSession || !hasPermission(context)) {
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
    scrollCaptionToLatest()
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
    captionScrollView = null
    windowParams = null
    currentCaption = ""
    dismissedForSession = false
    visible = false
  }

  fun updateCaption(caption: String, rtl: Boolean) {
    val boundedCaption = MurmurCaptionWindow.tail(caption)
    currentCaption = boundedCaption
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { updateCaption(boundedCaption, rtl) }
      return
    }
    if (!visible) {
      showIfAllowed()
    }
    val captionTextView = captionView ?: return
    captionTextView.text = boundedCaption.ifEmpty { EMPTY_CAPTION }
    captionTextView.layoutDirection = if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
    captionTextView.textDirection = if (rtl) View.TEXT_DIRECTION_RTL else View.TEXT_DIRECTION_LTR
    captionTextView.gravity = Gravity.BOTTOM or if (rtl) Gravity.END else Gravity.START
    scrollCaptionToLatest()
  }

  fun state(context: Context): Map<String, Any?> = mapOf(
    "overlay_permission_granted" to hasPermission(context),
    "overlay_visible" to visible,
    "caption_updated" to (visible && currentCaption.isNotEmpty())
  )

  companion object {
    private const val EMPTY_CAPTION = "Listening for phone audio…"
    private const val CAPTION_VIEW_HEIGHT_DP = 96

    fun hasPermission(context: Context): Boolean {
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(context)
    }
  }

  private fun createView(): View {
    val bubbleBackground = GradientDrawable().apply {
      setColor(Color.rgb(24, 24, 27))
      cornerRadius = dp(16).toFloat()
      setStroke(dp(1), Color.rgb(108, 108, 116))
    }
    val container = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(16), dp(10), dp(12), dp(12))
      background = bubbleBackground
      elevation = dp(8).toFloat()
    }
    val header = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val label = TextView(context).apply {
      text = "Murmur"
      contentDescription = "Move live captions"
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
    dismiss.setOnClickListener { dismissForSession() }
    header.addView(label)
    header.addView(dismiss)

    val caption = TextView(context).apply {
      setTextColor(Color.WHITE)
      textSize = 16f
      setLineSpacing(0f, 1.08f)
      gravity = Gravity.START
      text = currentCaption.ifEmpty { EMPTY_CAPTION }
      accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(2) }
    }
    val captionScroll = ScrollView(context).apply {
      isVerticalScrollBarEnabled = false
      isHorizontalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
      isSmoothScrollingEnabled = false
      setFadingEdgeLength(dp(12))
      isVerticalFadingEdgeEnabled = true
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(CAPTION_VIEW_HEIGHT_DP)
      ).apply { topMargin = dp(2) }
      addView(caption)
    }
    captionView = caption
    captionScrollView = captionScroll
    container.addView(header)
    container.addView(captionScroll)
    label.setOnTouchListener(DragTouchListener())
    return container
  }

  private fun scrollCaptionToLatest() {
    val scrollView = captionScrollView ?: return
    val textView = captionView ?: return
    scrollView.post {
      if (captionScrollView !== scrollView || captionView !== textView) {
        return@post
      }
      scrollView.scrollTo(0, maxOf(0, textView.height - scrollView.height))
    }
  }

  private fun dismissForSession() {
    dismissedForSession = true
    removeView()
  }

  private fun removeView() {
    val root = rootView
    if (root != null) {
      try {
        windowManager.removeView(root)
      } catch (_: IllegalArgumentException) {
      }
    }
    rootView = null
    captionView = null
    captionScrollView = null
    windowParams = null
    visible = false
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
          val overlay = rootView ?: return false
          try {
            windowManager.updateViewLayout(overlay, params)
          } catch (_: IllegalArgumentException) {
          }
          return true
        }
        MotionEvent.ACTION_UP -> {
          view.performClick()
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

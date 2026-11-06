package expo.modules.floatingmemo

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * 管理悬浮小气泡 + 快速输入浮层。
 * 所有 View 均通过 WindowManager 以 TYPE_APPLICATION_OVERLAY 添加，
 * 因此可以悬浮在其他应用（浏览器、聊天等）之上。
 */
class FloatingMemoOverlay(
  private val context: Context,
  private val onSave: (String) -> Unit,
  private val onDismiss: () -> Unit
) {
  companion object {
    private const val PREFS = "floating_memo_overlay"
    private const val KEY_X = "bubble_x"
    private const val KEY_Y = "bubble_y"

    private const val BUBBLE_SIZE_DP = 56
    private const val BUBBLE_MARGIN_DP = 8

    private const val GRADIENT_START = "#8E86FF"
    private const val GRADIENT_END = "#5A50E6"
  }

  private val windowManager: WindowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private var bubbleView: View? = null
  private var inputView: View? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var inputCard: View? = null
  private var editText: EditText? = null

  @Volatile private var showing = false
  @Volatile private var darkMode = false

  private var lastX = prefs.getInt(KEY_X, screenWidth() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2))
  private var lastY = prefs.getInt(KEY_Y, dp(200))

  // ---- 权限 ----

  fun hasPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
      Settings.canDrawOverlays(context)
  }

  fun requestPermission(): Boolean {
    if (hasPermission()) return true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        // 忽略启动失败
      }
    }
    return false
  }

  // ---- 对外状态控制 ----

  fun isShowing(): Boolean = showing

  fun setDarkMode(dark: Boolean) {
    darkMode = dark
  }

  fun show() {
    if (showing) return
    showing = true
    mainHandler.post { addBubble() }
  }

  fun hide() {
    showing = false
    FloatingMemoService.stop(context)
    mainHandler.post { removeAll() }
  }

  fun destroy() {
    hide()
  }

  // ---- 气泡 ----

  private fun addBubble() {
    if (bubbleView != null) return
    if (!hasPermission()) return

    val bubbleSize = dp(BUBBLE_SIZE_DP)
    val margin = dp(BUBBLE_MARGIN_DP)
    val windowSize = bubbleSize + margin * 2

    val container = FrameLayout(context)

    // 阴影层：略大且向下偏移的半透明椭圆，模拟柔和投影（避免 elevation 在悬浮窗内被裁掉）
    val shadow = View(context).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#2E000000"))
      }
    }
    container.addView(
      shadow,
      FrameLayout.LayoutParams(bubbleSize, bubbleSize, Gravity.CENTER).apply {
        topMargin = dp(4)
      }
    )

    // 气泡本体：渐变 + 半透明白边 + 居中图标
    val bubble = TextView(context).apply {
      text = "\uD83D\uDCDD" // 📝
      textSize = 22f
      gravity = Gravity.CENTER
      includeFontPadding = false
      setTextColor(Color.WHITE)
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor(GRADIENT_START), Color.parseColor(GRADIENT_END))
      ).apply {
        shape = GradientDrawable.OVAL
        setStroke(dp(2), Color.parseColor("#40FFFFFF"))
      }
    }
    container.addView(bubble, FrameLayout.LayoutParams(bubbleSize, bubbleSize, Gravity.CENTER))

    val params = WindowManager.LayoutParams(
      windowSize,
      windowSize,
      overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = clampX(lastX)
      y = clampY(lastY)
    }

    attachDrag(container, params)

    // 出现动画：缩放 0.2 → 1 + 淡入，带轻微回弹
    container.scaleX = 0.2f
    container.scaleY = 0.2f
    container.alpha = 0f

    bubbleView = container
    bubbleParams = params
    try {
      windowManager.addView(container, params)
      container.animate()
        .scaleX(1f)
        .scaleY(1f)
        .alpha(1f)
        .setDuration(260L)
        .setInterpolator(OvershootInterpolator(1.4f))
        .start()
      // 启动前台服务，降低切到其他 App 时被系统回收的概率
      FloatingMemoService.start(context)
    } catch (_: Exception) {
      bubbleView = null
      bubbleParams = null
    }
  }

  private fun attachDrag(bubble: View, params: WindowManager.LayoutParams) {
    val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    var downRawX = 0f
    var downRawY = 0f
    var startX = 0
    var startY = 0
    var moved = false
    var dismissing = false
    var longPress: Runnable? = null

    fun cancelLongPress() {
      longPress?.let { bubble.removeCallbacks(it) }
      longPress = null
    }

    bubble.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downRawX = event.rawX
          downRawY = event.rawY
          startX = params.x
          startY = params.y
          moved = false
          dismissing = false
          cancelLongPress()
          // 长按 520ms 且未移动 → 关闭悬浮窗（带缩小淡出动画）
          val runnable = Runnable {
            if (!moved && bubbleView === bubble) {
              dismissing = true
              dismissBubbleWithAnimation()
            }
          }
          longPress = runnable
          bubble.postDelayed(runnable, 520L)
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - downRawX
          val dy = event.rawY - downRawY
          if (!moved && Math.hypot(dx.toDouble(), dy.toDouble()) > touchSlop) {
            moved = true
            cancelLongPress()
          }
          if (moved) {
            params.x = startX + dx.toInt()
            params.y = startY + dy.toInt()
            try {
              windowManager.updateViewLayout(bubble, params)
            } catch (_: Exception) {
              // 忽略
            }
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          cancelLongPress()
          if (!dismissing && bubbleView === bubble) {
            if (moved) {
              lastX = params.x
              lastY = params.y
              prefs.edit().putInt(KEY_X, lastX).putInt(KEY_Y, lastY).apply()
            } else {
              openInput()
            }
          }
          true
        }
        MotionEvent.ACTION_CANCEL -> {
          cancelLongPress()
          false
        }
        else -> false
      }
    }
  }

  private fun hideBubble() {
    val view = bubbleView ?: return
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
      // 忽略
    }
    bubbleView = null
    bubbleParams = null
  }

  private fun showBubble() {
    if (bubbleView != null) return
    if (!showing) return
    addBubble()
  }

  /** 长按气泡：缩小淡出后关闭悬浮窗，并通知 JS 同步开关状态 */
  private fun dismissBubbleWithAnimation() {
    val view = bubbleView ?: return
    showing = false
    view.animate()
      .scaleX(0.2f)
      .scaleY(0.2f)
      .alpha(0f)
      .setDuration(180L)
      .setInterpolator(DecelerateInterpolator())
      .withEndAction {
        if (bubbleView === view) {
          hideBubble()
        }
        FloatingMemoService.stop(context)
        onDismiss()
      }
      .start()
  }

  // ---- 快速输入浮层 ----

  private fun openInput() {
    if (inputView != null) return
    hideBubble()

    val root = buildInputOverlay()
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType(),
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.CENTER
      softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
      // Android 12+ 给浮层加背景模糊，呈现毛玻璃观感；低版本忽略
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        flags = flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
        blurBehindRadius = dp(18)
      }
    }

    try {
      windowManager.addView(root, params)
      inputView = root

      // 浮层淡入 + 卡片轻微放大
      root.alpha = 0f
      root.animate().alpha(1f).setDuration(170L).start()

      inputCard?.let { card ->
        card.scaleX = 0.92f
        card.scaleY = 0.92f
        card.animate()
          .scaleX(1f)
          .scaleY(1f)
          .setDuration(220L)
          .setInterpolator(DecelerateInterpolator())
          .start()
      }

      editText?.postDelayed({
        editText?.requestFocus()
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT)
        Unit
      }, 150)
    } catch (_: Exception) {
      inputView = null
      showBubble()
    }
  }

  private fun closeInput() {
    val view = inputView ?: return
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
      // 忽略
    }
    inputView = null
    inputCard = null
    editText = null
    showBubble()
  }

  private fun buildInputOverlay(): View {
    val dark = darkMode
    val cardBg = if (dark) Color.parseColor("#E61E1F26") else Color.parseColor("#EBFFFFFF")
    val fg = if (dark) Color.parseColor("#ECECF1") else Color.parseColor("#1F2128")
    val hintColor = if (dark) Color.parseColor("#8A8F9C") else Color.parseColor("#9AA0AA")
    val inputBg = if (dark) Color.parseColor("#3A2A2C36") else Color.parseColor("#CCF2F3F7")
    val strokeColor = if (dark) Color.parseColor("#26FFFFFF") else Color.parseColor("#1F000000")

    val root = FrameLayout(context)

    val scrim = View(context).apply {
      setBackgroundColor(Color.parseColor("#59000000"))
      setOnClickListener { closeInput() }
    }
    root.addView(scrim, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

    // 圆角 + 半透明「毛玻璃」卡片
    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(20), dp(20), dp(16))
      background = GradientDrawable().apply {
        cornerRadius = dp(22).toFloat()
        setColor(cardBg)
        setStroke(dp(1), strokeColor)
      }
      isClickable = true
      elevation = dp(12).toFloat()
    }
    inputCard = card

    val title = TextView(context).apply {
      text = "快速记一条"
      textSize = 17f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(fg)
    }

    val edit = EditText(context).apply {
      hint = "想到什么，写下来…"
      setTextColor(fg)
      setHintTextColor(hintColor)
      textSize = 15f
      minLines = 2
      maxLines = 6
      gravity = Gravity.TOP or Gravity.START
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(inputBg)
      }
      setPadding(dp(14), dp(12), dp(14), dp(12))
    }
    editText = edit

    val btnRow = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.END
      setPadding(0, dp(6), 0, 0)
    }

    val cancel = TextView(context).apply {
      text = "取消"
      textSize = 15f
      setTextColor(hintColor)
      setPadding(dp(16), dp(10), dp(16), dp(10))
      setOnClickListener { closeInput() }
    }

    // 药丸状渐变保存按钮
    val save = TextView(context).apply {
      text = "快速保存"
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.WHITE)
      setPadding(dp(22), dp(10), dp(22), dp(10))
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor(GRADIENT_START), Color.parseColor(GRADIENT_END))
      ).apply {
        cornerRadius = dp(24).toFloat()
      }
      elevation = dp(4).toFloat()
      setOnClickListener {
        val text = edit.text.toString().trim()
        closeInput()
        if (text.isNotEmpty()) {
          onSave(text)
        }
        Unit
      }
    }

    btnRow.addView(cancel)
    btnRow.addView(save)

    card.addView(title)
    card.addView(
      edit,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(12)
        bottomMargin = dp(10)
      }
    )
    card.addView(btnRow)

    root.addView(
      card,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER).apply {
        setMargins(dp(22), 0, dp(22), 0)
      }
    )

    return root
  }

  private fun removeAll() {
    hideBubble()
    closeInput()
  }

  // ---- 工具 ----

  private fun overlayType(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
  }

  private fun dp(value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()

  private fun screenWidth(): Int = context.resources.displayMetrics.widthPixels
  private fun screenHeight(): Int = context.resources.displayMetrics.heightPixels

  private fun clampX(x: Int): Int =
    x.coerceIn(0, (screenWidth() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2)).coerceAtLeast(0))

  private fun clampY(y: Int): Int =
    y.coerceIn(0, (screenHeight() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2)).coerceAtLeast(0))
}

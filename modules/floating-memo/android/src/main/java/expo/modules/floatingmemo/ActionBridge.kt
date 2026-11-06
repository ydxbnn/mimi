package expo.modules.floatingmemo

/**
 * 让通知栏的「关闭悬浮窗」按钮能回调到当前悬浮层实例。
 */
object FloatingMemoActionBridge {
  @Volatile
  var closeHandler: (() -> Unit)? = null

  fun triggerClose() {
    closeHandler?.invoke()
  }
}

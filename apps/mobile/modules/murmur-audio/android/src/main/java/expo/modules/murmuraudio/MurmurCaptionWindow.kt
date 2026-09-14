package expo.modules.murmuraudio

/**
 * Keeps the native caption view bounded without hiding the newest words.
 *
 * The overlay is a live viewport, so its window must be anchored to the end
 * of the caption. If the window starts in the middle of a word, skip that
 * partial word rather than making the first visible line look broken.
 */
internal object MurmurCaptionWindow {
  const val MAX_LENGTH = 240

  fun tail(caption: String): String {
    val trimmed = caption.trim()
    if (trimmed.length <= MAX_LENGTH) {
      return trimmed
    }

    val suffixStart = trimmed.length - MAX_LENGTH
    var start = suffixStart
    while (start < trimmed.length && !trimmed[start].isWhitespace()) {
      start += 1
    }

    val suffix = trimmed.substring(start).trimStart()
    return if (suffix.isEmpty()) {
      trimmed.takeLast(MAX_LENGTH)
    } else {
      "… $suffix"
    }
  }
}

package expo.modules.murmuraudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MurmurCaptionWindowTest {
  @Test
  fun keepsShortCaptionsUntouched() {
    assertEquals("Hello, world.", MurmurCaptionWindow.tail("  Hello, world.  "))
  }

  @Test
  fun keepsTheNewestWordsWhenTheWindowIsFull() {
    val caption = "Earlier words that should leave the bubble " +
      "and the newest words must remain visible at the end."

    val visible = MurmurCaptionWindow.tail(caption.padEnd(MurmurCaptionWindow.MAX_LENGTH + 32, 'x'))

    assertTrue(visible.startsWith("… "))
    assertTrue(visible.contains("newest words must remain visible at the end."))
    assertTrue(visible.length <= MurmurCaptionWindow.MAX_LENGTH)
  }

  @Test
  fun doesNotCreateASecondEllipsisForLongUnbrokenText() {
    val caption = "x".repeat(MurmurCaptionWindow.MAX_LENGTH + 10)

    val visible = MurmurCaptionWindow.tail(caption)

    assertEquals(MurmurCaptionWindow.MAX_LENGTH, visible.length)
    assertTrue(visible.all { it == 'x' })
  }
}

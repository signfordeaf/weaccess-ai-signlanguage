package com.signlanguagetranslation.textselection

import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.widget.TextView

/**
 * Adds a "Sign Language" item to the text-selection action mode.
 *
 * Shown only while the SDK is enabled and the selection is non-empty; choosing
 * it hides the toolbar and hands the selected text to JavaScript, which decides
 * what to do with it.
 */
class CustomActionModeCallback(
    /** The view this callback was installed on — the selection lives on it. */
    private val textView: TextView,
    private val title: String,
    private val onSelected: (String) -> Unit,
) : ActionMode.Callback {

    override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
        menu.add(Menu.NONE, MENU_ITEM_ID, 0, title)
            .setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS)
        return true
    }

    override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean = false

    override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
        if (item.itemId != MENU_ITEM_ID) return false

        val text = selectedText()
        mode.finish()

        if (!text.isNullOrBlank()) onSelected(text)
        return true
    }

    override fun onDestroyActionMode(mode: ActionMode) = Unit

    private fun selectedText(): String? {
        val source = textView.text ?: return null
        val start = textView.selectionStart
        val end = textView.selectionEnd
        if (start < 0 || end < 0 || start == end) return null

        return source.subSequence(minOf(start, end), maxOf(start, end)).toString()
    }

    private companion object {
        /** High enough not to collide with the platform's own items. */
        const val MENU_ITEM_ID = 9_999
    }
}

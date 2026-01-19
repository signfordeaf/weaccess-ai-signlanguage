// android/src/main/java/com/signlanguagetranslation/network/SignModel.kt

package com.signlanguagetranslation.network

import org.json.JSONObject

data class SignModel(
    val state: Boolean?,
    val baseUrl: String?,
    val name: String?,
    val cid: String?,
    val st: Boolean?
) {
    companion object {
        fun fromJson(json: String): SignModel {
            val jsonObject = JSONObject(json)
            return SignModel(
                state = if (jsonObject.has("state")) jsonObject.getBoolean("state") else null,
                baseUrl = jsonObject.optString("baseUrl", null),
                name = jsonObject.optString("name", null),
                cid = jsonObject.optString("cid", null),
                st = if (jsonObject.has("st")) jsonObject.getBoolean("st") else null
            )
        }
    }

    val videoUrl: String?
        get() {
            if (baseUrl == null || name == null) return null
            val url = "$baseUrl$name"
            return url.replace("http://", "https://")
        }
}

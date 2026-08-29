package com.codex.remote

import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Small JSON-over-HTTP client for the local Codex CLI gateway. */
class RemoteClient {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    @Volatile
    var bearerToken: String = ""

    fun listSessions(baseUrl: String, callback: (Result<List<DevSession>>) -> Unit) {
        execute(callback) {
            val raw = request("GET", url(baseUrl, "/api/v1/sessions"))
            parseSessions(raw)
        }
    }

    fun startSession(
        baseUrl: String,
        command: String,
        cwd: String,
        callback: (Result<DevSession>) -> Unit,
    ) {
        execute(callback) {
            val body = JSONObject()
                .put("name", command.substringBefore(' ').ifBlank { "codex" })
                .put("command", command)
                .put("cwd", cwd)
                .put("args", JSONArray())
                .put("cols", 120)
                .put("rows", 36)
            parseSession(request("POST", url(baseUrl, "/api/v1/sessions"), body.toString()))
        }
    }

    fun sendInput(
        baseUrl: String,
        sessionId: String,
        input: String,
        callback: (Result<Unit>) -> Unit,
    ) {
        execute(callback) {
            val body = JSONObject().put("data", input)
            request("POST", url(baseUrl, "/api/v1/sessions/${encoded(sessionId)}/input"), body.toString())
            Unit
        }
    }

    fun stopSession(
        baseUrl: String,
        sessionId: String,
        callback: (Result<Unit>) -> Unit,
    ) {
        execute(callback) {
            request("POST", url(baseUrl, "/api/v1/sessions/${encoded(sessionId)}/stop"))
            Unit
        }
    }

    fun pollOutput(
        baseUrl: String,
        sessionId: String,
        cursor: Long,
        callback: (Result<OutputChunk>) -> Unit,
    ) {
        execute(callback) {
            val path = "/api/v1/sessions/${encoded(sessionId)}/output?cursor=$cursor"
            parseOutput(request("GET", url(baseUrl, path)), cursor)
        }
    }

    fun close() {
        executor.shutdownNow()
    }

    private fun <T> execute(callback: (Result<T>) -> Unit, block: () -> T) {
        executor.execute {
            runCatching(block).fold(
                onSuccess = { callback(Result.success(it)) },
                onFailure = { callback(Result.failure(it)) },
            )
        }
    }

    private fun request(method: String, target: String, body: String? = null): String {
        val connection = (URL(target).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8_000
            readTimeout = 15_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            if (bearerToken.isNotBlank()) {
                setRequestProperty("Authorization", "Bearer ${bearerToken.trim()}")
            }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                connection.outputStream.use { stream ->
                    stream.write(body.toByteArray(StandardCharsets.UTF_8))
                }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { input ->
                BufferedReader(InputStreamReader(input, StandardCharsets.UTF_8)).readText()
            }.orEmpty()
            if (status !in 200..299) {
                throw ApiException(status, response.ifBlank { connection.responseMessage.orEmpty() })
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun parseSessions(raw: String): List<DevSession> {
        val trimmed = raw.trim()
        val array = if (trimmed.startsWith("[")) {
            JSONArray(trimmed)
        } else {
            JSONObject(trimmed).optJSONArray("sessions") ?: JSONArray()
        }
        return buildList {
            for (index in 0 until array.length()) {
                array.optJSONObject(index)?.let(::parseSession)?.let(::add)
            }
        }
    }

    private fun parseSession(raw: String): DevSession {
        val root = JSONObject(raw)
        return parseSession(root.optJSONObject("session") ?: root)
    }

    private fun parseSession(json: JSONObject): DevSession = DevSession(
        id = json.optString("id").ifBlank { json.optString("sessionId") },
        title = json.optString("title").ifBlank {
            json.optString("name").ifBlank { json.optString("label", "Codex CLI") }
        },
        status = json.optString("status", if (json.optBoolean("running", false)) "running" else "idle"),
        command = json.optString("command", "codex"),
        cwd = json.optString("cwd", "~"),
        output = json.optString("output"),
    )

    private fun parseOutput(raw: String, previousCursor: Long): OutputChunk {
        val trimmed = raw.trim()
        if (!trimmed.startsWith("{")) {
            return OutputChunk(trimmed, previousCursor + trimmed.length, running = true)
        }
        val json = JSONObject(trimmed)
        val chunks = json.optJSONArray("chunks")
        if (chunks != null) {
            val text = buildString {
                for (index in 0 until chunks.length()) {
                    val chunk = chunks.optJSONObject(index) ?: continue
                    append(chunk.optString("Data", chunk.optString("data")))
                }
            }
            val session = json.optJSONObject("session")
            val status = session?.optString("status", "running") ?: "running"
            return OutputChunk(
                text = text,
                cursor = json.optLong("cursor", previousCursor),
                running = status == "running",
                reset = json.optBoolean("reset", false),
            )
        }
        return OutputChunk(
            text = json.optString("output", json.optString("text")),
            cursor = json.optLong("cursor", json.optLong("nextCursor", previousCursor)),
            running = json.optBoolean("running", true),
        )
    }

    private fun url(baseUrl: String, path: String): String =
        baseUrl.trim().removeSuffix("/") + path

    private fun encoded(value: String): String = Uri.encode(value)

    class ApiException(val statusCode: Int, detail: String) : RuntimeException("HTTP $statusCode: $detail")
}

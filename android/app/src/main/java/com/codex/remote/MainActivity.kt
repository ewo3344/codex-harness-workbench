package com.codex.remote

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.Locale

class MainActivity : android.app.Activity() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val client = RemoteClient()
    private val sessions = LinkedHashMap<String, DevSession>()
    private val preferences by lazy { getSharedPreferences("remote", Context.MODE_PRIVATE) }

    private lateinit var endpointInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var connectionLabel: TextView
    private lateinit var sessionList: LinearLayout
    private lateinit var terminalOutput: TextView
    private lateinit var commandInput: EditText
    private lateinit var inputEditor: EditText
    private lateinit var startButton: Button
    private lateinit var stopButton: Button
    private lateinit var sendButton: Button

    private var selectedSessionId: String? = null
    private var cursor: Long = 0
    private var polling = false
    private var connected = false
    private val pollRunnable = Runnable { pollSelectedSession() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = color(com.codex.remote.R.color.workbench_background)
        window.navigationBarColor = color(com.codex.remote.R.color.workbench_background)
        setContentView(buildContent())
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(pollRunnable)
        client.close()
        super.onDestroy()
    }

    private fun buildContent(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(10))
            setBackgroundColor(color(R.color.workbench_background))
        }

        val header = TextView(this).apply {
            text = "Codex Remote Workbench"
            setTextColor(color(R.color.workbench_text))
            textSize = 21f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        }
        root.addView(header, heightParams(WRAP, dp(34)))

        val endpointRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        endpointInput = EditText(this).apply {
            setSingleLine(true)
            hint = "Gateway URL (for example http://10.0.2.2:8787)"
            setText(preferences.getString(KEY_ENDPOINT, DEFAULT_ENDPOINT))
            setTextColor(color(R.color.workbench_text))
            setHintTextColor(color(R.color.workbench_muted))
            setPadding(dp(10), 0, dp(8), 0)
            imeOptions = EditorInfo.IME_ACTION_GO
        }
        endpointRow.addView(endpointInput, LinearLayout.LayoutParams(0, dp(48), 1f))
        val connectButton = button("Connect")
        endpointRow.addView(connectButton, widthParams(dp(104), dp(48)))
        root.addView(endpointRow, heightParams(MATCH, dp(52)))
        connectionLabel = TextView(this).apply {
            text = "Disconnected"
            setTextColor(color(R.color.workbench_muted))
            textSize = 12f
            setPadding(dp(2), 0, 0, dp(4))
        }
        root.addView(connectionLabel, heightParams(WRAP, dp(23)))
        connectButton.setOnClickListener { connect() }
        endpointInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                connect()
                true
            } else {
                false
            }
        }

        val tokenRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        tokenInput = EditText(this).apply {
            setSingleLine(true)
            hint = "Bearer token from the gateway"
            setText(preferences.getString(KEY_TOKEN, ""))
            setTextColor(color(R.color.workbench_text))
            setHintTextColor(color(R.color.workbench_muted))
            setPadding(dp(10), 0, dp(8), 0)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        tokenRow.addView(tokenInput, LinearLayout.LayoutParams(MATCH, dp(48)))
        root.addView(tokenRow, heightParams(MATCH, dp(52)))

        val sessionHeader = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        sessionHeader.addView(label("Codex CLI sessions"), LinearLayout.LayoutParams(0, dp(34), 1f))
        val newButton = button("New")
        sessionHeader.addView(newButton, widthParams(dp(76), dp(38)))
        root.addView(sessionHeader, heightParams(MATCH, dp(42)))
        newButton.setOnClickListener {
            commandInput.setText("codex")
            commandInput.requestFocus()
        }

        val sessionScroll = ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(color(R.color.workbench_surface))
        }
        sessionList = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(6), dp(6), dp(6), dp(6))
        }
        sessionScroll.addView(sessionList)
        root.addView(sessionScroll, heightParams(MATCH, dp(154)))

        terminalOutput = TextView(this).apply {
            setTextColor(color(R.color.workbench_text))
            setTextSize(13f)
            typeface = Typeface.MONOSPACE
            setTextIsSelectable(true)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setBackgroundColor(color(R.color.workbench_terminal))
            text = "Codex CLI console\nSelect a session or start a process.\n"
        }
        val outputScroll = ScrollView(this).apply {
            isFillViewport = true
            addView(terminalOutput)
        }
        root.addView(outputScroll, LinearLayout.LayoutParams(MATCH, 0, 1f))

        val processRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        commandInput = EditText(this).apply {
            setSingleLine(true)
            hint = "Command (codex)"
            setTextColor(color(R.color.workbench_text))
            setHintTextColor(color(R.color.workbench_muted))
            setPadding(dp(10), 0, dp(8), 0)
        }
        processRow.addView(commandInput, LinearLayout.LayoutParams(0, dp(48), 1f))
        startButton = button("Start")
        processRow.addView(startButton, widthParams(dp(76), dp(48)))
        stopButton = button("Stop")
        processRow.addView(stopButton, widthParams(dp(76), dp(48)))
        root.addView(processRow, heightParams(MATCH, dp(52)))
        startButton.setOnClickListener { startProcess() }
        stopButton.setOnClickListener { stopProcess() }

        val inputRow = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        inputEditor = EditText(this).apply {
            setSingleLine(false)
            hint = "Send input to the selected CLI session"
            setTextColor(color(R.color.workbench_text))
            setHintTextColor(color(R.color.workbench_muted))
            setPadding(dp(10), 0, dp(8), 0)
            imeOptions = EditorInfo.IME_ACTION_SEND
        }
        inputRow.addView(inputEditor, LinearLayout.LayoutParams(0, dp(52), 1f))
        sendButton = button("Send")
        inputRow.addView(sendButton, widthParams(dp(82), dp(52)))
        root.addView(inputRow, heightParams(MATCH, dp(56)))
        sendButton.setOnClickListener { sendInput() }

        updateActionState()
        return root
    }

    private fun connect() {
        val endpoint = endpointInput.text.toString().trim().removeSuffix("/")
        if (endpoint.isBlank()) {
            showError("Enter a gateway URL")
            return
        }
        connected = false
        preferences.edit().putString(KEY_ENDPOINT, endpoint).apply()
        val token = tokenInput.text.toString().trim()
        preferences.edit().putString(KEY_TOKEN, token).apply()
        client.bearerToken = token
        connectionLabel.text = "Connecting to $endpoint"
        client.listSessions(endpoint) { result ->
            mainHandler.post {
                result.onSuccess { remoteSessions ->
                    sessions.clear()
                    remoteSessions.filter { it.id.isNotBlank() }.forEach { sessions[it.id] = it }
                    connected = true
                    connectionLabel.text = "Connected - ${sessions.size} session(s)"
                    renderSessions()
                    if (selectedSessionId == null || selectedSessionId !in sessions) {
                        sessions.keys.firstOrNull()?.let(::selectSession)
                    }
                    schedulePoll()
                    if (sessions.isEmpty()) startProcess()
                }.onFailure { error ->
                    connected = false
                    connectionLabel.text = "Connection failed"
                    showError(error.message ?: "Gateway request failed")
                }
            }
        }
    }

    private fun startProcess() {
        val endpoint = endpointInput.text.toString().trim().removeSuffix("/")
        val command = commandInput.text.toString().trim().ifBlank { "codex" }
        if (endpoint.isBlank()) {
            showError("Enter a gateway URL first")
            return
        }
        startButton.isEnabled = false
        client.startSession(endpoint, command, "") { result ->
            mainHandler.post {
                startButton.isEnabled = true
                result.onSuccess { session ->
                    sessions[session.id] = session
                    renderSessions()
                    selectSession(session.id)
                    connectionLabel.text = "Process started - ${session.title}"
                }.onFailure { error -> showError(error.message ?: "Unable to start process") }
                updateActionState()
            }
        }
    }

    private fun stopProcess() {
        val sessionId = selectedSessionId ?: return
        val endpoint = endpointInput.text.toString().trim().removeSuffix("/")
        stopButton.isEnabled = false
        client.stopSession(endpoint, sessionId) { result ->
            mainHandler.post {
                stopButton.isEnabled = true
                result.onSuccess {
                    sessions[sessionId]?.let { sessions[sessionId] = it.copy(status = "stopped") }
                    renderSessions()
                    connectionLabel.text = "Process stopped"
                }.onFailure { error -> showError(error.message ?: "Unable to stop process") }
                updateActionState()
            }
        }
    }

    private fun sendInput() {
        val sessionId = selectedSessionId ?: return
        val input = inputEditor.text.toString()
        if (input.isBlank()) return
        val endpoint = endpointInput.text.toString().trim().removeSuffix("/")
        sendButton.isEnabled = false
        client.sendInput(endpoint, sessionId, input) { result ->
            mainHandler.post {
                sendButton.isEnabled = true
                result.onSuccess {
                    inputEditor.text.clear()
                    appendTerminal("\n> $input\n")
                }.onFailure { error -> showError(error.message ?: "Unable to send input") }
                updateActionState()
            }
        }
    }

    private fun pollSelectedSession() {
        val sessionId = selectedSessionId ?: return
        val endpoint = endpointInput.text.toString().trim().removeSuffix("/")
        if (!connected || endpoint.isBlank() || polling) return
        polling = true
        client.pollOutput(endpoint, sessionId, cursor) { result ->
            mainHandler.post {
                polling = false
                result.onSuccess { chunk ->
                    cursor = chunk.cursor
                    if (chunk.reset) {
                        terminalOutput.text = chunk.text
                    } else if (chunk.text.isNotEmpty()) {
                        appendTerminal(chunk.text)
                    }
                    sessions[sessionId]?.let {
                        sessions[sessionId] = it.copy(status = if (chunk.running) "running" else "stopped")
                    }
                    renderSessions()
                    updateActionState()
                }.onFailure {
                    connectionLabel.text = "Output stream unavailable"
                }
                schedulePoll()
            }
        }
    }

    private fun schedulePoll() {
        mainHandler.removeCallbacks(pollRunnable)
        if (connected && selectedSessionId != null) mainHandler.postDelayed(pollRunnable, 1_500)
    }

    private fun selectSession(id: String) {
        val session = sessions[id] ?: return
        selectedSessionId = id
        cursor = 0
        terminalOutput.text = session.output.ifBlank {
            "Session: ${session.title}\nCommand: ${session.command}\nDirectory: ${session.cwd}\n\n"
        }
        renderSessions()
        updateActionState()
        schedulePoll()
    }

    private fun renderSessions() {
        if (!::sessionList.isInitialized) return
        sessionList.removeAllViews()
        if (sessions.isEmpty()) {
            sessionList.addView(label("No remote sessions. Start one below."), heightParams(MATCH, dp(48)))
            return
        }
        sessions.values.forEach { session ->
            val selected = session.id == selectedSessionId
            val item = TextView(this).apply {
                text = String.format(Locale.US, "%s  -  %s\n%s", session.title, session.status, session.cwd)
                setTextColor(color(if (selected) R.color.workbench_accent else R.color.workbench_text))
                textSize = 14f
                setPadding(dp(10), dp(7), dp(10), dp(7))
                setBackgroundColor(color(if (selected) R.color.workbench_terminal else R.color.workbench_surface))
                setOnClickListener { selectSession(session.id) }
            }
            sessionList.addView(item, heightParams(MATCH, dp(52)))
        }
    }

    private fun appendTerminal(text: String) {
        val merged = (terminalOutput.text.toString() + text).takeLast(MAX_OUTPUT_CHARS)
        terminalOutput.text = merged
    }

    private fun updateActionState() {
        val hasSession = selectedSessionId != null
        stopButton.isEnabled = hasSession && sessions[selectedSessionId]?.status == "running"
        sendButton.isEnabled = hasSession
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun label(value: String) = TextView(this).apply {
        text = value
        setTextColor(color(R.color.workbench_muted))
        textSize = 13f
        gravity = Gravity.CENTER_VERTICAL
    }

    private fun button(value: String) = Button(this).apply {
        text = value
        isAllCaps = false
        minHeight = 0
        minWidth = 0
        setPadding(dp(4), 0, dp(4), 0)
    }

    private fun color(id: Int): Int = getColor(id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun widthParams(width: Int, height: Int) = LinearLayout.LayoutParams(width, height).apply {
        marginStart = dp(4)
    }

    private fun heightParams(width: Int, height: Int) = LinearLayout.LayoutParams(width, height)

    private fun showError(error: Throwable) = showError(error.message ?: "Request failed")

    private companion object {
        const val MATCH = LinearLayout.LayoutParams.MATCH_PARENT
        const val WRAP = LinearLayout.LayoutParams.WRAP_CONTENT
        const val DEFAULT_ENDPOINT = "http://10.0.2.2:8787"
        const val KEY_ENDPOINT = "gateway_url"
        const val KEY_TOKEN = "gateway_token"
        const val MAX_OUTPUT_CHARS = 200_000
    }
}

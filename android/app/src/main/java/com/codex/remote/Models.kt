package com.codex.remote

data class DevSession(
    val id: String,
    val title: String,
    val status: String,
    val command: String,
    val cwd: String,
    val output: String = "",
)

data class OutputChunk(
    val text: String,
    val cursor: Long,
    val running: Boolean,
    val reset: Boolean = false,
)

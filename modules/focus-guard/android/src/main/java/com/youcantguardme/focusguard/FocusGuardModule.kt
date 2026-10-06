package com.youcantguardme.focusguard

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FocusGuardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FocusGuard")

    AsyncFunction("start") {
      startTime: Double,
      bg: String,
      titleColor: String,
      timerColor: String,
      descColor: String,
      buttonBg: String,
      buttonTextColor: String ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      val intent = Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_START
        putExtra(FocusGuardService.EXTRA_START_TIME, startTime.toLong())
        putExtra(FocusGuardService.EXTRA_BG, bg)
        putExtra(FocusGuardService.EXTRA_TITLE_COLOR, titleColor)
        putExtra(FocusGuardService.EXTRA_TIMER_COLOR, timerColor)
        putExtra(FocusGuardService.EXTRA_DESC_COLOR, descColor)
        putExtra(FocusGuardService.EXTRA_BUTTON_BG, buttonBg)
        putExtra(FocusGuardService.EXTRA_BUTTON_TEXT_COLOR, buttonTextColor)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      null
    }

    AsyncFunction("setAppInForeground") { foreground: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      context.startService(Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_APP_STATE
        putExtra(FocusGuardService.EXTRA_FOREGROUND, foreground)
      })
      null
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      context.startService(Intent(context, FocusGuardService::class.java).apply {
        action = FocusGuardService.ACTION_STOP
      })
      null
    }
  }
}
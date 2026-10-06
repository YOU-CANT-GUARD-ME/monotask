import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

const ANDROID_PACKAGE_NAME = "com.youcantguardme.focusapp";

export function getAndroidPackageName() {
    return Application.applicationId ?? ANDROID_PACKAGE_NAME;
}

export async function openAndroidAppSettings() {
    if (Platform.OS !== "android") return;

    await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${getAndroidPackageName()}` }
    );
}

export async function openAndroidSetting(
    action: IntentLauncher.ActivityAction,
    params?: IntentLauncher.IntentLauncherParams
) {
    if (Platform.OS !== "android") return;

    try {
        await IntentLauncher.startActivityAsync(action, params);
    } catch (error) {
        console.log("Failed to open Android setting:", action, error);
        await openAndroidAppSettings();
    }
}

export async function openOverlayPermissionSettings() {
    await openAndroidSetting(IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION, {
        data: `package:${getAndroidPackageName()}`,
    });
}

export async function openUsageAccessSettings() {
    await openAndroidSetting(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
}

export async function openDndAccessSettings() {
    await openAndroidSetting(IntentLauncher.ActivityAction.NOTIFICATION_POLICY_ACCESS_SETTINGS);
}
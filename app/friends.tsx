// app/friends.tsx
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import {
    acceptFriendRequest,
    FriendDoc,
    getMyFriends,
    removeFriend,
    searchUserByEmail,
    sendFriendRequest,
    UserSearchResult,
} from "../utils/friends";

export default function FriendsScreen() {
    const { width } = useWindowDimensions();
    const scale = width / 390;
    const rs = (n: number) => Math.round(n * scale);
    const router = useRouter();
    const { colors } = useTheme();

    const [searchEmail, setSearchEmail] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<UserSearchResult | null | "not_found">(null);
    const [sendingRequest, setSendingRequest] = useState(false);

    const [friends, setFriends] = useState<FriendDoc[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(true);

    const loadFriends = useCallback(async () => {
        setLoadingFriends(true);
        try {
            const list = await getMyFriends();
            setFriends(list);
        } catch (e) {
            console.warn("loadFriends failed:", e);
            setFriends([]);
        } finally {
            setLoadingFriends(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadFriends();
        }, [loadFriends])
    );

    const handleSearch = async () => {
        if (!searchEmail.trim()) return;
        setSearching(true);
        setSearchResult(null);
        try {
            const result = await searchUserByEmail(searchEmail);
            setSearchResult(result ?? "not_found");
        } catch (e) {
            console.warn("search failed:", e);
            setSearchResult("not_found");
        } finally {
            setSearching(false);
        }
    };

    const handleSendRequest = async (user: UserSearchResult) => {
        setSendingRequest(true);
        try {
            await sendFriendRequest(user.uid, user.displayName, user.email);
            setSearchResult(null);
            setSearchEmail("");
            await loadFriends();
        } catch (e) {
            console.warn("send request failed:", e);
        } finally {
            setSendingRequest(false);
        }
    };

    const handleAccept = async (uid: string) => {
        await acceptFriendRequest(uid);
        await loadFriends();
    };

    const handleRemove = async (uid: string) => {
        await removeFriend(uid);
        await loadFriends();
    };

    const pendingReceived = friends.filter(
        (f) => f.status === "pending" && f.direction === "received"
    );
    const pendingSent = friends.filter(
        (f) => f.status === "pending" && f.direction === "sent"
    );
    const accepted = friends.filter((f) => f.status === "accepted");

    const s = StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        content: { paddingHorizontal: rs(24), paddingBottom: rs(48) },
        headerRow: { marginTop: rs(20), marginBottom: rs(20) },
        headerTitle: {
            fontSize: Math.min(rs(26), 32),
            fontWeight: "800",
            color: colors.text,
        },
        headerSub: { fontSize: rs(13), color: colors.textFaint, marginTop: rs(2) },
        searchRow: {
            flexDirection: "row",
            gap: rs(8),
            marginBottom: rs(16),
        },
        searchInput: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: rs(14),
            paddingHorizontal: rs(16),
            paddingVertical: rs(14),
            fontSize: rs(14),
            color: colors.text,
        },
        searchBtn: {
            backgroundColor: colors.primary,
            borderRadius: rs(14),
            paddingHorizontal: rs(18),
            alignItems: "center",
            justifyContent: "center",
        },
        searchBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: rs(13) },
        resultCard: {
            backgroundColor: colors.surface,
            borderRadius: rs(16),
            padding: rs(16),
            marginBottom: rs(20),
            flexDirection: "row",
            alignItems: "center",
            gap: rs(12),
        },
        resultAvatar: {
            width: rs(40),
            height: rs(40),
            borderRadius: rs(20),
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },
        resultAvatarText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) },
        resultInfo: { flex: 1 },
        resultName: { fontSize: rs(14), fontWeight: "700", color: colors.text },
        resultEmail: { fontSize: rs(12), color: colors.textFaint, marginTop: rs(2) },
        addBtn: {
            backgroundColor: colors.primary,
            borderRadius: rs(12),
            paddingVertical: rs(10),
            paddingHorizontal: rs(16),
        },
        addBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: rs(12) },
        notFoundText: {
            fontSize: rs(13),
            color: colors.textFaint,
            textAlign: "center",
            marginBottom: rs(20),
        },
        sectionLabel: {
            fontSize: rs(11),
            color: colors.textFaint,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: rs(10),
            marginTop: rs(4),
        },
        friendCard: {
            backgroundColor: colors.surface,
            borderRadius: rs(16),
            padding: rs(14),
            marginBottom: rs(10),
            flexDirection: "row",
            alignItems: "center",
            gap: rs(12),
        },
        friendAvatar: {
            width: rs(36),
            height: rs(36),
            borderRadius: rs(18),
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
        },
        friendAvatarText: { color: colors.primary, fontWeight: "800", fontSize: rs(13) },
        friendInfo: { flex: 1 },
        friendName: { fontSize: rs(13), fontWeight: "700", color: colors.text },
        friendEmail: { fontSize: rs(11), color: colors.textFaint, marginTop: rs(1) },
        acceptBtn: {
            backgroundColor: colors.primary,
            borderRadius: rs(10),
            paddingVertical: rs(8),
            paddingHorizontal: rs(12),
        },
        acceptBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: rs(11) },
        declineBtn: {
            backgroundColor: colors.surfaceAlt,
            borderRadius: rs(10),
            paddingVertical: rs(8),
            paddingHorizontal: rs(12),
            marginLeft: rs(6),
        },
        declineBtnText: { color: colors.danger, fontWeight: "700", fontSize: rs(11) },
        emptyText: {
            fontSize: rs(13),
            color: colors.textFaint,
            textAlign: "center",
            paddingVertical: rs(20),
        },
    });

    const initials = (name: string) =>
        name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

    return (
        <SafeAreaView style={s.safe} edges={Platform.OS === "web" ? [] : ["top"]}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.headerRow}>
                    <Text style={s.headerTitle}>친구</Text>
                    <Text style={s.headerSub}>이메일로 친구를 찾아보세요</Text>
                </View>

                <View style={s.searchRow}>
                    <TextInput
                        style={s.searchInput}
                        placeholder="friend@email.com"
                        placeholderTextColor={colors.textFaint}
                        value={searchEmail}
                        onChangeText={setSearchEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
                        {searching ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                            <Text style={s.searchBtnText}>검색</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {searchResult === "not_found" && (
                    <Text style={s.notFoundText}>사용자를 찾을 수 없습니다.</Text>
                )}

                {searchResult && searchResult !== "not_found" && (
                    <View style={s.resultCard}>
                        <View style={s.resultAvatar}>
                            <Text style={s.resultAvatarText}>{initials(searchResult.displayName)}</Text>
                        </View>
                        <View style={s.resultInfo}>
                            <Text style={s.resultName}>{searchResult.displayName}</Text>
                            <Text style={s.resultEmail}>{searchResult.email}</Text>
                        </View>
                        <TouchableOpacity
                            style={s.addBtn}
                            onPress={() => handleSendRequest(searchResult)}
                            disabled={sendingRequest}
                        >
                            <Text style={s.addBtnText}>
                                {sendingRequest ? "..." : "친구 요청"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loadingFriends ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: rs(20) }} />
                ) : (
                    <>
                        {pendingReceived.length > 0 && (
                            <>
                                <Text style={s.sectionLabel}>받은 요청</Text>
                                {pendingReceived.map((f) => (
                                    <View key={f.uid} style={s.friendCard}>
                                        <View style={s.friendAvatar}>
                                            <Text style={s.friendAvatarText}>
                                                {initials(f.displayName ?? "User")}
                                            </Text>
                                        </View>
                                        <View style={s.friendInfo}>
                                            <Text style={s.friendName}>{f.displayName}</Text>
                                            <Text style={s.friendEmail}>{f.email}</Text>
                                        </View>
                                        <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(f.uid)}>
                                            <Text style={s.acceptBtnText}>수락</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={s.declineBtn} onPress={() => handleRemove(f.uid)}>
                                            <Text style={s.declineBtnText}>거절</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}

                        {pendingSent.length > 0 && (
                            <>
                                <Text style={s.sectionLabel}>보낸 요청</Text>
                                {pendingSent.map((f) => (
                                    <View key={f.uid} style={s.friendCard}>
                                        <View style={s.friendAvatar}>
                                            <Text style={s.friendAvatarText}>
                                                {initials(f.displayName ?? "User")}
                                            </Text>
                                        </View>
                                        <View style={s.friendInfo}>
                                            <Text style={s.friendName}>{f.displayName}</Text>
                                            <Text style={s.friendEmail}>대기 중...</Text>
                                        </View>
                                        <TouchableOpacity style={s.declineBtn} onPress={() => handleRemove(f.uid)}>
                                            <Text style={s.declineBtnText}>취소</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}

                        <Text style={s.sectionLabel}>내 친구 ({accepted.length})</Text>
                        {accepted.length === 0 ? (
                            <Text style={s.emptyText}>아직 친구가 없어요</Text>
                        ) : (
                            accepted.map((f) => (
                                <TouchableOpacity
                                    key={f.uid}
                                    style={s.friendCard}
                                    onPress={() => router.push({ pathname: "/friend-profile", params: { uid: f.uid } })}
                                    activeOpacity={0.75}
                                >
                                    <View style={s.friendAvatar}>
                                        <Text style={s.friendAvatarText}>
                                            {initials(f.displayName ?? "User")}
                                        </Text>
                                    </View>
                                    <View style={s.friendInfo}>
                                        <Text style={s.friendName}>{f.displayName}</Text>
                                        <Text style={s.friendEmail}>{f.email}</Text>
                                    </View>
                                    <AppIcon name="chevron-forward" size={rs(14)} color={colors.border} />
                                </TouchableOpacity>
                            ))
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
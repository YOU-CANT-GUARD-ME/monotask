// app/friends.tsx
// Community tab: find people by email, see who you follow and who follows
// you, and (in the 크루 tab) your study crews.
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import CrewsPanel from "../components/CrewsPanel";
import { useTheme } from "../contexts/ThemeContext";
import {
    FollowUser,
    followUser,
    getFollowList,
    searchUserByEmail,
    unfollowUser,
    UserSearchResult,
} from "../utils/follow";

type Tab = "following" | "followers" | "crews";

export default function FriendsScreen() {
    const { width } = useWindowDimensions();
    const scale = width / 390;
    const rs = (n: number) => Math.round(n * scale);
    const router = useRouter();
    const { colors } = useTheme();

    const params = useLocalSearchParams<{ tab?: string }>();
    const [tab, setTab] = useState<Tab>("following");

    // Opened from the follower/following counts on the profile page.
    useEffect(() => {
        if (params.tab === "followers" || params.tab === "following" || params.tab === "crews") {
            setTab(params.tab);
        }
    }, [params.tab]);

    const [searchEmail, setSearchEmail] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<UserSearchResult | null | "not_found">(null);

    const [following, setFollowing] = useState<FollowUser[]>([]);
    const [followers, setFollowers] = useState<FollowUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyUid, setBusyUid] = useState<string | null>(null);

    const loadLists = useCallback(async () => {
        setLoading(true);
        try {
            const [ing, ers] = await Promise.all([
                getFollowList("following"),
                getFollowList("followers"),
            ]);
            setFollowing(ing);
            setFollowers(ers);
        } catch (e) {
            console.warn("load follow lists failed:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLists();
        }, [loadLists])
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

    // Follow or unfollow, updating every place that person appears.
    const toggleFollow = async (user: FollowUser) => {
        if (busyUid) return;
        setBusyUid(user.uid);
        const nowFollowing = !user.isFollowing;
        const patch = (list: FollowUser[]) =>
            list.map((u) => (u.uid === user.uid ? { ...u, isFollowing: nowFollowing } : u));
        try {
            if (nowFollowing) await followUser(user.uid);
            else await unfollowUser(user.uid);

            setFollowers(patch);
            setFollowing((list) =>
                nowFollowing
                    ? list.some((u) => u.uid === user.uid)
                        ? patch(list)
                        : [{ ...user, isFollowing: true }, ...list]
                    : list.filter((u) => u.uid !== user.uid)
            );
            setSearchResult((r) =>
                r && r !== "not_found" && r.uid === user.uid ? { ...r, isFollowing: nowFollowing } : r
            );
        } catch (e) {
            console.warn("follow toggle failed:", e);
        } finally {
            setBusyUid(null);
        }
    };

    const openProfile = (uid: string) =>
        router.push({ pathname: "/friend-profile", params: { uid } });

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
        notFoundText: {
            fontSize: rs(13),
            color: colors.textFaint,
            textAlign: "center",
            marginBottom: rs(20),
        },
        tabRow: {
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: rs(14),
            padding: rs(4),
            marginBottom: rs(16),
        },
        tabBtn: {
            flex: 1,
            alignItems: "center",
            paddingVertical: rs(10),
            borderRadius: rs(11),
        },
        tabBtnActive: { backgroundColor: colors.bg },
        tabText: { fontSize: rs(13), fontWeight: "700", color: colors.textFaint },
        tabTextActive: { color: colors.text },
        card: {
            backgroundColor: colors.surface,
            borderRadius: rs(16),
            padding: rs(14),
            marginBottom: rs(10),
            flexDirection: "row",
            alignItems: "center",
            gap: rs(12),
        },
        avatar: {
            width: rs(36),
            height: rs(36),
            borderRadius: rs(18),
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
        },
        avatarText: { color: colors.primary, fontWeight: "800", fontSize: rs(13) },
        info: { flex: 1 },
        name: { fontSize: rs(13), fontWeight: "700", color: colors.text },
        sub: { fontSize: rs(11), color: colors.textFaint, marginTop: rs(1) },
        followBtn: {
            backgroundColor: colors.primary,
            borderRadius: rs(10),
            paddingVertical: rs(8),
            paddingHorizontal: rs(14),
            minWidth: rs(72),
            alignItems: "center",
        },
        followBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: rs(12) },
        followingBtn: { backgroundColor: colors.surfaceAlt },
        followingBtnText: { color: colors.text },
        emptyText: {
            fontSize: rs(13),
            color: colors.textFaint,
            textAlign: "center",
            paddingVertical: rs(20),
        },
    });

    const initials = (name: string) =>
        name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

    const FollowButton = ({ user }: { user: FollowUser }) =>
        user.isMe ? null : (
            <TouchableOpacity
                style={[s.followBtn, user.isFollowing && s.followingBtn]}
                onPress={() => toggleFollow(user)}
                disabled={busyUid === user.uid}
                activeOpacity={0.8}
            >
                {busyUid === user.uid ? (
                    <ActivityIndicator size="small" color={user.isFollowing ? colors.text : colors.onPrimary} />
                ) : (
                    <Text style={[s.followBtnText, user.isFollowing && s.followingBtnText]}>
                        {user.isFollowing ? "팔로잉" : "팔로우"}
                    </Text>
                )}
            </TouchableOpacity>
        );

    const UserRow = ({ user, subtitle }: { user: FollowUser; subtitle?: string }) => (
        <TouchableOpacity style={s.card} onPress={() => openProfile(user.uid)} activeOpacity={0.75}>
            <View style={s.avatar}>
                <Text style={s.avatarText}>{initials(user.displayName)}</Text>
            </View>
            <View style={s.info}>
                <Text style={s.name}>{user.displayName}</Text>
                {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
            </View>
            <FollowButton user={user} />
        </TouchableOpacity>
    );

    const list = tab === "following" ? following : followers;

    return (
        <SafeAreaView style={s.safe} edges={Platform.OS === "web" ? [] : ["top"]}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.headerRow}>
                    <Text style={s.headerTitle}>커뮤니티</Text>
                    <Text style={s.headerSub}>이메일로 사람을 찾아 팔로우해보세요</Text>
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
                    <View style={{ marginBottom: rs(10) }}>
                        <UserRow user={searchResult} subtitle={searchResult.email} />
                    </View>
                )}

                <View style={s.tabRow}>
                    {(
                        [
                            { key: "following", label: `팔로잉 ${following.length}` },
                            { key: "followers", label: `팔로워 ${followers.length}` },
                            { key: "crews", label: "크루" },
                        ] as { key: Tab; label: string }[]
                    ).map((t) => (
                        <TouchableOpacity
                            key={t.key}
                            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
                            onPress={() => setTab(t.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {tab === "crews" ? (
                    <CrewsPanel rs={rs} colors={colors} />
                ) : loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: rs(20) }} />
                ) : list.length === 0 ? (
                    <Text style={s.emptyText}>
                        {tab === "following" ? "아직 팔로우한 사람이 없어요" : "아직 팔로워가 없어요"}
                    </Text>
                ) : (
                    list.map((u) => <UserRow key={u.uid} user={u} />)
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

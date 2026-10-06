// components/DurationPicker.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MAX_HOURS = 9;
const WEB_SCROLL_IDLE_MS = 220;
const LOOP_REPEAT = 9; // odd number of tiled copies of the data, centered

type WheelColumnProps = {
    data: number[];
    value: number;
    onChange: (value: number) => void;
    rs: (n: number) => number;
    pad?: boolean;
    resetKey: number;
};

function WheelColumn({ data, value, onChange, rs, pad, resetKey }: WheelColumnProps) {
    const { colors } = useTheme();
    const listRef = useRef<FlatList<number>>(null);
    const itemHeight = rs(ITEM_HEIGHT);
    const containerHeight = itemHeight * VISIBLE_ITEMS;
    const paddingVertical = itemHeight * Math.floor(VISIBLE_ITEMS / 2);
    const isMountedRef = useRef(true);

    // Guards against overlapping programmatic scrollToOffset calls — this is
    // what was causing the freeze. While true, any incoming scroll events are
    // ignored so we never issue a second scroll command on top of one that's
    // still settling.
    const isAdjustingRef = useRef(false);

    const n = data.length;
    const middleBlockStart = Math.floor(LOOP_REPEAT / 2) * n;
    const REBUFFER_MARGIN = n * 2;

    const loopData = useMemo(
        () => Array.from({ length: n * LOOP_REPEAT }, (_, i) => data[i % n]),
        [data, n]
    );

    const indexForValue = useCallback(
        (v: number) => middleBlockStart + Math.max(0, data.indexOf(v)),
        [data, middleBlockStart]
    );

    const [liveIndex, setLiveIndex] = useState(() => indexForValue(value));

    const webIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recenterReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        const idx = indexForValue(value);
        setLiveIndex(idx);
        listRef.current?.scrollToOffset({
            offset: idx * itemHeight,
            animated: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (webIdleTimer.current) clearTimeout(webIdleTimer.current);
            if (recenterReleaseTimer.current) clearTimeout(recenterReleaseTimer.current);
        };
    }, []);

    const commitIndex = useCallback(
        (rawIndex: number) => {
            const clamped = Math.max(0, Math.min(loopData.length - 1, rawIndex));
            const next = loopData[clamped];
            setLiveIndex(clamped);
            if (next !== value) onChange(next);
            return clamped;
        },
        [loopData, value, onChange]
    );

    // Only jump when actually close to running out of tiled buffer — with
    // LOOP_REPEAT=9 this rarely fires during normal use.
    const recenterIfNeeded = useCallback(
        (index: number) => {
            if (index >= REBUFFER_MARGIN && index <= loopData.length - REBUFFER_MARGIN) return;
            const idealIndex = middleBlockStart + ((index % n) + n) % n;

            isAdjustingRef.current = true;
            setLiveIndex(idealIndex);
            listRef.current?.scrollToOffset({
                offset: idealIndex * itemHeight,
                animated: false,
            });

            if (recenterReleaseTimer.current) clearTimeout(recenterReleaseTimer.current);
            recenterReleaseTimer.current = setTimeout(() => {
                isAdjustingRef.current = false;
            }, 50);
        },
        [REBUFFER_MARGIN, loopData.length, middleBlockStart, n, itemHeight]
    );

    // Called once scrolling has actually settled. On native, snapToInterval +
    // disableIntervalMomentum already leaves us exactly on an item boundary,
    // so we just read the final position — no extra scrollToOffset needed.
    // On web, snapping isn't reliably native, so we force one animated scroll.
    const handleSettle = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (isAdjustingRef.current) return;

            const y = e.nativeEvent.contentOffset.y;
            const rawIndex = Math.round(y / itemHeight);
            const clamped = commitIndex(rawIndex);

            // Always force a pixel-exact, non-animated correction. This is the
            // only place that ever moves the list after it's settled, so there's
            // no competing correction that can land at a different offset.
            isAdjustingRef.current = true;
            listRef.current?.scrollToOffset({
                offset: clamped * itemHeight,
                animated: false,
            });

            if (recenterReleaseTimer.current) clearTimeout(recenterReleaseTimer.current);
            recenterReleaseTimer.current = setTimeout(() => {
                isAdjustingRef.current = false;
                recenterIfNeeded(clamped);
            }, 50);
        },
        [itemHeight, commitIndex, recenterIfNeeded]
    );

    const updateLiveIndex = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!isMountedRef.current || isAdjustingRef.current) return;
            const now = Date.now();
            if (now - lastUpdateRef.current < 100) return;
            lastUpdateRef.current = now;

            const y = e.nativeEvent.contentOffset.y;
            const index = Math.round(y / itemHeight);
            const clamped = Math.max(0, Math.min(loopData.length - 1, index));
            setLiveIndex((prev) => (prev === clamped ? prev : clamped));

            if (Platform.OS === "web") {
                if (webIdleTimer.current) clearTimeout(webIdleTimer.current);
                const evt = e;
                webIdleTimer.current = setTimeout(() => {
                    if (!isMountedRef.current) return;
                    handleSettle(evt);
                }, WEB_SCROLL_IDLE_MS);
            }
        },
        [itemHeight, loopData.length, handleSettle]
    );

    const s = StyleSheet.create({
        wrap: {
            height: containerHeight,
            width: "100%",
            alignSelf: "stretch",
            position: "relative",
        },
        highlight: {
            position: "absolute",
            top: paddingVertical,
            left: 0,
            right: 0,
            height: itemHeight,
            backgroundColor: colors.primarySoft,
            borderRadius: rs(12),
        },
        item: { height: itemHeight, alignItems: "center", justifyContent: "center" },
        itemText: { fontSize: rs(16), color: colors.textFaint, fontWeight: "600" },
        itemTextActive: { fontSize: rs(20), color: colors.primary, fontWeight: "800" },
    });

    return (
        <View style={s.wrap}>
            <View style={s.highlight} pointerEvents="none" />
            <FlatList
                ref={listRef}
                data={loopData}
                keyExtractor={(_, index) => String(index)}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                snapToAlignment="start"
                disableIntervalMomentum
                decelerationRate="fast"
                initialScrollIndex={liveIndex}
                scrollEventThrottle={32}
                onScroll={updateLiveIndex}
                getItemLayout={(_, index) => ({
                    length: itemHeight,
                    offset: itemHeight * index,
                    index,
                })}
                onScrollToIndexFailed={(info) => {
                    listRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: false,
                    });
                }}
                contentContainerStyle={{ paddingVertical }}
                onMomentumScrollEnd={(e) => {
                    if (webIdleTimer.current) clearTimeout(webIdleTimer.current);
                    handleSettle(e);
                }}
                renderItem={({ item, index }) => {
                    const active = index === liveIndex;
                    const label = pad ? String(item).padStart(2, "0") : String(item);
                    return (
                        <View style={s.item}>
                            <Text style={active ? s.itemTextActive : s.itemText}>{label}</Text>
                        </View>
                    );
                }}
            />
        </View>
    );
}

type Props = {
    hours: number;
    minutes: number;
    seconds: number;
    onChange: (hours: number, minutes: number, seconds: number) => void;
    rs: (n: number) => number;
    resetKey?: number;
};

export default function TimeWheelPicker({
    hours,
    minutes,
    seconds,
    onChange,
    rs,
    resetKey = 0,
}: Props) {
    const { colors } = useTheme();

    const hourData = useMemo(() => Array.from({ length: MAX_HOURS + 1 }, (_, i) => i), []);
    const minSecData = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

    const s = StyleSheet.create({
        row: { flexDirection: "row", alignItems: "flex-start", width: "100%" },
        colWrap: { flex: 1, alignItems: "stretch" },
        unitLabel: {
            fontSize: rs(11),
            color: colors.textFaint,
            fontWeight: "700",
            marginTop: rs(6),
            textAlign: "center",
        },
    });

    return (
        <View style={s.row}>
            <View style={s.colWrap}>
                <WheelColumn
                    data={hourData}
                    value={hours}
                    onChange={(h) => onChange(h, minutes, seconds)}
                    rs={rs}
                    resetKey={resetKey}
                />
                <Text style={s.unitLabel}>시간</Text>
            </View>
            <View style={s.colWrap}>
                <WheelColumn
                    data={minSecData}
                    value={minutes}
                    onChange={(m) => onChange(hours, m, seconds)}
                    rs={rs}
                    pad
                    resetKey={resetKey}
                />
                <Text style={s.unitLabel}>분</Text>
            </View>
            <View style={s.colWrap}>
                <WheelColumn
                    data={minSecData}
                    value={seconds}
                    onChange={(sec) => onChange(hours, minutes, sec)}
                    rs={rs}
                    pad
                    resetKey={resetKey}
                />
                <Text style={s.unitLabel}>초</Text>
            </View>
        </View>
    );
}
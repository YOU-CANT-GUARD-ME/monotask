import React from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

type IconName = "home" | "book" | "stats" | "user" | "lock" | "bellOff" | "people";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export default function MonoIcon({ name, size = 24, color = "#26221A" }: Props) {
  if (name === "home") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4 11.2L12 4L20 11.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6.8 10.2V20H17.2V10.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 20V15H14V20" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (name === "book") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 5.5C5 4.7 5.7 4 6.5 4H19V18.5H6.5C5.7 18.5 5 19.2 5 20V5.5Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5 20C5 19.2 5.7 18.5 6.5 18.5H19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="8" y1="8" x2="16" y2="8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === "stats") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Line x1="5" y1="20" x2="20" y2="20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Rect x="6.5" y="11" width="2.8" height="6" rx="1.2" stroke={color} strokeWidth={2.2} />
        <Rect x="11" y="7" width="2.8" height="10" rx="1.2" stroke={color} strokeWidth={2.2} />
        <Rect x="15.5" y="4" width="2.8" height="13" rx="1.2" stroke={color} strokeWidth={2.2} />
      </Svg>
    );
  }

  if (name === "user") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth={2.2} />
        <Path d="M5.5 20C6.4 16.8 8.8 15 12 15C15.2 15 17.6 16.8 18.5 20" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (name === "people") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="8" r="2.8" stroke={color} strokeWidth={2.2} />
        <Path d="M4 19C4.7 16.3 6.6 15 9 15C11.4 15 13.3 16.3 14 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="16.5" cy="9" r="2.2" stroke={color} strokeWidth={2.2} />
        <Path d="M14.8 15.2C17.3 15.4 18.8 16.6 19.4 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (name === "lock") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="10" width="14" height="10" rx="3" stroke={color} strokeWidth={2.2} />
        <Path d="M8.2 10V7.8C8.2 5.7 9.8 4 12 4C14.2 4 15.8 5.7 15.8 7.8V10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="12" y1="14" x2="12" y2="16.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 17H16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M6.5 17C7.3 15.8 7.8 14.5 7.8 12.8V10C7.8 7.8 9.4 6.2 11.5 6.2C13.6 6.2 15.2 7.8 15.2 10V12.8C15.2 14.5 15.7 15.8 16.5 17" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.3 20C10.7 20.6 11.2 21 12 21C12.8 21 13.3 20.6 13.7 20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
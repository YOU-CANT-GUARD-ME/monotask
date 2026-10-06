import React from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

type Props = {
  name: string;
  size?: number;
  color?: any;
  style?: any;
};

function normalize(name: string) {
  return String(name || "")
    .replace("-outline", "")
    .replace("-o", "");
}

export default function AppIcon({ name, size = 24, color = "#26221A", style }: Props) {
  const n = normalize(name);

  if (["home", "house.fill"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M4 11.2L12 4L20 11.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6.8 10.2V20H17.2V10.2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 20V15H14V20" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["book"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M5 5.5C5 4.7 5.7 4 6.5 4H19V18.5H6.5C5.7 18.5 5 19.2 5 20V5.5Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5 20C5 19.2 5.7 18.5 6.5 18.5H19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="8" y1="8" x2="16" y2="8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["stats-chart", "bar-chart"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Line x1="5" y1="20" x2="20" y2="20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Rect x="6.5" y="11" width="2.8" height="6" rx="1.2" stroke={color} strokeWidth={2.2} />
        <Rect x="11" y="7" width="2.8" height="10" rx="1.2" stroke={color} strokeWidth={2.2} />
        <Rect x="15.5" y="4" width="2.8" height="13" rx="1.2" stroke={color} strokeWidth={2.2} />
      </Svg>
    );
  }

  if (["user", "person", "user-o"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth={2.2} />
        <Path d="M5.5 20C6.4 16.8 8.8 15 12 15C15.2 15 17.6 16.8 18.5 20" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["lock"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Rect x="5" y="10" width="14" height="10" rx="3" stroke={color} strokeWidth={2.2} />
        <Path d="M8.2 10V7.8C8.2 5.7 9.8 4 12 4C14.2 4 15.8 5.7 15.8 7.8V10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="12" y1="14" x2="12" y2="16.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["close", "close-circle"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        {name.includes("circle") && <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.2} />}
        <Line x1="8" y1="8" x2="16" y2="16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1="16" y1="8" x2="8" y2="16" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["checkmark"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Polyline points="5,12.5 10,17.2 19,6.8" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["chevron-forward", "chevron-right", "chevron.right"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M9 5L16 12L9 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["chevron-back", "arrow-back"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M15 5L8 12L15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["time", "clock"].includes(n) || n === "clock-o") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.2} />
        <Path d="M12 7.5V12L15.2 14" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["calendar", "calendar-check"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Rect x="5" y="6" width="14" height="13" rx="2.5" stroke={color} strokeWidth={2.2} />
        <Line x1="8" y1="4" x2="8" y2="8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="16" y1="4" x2="16" y2="8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="5" y1="10" x2="19" y2="10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["image"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Rect x="5" y="5" width="14" height="14" rx="3" stroke={color} strokeWidth={2.2} />
        <Circle cx="9" cy="9" r="1.2" fill={color} />
        <Path d="M7 17L11 13L13.5 15.5L15.2 13.8L18 17" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["trash"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M5 7H19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M9 7V5H15V7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8 10V19H16V10" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["create", "pencil"].includes(n)) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M15.5 4.5L19.5 8.5L8 20H4V16L15.5 4.5Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="13.5" y1="6.5" x2="17.5" y2="10.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

  if (["help-circle", "information-circle", "alert-circle"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.2} />
        <Line x1="12" y1="16.5" x2="12" y2="16.6" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
        <Path d="M10 9.4C10.4 8.5 11.1 8 12.2 8C13.5 8 14.4 8.8 14.4 10C14.4 11.5 12.6 11.8 12.3 13.3" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["play"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M8 5.5L18 12L8 18.5V5.5Z" fill={color} />
      </Svg>
    );
  }

  if (["flame", "fire"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M12 21C8.5 21 6 18.6 6 15.2C6 12.5 7.6 10.8 9.1 9.2C10.2 8 11.2 6.8 11.2 5C14.2 6.4 17.5 9.7 17.5 14.8C17.5 18.5 15.2 21 12 21Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["sparkles"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M12 3L13.6 8.4L19 10L13.6 11.6L12 17L10.4 11.6L5 10L10.4 8.4L12 3Z" stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
        <Path d="M18 15L18.7 17.3L21 18L18.7 18.7L18 21L17.3 18.7L15 18L17.3 17.3L18 15Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["refresh"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M18 8C16.8 6.2 14.8 5 12.5 5C8.9 5 6 7.9 6 11.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M18 5V8H15" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6 16C7.2 17.8 9.2 19 11.5 19C15.1 19 18 16.1 18 12.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M6 19V16H9" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["add"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["notifications", "bell"].includes(n) || n === "bell-o") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M8 17H16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M6.5 17C7.3 15.8 7.8 14.5 7.8 12.8V10C7.8 7.8 9.4 6.2 12 6.2C14.6 6.2 16.2 7.8 16.2 10V12.8C16.2 14.5 16.7 15.8 17.5 17" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10.3 20C10.7 20.6 11.2 21 12 21C12.8 21 13.3 20.6 13.7 20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["log-out", "sign-out"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M10 5H6V19H10" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13 12H20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M17 8L21 12L17 16" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["sunny"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={2.2} />
        <Line x1="12" y1="3" x2="12" y2="5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="12" y1="19" x2="12" y2="21" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="3" y1="12" x2="5" y2="12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1="19" y1="12" x2="21" y2="12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["moon"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M18.5 15.5C17.2 16.4 15.8 16.8 14.2 16.8C10.3 16.8 7.2 13.7 7.2 9.8C7.2 8.2 7.6 6.8 8.5 5.5C5.9 6.7 4 9.4 4 12.5C4 16.6 7.4 20 11.5 20C14.6 20 17.3 18.1 18.5 15.5Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["phone-portrait"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Rect x="7" y="3.5" width="10" height="17" rx="2.5" stroke={color} strokeWidth={2.2} />
        <Line x1="11" y1="17" x2="13" y2="17" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["leaf"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M19 5C12 5 6 9.5 6 15.5C6 17.8 7.7 19 9.7 19C15.7 19 19 12 19 5Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6 19C8.5 14.5 11.5 11.5 16 9" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["flash"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M13 3L6 13H11L10 21L18 10H13L13 3Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["globe", "earth", "public"].includes(n)) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle
        cx="12"
        cy="12"
        r="8"
        stroke={color}
        strokeWidth={2.2}
      />
      <Path
        d="M4 12H20"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M12 4C14.2 6.2 15.2 9 15.2 12C15.2 15 14.2 17.8 12 20"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M12 4C9.8 6.2 8.8 9 8.8 12C8.8 15 9.8 17.8 12 20"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

  if (["bulb"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M8 11C8 8.8 9.8 7 12 7C14.2 7 16 8.8 16 11C16 12.5 15.2 13.7 14 14.5V17H10V14.5C8.8 13.7 8 12.5 8 11Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
        <Line x1="10" y1="20" x2="14" y2="20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["paint-brush"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M14 6L18 10L10 18C8.5 19.5 6 19 5 20C6 18 4.5 16.5 6 15L14 6Z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 5L19 9" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (["history"].includes(n)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path d="M7 8H4V5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5 8C6.5 5.5 9.1 4 12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20C9.3 20 6.9 18.7 5.5 16.7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M12 8V12L15 14" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (["search"].includes(n)) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={2.2} />
      <Line x1="15.3" y1="15.3" x2="20" y2="20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

if (["people", "group", "users"].includes(n)) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {/* Left person */}
      <Circle cx="9" cy="9" r="2.5" stroke={color} strokeWidth={2.2} />
      <Path
        d="M5.8 18C6.2 15.8 7.6 14.5 9.5 14.5C11.4 14.5 12.8 15.8 13.2 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />

      {/* Right person */}
      <Circle cx="16" cy="10" r="2.2" stroke={color} strokeWidth={2.2} />
      <Path
        d="M13.8 18C14.1 16.3 15.2 15.2 16.8 15.2C18.4 15.2 19.5 16.3 19.8 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={2.2} />
      <Line x1="12" y1="8" x2="12" y2="12.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="12" y1="16" x2="12" y2="16.1" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
  );
}

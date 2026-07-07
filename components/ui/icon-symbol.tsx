import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";
import AppIcon from "../AppIcon";

type IconSymbolName =
  | "house.fill"
  | "paperplane.fill"
  | "chevron.left.forwardslash.chevron.right"
  | "chevron.right";

const MAPPING: Record<IconSymbolName, string> = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-forward",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: SymbolViewProps["name"];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <AppIcon
      name={MAPPING[name as IconSymbolName] || "help-circle-outline"}
      size={size}
      color={color}
      style={style}
    />
  );
}

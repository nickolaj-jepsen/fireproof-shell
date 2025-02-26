import Hyprland from "gi://AstalHyprland";
import { App, type Gdk } from "astal/gtk4";
import config from "../config";

export type SecondaryMonitor = Gdk.Monitor & {
  relation: "left" | "right" | "top" | "bottom";
};

export const getMonitors = (): {
  main: Gdk.Monitor;
  secondary: SecondaryMonitor[];
} => {
  const scanFn = [
    // Monitor in config
    (monitor: Gdk.Monitor) => config.monitor.main === monitor.get_connector(),
    // First monitor
    () => true,
  ];

  const monitors = App.get_monitors();
  const main =
    scanFn.map((fn) => monitors.find(fn)).find((m) => m) || monitors[0];
  const secondary = monitors
    .filter((m) => m !== main)
    .map((m) => {
      const monitor = m as SecondaryMonitor;
      const { x: mx, y: my } = main.get_geometry();
      const { x, y } = m.get_geometry();

      const verticalDiff = Math.abs(y - my);
      const horizontalDiff = Math.abs(x - mx);

      if (verticalDiff > horizontalDiff) {
        monitor.relation = y < my ? "top" : "bottom";
      } else {
        monitor.relation = x < mx ? "left" : "right";
      }

      return monitor;
    });
  return { main, secondary };
};

export const activeMonitor = (): Gdk.Monitor => {
  const hypr = Hyprland.get_default();
  const hyprMonitor = hypr.focusedMonitor;
  const monitors = App.get_monitors();
  for (const monitor of monitors) {
    if (monitor.get_connector() === hyprMonitor.get_name()) return monitor;
  }

  throw new Error("No active monitor found");
};

export function getHyprlandMonitor(monitor: Gdk.Monitor): Hyprland.Monitor {
  const hyprland = Hyprland.get_default();
  const monitors = hyprland.get_monitors();
  for (const hyprmonitor of monitors) {
    if (hyprmonitor.get_name() === monitor.get_connector()) return hyprmonitor;
  }

  throw new Error("GDK monitor does not map to a Hyprland monitor");
}

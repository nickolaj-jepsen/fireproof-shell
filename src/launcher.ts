import { Gdk } from "astal/gtk4";
import Launcher from "./launcher/Launcher";

export default function launcher(monitor: Gdk.Monitor, res: () => void) {
  return Launcher(monitor, res);
}

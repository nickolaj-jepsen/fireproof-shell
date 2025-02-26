import { Variable } from "astal";
import { App, Astal, Gdk, Gtk } from "astal/gtk4";
import { SearchEntry } from "../widgets";
const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor;

const size = (monitor: Gdk.Monitor): { mx: number; my: number } => {
  const { width, height } = monitor.get_geometry();
  return {
    mx: (width - 800) / 2,
    my: (height - 600) / 2,
  };
};

export default function Launcher(monitor: Gdk.Monitor, res: () => void) {
  const ref: Variable<Gtk.Window | undefined> = Variable(undefined);
  const { mx, my } = size(monitor);

  const close = () => {
    ref?.get()?.close();
    res();
  };

  return (
    <window
      visible
      name={"launcher"}
      gdkmonitor={monitor}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT | BOTTOM}
      application={App}
      onKeyPressed={(self, keyval) => {
        if (keyval === Gdk.KEY_Escape) {
          close();
        }
      }}
      setup={(self) => {
        ref.set(self);
      }}
    >
      <overlay>
        <box
          type="overlay"
          cssClasses={["launcher"]}
          marginTop={my}
          marginStart={mx}
          marginBottom={my}
          marginEnd={mx}
          vertical
        >
          <SearchEntry cssClasses={["launcher--search"]} hexpand></SearchEntry>
          <box cssClasses={["launcher--results"]} hexpand vexpand>
            Results...
          </box>
        </box>
        <box cssClasses={["launcher--backdrop"]} onButtonPressed={close}></box>
      </overlay>
    </window>
  );
}

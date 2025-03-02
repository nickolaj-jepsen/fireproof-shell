import { bind, exec, idle, subprocess, timeout, Variable } from "astal";
import { App, Astal, Gdk, Gtk, hook } from "astal/gtk4";
import { ScrolledWindow, SearchEntry } from "../widgets";
import Apps from "gi://AstalApps";
import Pango from "gi://Pango?version=1.0";
import config from "../config";
import { activeMonitor } from "../utils/monitors";

const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor;

const LAUNCHER_NAME = "launcher";

export const openLauncher = () => {
  const launcher = App.get_window(LAUNCHER_NAME);
  if (!launcher) {
    throw new Error("Launcher is not enabled!");
  }

  launcher.show();
};

const closeLauncher = () => {
  const launcher = App.get_window(LAUNCHER_NAME);
  if (!launcher) {
    throw new Error("Launcher is not enabled!");
  }

  launcher.hide();
};

export default function Launcher() {
  const apps = new Apps.Apps();

  const lineHeight = Variable(0);
  const size = Variable({ mx: 100, my: 100 });
  const mx = size((size) => size.mx);
  const my = size((size) => size.my);

  const search = Variable("");
  const buffer = new Gtk.EntryBuffer();
  buffer.connect("inserted-text", (self) => search.set(self.text));
  buffer.connect("deleted-text", (self, position) =>
    search.set(self.text.substring(0, position)),
  );

  const selected = Variable(0);

  const results = search((search) => {
    return apps.exact_query(search);
  });

  const moveCursor = (direction: number) => {
    if (selected.get() + direction <= 0) {
      selected.set(0);
    } else if (selected.get() + direction >= results.get().length - 1) {
      selected.set(results.get().length - 1);
    } else {
      selected.set(selected.get() + direction);
    }
  };

  const onKeyPressed = (
    _: unknown,
    keyval: number,
    keycode: number,
    state: Gdk.ModifierType,
  ) => {
    if (keyval === Gdk.KEY_Escape) {
      closeLauncher();
    }
    if (keyval === Gdk.KEY_Up) {
      moveCursor(-1);
    }
    if (keyval === Gdk.KEY_Down) {
      moveCursor(1);
    }
  };

  const open = (app: Apps.Application) => {
    if (config.launcher.uwsm) {
      // When not app.launch(), we need to increase the frequency manually
      app.set_frequency(app.get_frequency() + 1);
      subprocess("uwsm app -t service -- " + app.entry);
    } else {
      app.launch();
    }

    closeLauncher();
  };

  return (
    <window
      name={LAUNCHER_NAME}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | LEFT | RIGHT | BOTTOM}
      application={App}
      onKeyPressed={onKeyPressed}
      onNotifyVisible={(self) => {
        // Reset state when launcher is opened / closed
        search.set("");
        buffer.text = "";
        selected.set(0);

        const { width, height } = activeMonitor().get_geometry();
        size.set({
          mx: (width - 800) / 2,
          my: (height - 600) / 2,
        });
      }}
    >
      <overlay onHoverLeave={() => closeLauncher()}>
        <box
          type="overlay"
          cssClasses={["launcher"]}
          marginTop={my}
          marginStart={mx}
          marginBottom={my}
          marginEnd={mx}
          vertical
        >
          <entry
            cssClasses={["launcher__search"]}
            buffer={buffer}
            onChanged={(x) => {
              selected.set(0);
            }}
            onActivate={() => {
              open(results.get()[selected.get()]);
            }}
          />
          <ScrolledWindow
            canFocus={false}
            vexpand
            setup={(self) => {
              hook(self, selected, (_self, selected: number) => {
                // Move the scroll when the selected item is out of view
                const height = self.get_size(Gtk.Orientation.VERTICAL);
                const currentPos = self.vadjustment.get_value();
                const lh = lineHeight.get();

                if (selected * lh < currentPos) {
                  self.vadjustment.set_value(selected * lh);
                } else if ((selected + 1) * lh > currentPos + height) {
                  self.vadjustment.set_value((selected + 1) * lh - height);
                }
              });
            }}
          >
            <box cssClasses={["launcher__results"]} vertical>
              {results.as((results) => {
                return results.map((result, index) => {
                  return (
                    <box
                      cssClasses={selected((selected) =>
                        selected === index
                          ? ["launcher__result", "launcher__result--selected"]
                          : ["launcher__result"],
                      )}
                      onHoverEnter={() => {
                        selected.set(index);
                      }}
                      onButtonReleased={() => {
                        open(result);
                      }}
                      setup={(self) => {
                        lineHeight.set(
                          self.get_preferred_size()[0]?.height ?? 0,
                        );
                      }}
                    >
                      <image
                        iconName={result.iconName ?? ""}
                        cssClasses={["launcher__result__icon"]}
                        pixelSize={32}
                      />
                      <box vertical valign={Gtk.Align.START}>
                        <label
                          label={result.name}
                          halign={Gtk.Align.START}
                          ellipsize={Pango.EllipsizeMode.END}
                          cssClasses={["launcher__result__name"]}
                        />
                        <label
                          label={result.description}
                          halign={Gtk.Align.START}
                          cssClasses={["launcher__result__description"]}
                          ellipsize={Pango.EllipsizeMode.END}
                        />
                      </box>
                    </box>
                  );
                });
              })}
            </box>
          </ScrolledWindow>
        </box>
        <box
          cssClasses={["launcher__backdrop"]}
          onButtonReleased={() => closeLauncher()}
        ></box>
      </overlay>
    </window>
  );
}

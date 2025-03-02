import { bind, exec, idle, subprocess, timeout, Variable } from "astal";
import { App, Astal, Gdk, Gtk, hook } from "astal/gtk4";
import { ScrolledWindow, SearchEntry } from "../widgets";
import Apps from "gi://AstalApps";
import Pango from "gi://Pango?version=1.0";
import config from "../config";
import { activeMonitor } from "../utils/monitors";
import clamp from "../utils/clamp";
import {
  defaultPlugin,
  LauncherPlugin,
  launcherPlugins,
  parseQuery,
} from "./plugins";

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
  const lineHeight = Variable(0);
  const size = Variable({ mx: 100, my: 100 });
  const mx = size((size) => size.mx);
  const my = size((size) => size.my);

  const selected = Variable(0);
  const entryRef = Variable<Gtk.Entry | null>(null);
  const search = Variable("");
  const resultLength = Variable(0); // Cache the length of the results so we don't have to recalculate it every time the cursor moves

  const setSearch = (query: string) => {
    search.set(query);
    selected.set(0);
  };

  const currentPlugin = bind(search).as((search) => {
    return parseQuery(search)[0];
  });

  const results = bind(search).as((search) => {
    const [plugin, query] = parseQuery(search);
    const result = plugin.query(query);
    resultLength.set(result.length);
    return result;
  });

  const setPlugin = (plugin: LauncherPlugin) => {
    const entry = entryRef.get();
    if (!entry) {
      console.error("Gtk.Entry not found");
      return;
    }

    const existingQuery = search.get();
    const oldCommand = currentPlugin.get().command;

    const cleanedQuery =
      oldCommand === "<default>"
        ? existingQuery
        : existingQuery.replace(new RegExp(`^${oldCommand} `), "");

    const newQuery =
      plugin.command === "<default>"
        ? cleanedQuery
        : `${plugin.command} ${cleanedQuery}`;

    const cursorDelta = newQuery.length - existingQuery.length;
    const [isSelection, start, end] = entry.get_selection_bounds();

    // Update text
    entry.delete_text(0, -1);
    entry.insert_text(newQuery, -1, 0);

    // Update cursor
    idle(() => {
      const newStart = Math.max(start + cursorDelta, 0);
      if (isSelection) {
        entry.select_region(newStart, end + cursorDelta);
      } else {
        entry.set_position(newStart);
      }
    });
  };

  const moveCursor = (direction: number) => {
    const newValue = selected.get() + direction;
    const max = resultLength.get() - 1;
    selected.set(clamp(newValue, 0, max));
  };

  const cyclePlugin = (direction: number) => {
    const plugins = [defaultPlugin, ...launcherPlugins];
    const currentIndex = plugins.indexOf(currentPlugin.get());
    const newIndex = currentIndex + direction;
    if (newIndex < 0) {
      setPlugin(plugins[plugins.length - 1]);
    } else if (newIndex >= plugins.length) {
      setPlugin(plugins[0]);
    } else {
      setPlugin(plugins[newIndex]);
    }
  };

  const onKeyPressed = (
    _: unknown,
    keyval: number,
    keycode: number,
    state: Gdk.ModifierType,
  ) => {
    const shift = state & Gdk.ModifierType.SHIFT_MASK ? true : false;
    if (keyval === Gdk.KEY_ISO_Left_Tab) cyclePlugin(-1); // My keyboard produces this keyval for Shift+Tab ????
    if (shift && keyval === Gdk.KEY_Tab) cyclePlugin(-1);
    if (!shift && keyval === Gdk.KEY_Tab) cyclePlugin(1);
    if (keyval === Gdk.KEY_Escape) closeLauncher();
    if (keyval === Gdk.KEY_Up) moveCursor(-1);
    if (keyval === Gdk.KEY_Down) moveCursor(1);
  };
  const onKeyReleased = (
    _: unknown,
    keyval: number,
    keycode: number,
    state: Gdk.ModifierType,
  ) => {
    const ctrl = state & Gdk.ModifierType.CONTROL_MASK;
    if (ctrl && keyval === Gdk.KEY_c) closeLauncher();
  };

  const reset = () => {
    search.set("");
    entryRef.get()?.set_text("");
    selected.set(0);
  };

  const resize = () => {
    const { width, height } = activeMonitor().get_geometry();
    size.set({
      mx: (width - 800) / 2,
      my: (height - 600) / 2,
    });
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
      onKeyReleased={onKeyReleased}
      onNotifyVisible={(self) => {
        if (self.visible) {
          reset();
          resize();
        }
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
            setup={(self) => {
              entryRef.set(self);
            }}
            onNotifyText={(self) => {
              setSearch(self.text);
            }}
            onActivate={() => {
              results.get()[selected.get()].action();
              closeLauncher();
            }}
          />
          <box spacing={10} canFocus={false}>
            {currentPlugin.as((currentPlugin) => {
              return [defaultPlugin, ...launcherPlugins].map((plugin) => (
                <button
                  label={plugin.name}
                  cssClasses={
                    plugin === currentPlugin
                      ? ["launcher__plugin", "launcher__plugin--selected"]
                      : ["launcher__plugin"]
                  }
                  onClicked={() => setPlugin(plugin)}
                />
              ));
            })}
          </box>
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
                        result.action();
                        closeLauncher();
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
                      <box vertical valign={Gtk.Align.CENTER}>
                        <label
                          label={result.name}
                          halign={Gtk.Align.START}
                          ellipsize={Pango.EllipsizeMode.END}
                          cssClasses={["launcher__result__name"]}
                        />
                        {result.description && (
                          <label
                            label={result.description}
                            halign={Gtk.Align.START}
                            cssClasses={["launcher__result__description"]}
                            ellipsize={Pango.EllipsizeMode.END}
                          />
                        )}
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

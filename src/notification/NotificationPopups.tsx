import Notifd from "gi://AstalNotifd";
import { Variable, bind, interval, timeout } from "astal";
import { App, hook } from "astal/gtk4";
import { Astal, Gdk, Gtk } from "astal/gtk4";
import config from "../config";
import { VarMap } from "../utils/var-map";
import Notification from "./Notification";
import { ScrolledWindow } from "../widgets";
import { compareMany, patternsToCompare } from "../utils/ignore";

class NotificationMap extends VarMap<number, Gtk.Widget> {
  #notifd = Notifd.get_default();

  get() {
    return [...this.map.entries()].sort(([a], [b]) => b - a).map(([_, v]) => v);
  }

  constructor() {
    super();
    const ignore = patternsToCompare(config.notification.ignore);

    this.#notifd.connect("notified", (_, id) => {
      const notification = this.#notifd.get_notification(id);
      if (notification === null) {
        return;
      }

      // Ignore notifications based on the app name
      if (compareMany(notification.app_name, ignore)) {
        notification.dismiss();
        return;
      }

      this.set(id, Notification({ notification }));
    });

    // notifications can be closed by the outside before
    // any user input, which have to be handled too
    this.#notifd.connect("resolved", (_, id) => {
      this.delete(id);
    });
  }
}

export default function NotificationPopups(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT } = Astal.WindowAnchor;
  const notificationsMap = new NotificationMap();
  const count = bind(notificationsMap).as((map) => map.length);

  return (
    <window
      name={"notifications"}
      application={App}
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | RIGHT}
      visible={count.as((n) => n > 0)}
      vexpand={true}
      valign={Gtk.Align.START}
      setup={(self) => {
        hook(self, notificationsMap, (self, _) => {
          self.queue_allocate();
        });
      }}
    >
      <box vertical={true}>
        <box
          visible={count.as((n) => n > 1)}
          cssClasses={["notification__menu"]}
          halign={Gtk.Align.END}
          spacing={20}
        >
          <label
            cssClasses={["notification__menu__count"]}
            xalign={0}
            label={count.as((n) =>
              n === 1 ? "1 notification" : `${n} notifications`
            )}
          />
          <button
            onClicked={() => {
              notificationsMap.clear();
            }}
            cssClasses={["button"]}
            cursor={Gdk.Cursor.new_from_name("pointer", null)}
            label="Dismiss all"
          />
        </box>
        {bind(notificationsMap).as((map) => map.slice(0, 50))}
      </box>
    </window>
  );
}

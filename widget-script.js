// CRE Market Monitor widget for Scriptable (iPhone)
//
// Change what's shown: open Scriptable, tap this script, choose "Choose datapoints".
// Per-widget override: type short names in the widget's Parameter box, e.g. 10Y, BBB, LUMBER
//
// Lock screen: rectangular (4 numbers in one row), inline (2, above the clock), circular (1).
// Home screen: small or medium (all picks).
// Next meeting: type MEETINGS in a widget's Parameter box to show your next meeting instead.

const DATA_URL = "https://tmart709.github.io/cre-market-monitor/data/market.json";
const DASHBOARD_URL = "https://tmart709.github.io/cre-market-monitor/";
const MAX_PICKS = 4;
const DEFAULT_PICKS = ["yahoo:^TNX", "fred:SOFR", "yahoo:CL=F", "yahoo:HRC=F"];

// Short names for the lock screen; anything not listed uses its ticker symbol
const SHORT = {
  "^TNX": "10Y", "^FVX": "5Y", "^TYX": "30Y", "^IRX": "3M", DGS2: "2Y", DGS7: "7Y",
  SOFR: "SOFR", DFF: "FED", BAMLC0A4CBBB: "BBB", MORTGAGE30US: "MTG",
  "HRC=F": "STEEL", "LBR=F": "LUMBER", "HG=F": "COPPER", "CL=F": "OIL", "BZ=F": "BRENT", "HO=F": "DIESEL",
  WPUSI012011: "CONST PPI", WPU1017: "STEEL PPI", PCU327320327320: "CONCRETE",
  TLNRESCONS: "NONRES", CREACBW027SBOG: "CRE LOANS", DRCRELEXFACBS: "CRE DELINQ",
  "^VIX": "VIX", "DX-Y.NYB": "DXY",
};

// Meeting widget: calendar names to ignore, e.g. ["Holidays", "Birthdays"]
const SKIP_CALENDARS = ["Holidays", "US Holidays", "Birthdays", "Siri Suggestions"];
const MEETING_WORDS = ["MEETINGS", "MEETING", "CALENDAR", "CAL"];

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "cre-market.json");
const picksPath = fm.joinPath(fm.documentsDirectory(), "cre-picks.json");

// ---- data ----

async function loadData() {
  try {
    const req = new Request(DATA_URL + "?t=" + Date.now());
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    fm.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath));
    return null;
  }
}

function allItems(data) {
  const out = [];
  for (const g of data.groups) for (const i of g.items) out.push(i);
  return out;
}

function shortName(item) {
  return SHORT[item.symbol] || item.symbol.replace(/^\^/, "").replace(/=F$/, "");
}

function loadPicks() {
  try {
    if (fm.fileExists(picksPath)) return JSON.parse(fm.readString(picksPath));
  } catch (e) {}
  return DEFAULT_PICKS.slice();
}

function savePicks(keys) {
  fm.writeString(picksPath, JSON.stringify(keys));
}

// Widget Parameter like "10Y, BBB, LUMBER" (short names, tickers or labels)
function picksFromParameter(param, items) {
  const wanted = param.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const keys = [];
  for (const w of wanted) {
    const hit = items.find((i) =>
      shortName(i).toUpperCase() === w || i.symbol.toUpperCase() === w || i.label.toUpperCase() === w);
    if (hit && !keys.includes(hit.key)) keys.push(hit.key);
  }
  return keys;
}

function picked(data, keys) {
  const byKey = {};
  for (const i of allItems(data)) byKey[i.key] = i;
  return keys.map((k) => byKey[k]).filter(Boolean).map((item) => ({ item, short: shortName(item) }));
}

// ---- formatting ----

function fmtValue(item) {
  const v = item.value;
  switch (item.unit) {
    case "pct": return v.toFixed(2) + "%";
    case "index": return v.toFixed(Math.abs(v) >= 100 ? 1 : 2);
    case "bn": return "$" + Math.round(v).toLocaleString("en-US") + "B";
    default: return Math.abs(v) >= 1000 ? "$" + Math.round(v).toLocaleString("en-US") : "$" + v.toFixed(2);
  }
}

function fmtChange(item) {
  if (item.prev == null) return { text: "", dir: 0 };
  const diff = item.value - item.prev;
  const dir = Math.abs(diff) < 1e-9 ? 0 : diff > 0 ? 1 : -1;
  const arrow = dir > 0 ? "▲" : dir < 0 ? "▼" : "•";
  if (item.unit === "pct") return { text: `${arrow}${Math.abs(diff * 100).toFixed(0)}bp`, dir };
  const pct = item.prev ? Math.abs(diff / item.prev) * 100 : 0;
  return { text: `${arrow}${pct.toFixed(1)}%`, dir };
}

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// ---- lock screen widgets ----

function rectangular(rows) {
  // One row of up to 4 metrics: short name, value, change
  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  const line = w.addStack();
  line.layoutHorizontally();
  line.topAlignContent();
  const shown = rows.slice(0, 4);
  shown.forEach((p, i) => {
    if (i > 0) line.addSpacer();
    const cell = line.addStack();
    cell.layoutVertically();
    const ch = fmtChange(p.item);
    const name = cell.addText(p.short);
    name.font = Font.mediumSystemFont(9);
    name.textOpacity = 0.75;
    name.lineLimit = 1;
    name.minimumScaleFactor = 0.6;
    const val = cell.addText(fmtValue(p.item));
    val.font = Font.boldSystemFont(12);
    val.lineLimit = 1;
    val.minimumScaleFactor = 0.5;
    if (ch.text) {
      const chg = cell.addText(ch.text);
      chg.font = Font.mediumSystemFont(9);
      chg.lineLimit = 1;
      chg.minimumScaleFactor = 0.6;
    }
  });
  return w;
}

function inline(rows) {
  const w = new ListWidget();
  w.addText(rows.slice(0, 2).map((p) => `${p.short} ${fmtValue(p.item)}`).join(" · "));
  return w;
}

function circular(rows) {
  const w = new ListWidget();
  const p = rows[0];
  const s = w.addStack();
  s.layoutVertically();
  s.centerAlignContent();
  const label = s.addText(p.short);
  label.font = Font.mediumSystemFont(9);
  label.lineLimit = 1;
  label.minimumScaleFactor = 0.6;
  label.centerAlignText();
  const val = s.addText(fmtValue(p.item).replace("%", ""));
  val.font = Font.boldSystemFont(14);
  val.lineLimit = 1;
  val.minimumScaleFactor = 0.5;
  val.centerAlignText();
  return w;
}

// ---- home screen widget ----

function home(rows, data, medium) {
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1d2025"));
  w.setPadding(12, 14, 12, 14);
  const up = Color.dynamic(new Color("#1f7a4d"), new Color("#4cc28a"));
  const down = Color.dynamic(new Color("#b3372f"), new Color("#f07a70"));
  const muted = Color.dynamic(new Color("#6b6f78"), new Color("#9aa0aa"));
  const text = Color.dynamic(new Color("#1b1d21"), new Color("#eceef1"));

  const title = w.addText("CRE Monitor");
  title.font = Font.semiboldSystemFont(11);
  title.textColor = muted;
  w.addSpacer(6);

  for (const p of rows) {
    const line = w.addStack();
    line.centerAlignContent();
    const label = line.addText(medium ? p.item.label : p.short);
    label.font = Font.mediumSystemFont(medium ? 13 : 12);
    label.textColor = text;
    label.lineLimit = 1;
    label.minimumScaleFactor = 0.7;
    line.addSpacer();
    const val = line.addText(fmtValue(p.item));
    val.font = Font.boldSystemFont(medium ? 14 : 13);
    val.textColor = text;
    if (medium) {
      line.addSpacer(8);
      const ch = fmtChange(p.item);
      const box = line.addStack();
      box.size = new Size(58, 0);
      box.addSpacer();
      const c = box.addText(ch.text);
      c.font = Font.semiboldSystemFont(12);
      c.textColor = ch.dir > 0 ? up : ch.dir < 0 ? down : muted;
    }
    w.addSpacer(4);
  }

  w.addSpacer();
  const foot = w.addText(`Updated ${ago(data.updated)}`);
  foot.font = Font.systemFont(9);
  foot.textColor = muted;
  return w;
}

function messageWidget(msg) {
  const w = new ListWidget();
  const t = w.addText(msg);
  t.font = Font.systemFont(12);
  return w;
}

function buildWidget(data, keys, family) {
  if (!data) return messageWidget("CRE Monitor: no data yet");
  const rows = picked(data, keys);
  if (!rows.length) return messageWidget("CRE Monitor: open Scriptable to choose datapoints");
  if (family === "accessoryRectangular") return rectangular(rows);
  if (family === "accessoryInline") return inline(rows);
  if (family === "accessoryCircular") return circular(rows);
  return home(rows, data, family !== "small");
}

// ---- next meeting ----

function amDeclined(ev) {
  return (ev.attendees || []).some((a) => a.isCurrentUser && a.status === "declined");
}

async function upcomingEvents() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 0);
  const events = await CalendarEvent.between(now, end);
  return events
    .filter((ev) => !ev.isAllDay && ev.endDate > now && !amDeclined(ev))
    .filter((ev) => !SKIP_CALENDARS.includes(ev.calendar && ev.calendar.title))
    .sort((a, b) => a.startDate - b.startDate);
}

function placeName(ev) {
  const loc = (ev.location || "").split("\n")[0].trim();
  if (/teams/i.test(loc) || (!loc && /teams\.(microsoft|live)\.com/i.test(ev.notes || ""))) return "Teams";
  if (/zoom\.us/i.test(loc)) return "Zoom";
  return loc;
}

function clock(d) {
  const df = new DateFormatter();
  df.useNoDateStyle();
  df.useShortTimeStyle();
  return df.string(d);
}

function until(d) {
  const mins = Math.max(0, Math.round((d - Date.now()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// Works out what to say: in progress, coming up, free for a while, or done for the day
function meetingStatus(events) {
  const now = new Date();
  const today = events.filter((ev) => sameDay(ev.startDate, now) || ev.startDate <= now);
  const current = today.find((ev) => ev.startDate <= now);
  const next = today.find((ev) => ev.startDate > now);
  if (current) {
    return { head: "NOW", title: current.title, detail: `ends ${clock(current.endDate)}` +
      (next ? ` · next ${clock(next.startDate)}` : ""), ev: current, short: "NOW" };
  }
  if (next) {
    const mins = (next.startDate - now) / 60000;
    const where = placeName(next) ? ` · ${placeName(next)}` : "";
    if (mins <= 90) {
      return { head: "NEXT MEETING", title: `${next.title} · in ${until(next.startDate)}`,
        detail: clock(next.startDate) + where, ev: next, short: until(next.startDate) };
    }
    return { head: `FREE UNTIL ${clock(next.startDate)}`, title: next.title,
      detail: `in ${until(next.startDate)}` + where, ev: next, short: until(next.startDate) };
  }
  const tomorrow = events.find((ev) => !sameDay(ev.startDate, now));
  return { head: "NO MORE MEETINGS TODAY", title: tomorrow ? tomorrow.title : "Nothing on the calendar",
    detail: tomorrow ? `Tomorrow ${clock(tomorrow.startDate)}` : "", ev: null, short: "—" };
}

// Refresh at the next moment the wording changes: event start/end, or every 5 min when close
function meetingRefresh(status) {
  const soon = new Date(Date.now() + 5 * 60 * 1000);
  if (!status.ev) return new Date(Date.now() + 30 * 60 * 1000);
  const edge = status.ev.startDate > new Date() ? status.ev.startDate : status.ev.endDate;
  const close = edge - Date.now() < 90 * 60 * 1000;
  return close && edge > soon ? soon : edge;
}

function meetingWidget(status, family) {
  const w = new ListWidget();
  if (family === "accessoryInline") {
    const line = !status.ev ? "No more meetings today"
      : status.short === "NOW" ? `Now · ${status.title}`
      : status.head.startsWith("FREE") ? `Free until ${clock(status.ev.startDate)}`
      : status.title;
    w.addText(line);
    return w;
  }
  if (family === "accessoryCircular") {
    const s = w.addStack();
    s.layoutVertically();
    const top = s.addText(status.ev && status.short === "NOW" ? "MTG" : "NEXT");
    top.font = Font.mediumSystemFont(9);
    top.centerAlignText();
    const v = s.addText(status.short);
    v.font = Font.boldSystemFont(14);
    v.lineLimit = 1;
    v.minimumScaleFactor = 0.5;
    v.centerAlignText();
    return w;
  }
  const head = w.addText(status.head);
  head.font = Font.mediumSystemFont(10);
  head.textOpacity = 0.75;
  head.lineLimit = 1;
  head.minimumScaleFactor = 0.7;
  const title = w.addText(status.title);
  title.font = Font.boldSystemFont(14);
  title.lineLimit = 1;
  title.minimumScaleFactor = 0.6;
  if (status.detail) {
    const d = w.addText(status.detail);
    d.font = Font.systemFont(11);
    d.lineLimit = 1;
    d.minimumScaleFactor = 0.7;
  }
  return w;
}

// ---- picker (runs inside the Scriptable app) ----

async function choose(data) {
  const selected = loadPicks();
  const table = new UITable();
  table.showSeparators = true;

  const render = () => {
    table.removeAllRows();
    const head = new UITableRow();
    head.isHeader = true;
    head.height = 70;
    head.addText(
      `Pick up to ${MAX_PICKS} (${selected.length}/${MAX_PICKS})`,
      "Tap to add or remove. Swipe down when done."
    );
    table.addRow(head);

    for (const g of data.groups) {
      const gh = new UITableRow();
      gh.isHeader = true;
      gh.addText(g.name.toUpperCase()).titleFont = Font.semiboldSystemFont(12);
      table.addRow(gh);

      for (const item of g.items) {
        const pos = selected.indexOf(item.key);
        const row = new UITableRow();
        row.dismissOnSelect = false;
        row.height = 52;
        const mark = row.addText(pos >= 0 ? String(pos + 1) : "");
        mark.widthWeight = 8;
        mark.titleFont = Font.boldSystemFont(16);
        mark.titleColor = Color.blue();
        const name = row.addText(item.label, shortName(item));
        name.widthWeight = 62;
        name.subtitleColor = Color.gray();
        const val = row.addText(fmtValue(item));
        val.widthWeight = 30;
        val.rightAligned();
        row.onSelect = () => {
          const at = selected.indexOf(item.key);
          if (at >= 0) selected.splice(at, 1);
          else if (selected.length < MAX_PICKS) selected.push(item.key);
          render();
          table.reload();
        };
        table.addRow(row);
      }
    }
  };

  render();
  await table.present(false);
  savePicks(selected);
  return selected;
}

async function preview(widget, kind) {
  if (kind === "lock" && typeof widget.presentAccessoryRectangular === "function") {
    await widget.presentAccessoryRectangular();
  } else {
    await widget.presentMedium();
  }
}

// ---- main ----

const param = (args.widgetParameter || "").trim();
const inWidget = config.runsInWidget || config.runsInAccessoryWidget;
const meetingMode = MEETING_WORDS.includes(param.toUpperCase());
const data = meetingMode && inWidget ? null : await loadData();

if (meetingMode && inWidget) {
  let widget;
  try {
    const status = meetingStatus(await upcomingEvents());
    widget = meetingWidget(status, config.widgetFamily);
    widget.refreshAfterDate = meetingRefresh(status);
  } catch (e) {
    widget = messageWidget("Open Scriptable and run CRE Monitor to allow calendar access");
  }
  widget.url = "calshow://";
  Script.setWidget(widget);
} else if (inWidget) {
  let keys = loadPicks();
  if (param && data) {
    const fromParam = picksFromParameter(param, allItems(data));
    if (fromParam.length) keys = fromParam;
  }
  const widget = buildWidget(data, keys, config.widgetFamily);
  widget.url = DASHBOARD_URL;
  widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  Script.setWidget(widget);
} else if (!data) {
  const a = new Alert();
  a.title = "No data";
  a.message = "Couldn't reach the dashboard. Check your connection and try again.";
  a.addAction("OK");
  await a.present();
} else {
  const menu = new Alert();
  menu.title = "CRE Monitor";
  menu.message = "Showing: " + picked(data, loadPicks()).map((p) => p.short).join(", ");
  menu.addAction("Choose datapoints");
  menu.addAction("Preview lock screen");
  menu.addAction("Preview home screen");
  menu.addAction("Preview next meeting");
  menu.addCancelAction("Close");
  const choice = await menu.presentSheet();
  if (choice === 0) {
    const keys = await choose(data);
    await preview(buildWidget(data, keys, "accessoryRectangular"), "lock");
  } else if (choice === 1) {
    await preview(buildWidget(data, loadPicks(), "accessoryRectangular"), "lock");
  } else if (choice === 2) {
    await preview(buildWidget(data, loadPicks(), "medium"), "home");
  } else if (choice === 3) {
    await preview(meetingWidget(meetingStatus(await upcomingEvents()), "accessoryRectangular"), "lock");
  }
}
Script.complete();

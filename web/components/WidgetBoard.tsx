"use client";

// The Overview widget board. Just grab a card and drag it — no mode to enter,
// no jiggling; the other cards glide out of the way under the cursor and the
// layout is saved on drop.
//
// Hovering a card reveals its size control (S / M / L = 1 col / 2 cols / full
// row) and a ⊖ badge that parks it in the tray. "Customize" pins those controls
// open — and is also what enables dragging by TOUCH, since otherwise a finger
// on a card has to stay free to scroll the page.
//
// Pointer events (not HTML5 drag-and-drop) so touch works, FLIP-animated so
// reordering slides instead of snapping.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ALL_WIDGETS,
  SPAN_LABEL,
  WIDGET_META,
  setSettings,
  useSettings,
  type WidgetKey,
  type WidgetSpan,
} from "@/lib/settings";

type DragState = {
  key: WidgetKey;
  el: HTMLElement;
  /** where inside the card the pointer grabbed it */
  grabX: number;
  grabY: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** Slot geometry + order FROZEN at drag start. Deriving the target from a
   *  fixed grid (rather than live rects that move as we reorder) is what keeps
   *  the drop target stable instead of cascading as cards shift. */
  slots: { key: WidgetKey; cx: number; cy: number }[];
  baseOrder: WidgetKey[];
};

export function WidgetBoard({ render }: { render: (k: WidgetKey) => React.ReactNode }) {
  const settings = useSettings();
  const [editing, setEditing] = useState(false);

  const savedVisible = settings.widgetOrder.filter((k) => !settings.hiddenWidgets.includes(k));
  const hidden = settings.widgetOrder.filter((k) => settings.hiddenWidgets.includes(k));

  // While a drag is in flight we keep a local order so cards can shift live;
  // it's committed to settings on drop.
  const [liveOrder, setLiveOrder] = useState<WidgetKey[] | null>(null);
  const [dragKey, setDragKey] = useState<WidgetKey | null>(null);
  const order = liveOrder ?? savedVisible;

  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  // ---- FLIP: remember where every card was, then animate the delta ----------
  const prevRects = useRef(new Map<WidgetKey, DOMRect>());
  const previousWidth = useRef<number | null>(null);
  useLayoutEffect(() => {
    const g = gridRef.current;
    if (!g) return;
    const width = g.getBoundingClientRect().width;
    const resized = previousWidth.current !== null && Math.abs(previousWidth.current - width) > 1;
    previousWidth.current = width;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const el of Array.from(g.querySelectorAll<HTMLElement>("[data-wk]"))) {
      const k = el.dataset.wk as WidgetKey;
      const now = el.getBoundingClientRect();
      const before = prevRects.current.get(k);
      prevRects.current.set(k, now);
      // Reflow immediately across device sizes; animate only widget rearranging.
      if (resized) {
        el.style.transform = "";
        el.style.transition = "";
        continue;
      }
      if (reduce || !before || k === dragKey) continue;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 220ms cubic-bezier(.2,.7,.3,1)";
        el.style.transform = "";
      });
    }
  });

  // ---- hit-testing against the FROZEN slot grid ----------------------------
  const slotAt = useCallback((d: DragState, x: number, y: number): number => {
    let best = 0;
    let bestDist = Infinity;
    d.slots.forEach((s, i) => {
      const dist = Math.hypot(x - s.cx, y - s.cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }, []);

  const endDrag = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    d.el.style.transition = "";
    d.el.style.transform = "";
    d.el.style.zIndex = "";
    drag.current = null;
    setDragKey(null);

    // commit: visible order (as dragged) + parked widgets keep their order
    const next = [...orderRef.current, ...hidden];
    setLiveOrder(null);
    setSettings({ widgetOrder: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden.join(",")]);

  useEffect(() => {
    if (!dragKey) return;
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      e.preventDefault();
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 4) return; // ignore jitter
      d.moved = true;

      // Anchor to the card's layout box (offsetLeft/Top ignore its transform),
      // so the card stays under the finger even after its slot moves.
      const g = gridRef.current;
      if (!g) return;
      const gr = g.getBoundingClientRect();
      const tx = e.clientX - d.grabX - (gr.left + d.el.offsetLeft);
      const ty = e.clientY - d.grabY - (gr.top + d.el.offsetTop);
      d.el.style.transition = "none";
      d.el.style.transform = `translate(${tx}px, ${ty}px) scale(1.03)`;
      d.el.style.zIndex = "40";

      // Recompute from the ORIGINAL order every frame: moving the dragged key to
      // whichever frozen slot the pointer is over. Idempotent, so no drift.
      const target = slotAt(d, e.clientX, e.clientY);
      const next = d.baseOrder.filter((k) => k !== d.key);
      next.splice(target, 0, d.key);
      if (next.join() !== orderRef.current.join()) setLiveOrder(next);
    };
    const onUp = () => endDrag();
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragKey, slotAt, endDrag]);

  function startDrag(e: React.PointerEvent, k: WidgetKey) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // A finger resting on a card must still be able to scroll the page, so touch
    // dragging is opt-in via Customize. Mouse/pen drag freely.
    if (e.pointerType === "touch" && !editing) return;
    const el = e.currentTarget as HTMLElement;
    if ((e.target as HTMLElement).closest("button")) return; // size / remove taps
    const r = el.getBoundingClientRect();
    const g = gridRef.current;
    const slots = g
      ? Array.from(g.querySelectorAll<HTMLElement>("[data-wk]")).map((n) => {
          const nr = n.getBoundingClientRect();
          return {
            key: n.dataset.wk as WidgetKey,
            cx: nr.left + nr.width / 2,
            cy: nr.top + nr.height / 2,
          };
        })
      : [];
    drag.current = {
      key: k,
      el,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      slots,
      baseOrder: savedVisible,
    };
    setLiveOrder(savedVisible);
    setDragKey(k);
  }

  function setSpan(k: WidgetKey, span: WidgetSpan) {
    setSettings((cur) => ({ widgetSpans: { ...cur.widgetSpans, [k]: span } }));
  }
  function park(k: WidgetKey) {
    setSettings((cur) => ({ hiddenWidgets: [...cur.hiddenWidgets, k] }));
  }
  function unpark(k: WidgetKey) {
    setSettings((cur) => ({ hiddenWidgets: cur.hiddenWidgets.filter((x) => x !== k) }));
  }

  // At 2 columns "M" and "L" are the same width, so only offer S / L there.
  const sizeChoices: WidgetSpan[] = settings.density === 3 ? [1, 2, 3] : [1, 3];

  return (
    <>
      <div className="ov-head">
        <h2 className="section" style={{ margin: 0 }}>
          Overview
        </h2>
        <button
          className={`btn small ${editing ? "btn-primary" : ""}`}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : "Customize"}
        </button>
      </div>

      {editing && (
        <p className="wb-hint">
          Drag any card to move it. Use <b>S</b> / <b>M</b> / <b>L</b> to resize, or <b>⊖</b> to
          park it in the tray.
        </p>
      )}

      {order.length === 0 ? (
        <div className="empty">
          No widgets on the board.{" "}
          {editing ? "Add one from the tray below." : "Press Customize to add some."}
        </div>
      ) : (
        <div
          className={`ov-grid ${editing ? "is-editing" : ""}`}
          data-density={settings.density}
          ref={gridRef}
        >
          {order.map((k) => {
            const span = Math.min(settings.widgetSpans[k] ?? 1, settings.density) as WidgetSpan;
            return (
              <div
                key={k}
                data-wk={k}
                data-span={settings.widgetSpans[k] === 3 ? "full" : span}
                className={`ov-slot ${dragKey === k ? "is-dragging" : ""}`}
                onPointerDown={(e) => startDrag(e, k)}
              >
                <div className="wb-card">
                  {(
                    <div className="wb-tools">
                      <button
                        className="wb-remove"
                        onClick={() => park(k)}
                        title={`Remove ${WIDGET_META[k].label}`}
                        aria-label={`Remove ${WIDGET_META[k].label}`}
                      >
                        ⊖
                      </button>
                      <span className="wb-sizes">
                        {sizeChoices.map((sp) => (
                          <button
                            key={sp}
                            className={`wb-size ${(settings.widgetSpans[k] ?? 1) === sp ? "active" : ""}`}
                            onClick={() => setSpan(k, sp)}
                            title={`Size ${SPAN_LABEL[sp]}`}
                          >
                            {SPAN_LABEL[sp]}
                          </button>
                        ))}
                      </span>
                    </div>
                  )}
                  {render(k)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="wb-tray">
          <div className="wb-tray-head">Parked widgets</div>
          {hidden.length === 0 ? (
            <div className="muted wb-tray-empty">Everything is on the board.</div>
          ) : (
            <div className="wb-tray-items">
              {hidden.map((k) => (
                <button key={k} className="wb-chip" onClick={() => unpark(k)}>
                  <span className="wb-chip-plus">＋</span>
                  <span>
                    <span className="wb-chip-name">{WIDGET_META[k].label}</span>
                    <span className="wb-chip-hint">{WIDGET_META[k].hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

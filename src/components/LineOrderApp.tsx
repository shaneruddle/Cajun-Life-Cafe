/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// LIFF/MINI App ordering page — opened from the Cajun Life LINE chat via the
// Rich Menu's "Order Food" tile (URI action → the LIFF URL). Renders inside
// LINE's in-app browser. See cajun-line-ordering-spec.md for the full flow.
//
// V1 scope: published `menu` items with a quantity stepper, delivery address
// (prefilled from crm_customers if this LINE user has ordered/enrolled
// before), and a "Build Your Own" bowl configurator is NOT included yet —
// same categories/items as DigitalMenu, just with quantities added, kept
// deliberately small for a first pass (fast-follow, not forgotten).
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { MenuItem, Category } from "../types";
import { handleFirestoreError } from "../utils/firestore";
import { normalizeImageUrl } from "../utils/images";
import { FirebaseImage } from "./ui/FirebaseImage";
import { ShoppingBag, Plus, Minus, X, MapPin, Loader2 } from "lucide-react";

interface CartLine {
  item: MenuItem;
  qty: number;
}

type Stage = "loading" | "not-in-line" | "menu" | "review" | "sending" | "sent" | "error";

const LineOrderApp = () => {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [liffModule, setLiffModule] = useState<any>(null);
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});

  const [addressText, setAddressText] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [addressLoaded, setAddressLoaded] = useState(false);

  // ── LIFF init ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const liffId = import.meta.env.VITE_LIFF_ID;
      if (!liffId) {
        setErrorMsg("Ordering isn't set up yet — LIFF ID missing.");
        setStage("error");
        return;
      }
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        setLiffModule(liff);
        if (!liff.isInClient()) {
          // Allow browsing outside LINE for testing, but sendMessages()
          // (needed to place an order) only works from inside the chat.
          setStage("not-in-line");
        }
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        if (liff.isInClient()) setStage("menu");
      } catch (err) {
        console.error("LIFF init error:", err);
        setErrorMsg("Couldn't connect to LINE. Please reopen this from the Cajun Life chat.");
        setStage("error");
      }
    })();
  }, []);

  // ── Menu data (same pattern as DigitalMenu.tsx) ─────────────────────
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCategoryList(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]);
    }, (err) => handleFirestoreError(err, "list", "categories"));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "menu"), where("published", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const menuItems = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
      setItems(menuItems.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (err) => handleFirestoreError(err, "list", "menu"));
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const itemCats = Array.from(new Set(items.map((i) => i.category)));
    const definedCats = categoryList.map((c) => c.name);
    const otherCats = itemCats.filter((c) => !definedCats.includes(c)).sort();
    return [...definedCats.filter((c) => itemCats.includes(c)), ...otherCats];
  }, [items, categoryList]);

  useEffect(() => {
    if (!activeCategory && categories.length > 0) setActiveCategory(categories[0]);
  }, [categories, activeCategory]);

  const filteredItems = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  );

  // ── Saved address prefill ────────────────────────────────────────
  useEffect(() => {
    if (!lineUserId || addressLoaded) return;
    (async () => {
      try {
        const resp = await fetch(`/api/customer/by-line/${encodeURIComponent(lineUserId)}`);
        const data = await resp.json();
        if (data.found) {
          setAddressText(data.address || "");
          setAddressNotes(data.deliveryNotes || "");
        }
      } catch (err) {
        console.error("Address prefill error:", err);
      } finally {
        setAddressLoaded(true);
      }
    })();
  }, [lineUserId, addressLoaded]);

  // ── Cart ─────────────────────────────────────────────────────────
  const addToCart = useCallback((item: MenuItem, delta: number) => {
    setCart((prev) => {
      const id = item.id!;
      const existingQty = prev[id]?.qty || 0;
      const nextQty = Math.max(0, existingQty + delta);
      if (nextQty === 0) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { item, qty: nextQty } };
    });
  }, []);

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + (parseFloat(l.item.price.replace("฿", "")) || 0) * l.qty, 0),
    [cartLines]
  );

  // ── Submit: create draft order, send Flex Message into the chat ────
  const handleReviewSend = useCallback(async () => {
    if (!lineUserId || cartLines.length === 0) return;
    setStage("sending");
    try {
      const orderItems = cartLines.map((l) => ({
        name: l.item.name,
        qty: l.qty,
        unitPrice: parseFloat(l.item.price.replace("฿", "")) || 0
      }));
      const draftResp = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          items: orderItems,
          deliveryAddress: { addressText, notes: addressNotes },
          notes: addressNotes
        })
      });
      const draft = await draftResp.json();
      if (!draft.success) throw new Error(draft.error || "Failed to create order");

      // The order-confirmation Flex Message (summary + Confirm/Edit/Cancel) is
      // pushed by the backend right after it creates the draft — see
      // buildOrderFlexMessage()/pushLineMessages() in server.ts. It can't be
      // sent from here via liff.sendMessages(): LINE only allows URI button
      // actions on a Flex Message sent that way, not postback (confirmed via
      // an INVALID_MESSAGE rejection during testing) — a bot-side push has
      // no such restriction, so that's used instead.
      setStage("sent");
      setTimeout(() => {
        try { liffModule.closeWindow(); } catch { /* not always available outside LINE */ }
      }, 1800);
    } catch (err: any) {
      console.error("Send order error:", err);
      setErrorMsg("Couldn't send your order — please reopen this from the Cajun Life LINE chat and try again.");
      setStage("error");
    }
  }, [lineUserId, cartLines, addressText, addressNotes, liffModule]);

  // ── Render ───────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-terracotta animate-spin" />
        <p className="text-sm text-gray-500">Loading Cajun Life ordering…</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-ink font-medium">{errorMsg}</p>
      </div>
    );
  }

  if (stage === "sent") {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-terracotta" />
        </div>
        <p className="text-ink font-medium">Sent! Check the chat to confirm your order.</p>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <header className="p-4 flex items-center gap-3 border-b border-gray-100 bg-white">
          <button onClick={() => setStage("menu")} aria-label="Back to menu" className="p-1">
            <X className="w-5 h-5 text-ink" />
          </button>
          <h1 className="font-display font-bold text-lg text-ink">Review Order</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="card p-4 space-y-3">
            {cartLines.map((l) => (
              <div key={l.item.id} className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-ink text-sm">{l.item.name}</p>
                  <p className="text-xs text-gray-400">฿{l.item.price.replace("฿", "")} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => addToCart(l.item, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                  <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                  <button onClick={() => addToCart(l.item, 1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-ink">
              <span>Total</span>
              <span>฿{cartTotal}</span>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-ink font-medium text-sm">
              <MapPin className="w-4 h-4 text-terracotta" /> Delivery address
            </div>
            <textarea
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="e.g. The Cliff Condo, Pratumnak, Building B Room 1406"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm min-h-[70px]"
            />
            <textarea
              value={addressNotes}
              onChange={(e) => setAddressNotes(e.target.value)}
              placeholder="Delivery notes — gate code, don't ring the bell, etc. (optional)"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm min-h-[50px]"
            />
          </div>
        </main>
        <footer className="p-4 bg-white border-t border-gray-100">
          <button
            onClick={handleReviewSend}
            disabled={!addressText.trim() || stage !== "review"}
            className="terracotta-button w-full text-center font-bold disabled:opacity-40"
          >
            Send Order to Chat
          </button>
        </footer>
      </div>
    );
  }

  if (stage === "sending") {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-terracotta animate-spin" />
        <p className="text-sm text-gray-500">Sending your order…</p>
      </div>
    );
  }

  // stage === "menu" or "not-in-line"
  return (
    <div className="min-h-screen bg-cream flex flex-col pb-28">
      {stage === "not-in-line" && (
        <div className="bg-terracotta/10 text-terracotta text-xs text-center py-2 px-4">
          Open this from the Cajun Life LINE chat to place an order.
        </div>
      )}
      <div className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-gray-100">
        <header className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-display font-bold text-terracotta text-center">Cajun Life — Order Food</h1>
        </header>
        <div className="flex overflow-x-auto gap-2 px-4 pb-3 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full font-medium text-xs transition-all ${
                activeCategory === cat ? "bg-terracotta text-white shadow-md" : "bg-white text-ink shadow-sm border border-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pt-2 space-y-3">
        {filteredItems.map((item) => {
          const qty = cart[item.id!]?.qty || 0;
          return (
            <div key={item.id} className="card p-3 flex items-center gap-3">
              <FirebaseImage
                src={normalizeImageUrl(item.primaryPhotoPath || item.image)}
                fallbackSrc="/logo.png"
                alt={item.name}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                aspectRatio="1/1"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink text-sm truncate">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{item.description}</p>
                )}
                <p className="text-terracotta font-bold text-sm mt-1">฿{item.price.replace("฿", "")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {qty > 0 && (
                  <button onClick={() => addToCart(item, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                )}
                {qty > 0 && <span className="w-5 text-center text-sm font-bold">{qty}</span>}
                <button onClick={() => addToCart(item, 1)} className="w-7 h-7 rounded-full bg-terracotta text-white flex items-center justify-center"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="text-center text-gray-400 italic py-12">No items in this category.</p>
        )}
      </main>

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-ink text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <button
              onClick={() => setStage("review")}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <ShoppingBag className="w-4 h-4" />
                <span><span className="font-bold">{cartCount}</span> item{cartCount > 1 ? "s" : ""}</span>
              </span>
              <span className="flex items-center gap-3 font-bold text-sm">
                ฿{cartTotal}
                <span className="bg-terracotta text-white text-xs font-bold px-4 py-2 rounded-full">Review Order</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LineOrderApp;

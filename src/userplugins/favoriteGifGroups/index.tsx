import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Menu, React } from "@webpack/common";

interface GifGroupsData {
    categories: string[];
    gifMap: Record<string, string>;
}

const DEFAULT_DATA: GifGroupsData = {
    categories: ["Anime", "Memes", "Reactions"],
    gifMap: {}
};

const settings = definePluginSettings({
    categories: {
        type: OptionType.STRING,
        description: "Categories list (JSON)",
        default: JSON.stringify(DEFAULT_DATA.categories),
        hidden: true
    },
    gifMap: {
        type: OptionType.STRING,
        description: "GIF to Category mappings (JSON)",
        default: JSON.stringify(DEFAULT_DATA.gifMap),
        hidden: true
    }
});

function sortCategories(list: string[]): string[] {
    return [...list].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function loadData(): GifGroupsData {
    try {
        const parsed = JSON.parse(settings.store.categories);
        const categories = Array.isArray(parsed) ? parsed : DEFAULT_DATA.categories;
        const gifMap = JSON.parse(settings.store.gifMap);
        return {
            categories: sortCategories(categories),
            gifMap: gifMap || {}
        };
    } catch {
        return {
            categories: sortCategories(DEFAULT_DATA.categories),
            gifMap: {}
        };
    }
}

function saveData(d: GifGroupsData) {
    d.categories = sortCategories(d.categories);
    settings.store.categories = JSON.stringify(d.categories);
    settings.store.gifMap = JSON.stringify(d.gifMap);
}

function closeContextMenu() {
    try {
        FluxDispatcher?.dispatch?.({ type: "CONTEXT_MENU_CLOSE" });
    } catch {}
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
}

let activeCategory: string | null = null;
let lastPicker: any = null;
let observer: MutationObserver | null = null;

function showInputModal(title: string, placeholder: string, onConfirm: (val: string) => void) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);";

    const modal = document.createElement("div");
    modal.style.cssText = "background:var(--background-primary, #313338);border-radius:8px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:14px;color:var(--text-normal, #dbdee1);";

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-size:16px;font-weight:600;color:var(--header-primary, #fff);";

    const input = document.createElement("input");
    input.placeholder = placeholder || "";
    input.style.cssText = "background:var(--background-tertiary, #1e1f22);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:10px;color:var(--text-normal, #dbdee1);font-size:14px;outline:none;";

    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;gap:8px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "background:none;border:none;color:var(--interactive-normal, #b5bac1);padding:8px 16px;border-radius:4px;cursor:pointer;font-size:14px;";
    cancelBtn.onclick = () => overlay.remove();

    const okBtn = document.createElement("button");
    okBtn.textContent = "Create";
    okBtn.style.cssText = "background:var(--brand-500, #5865f2);color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:500;";
    okBtn.onclick = () => {
        const val = input.value.trim();
        if (val) {
            overlay.remove();
            onConfirm(val);
        }
    };

    input.onkeydown = (e) => {
        if (e.key === "Enter") okBtn.click();
        if (e.key === "Escape") cancelBtn.click();
    };

    btns.appendChild(cancelBtn);
    btns.appendChild(okBtn);
    modal.appendChild(h);
    modal.appendChild(input);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
}

function showConfirmModal(categoryName: string, onConfirm: () => void) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);";

    const modal = document.createElement("div");
    modal.style.cssText = "background:var(--background-primary, #313338);border-radius:8px;padding:20px;width:360px;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:12px;";

    const h = document.createElement("div");
    h.textContent = `Delete category "${categoryName}"?`;
    h.style.cssText = "font-size:16px;font-weight:600;color:var(--header-primary, #fff);";

    const desc = document.createElement("div");
    desc.textContent = "GIFs will remain in your favorites, but will be removed from this category.";
    desc.style.cssText = "font-size:14px;color:var(--text-muted, #949ba4);line-height:1.4;";

    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:6px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "background:none;border:none;color:var(--interactive-normal, #b5bac1);padding:8px 16px;border-radius:4px;cursor:pointer;font-size:14px;";
    cancelBtn.onclick = () => overlay.remove();

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.style.cssText = "background:var(--status-danger, #da373c);color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:500;";
    delBtn.onclick = () => {
        overlay.remove();
        onConfirm();
    };

    btns.appendChild(cancelBtn);
    btns.appendChild(delBtn);
    modal.appendChild(h);
    modal.appendChild(desc);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function getGifUrl(target: HTMLElement): string | null {
    const item = target?.closest?.(".result__2dc39") || target;
    if (!item) return null;
    const pk = Object.keys(item).find(k => k.startsWith("__reactProps"));
    if (pk && (item as any)[pk]?.children) {
        const ch = (item as any)[pk].children;
        const fav = Array.isArray(ch) ? ch.find(c => c?.props?.url) : null;
        if (fav?.props?.url) return fav.props.url;
    }
    return (item.querySelector("img, video") as HTMLImageElement)?.src || null;
}

const OrigSymbol = Symbol.for("vc_gif_groups_clean_orig");

function patchPickerComponent(panel: Element) {
    let curr = (panel as any)[Object.keys(panel).find(k => k.startsWith("__reactFiber")) || ""];
    while (curr && !curr.memoizedProps?.favorites) curr = curr.return;
    if (!curr?.type?.prototype) return false;

    const proto = curr.type.prototype;
    if (proto[OrigSymbol]) return true;

    proto[OrigSymbol] = {
        render: proto.render,
        renderHeader: proto.renderHeader,
        renderContent: proto.renderContent
    };
    const orig = proto[OrigSymbol];

    proto.renderContent = function () {
        lastPicker = this;
        const origFavorites = this.props.favorites;
        if (Array.isArray(origFavorites) && activeCategory !== null) {
            const { categories, gifMap } = loadData();
            let filtered: any[];
            if (activeCategory === "__UNGROUPED__") {
                filtered = origFavorites.filter((g: any) => {
                    const u = g.url || g.src;
                    const c = gifMap[u];
                    return !c || !categories.includes(c);
                });
            } else {
                filtered = origFavorites.filter((g: any) => (g.url || g.src) && gifMap[g.url || g.src] === activeCategory);
            }

            const oldProps = this.props;
            this.props = Object.assign({}, oldProps, { favorites: filtered });
            try {
                return orig.renderContent.call(this);
            } finally {
                this.props = oldProps;
            }
        }
        return orig.renderContent.call(this);
    };

    proto.render = function () {
        lastPicker = this;
        const res = orig.render.call(this);
        const { categories } = loadData();

        const bar = React.createElement("div", {
            key: "vc-gif-bar",
            style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                padding: "8px 12px",
                borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                background: "var(--background-secondary, #2b2d31)",
                boxSizing: "border-box",
                width: "100%",
                minHeight: "44px",
                alignItems: "center"
            }
        }, [
            React.createElement("button", {
                key: "all",
                onClick: () => { activeCategory = null; this.forceUpdate(); },
                style: {
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "none",
                    background: activeCategory === null ? "var(--brand-500, #5865f2)" : "rgba(255,255,255,0.07)",
                    color: activeCategory === null ? "#fff" : "var(--text-normal, #dbdee1)"
                }
            }, "All"),
            React.createElement("button", {
                key: "ungrouped",
                onClick: () => { activeCategory = "__UNGROUPED__"; this.forceUpdate(); },
                style: {
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "none",
                    background: activeCategory === "__UNGROUPED__" ? "var(--brand-500, #5865f2)" : "rgba(255,255,255,0.07)",
                    color: activeCategory === "__UNGROUPED__" ? "#fff" : "var(--text-muted, #949ba4)"
                }
            }, "Ungrouped"),
            ...categories.map((cat: string) => {
                const isAct = activeCategory === cat;
                return React.createElement("div", {
                    key: cat,
                    style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        background: isAct ? "var(--brand-500, #5865f2)" : "rgba(255,255,255,0.07)",
                        borderRadius: "12px",
                        padding: "2px 8px"
                    }
                }, [
                    React.createElement("span", {
                        key: "t",
                        onClick: () => { activeCategory = isAct ? null : cat; this.forceUpdate(); },
                        style: {
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: isAct ? "#fff" : "var(--text-normal, #dbdee1)"
                        }
                    }, cat),
                    React.createElement("span", {
                        key: "d",
                        onClick: (e: MouseEvent) => {
                            e.stopPropagation();
                            showConfirmModal(cat, () => {
                                const d = loadData();
                                d.categories = d.categories.filter((c: string) => c !== cat);
                                for (const k in d.gifMap) {
                                    if (d.gifMap[k] === cat) delete d.gifMap[k];
                                }
                                saveData(d);
                                if (activeCategory === cat) activeCategory = null;
                                this.forceUpdate();
                            });
                        },
                        style: {
                            cursor: "pointer",
                            fontSize: "13px",
                            opacity: 0.6,
                            marginLeft: "3px",
                            color: isAct ? "#fff" : "var(--text-muted, #949ba4)",
                            display: "flex",
                            alignItems: "center"
                        }
                    }, "×")
                ]);
            }),
            React.createElement("button", {
                key: "add",
                onClick: () => {
                    showInputModal("New Category", "e.g. Memes, Reactions, Anime...", (name: string) => {
                        const d = loadData();
                        if (!d.categories.includes(name)) {
                            d.categories.push(name);
                            saveData(d);
                        }
                        activeCategory = name;
                        this.forceUpdate();
                    });
                },
                style: {
                    padding: "3px 8px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    border: "1px dashed rgba(255,255,255,0.2)",
                    background: "none",
                    color: "var(--text-muted, #949ba4)"
                }
            }, "+")
        ]);

        if (res?.props?.children && Array.isArray(res.props.children)) {
            const ch = [...res.props.children];
            ch.splice(1, 0, bar);
            return React.cloneElement(res, {}, ch);
        }
        return res;
    };

    return true;
}

export default definePlugin({
    name: "FavoriteGifGroups",
    description: "Allows grouping your favorite GIFs into custom categories",
    authors: [{ name: "Eysti", id: 0n }],
    settings,

    contextMenus: {
        "gif-picker"(children: any[], { target }: { target: HTMLElement }) {
            const url = getGifUrl(target);
            if (!url) return;
            const data = loadData();
            const currentCat = data.gifMap[url] || null;

            const subItems = [
                <Menu.MenuItem
                    id="vc-gif-create-new"
                    key="vc-gif-create-new"
                    label="➕ Create Category..."
                    action={() => {
                        closeContextMenu();
                        showInputModal("New GIF Category", "e.g. Memes, Reactions, Anime...", (name: string) => {
                            const d = loadData();
                            if (!d.categories.includes(name)) d.categories.push(name);
                            d.gifMap[url] = name;
                            saveData(d);
                            lastPicker?.forceUpdate?.();
                        });
                    }}
                />,
                <Menu.MenuSeparator key="sep-1" />
            ];

            for (const cat of data.categories) {
                const isCur = currentCat === cat;
                subItems.push(
                    <Menu.MenuCheckboxItem
                        id={`vc-gif-cat-${cat}`}
                        key={`vc-gif-cat-${cat}`}
                        label={cat}
                        checked={isCur}
                        action={() => {
                            const d = loadData();
                            if (isCur) {
                                delete d.gifMap[url];
                            } else {
                                d.gifMap[url] = cat;
                            }
                            saveData(d);
                            closeContextMenu();
                            lastPicker?.forceUpdate?.();
                        }}
                    />
                );
            }

            if (currentCat) {
                subItems.push(
                    <Menu.MenuSeparator key="sep-2" />,
                    <Menu.MenuItem
                        id="vc-gif-rem"
                        key="vc-gif-rem"
                        label="❌ Remove from Category"
                        color="danger"
                        action={() => {
                            const d = loadData();
                            delete d.gifMap[url];
                            saveData(d);
                            closeContextMenu();
                            lastPicker?.forceUpdate?.();
                        }}
                    />
                );
            }

            children.push(
                <Menu.MenuGroup key="vc-gif-group">
                    <Menu.MenuItem
                        id="vc-gif-cat-sub"
                        key="vc-gif-cat-sub"
                        label={`📁 Category: ${currentCat || "None"}`}
                    >
                        {subItems}
                    </Menu.MenuItem>
                </Menu.MenuGroup>
            );
        }
    },

    start() {
        const existing = document.querySelector("#gif-picker-tab-panel");
        if (existing) patchPickerComponent(existing);

        observer = new MutationObserver(() => {
            const p = document.querySelector("#gif-picker-tab-panel");
            if (p) patchPickerComponent(p);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        observer?.disconnect();
        observer = null;
    }
}); 
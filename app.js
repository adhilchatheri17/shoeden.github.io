const INVENTORY_CONFIG = {
    "2-Rack": {
        name: "2 Rack Shoe Rack",
        category: "Shoe Rack",
        colors: ["Coffee Brown", "Ivory White"],
        rackCount: 2,
        capacityPairs: 6
    },
    "3-Rack": {
        name: "3 Rack Shoe Rack",
        category: "Shoe Rack",
        colors: ["Coffee Brown", "Ivory White", "Grey White"],
        rackCount: 3,
        capacityPairs: 9
    },
    "4-Rack": {
        name: "4 Rack Shoe Rack",
        category: "Shoe Rack",
        colors: ["Coffee Brown", "Ivory White", "Grey White"],
        rackCount: 4,
        capacityPairs: 12
    },
    "5-Rack": {
        name: "5 Rack Shoe Rack",
        category: "Shoe Rack",
        colors: ["Coffee Brown", "Ivory White", "Grey White"],
        rackCount: 5,
        capacityPairs: 15
    },
    "Ironing Table": {
        name: "Foldable Ironing Table with Iron Box Holder",
        category: "Table",
        colors: [],
        rackCount: null,
        capacityPairs: null
    },
    "Study Table": {
        name: "Foldable Study Table",
        category: "Table",
        colors: ["Wooden", "Grey", "White"],
        rackCount: null,
        capacityPairs: null
    }
};

const GODOWNS = [
    { id: "Chennai", label: "Chennai", group: "ShoeDen Chennai Group" },
    { id: "Erode", label: "Erode", group: "ShoeDen Erode Group" },
    { id: "Kallakurichi", label: "Kallakurichi", group: "ShoeDen Kallakurichi Group" },
    { id: "Madurai", label: "Madurai", group: "ShoeDen Madurai Group" },
    { id: "Kanyakumari", label: "Kanyakumari", group: "ShoeDen Kanyakumari Group" }
];

const STOCK_VARIANTS = buildStockVariants();
const STATUSES = ["New", "Packed", "Dispatched", "Delivered", "Returned"];
const ACTIVE_STATUSES = ["New", "Packed", "Dispatched"];
const SHARE_STATUS_PRESETS = {
    active: ["New", "Packed", "Dispatched"]
};
const SUPABASE_CONFIG = window.SHOEDEN_SUPABASE || {};
const SUPABASE_LIBRARY_READY = Boolean(window.supabase?.createClient);
const SUPABASE_IS_CONFIGURED = Boolean(
    SUPABASE_LIBRARY_READY &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.includes("PASTE_") &&
    !SUPABASE_CONFIG.anonKey.includes("PASTE_")
);
const supabaseClient = SUPABASE_IS_CONFIGURED
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;

let orders = [];
let stocks = [];
let currentOrdersGodown = "All";
let currentDeliveredGodown = "All";
let stockStorageAvailable = true;
let stockSetupToastShown = false;
let stockStorageMessage = "";
let selectedShareOrderIds = new Set();

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view-section");
const pageTitle = document.getElementById("current-page-title");
const pageSubtitle = document.getElementById("current-page-subtitle");
const orderForm = document.getElementById("orderForm");
const loginForm = document.getElementById("loginForm");
const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app");
const itemsContainer = document.getElementById("order-items-container");
const addItemBtn = document.getElementById("add-item-btn");
const itemTemplate = document.getElementById("item-template");
const toast = document.getElementById("toast");
const shareTeamSelect = document.getElementById("shareTeam");
const shareGodownSelect = document.getElementById("shareGodown");
const shareStatusSelect = document.getElementById("shareStatus");
const shareMessage = document.getElementById("share-message");
const shareOrdersList = document.getElementById("share-orders-list");
const shareOrderCount = document.getElementById("share-order-count");
const shareQtyCount = document.getElementById("share-qty-count");
const copyShareBtn = document.getElementById("copy-share-message");
const whatsappShareBtn = document.getElementById("whatsapp-share-message");

const navConfig = {
    dashboard: {
        title: "Dashboard",
        subtitle: "Live overview of godown orders and dispatch status."
    },
    "new-order": {
        title: "New Order",
        subtitle: "Add orders received from the correct godown WhatsApp group."
    },
    "orders-list": {
        title: "Active Orders",
        subtitle: "Godown-wise active order board (New, Packed, Dispatched, Returned)."
    },
    "delivered-orders": {
        title: "Delivered Orders",
        subtitle: "Dedicated archive of all successfully delivered godown orders."
    },
    "share-orders": {
        title: "Share Orders",
        subtitle: "Send clear fitting and delivery lists to the right team."
    },
    stock: {
        title: "Stock",
        subtitle: "Manage each godown stock and see dispatched pending delivery."
    },
    "sales-report": {
        title: "Daily Sales & Collection Report",
        subtitle: "Everyday Cash & UPI collection breakdown by person and godown."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupControls();
    setupNavigation();
    setupMobileNav();
    setupOrderForm();
    setupSharePage();
    renderSalesReport();
    addNewItem();
    setDefaultOrderDate();
    checkLogin();

    // Splash screen logic
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => splash.remove(), 800);
        }
    }, 2500);
});

function setupLogin() {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const username = document.getElementById("loginUsername").value.trim();
        const email = resolveLoginEmail(username);
        const password = document.getElementById("loginPassword").value;

        if (!ensureSupabaseConfigured()) return;

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            loginForm.reset();
            showApp();
            await loadAppData();
            showToast("Logged in.");
        } catch (error) {
            showToast("Invalid username or password.", true);
        }
    });
}

async function checkLogin() {
    if (!SUPABASE_IS_CONFIGURED || !supabaseClient) {
        showApp();
        updateDashboard();
        renderOrdersTable();
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data?.session) {
            showLogin();
            return;
        }
        showApp();
        await loadAppData();
    } catch (error) {
        showLogin();
    }
}

function showApp() {
    if (appShell) appShell.classList.remove("auth-hidden");
    if (loginScreen) loginScreen.classList.add("hide");
}

function showLogin() {
    if (appShell) appShell.classList.add("auth-hidden");
    if (loginScreen) loginScreen.classList.remove("hide");
    const userEl = document.getElementById("loginUsername");
    if (userEl) userEl.focus();
}

function ensureSupabaseConfigured() {
    if (SUPABASE_IS_CONFIGURED && supabaseClient) return true;
    showLogin();
    showToast(
        SUPABASE_LIBRARY_READY
            ? "Add your Supabase URL and anon key in supabase-config.js."
            : "Supabase could not load. Check your internet connection.",
        true
    );
    return false;
}

function resolveLoginEmail(username) {
    if (username.includes("@")) return username;
    if (
        SUPABASE_CONFIG.defaultUsername &&
        SUPABASE_CONFIG.defaultEmail &&
        username.toLowerCase() === SUPABASE_CONFIG.defaultUsername.toLowerCase()
    ) {
        return SUPABASE_CONFIG.defaultEmail;
    }
    return username;
}

async function requireSession() {
    if (!ensureSupabaseConfigured()) throw new Error("Supabase is not configured");
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
        showLogin();
        throw error || new Error("Authentication required");
    }
    return data.session;
}

function setupControls() {
    const godownSelect = document.getElementById("godownLocation");
    
    // Status filter is no longer needed since we have visual columns
    // We can remove it or keep it hidden if the column layout handles it all
    // Wait, the column layout makes status filter redundant.

    godownSelect.innerHTML = '<option value="" disabled selected>Select godown group</option>';

    GODOWNS.forEach(godown => {
        godownSelect.insertAdjacentHTML(
            "beforeend",
            `<option value="${godown.id}">${godown.label} - ${godown.group}</option>`
        );
    });

    renderGodownTabs();
    renderDeliveredGodownTabs();

    document.getElementById("search-orders")?.addEventListener("input", renderOrdersTable);
    document.getElementById("search-delivered-orders")?.addEventListener("input", renderDeliveredOrdersTable);
}

function renderGodownTabs() {
    const container = document.getElementById("godown-tabs-container");
    if (!container) return;
    
    container.innerHTML = `<button class="godown-tab ${currentOrdersGodown === "All" ? "active" : ""}" data-godown="All">All Godowns</button>`;
    
    GODOWNS.forEach(godown => {
        container.insertAdjacentHTML("beforeend", `
            <button class="godown-tab ${currentOrdersGodown === godown.id ? "active" : ""}" data-godown="${godown.id}">
                ${godown.label}
            </button>
        `);
    });

    container.querySelectorAll(".godown-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            currentOrdersGodown = tab.dataset.godown;
            renderGodownTabs(); // Update active class
            renderOrdersTable();
        });
    });
}

function renderDeliveredGodownTabs() {
    const container = document.getElementById("delivered-godown-tabs-container");
    if (!container) return;
    
    container.innerHTML = `<button class="godown-tab ${currentDeliveredGodown === "All" ? "active" : ""}" data-godown="All">All Godowns</button>`;
    
    GODOWNS.forEach(godown => {
        container.insertAdjacentHTML("beforeend", `
            <button class="godown-tab ${currentDeliveredGodown === godown.id ? "active" : ""}" data-godown="${godown.id}">
                ${godown.label}
            </button>
        `);
    });

    container.querySelectorAll(".godown-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            currentDeliveredGodown = tab.dataset.godown;
            renderDeliveredGodownTabs();
            renderDeliveredOrdersTable();
        });
    });
}

function buildStockVariants() {
    return Object.entries(INVENTORY_CONFIG).map(([productKey, product]) => {
        return {
            key: stockKey(productKey, ""),
            product: productKey,
            color: "",
            label: product.name,
            category: product.category
        };
    });
}

function stockKey(product, color = "") {
    return `${product}__${color || "NO_COLOR"}`;
}

async function loadOrders() {
    try {
        if (SUPABASE_IS_CONFIGURED && supabaseClient) {
            const { data, error } = await supabaseClient
                .from("orders")
                .select("*")
                .order("date", { ascending: false });
            if (!error && data) {
                orders = data.map(fromDbOrder);
            }
        }
    } catch (error) {
        console.warn("Could not load orders from Supabase:", error);
    } finally {
        updateDashboard();
        renderOrdersTable();
        renderDeliveredOrdersTable();
        syncShareSelection();
        renderShareOrdersPage();
        renderStockTable();
    }
}

async function loadStocks() {
    try {
        if (SUPABASE_IS_CONFIGURED && supabaseClient) {
            const { data, error } = await supabaseClient
                .from("godown_stocks")
                .select("*")
                .order("product", { ascending: true })
                .order("color", { ascending: true })
                .order("godown_location", { ascending: true });
            if (!error && data) {
                stockStorageAvailable = true;
                stockStorageMessage = "";
                stocks = data;
            }
        }
    } catch (error) {
        console.warn("Could not load stock from Supabase:", error);
    } finally {
        renderStockTable();
    }
}

async function loadAppData() {
    await loadOrders();
    await loadStocks();
}

function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navigateTo(item.dataset.target);
        });
    });
}

function setupMobileNav() {
    const mobileToggle = document.getElementById("mobile-menu-toggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");

    if (mobileToggle) {
        mobileToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("show");
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        });
    }

    // Close sidebar when a nav item is clicked on mobile
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        });
    });

    mobileNavBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            navigateTo(btn.dataset.target);
        });
    });
}

function navigateTo(targetId) {
    // Update sidebar nav
    navItems.forEach(nav => nav.classList.remove("active"));
    const sidebarItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if (sidebarItem) sidebarItem.classList.add("active");

    // Update mobile bottom nav
    document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.target === targetId);
    });

    // Switch views
    views.forEach(view => {
        view.classList.toggle("active", view.id === targetId);
        view.classList.toggle("hide", view.id !== targetId);
    });

    pageTitle.textContent = navConfig[targetId].title;
    pageSubtitle.textContent = navConfig[targetId].subtitle;

    if (targetId === "dashboard") updateDashboard();
    if (targetId === "orders-list") renderOrdersTable();
    if (targetId === "delivered-orders") renderDeliveredOrdersTable();
    if (targetId === "share-orders") renderShareOrdersPage();
    if (targetId === "stock") renderStockTable();
    if (targetId === "sales-report") renderSalesReport();

    // Close mobile sidebar
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sidebar-overlay")?.classList.remove("show");
}

function setupOrderForm() {
    addItemBtn.addEventListener("click", addNewItem);
    itemsContainer.addEventListener("input", updateFormQuantity);
    itemsContainer.addEventListener("change", updateFormQuantity);

    orderForm.addEventListener("submit", event => {
        event.preventDefault();
        saveNewOrder();
    });
}

function setupSharePage() {
    if (!shareTeamSelect || !shareGodownSelect || !shareStatusSelect) return;

    shareGodownSelect.innerHTML = '<option value="All">All Godowns</option>';
    GODOWNS.forEach(godown => {
        shareGodownSelect.insertAdjacentHTML(
            "beforeend",
            `<option value="${escapeHtml(godown.id)}">${escapeHtml(godown.label)}</option>`
        );
    });

    [shareTeamSelect, shareGodownSelect, shareStatusSelect].forEach(control => {
        control.addEventListener("change", () => {
            selectedShareOrderIds = new Set(getShareCandidateOrders().map(order => order.id));
            renderShareOrdersPage();
        });
    });

    shareOrdersList?.addEventListener("change", event => {
        const checkbox = event.target.closest(".share-order-check");
        if (!checkbox) return;
        if (checkbox.checked) {
            selectedShareOrderIds.add(checkbox.value);
        } else {
            selectedShareOrderIds.delete(checkbox.value);
        }
        renderShareMessage();
    });

    copyShareBtn?.addEventListener("click", copyShareMessage);
    whatsappShareBtn?.addEventListener("click", shareToWhatsApp);
}

function addNewItem() {
    const clone = itemTemplate.content.cloneNode(true);
    const itemCard = clone.querySelector(".item-card");
    const productSelect = itemCard.querySelector(".product-select");
    const colorGroup = itemCard.querySelector(".color-group");
    const colorSelect = itemCard.querySelector(".color-select");
    const removeBtn = itemCard.querySelector(".remove-item-btn");
    const hint = itemCard.querySelector(".item-hint");

    populateProductSelect(productSelect);

    productSelect.addEventListener("change", () => {
        const product = INVENTORY_CONFIG[productSelect.value];
        colorSelect.innerHTML = "";

        if (product.colors.length) {
            colorGroup.classList.remove("hide");
            colorSelect.disabled = false;
            colorSelect.required = true;
            colorSelect.innerHTML = '<option value="" disabled selected>Select color</option>';
            product.colors.forEach(color => {
                colorSelect.insertAdjacentHTML("beforeend", `<option value="${color}">${color}</option>`);
            });
        } else {
            colorGroup.classList.add("hide");
            colorSelect.disabled = true;
            colorSelect.required = false;
        }

        hint.textContent = product.capacityPairs
            ? `${product.rackCount} racks, 3 pairs per rack, total ${product.capacityPairs} pairs.`
            : product.name;
    });

    removeBtn.addEventListener("click", () => {
        if (itemsContainer.children.length === 1) {
            showToast("Order must have at least one item.", true);
            return;
        }
        itemCard.remove();
        updateFormQuantity();
    });

    itemsContainer.appendChild(itemCard);
    updateFormQuantity();
}

function populateProductSelect(select) {
    const groups = {
        "Shoe Racks": ["2-Rack", "3-Rack", "4-Rack", "5-Rack"],
        "Tables": ["Ironing Table", "Study Table"]
    };

    Object.entries(groups).forEach(([label, keys]) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = label;
        keys.forEach(key => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = INVENTORY_CONFIG[key].name;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });
}

async function saveNewOrder() {
    const godownLocation = document.getElementById("godownLocation").value;
    const godown = GODOWNS.find(entry => entry.id === godownLocation);
    const agentName = document.getElementById("agentName").value.trim();
    const customerName = document.getElementById("customerName").value.trim();
    const customerPhone = document.getElementById("customerPhone").value.trim();
    const deliveryArea = document.getElementById("deliveryArea").value.trim();
    const locationLink = document.getElementById("locationLink").value.trim();
    const orderDate = document.getElementById("orderDate").value;
    const notes = document.getElementById("orderNotes").value.trim();
    const specificDate = document.getElementById("specificDate").value;
    const isInfluencer = document.getElementById("isInfluencer").checked;
    const items = collectItems();

    if (!godownLocation || !agentName || !items.length || !orderDate) {
        showToast("Fill godown, agent, date, product, color, and quantity.", true);
        return;
    }

    const newOrder = {
        id: createOrderId(godownLocation),
        date: new Date(orderDate).toISOString(),
        agentName,
        customerName,
        customerPhone,
        deliveryArea,
        locationLink,
        godownLocation,
        whatsappGroup: godown.group,
        status: "New",
        notes,
        specificDate,
        isInfluencer,
        items
    };

    try {
        await requireSession();
        const { data, error } = await supabaseClient
            .from("orders")
            .insert(toDbOrder(newOrder))
            .select()
            .single();
        if (error) throw error;

        const savedOrder = fromDbOrder(data);
        orders.unshift(savedOrder);
        showToast("Order saved.");
        
        orderForm.reset();
        setDefaultOrderDate();
        itemsContainer.innerHTML = "";
        addNewItem();
        updateDashboard();
        renderOrdersTable();
        syncShareSelection();
        renderShareOrdersPage();
        renderStockTable();
        document.querySelector('[data-target="orders-list"]').click();
    } catch (error) {
        showToast("Database rejected save. Check Supabase setup/RLS.", true);
    }
}

function collectItems() {
    const items = [];
    let valid = true;

    itemsContainer.querySelectorAll(".item-card").forEach(card => {
        const productKey = card.querySelector(".product-select").value;
        const qty = Number.parseInt(card.querySelector(".qty-input").value, 10);
        const colorSelect = card.querySelector(".color-select");
        const product = INVENTORY_CONFIG[productKey];
        const color = colorSelect.disabled ? "" : colorSelect.value;

        if (!product || !qty || qty < 1 || (product.colors.length && !color)) {
            valid = false;
            return;
        }

        items.push({ product: productKey, color, qty });
    });

    return valid ? items : [];
}

function updateFormQuantity() {
    const total = [...itemsContainer.querySelectorAll(".qty-input")]
        .reduce((sum, input) => sum + (Number.parseInt(input.value, 10) || 0), 0);
    document.getElementById("form-total-qty").textContent = total;
}

function updateDashboard() {
    const godownCounts = Object.fromEntries(GODOWNS.map(godown => [godown.id, 0]));
    const statusCounts = Object.fromEntries(STATUSES.map(status => [status, 0]));
    let totalQty = 0;
    let pending = 0;

    orders.forEach(order => {
        if (godownCounts[order.godownLocation] !== undefined) godownCounts[order.godownLocation]++;
        const status = order.status || "New";
        if (statusCounts[status] !== undefined) statusCounts[status]++;
        if (status === "Dispatched") pending++;
        order.items.forEach(item => {
            totalQty += Number.parseInt(item.qty, 10) || 0;
        });
    });

    document.getElementById("stat-total-orders").textContent = orders.length;
    document.getElementById("stat-items-sold").textContent = totalQty;
    document.getElementById("stat-pending").textContent = pending;
    renderGodownBars(godownCounts);
    renderStatusStats(statusCounts);
    renderRecentOrders();
}

function renderGodownBars(godownCounts) {
    const container = document.getElementById("godown-stats-container");
    const max = Math.max(...Object.values(godownCounts), 1);
    container.innerHTML = "";

    GODOWNS.forEach(godown => {
        const count = godownCounts[godown.id] || 0;
        container.insertAdjacentHTML("beforeend", `
            <div class="bar-row">
                <div class="bar-copy">
                    <strong>${escapeHtml(godown.label)}</strong>
                    <span>${escapeHtml(godown.group)}</span>
                </div>
                <div class="bar-track"><span style="width:${(count / max) * 100}%"></span></div>
                <b>${count}</b>
            </div>
        `);
    });
}

function renderStatusStats(statusCounts) {
    const container = document.getElementById("status-stats-container");
    container.innerHTML = "";
    STATUSES.forEach(status => {
        container.insertAdjacentHTML("beforeend", `
            <div class="status-card">
                <span>${escapeHtml(status)}</span>
                <strong>${statusCounts[status] || 0}</strong>
            </div>
        `);
    });
}

function renderRecentOrders() {
    const container = document.getElementById("recent-orders-list");
    container.innerHTML = "";

    if (!orders.length) {
        container.innerHTML = '<div class="empty-inline">No orders yet.</div>';
        return;
    }

    orders.slice(0, 6).forEach(order => {
        container.insertAdjacentHTML("beforeend", `
            <div class="recent-item">
                <div>
                    <strong>${escapeHtml(order.id)}</strong>
                    <span>${escapeHtml(order.agentName)} / ${escapeHtml(order.godownLocation)}</span>
                </div>
                <div class="recent-meta">
                    <span class="status-pill">${escapeHtml(order.status || "New")}</span>
                    <time>${formatDate(order.date)}</time>
                </div>
            </div>
        `);
    });
}

function renderOrdersTable() {
    const board = document.getElementById("orders-board");
    const noOrders = document.getElementById("no-orders-message");
    if (!board || !noOrders) return;

    const searchInput = document.getElementById("search-orders");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    let matches = 0;

    board.innerHTML = "";

    // Exclude delivered orders from the main active workflow desk
    const activeOrders = (orders || []).filter(order => (order.status || "New") !== "Delivered");

    const filteredOrders = activeOrders.filter(order => {
        const searchText = [
            order.id,
            order.agentName,
            order.customerName,
            order.customerPhone,
            order.deliveryArea,
            order.locationLink,
            order.godownLocation,
            order.whatsappGroup
        ].join(" ").toLowerCase();
        return searchText.includes(search) &&
            (currentOrdersGodown === "All" || order.godownLocation === currentOrdersGodown);
    });

    GODOWNS.forEach(godown => {
        if (currentOrdersGodown !== "All" && currentOrdersGodown !== godown.id) return;
        const godownOrders = filteredOrders.filter(order => order.godownLocation === godown.id);
        matches += godownOrders.length;

        const statusColumns = [...ACTIVE_STATUSES, "Returned"].map(status => {
            const statusOrders = godownOrders.filter(order => (order.status || "New") === status);
            let extClass = "";
            if (status === "Returned") extClass = "returned-column";
            
            return `
                <div class="order-column ${extClass}">
                    <div class="order-column-title">
                        <span>${escapeHtml(status)}</span>
                        <b>${statusOrders.length}</b>
                    </div>
                    <div class="order-card-list">
                        ${statusOrders.length ? statusOrders.map(renderOrderCard).join("") : '<div class="empty-column">No orders</div>'}
                    </div>
                </div>
            `;
        }).join("");

        board.insertAdjacentHTML("beforeend", `
            <section class="godown-board">
                <div class="godown-board-head">
                    <div>
                        <h3>${escapeHtml(godown.label)}</h3>
                        <span>${escapeHtml(godown.group)}</span>
                    </div>
                    <strong>${godownOrders.length} active orders</strong>
                </div>
                <div class="order-columns">${statusColumns}</div>
            </section>
        `);
    });

    const isSearching = Boolean(search);
    noOrders.classList.toggle("hide", !isSearching || matches > 0);
    board.classList.remove("hide");
}

function renderDeliveredOrdersTable() {
    const board = document.getElementById("delivered-orders-board");
    const noOrders = document.getElementById("no-delivered-orders-message");
    if (!board || !noOrders) return;

    const searchInput = document.getElementById("search-delivered-orders");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    let matches = 0;

    board.innerHTML = "";

    const deliveredOrders = (orders || []).filter(order => order.status === "Delivered");

    const filteredOrders = deliveredOrders.filter(order => {
        const searchText = [
            order.id,
            order.agentName,
            order.customerName,
            order.customerPhone,
            order.deliveryArea,
            order.locationLink,
            order.godownLocation,
            order.whatsappGroup
        ].join(" ").toLowerCase();
        return searchText.includes(search) &&
            (currentDeliveredGodown === "All" || order.godownLocation === currentDeliveredGodown);
    });

    GODOWNS.forEach(godown => {
        if (currentDeliveredGodown !== "All" && currentDeliveredGodown !== godown.id) return;
        const godownOrders = filteredOrders.filter(order => order.godownLocation === godown.id);
        matches += godownOrders.length;

        board.insertAdjacentHTML("beforeend", `
            <section class="godown-board">
                <div class="godown-board-head">
                    <div>
                        <h3>${escapeHtml(godown.label)}</h3>
                        <span>${escapeHtml(godown.group)}</span>
                    </div>
                    <strong style="color:#000000; font-weight:800;">${godownOrders.length} Delivered</strong>
                </div>
                <div class="order-columns" style="grid-template-columns: 1fr;">
                    <div class="order-column delivered-column" style="background:#ffffff; border:1px solid #e2e2e8;">
                        <div class="order-column-title" style="background:#000000; color:#ffffff;">
                            <span><i class="fa-solid fa-circle-check" style="color:#ffffff;"></i> Delivered Orders</span>
                            <b style="background:#ffffff; color:#000000;">${godownOrders.length}</b>
                        </div>
                        <div class="order-card-list">
                            ${godownOrders.length ? godownOrders.map(renderOrderCard).join("") : '<div class="empty-column">No delivered orders</div>'}
                        </div>
                    </div>
                </div>
            </section>
        `);
    });

    const isSearching = Boolean(search);
    noOrders.classList.toggle("hide", !isSearching || matches > 0);
    board.classList.remove("hide");
}

function getShareCandidateOrders() {
    const godown = shareGodownSelect?.value || "All";
    const statusFilter = shareStatusSelect?.value || "active";
    const statuses = SHARE_STATUS_PRESETS[statusFilter] || [statusFilter];

    return orders.filter(order => {
        const status = order.status || "New";
        return statuses.includes(status) &&
            (godown === "All" || order.godownLocation === godown);
    });
}

function syncShareSelection() {
    const candidateIds = new Set(getShareCandidateOrders().map(order => order.id));
    selectedShareOrderIds = new Set([...selectedShareOrderIds].filter(id => candidateIds.has(id)));
    if (!selectedShareOrderIds.size) selectedShareOrderIds = candidateIds;
}

function renderShareOrdersPage() {
    if (!shareOrdersList || !shareMessage) return;

    const candidates = getShareCandidateOrders();
    const candidateIds = new Set(candidates.map(order => order.id));
    selectedShareOrderIds = new Set([...selectedShareOrderIds].filter(id => candidateIds.has(id)));
    if (!selectedShareOrderIds.size && candidates.length) {
        selectedShareOrderIds = candidateIds;
    }

    if (!candidates.length) {
        shareOrdersList.innerHTML = `
            <div class="empty-state compact">
                <i class="fa-solid fa-share-nodes"></i>
                <h3>No orders ready to share</h3>
                <p>Change the godown or status filter, or add new orders first.</p>
            </div>
        `;
        renderShareMessage();
        return;
    }

    shareOrdersList.innerHTML = candidates.map(order => {
        const checked = selectedShareOrderIds.has(order.id) ? "checked" : "";
        const totalQty = getOrderQuantity(order);
        const safeOrderId = jsString(order.id);
        return `
            <label class="share-order-card">
                <input type="checkbox" class="share-order-check" value="${escapeHtml(order.id)}" ${checked}>
                <span class="share-order-body">
                    <strong>${escapeHtml(order.agentName || "Agent")} <small>${escapeHtml(order.id)}</small></strong>
                    <span>${escapeHtml([order.godownLocation, order.status || "New", formatDate(order.date)].filter(Boolean).join(" / "))}</span>
                    <span>${escapeHtml([order.customerName, order.customerPhone, order.deliveryArea].filter(Boolean).join(" / ") || "Customer details not added")}</span>
                    ${order.locationLink ? '<span class="location-ready">Location link added</span>' : '<span class="location-missing">No map location</span>'}
                    <b>${totalQty} qty</b>
                </span>
                <button type="button" class="btn btn-compact btn-secondary share-single-btn" onclick="event.preventDefault(); event.stopPropagation(); shareSingleOrder('${safeOrderId}')" title="Share this single order to WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
            </label>
        `;
    }).join("");

    renderShareMessage();
}

function renderShareMessage() {
    if (!shareMessage) return;

    const selectedOrders = getShareCandidateOrders()
        .filter(order => selectedShareOrderIds.has(order.id));
    const totalQty = selectedOrders.reduce((sum, order) => sum + getOrderQuantity(order), 0);

    if (shareOrderCount) shareOrderCount.textContent = selectedOrders.length;
    if (shareQtyCount) shareQtyCount.textContent = totalQty;
    shareMessage.value = buildShareMessage(selectedOrders);
}

function buildShareMessage(selectedOrders) {
    const team = shareTeamSelect?.value === "delivery" ? "Delivery Team" : "Fitting Team";
    const godown = shareGodownSelect?.value || "All";
    const godownLabel = godown === "All" ? "All Godowns" : godown;
    const today = new Date().toLocaleDateString([], { dateStyle: "medium" });

    if (!selectedOrders.length) {
        return `📋 *ShoeDen ${team} Orders*\n📍 ${godownLabel} - ${today}\n\n⚠️ No orders selected.`;
    }

    const totalQty = selectedOrders.reduce((sum, order) => sum + getOrderQuantity(order), 0);
    const grouped = groupOrdersByGodown(selectedOrders);
    const lines = [
        `🚚 *ShoeDen ${team} Orders*`,
        `📍 *Godown:* ${godownLabel}`,
        `📅 *Date:* ${today}`,
        `📊 *Total:* ${selectedOrders.length} Orders (${totalQty} Items)`,
        `================================`
    ];

    let orderCounter = 1;

    grouped.forEach(([groupName, groupOrders]) => {
        lines.push(`\n🏢 *GODOWN: ${groupName.toUpperCase()}* (${groupOrders.length} orders)`);
        lines.push(`--------------------------------`);

        groupOrders.forEach(order => {
            lines.push(`\n📦 *ORDER #${orderCounter}:* \`${order.id}\``);
            
            if (order.isInfluencer) {
                lines.push(`🌟 *INFLUENCER ORDER*`);
            }
            
            lines.push(`📌 *Agent:* ${order.agentName || "N/A"}`);
            if (order.customerName) lines.push(`👤 *Customer:* ${order.customerName}`);
            if (order.customerPhone) lines.push(`📞 *Phone:* ${order.customerPhone}`);
            if (order.deliveryArea) lines.push(`📍 *Address:* ${order.deliveryArea}`);
            if (order.locationLink) lines.push(`🗺️ *Location:* ${order.locationLink}`);
            if (order.specificDate) lines.push(`📅 *Delivery Date:* ${order.specificDate}`);

            lines.push(`🛒 *Items:*`);
            (order.items || []).forEach(item => {
                const product = INVENTORY_CONFIG[item.product]?.name || item.product;
                const color = item.color ? ` (${item.color})` : "";
                lines.push(`   • ${item.qty}x ${product}${color}`);
            });

            if (order.notes) lines.push(`📝 *Notes:* ${order.notes}`);
            lines.push(`🚥 *Status:* ${order.status || "New"}`);
            lines.push(`--------------------------------`);
            orderCounter++;
        });
    });

    lines.push(`\n================================`);
    lines.push(`✅ *Please confirm once received & assigned.*`);
    return lines.join("\n").trim();
}

window.shareSingleOrder = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        showToast("Order not found.", true);
        return;
    }
    const message = buildSingleOrderMessage(order);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
};

function buildSingleOrderMessage(order) {
    const team = shareTeamSelect?.value === "delivery" ? "Delivery Team" : "Fitting Team";
    const lines = [
        `📦 *ShoeDen ${team} Order*`,
        `================================`,
        `🆔 *Order ID:* \`${order.id}\``
    ];

    if (order.isInfluencer) {
        lines.push(`🌟 *INFLUENCER ORDER*`);
    }

    lines.push(`🏢 *Godown:* ${order.godownLocation || "N/A"}`);
    lines.push(`📌 *Agent:* ${order.agentName || "N/A"}`);

    if (order.customerName) lines.push(`👤 *Customer:* ${order.customerName}`);
    if (order.customerPhone) lines.push(`📞 *Phone:* ${order.customerPhone}`);
    if (order.deliveryArea) lines.push(`📍 *Address:* ${order.deliveryArea}`);
    if (order.locationLink) lines.push(`🗺️ *Location:* ${order.locationLink}`);
    if (order.specificDate) lines.push(`📅 *Delivery Date:* ${order.specificDate}`);

    lines.push(`🛒 *Items:*`);
    (order.items || []).forEach(item => {
        const product = INVENTORY_CONFIG[item.product]?.name || item.product;
        const color = item.color ? ` (${item.color})` : "";
        lines.push(`   • ${item.qty}x ${product}${color}`);
    });

    if (order.notes) lines.push(`📝 *Notes:* ${order.notes}`);
    lines.push(`🚥 *Status:* ${order.status || "New"}`);
    lines.push(`================================`);

    return lines.join("\n").trim();
}

function groupOrdersByGodown(orderList) {
    return GODOWNS
        .map(godown => [godown.label, orderList.filter(order => order.godownLocation === godown.id)])
        .filter(([, groupOrders]) => groupOrders.length);
}

function formatShareItems(items = []) {
    if (!items.length) return "No items";
    return items.map(item => {
        const product = INVENTORY_CONFIG[item.product]?.name || item.product;
        const color = item.color ? ` (${item.color})` : "";
        return `${item.qty}x ${product}${color}`;
    }).join(", ");
}

function getOrderQuantity(order) {
    return (order.items || []).reduce((sum, item) => sum + (Number.parseInt(item.qty, 10) || 0), 0);
}

async function copyShareMessage() {
    const message = shareMessage?.value || "";
    if (!message.trim()) {
        showToast("No message to copy.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(message);
        showToast("Team message copied.");
    } catch (error) {
        shareMessage?.select();
        showToast("Select and copy the message manually.", true);
    }
}

function shareToWhatsApp() {
    const message = shareMessage?.value || "";
    if (!message.trim()) {
        showToast("No message to share.", true);
        return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function renderOrderCard(order) {
    const status = order.status || "New";
    const dateVal = toDateInputValue(order.date);
    const safeOrderId = jsString(order.id);
    
    // Influencer logic based on both explicit flag and keywords
    const isInfluencer = order.isInfluencer || 
        `${order.notes || ""} ${order.agentName} ${order.customerName || ""}`.toLowerCase().includes("influencer");

    return `
        <article class="order-card-v2 ${isInfluencer ? 'is-influencer' : ''} status-${status.toLowerCase()}">
            <div class="card-header">
                <div class="location-badge">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${escapeHtml(order.godownLocation)}</span>
                </div>
                <button class="card-delete-btn" onclick="deleteOrder('${safeOrderId}')" title="Delete">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>

            <div class="card-main">
                <div class="main-info">
                    <h4 class="agent-name">${escapeHtml(order.agentName)}</h4>
                    <div class="customer-phone">
                        <i class="fa-solid fa-phone"></i>
                        <span>${escapeHtml(order.customerPhone || "No Phone")}</span>
                    </div>
                </div>
                
                <div class="order-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-calendar-day"></i>
                        <span>${toDateDisplay(order.date)}</span>
                    </div>
                    ${order.specificDate ? `
                    <div class="meta-item specific-date">
                        <i class="fa-solid fa-clock"></i>
                        <span>Target: ${toDateDisplay(order.specificDate)}</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="card-products">
                ${formatItemsMinimal(order.items)}
            </div>

            ${order.notes ? `
            <div class="card-notes">
                <i class="fa-solid fa-quote-left"></i>
                <p>${escapeHtml(order.notes)}</p>
            </div>` : ''}

            <div class="card-footer">
                <div class="area-tag" title="${escapeHtml(order.deliveryArea)}">
                    <i class="fa-solid fa-map-pin"></i>
                    <span>${escapeHtml(order.deliveryArea || "No Area")}</span>
                </div>
                <div class="status-wrapper">
                    <select class="status-select-v2" onchange="updateOrderStatus('${safeOrderId}', this.value)">
                        ${STATUSES.map(value => `<option value="${escapeHtml(value)}" ${value === status ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
                    </select>
                </div>
            </div>
            
            ${isInfluencer ? '<div class="influencer-ribbon">INFLUENCER</div>' : ''}
        </article>
    `;
}

function toDateDisplay(date) {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatItemsMinimal(items) {
    if (!items || !items.length) return '<div class="no-items">No products</div>';
    return items.map(item => {
        const product = INVENTORY_CONFIG[item.product];
        const color = item.color ? `<span>${escapeHtml(item.color)}</span>` : "";
        return `
            <div class="product-line">
                <span class="product-qty">${escapeHtml(String(item.qty))}x</span>
                <span class="product-name">${escapeHtml(product?.name || item.product)}</span>
                ${color}
            </div>
        `;
    }).join("");
}


window.switchStockView = function(mode) {
    const zonesContainer = document.getElementById("stock-zones-container");
    const matrixContainer = document.getElementById("stock-matrix-container");
    const zonesBtn = document.getElementById("stock-view-zones-btn");
    const matrixBtn = document.getElementById("stock-view-matrix-btn");
    
    if (mode === 'matrix') {
        zonesContainer?.classList.add("hide");
        matrixContainer?.classList.remove("hide");
        zonesBtn?.classList.remove("active");
        matrixBtn?.classList.add("active");
    } else {
        matrixContainer?.classList.add("hide");
        zonesContainer?.classList.remove("hide");
        matrixBtn?.classList.remove("active");
        zonesBtn?.classList.add("active");
    }
};

window.updateStockQuantityStep = function(godownId, product, color, delta) {
    const baseStock = getStockQty(godownId, product, color);
    const stockData = calculateStockMetrics();
    const key = stockKeyForGodown(godownId, product, color);
    const delivQty = stockData.delivered.get(key) || 0;
    const currentPhysicalStock = baseStock - delivQty;
    const newPhysical = Math.max(0, currentPhysicalStock + delta);
    
    updateStockQuantity(godownId, product, color, newPhysical);
};

function renderStockTable() {
    const head = document.getElementById("stock-table-head");
    const body = document.getElementById("stock-table-body");
    const zonesContainer = document.getElementById("stock-zones-container");
    const setupMessage = document.getElementById("stock-setup-message");

    if (setupMessage) {
        if (!stockStorageAvailable && stockStorageMessage) {
            setupMessage.innerHTML = `
                <div class="setup-alert-content">
                    <div class="setup-alert-header">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <strong>Database Stock Setup Required</strong>
                    </div>
                    <p>The <code>godown_stocks</code> table has not been created in your Supabase project yet. Run the <code>godown_stocks</code> schema in your <strong>Supabase SQL Editor</strong> to enable real-time stock tracking.</p>
                    <div class="setup-alert-actions">
                        <button type="button" class="btn btn-compact btn-secondary" onclick="copyStockSql()">
                            <i class="fa-solid fa-copy"></i>
                            <span>Copy Stock Setup SQL</span>
                        </button>
                    </div>
                </div>
            `;
            setupMessage.classList.remove("hide");
        } else {
            setupMessage.classList.add("hide");
        }
    }

    const stockData = calculateStockMetrics();

    // ── Calculate Grand Totals across all Godowns for Hero Stats ──
    let grandPhysical = 0;
    let grandHold = 0;
    let grandAvailable = 0;

    GODOWNS.forEach(godown => {
        STOCK_VARIANTS.forEach(variant => {
            const baseStock = getStockQty(godown.id, variant.product, variant.color);
            const key = stockKeyForGodown(godown.id, variant.product, variant.color);
            const holdQty = stockData.holds.get(key) || 0;
            const delivQty = stockData.delivered.get(key) || 0;
            
            const physical = baseStock - delivQty;
            const available = physical - holdQty;

            grandPhysical += physical;
            grandHold += holdQty;
            grandAvailable += available;
        });
    });

    // ── Update Hero KPI Cards ──
    const maxCapacityEst = GODOWNS.length * 350; // Estimated 350 pairs max capacity per godown
    const capacityPercent = Math.min(100, Math.round((grandPhysical / maxCapacityEst) * 100));

    const capacityPercentEl = document.getElementById("wh-kpi-capacity-percent");
    const capacityBarEl = document.getElementById("wh-kpi-capacity-bar");
    const capacityTextEl = document.getElementById("wh-kpi-capacity-text");
    const dispatchedEl = document.getElementById("wh-kpi-dispatched");
    const availableEl = document.getElementById("wh-kpi-available");

    if (capacityPercentEl) capacityPercentEl.textContent = `${capacityPercent}%`;
    if (capacityBarEl) capacityBarEl.style.width = `${capacityPercent}%`;
    if (capacityTextEl) capacityTextEl.textContent = `${grandPhysical.toLocaleString()} / ${maxCapacityEst.toLocaleString()} Total Pairs`;
    if (dispatchedEl) dispatchedEl.textContent = grandHold.toLocaleString();
    if (availableEl) availableEl.textContent = grandAvailable.toLocaleString();

    // ── Render 3D Godown Zone Cards (Matching Reference Image 1) ──
    if (zonesContainer) {
        const zoneLetters = ["A", "B", "C", "D", "E"];
        const zoneSubtitles = [
            "Fast Picking Logistics",
            "Central Express Hub",
            "Main Stock Depot",
            "Regional Distribution",
            "Southern Dispatch Terminal"
        ];

        zonesContainer.innerHTML = GODOWNS.map((godown, idx) => {
            const letter = zoneLetters[idx % zoneLetters.length];
            const subtitle = zoneSubtitles[idx % zoneSubtitles.length];
            const godownEstCap = 350;
            let godownPhysical = 0;
            let godownHold = 0;
            let godownAvail = 0;

            const productRows = STOCK_VARIANTS.map(variant => {
                const baseStock = getStockQty(godown.id, variant.product, variant.color);
                const key = stockKeyForGodown(godown.id, variant.product, variant.color);
                const holdQty = stockData.holds.get(key) || 0;
                const delivQty = stockData.delivered.get(key) || 0;
                const physical = baseStock - delivQty;
                const available = physical - holdQty;

                godownPhysical += physical;
                godownHold += holdQty;
                godownAvail += available;

                const safeGodownId = jsString(godown.id);
                const safeProduct = jsString(variant.product);
                const safeColor = jsString(variant.color);

                const availClass = available < 0 ? "negative-badge" : available <= 3 ? "low-badge" : "ok-badge";

                return `
                    <div class="zone-product-item">
                        <div class="zone-prod-info">
                            <strong>${escapeHtml(variant.label)}</strong>
                            <span class="zone-prod-cat">${escapeHtml(variant.category)}</span>
                        </div>
                        <div class="zone-prod-metrics">
                            <span class="zone-metric-pill hold">Hold <b>${holdQty}</b></span>
                            <span class="zone-metric-pill ${availClass}">Avail <b>${available}</b></span>
                        </div>
                        <div class="zone-prod-stepper">
                            <button type="button" class="stepper-btn" onclick="updateStockQuantityStep('${safeGodownId}', '${safeProduct}', '${safeColor}', -1)">-</button>
                            <input
                                type="number"
                                class="zone-stock-input"
                                value="${physical}"
                                ${stockStorageAvailable ? "" : "disabled"}
                                onchange="updateStockQuantity('${safeGodownId}', '${safeProduct}', '${safeColor}', this.value)"
                            >
                            <button type="button" class="stepper-btn" onclick="updateStockQuantityStep('${safeGodownId}', '${safeProduct}', '${safeColor}', 1)">+</button>
                        </div>
                    </div>
                `;
            }).join("");

            const godownCapPercent = Math.min(100, Math.round((godownPhysical / godownEstCap) * 100));

            return `
                <div class="godown-zone-card">
                    <div class="zone-card-header">
                        <div class="zone-badge">
                            <span>ZONE</span>
                            <strong>${letter}</strong>
                        </div>
                        <div class="zone-title-box">
                            <h4>${escapeHtml(godown.label)}</h4>
                            <span class="zone-sub">${subtitle}</span>
                        </div>
                        <div class="zone-group-tag">
                            <i class="fa-solid fa-layer-group"></i> ${escapeHtml(godown.group || "Godown")}
                        </div>
                    </div>

                    <div class="zone-capacity-box">
                        <div class="zone-cap-head">
                            <span>Capacity Occupied</span>
                            <strong>${godownCapPercent}% (${godownPhysical} / ${godownEstCap} Pairs)</strong>
                        </div>
                        <div class="capacity-track">
                            <div class="capacity-fill" style="width: ${godownCapPercent}%"></div>
                        </div>
                    </div>

                    <div class="zone-summary-pills">
                        <div class="zone-pill">
                            <span>Physical Stock</span>
                            <strong>${godownPhysical}</strong>
                        </div>
                        <div class="zone-pill">
                            <span>Dispatched Hold</span>
                            <strong>${godownHold}</strong>
                        </div>
                        <div class="zone-pill highlight">
                            <span>Available Balance</span>
                            <strong>${godownAvail}</strong>
                        </div>
                    </div>

                    <div class="zone-inventory-rack">
                        <div class="rack-title">
                            <i class="fa-solid fa-dolly"></i> Stock Racks & Products
                        </div>
                        <div class="rack-products-list">
                            ${productRows}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // ── Render Secondary Full Matrix View ──
    if (head && body) {
        head.innerHTML = `
            <tr>
                <th>Product</th>
                ${GODOWNS.map(godown => `<th>${escapeHtml(godown.label)}</th>`).join("")}
                <th>Total Available</th>
            </tr>
        `;

        const rackProducts = STOCK_VARIANTS.filter(v => v.category === "Shoe Rack");
        const tableProducts = STOCK_VARIANTS.filter(v => v.category === "Table");

        function renderProductRow(variant) {
            let totalAvailable = 0;
            const godownCells = GODOWNS.map(godown => {
                const baseStock = getStockQty(godown.id, variant.product, variant.color);
                const key = stockKeyForGodown(godown.id, variant.product, variant.color);
                const holdQty = stockData.holds.get(key) || 0;
                const delivQty = stockData.delivered.get(key) || 0;
                
                const currentPhysicalStock = baseStock - delivQty;
                const available = currentPhysicalStock - holdQty;
                totalAvailable += available;
                const availableClass = available < 0 ? "negative" : available <= 3 ? "low" : "";

                return `
                    <td>
                        <div class="stock-cell">
                            <input
                                type="number"
                                value="${currentPhysicalStock}"
                                ${stockStorageAvailable ? "" : "disabled"}
                                onchange="updateStockQuantity('${jsString(godown.id)}', '${jsString(variant.product)}', '${jsString(variant.color)}', this.value)"
                                aria-label="${escapeHtml(`${variant.label} ${variant.color || "stock"} ${godown.label}`)}"
                            >
                            <div class="stock-metrics">
                                <span>Hold <b>${holdQty}</b></span>
                                <span>Deliv <b>${delivQty}</b></span>
                                <span>Avail <b class="${availableClass}">${available}</b></span>
                            </div>
                        </div>
                    </td>
                `;
            }).join("");

            return `
                <tr>
                    <td class="stock-product">
                        <strong>${escapeHtml(variant.label)}</strong>
                        <span>${escapeHtml(variant.category)}</span>
                    </td>
                    ${godownCells}
                    <td><strong class="${totalAvailable < 0 ? "negative" : totalAvailable <= 10 ? "low" : ""}">${totalAvailable}</strong></td>
                </tr>
            `;
        }

        function renderSubtotalRow(label, variants) {
            let grandTotal = 0;
            const godownCells = GODOWNS.map(godown => {
                let subtotal = 0;
                variants.forEach(variant => {
                    const stockQty = getStockQty(godown.id, variant.product, variant.color);
                    const key = stockKeyForGodown(godown.id, variant.product, variant.color);
                    const holdQty = stockData.holds.get(key) || 0;
                    const delivQty = stockData.delivered.get(key) || 0;
                    subtotal += stockQty - holdQty - delivQty;
                });
                grandTotal += subtotal;
                const cls = subtotal < 0 ? "negative" : subtotal <= 5 ? "low" : "";
                return `<td class="stock-subtotal-cell"><strong class="${cls}">${subtotal}</strong></td>`;
            }).join("");

            const grandCls = grandTotal < 0 ? "negative" : grandTotal <= 10 ? "low" : "";
            return `
                <tr class="stock-subtotal-row">
                    <td class="stock-product stock-subtotal-cell"><strong>${escapeHtml(label)}</strong></td>
                    ${godownCells}
                    <td class="stock-subtotal-cell"><strong class="${grandCls}">${grandTotal}</strong></td>
                </tr>
            `;
        }

        let rows = "";
        rows += rackProducts.map(renderProductRow).join("");
        if (rackProducts.length > 0) {
            rows += renderSubtotalRow("All Racks Total", rackProducts);
        }

        const ironingTableProducts = tableProducts.filter(v => v.product === "Ironing Table");
        rows += ironingTableProducts.map(renderProductRow).join("");
        if (ironingTableProducts.length > 0) {
            rows += renderSubtotalRow("Ironing Table Total", ironingTableProducts);
        }

        const studyTableProducts = tableProducts.filter(v => v.product === "Study Table");
        rows += studyTableProducts.map(renderProductRow).join("");
        if (studyTableProducts.length > 0) {
            rows += renderSubtotalRow("Study Table Total", studyTableProducts);
        }

        body.innerHTML = rows;
    }
}

function calculateStockMetrics() {
    const holds = new Map();
    const delivered = new Map();

    orders.forEach(order => {
        const status = order.status || "New";
        
        if (ACTIVE_STATUSES.includes(status)) {
            order.items.forEach(item => {
                const key = stockKeyForGodown(order.godownLocation, item.product, "");
                holds.set(key, (holds.get(key) || 0) + (Number.parseInt(item.qty, 10) || 0));
            });
        } else if (status === "Delivered") {
            order.items.forEach(item => {
                const key = stockKeyForGodown(order.godownLocation, item.product, "");
                delivered.set(key, (delivered.get(key) || 0) + (Number.parseInt(item.qty, 10) || 0));
            });
        }
    });

    return { holds, delivered };
}

function getStockQty(godown, product, color) {
    let sum = 0;
    stocks.forEach(stock => {
        if (stock.godown_location === godown && stock.product === product) {
            sum += Number.parseInt(stock.quantity, 10) || 0;
        }
    });
    return sum;
}

function stockKeyForGodown(godown, product, color = "") {
    return `${godown}__${stockKey(product, color)}`;
}

window.updateStockQuantity = async function(godown, product, color, value) {
    if (!stockStorageAvailable) {
        showToast(stockStorageMessage || "Stock setup is incomplete.", true);
        renderStockTable();
        return;
    }

    const currentPhysical = Number.parseInt(value, 10) || 0;
    
    // Add back the delivered quantity to save as Base Stock internally
    const metrics = calculateStockMetrics();
    const key = stockKeyForGodown(godown, product, color);
    const delivQty = metrics.delivered.get(key) || 0;
    const quantity = currentPhysical + delivQty;

    const previousStocks = [...stocks];
    
    // Remove all old entries for this product (cleaning up color variants)
    stocks = stocks.filter(s => !(s.godown_location === godown && s.product === product));
    // Add single consolidated row
    stocks.push({ godown_location: godown, product, color: "", quantity });
    
    renderStockTable();

    try {
        await requireSession();
        // Delete previous variants first to avoid duplicates or orphaned sums
        await supabaseClient
            .from("godown_stocks")
            .delete()
            .eq("godown_location", godown)
            .eq("product", product);

        // Insert new single consolidated variant
        const { error } = await supabaseClient
            .from("godown_stocks")
            .insert({
                godown_location: godown,
                product,
                color: "",
                quantity
            });
        
        if (error) throw error;
        showToast("Stock updated.");
    } catch (error) {
        stocks = previousStocks;
        renderStockTable();
        showToast("Database rejected stock update.", true);
    }
};

window.updateOrderStatus = async function(orderId, status) {
    const order = orders.find(entry => entry.id === orderId);
    if (!order) return;
    const previousStatus = order.status || "New";
    order.status = status;
    updateDashboard();
    renderOrdersTable();
    renderDeliveredOrdersTable();
    syncShareSelection();
    renderShareOrdersPage();

    try {
        await requireSession();
        const { error } = await supabaseClient
            .from("orders")
            .update({ status })
            .eq("id", orderId);
        if (error) throw error;
        showToast(`Status updated to ${status}.`);
        renderOrdersTable();
        renderDeliveredOrdersTable();
        renderShareOrdersPage();
        renderStockTable();
    } catch (error) {
        order.status = previousStatus;
        updateDashboard();
        renderOrdersTable();
        renderDeliveredOrdersTable();
        syncShareSelection();
        renderShareOrdersPage();
        showToast("Database rejected status update.", true);
    }
};

window.updateOrderDate = async function(orderId, newDateValue) {
    const order = orders.find(entry => entry.id === orderId);
    if (!order || !newDateValue) return;
    const previousDate = order.date;
    order.date = new Date(newDateValue).toISOString();
    updateDashboard();
    renderShareOrdersPage();

    try {
        await requireSession();
        const { error } = await supabaseClient
            .from("orders")
            .update({ date: order.date })
            .eq("id", orderId);
        if (error) throw error;
        showToast("Date updated.");
    } catch (error) {
        order.date = previousDate;
        updateDashboard();
        renderOrdersTable();
        renderShareOrdersPage();
        showToast("Database rejected date update.", true);
    }
};

window.deleteOrder = async function(orderId) {
    if (!confirm("Delete this order?")) return;
    const previousOrders = [...orders];
    orders = orders.filter(order => order.id !== orderId);
    renderOrdersTable();
    updateDashboard();
    syncShareSelection();
    renderShareOrdersPage();

    try {
        await requireSession();
        const { error } = await supabaseClient
            .from("orders")
            .delete()
            .eq("id", orderId);
        if (error) throw error;
        renderStockTable();
        showToast("Order deleted.");
    } catch (error) {
        orders = previousOrders;
        updateDashboard();
        renderOrdersTable();
        syncShareSelection();
        renderShareOrdersPage();
        showToast("Database rejected deletion. Check RLS policies.", true);
    }
};

window.logout = async function() {
    try {
        if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (error) {
        // If the session already expired, still return to the login screen.
    }
    orders = [];
    stocks = [];
    updateDashboard();
    renderOrdersTable();
    syncShareSelection();
    renderShareOrdersPage();
    renderStockTable();
    showLogin();
    showToast("Logged out.");
};

window.exportData = function() {
    const headerCols = [
        "Order ID", "Date", "Status", "Godown", "WhatsApp Group", "Agent",
        "Customer", "Phone", "Delivery Area", "Location Link", "Product", "Color", "Quantity", "Notes"
    ];

    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #222; color: #fff; font-weight: bold; }
  .delivered { background: #c6efce; color: #006100; }
  .returned { background: #ffc7ce; color: #9c0006; }
</style></head><body><table>`;

    tableHtml += "<tr>" + headerCols.map(h => `<th>${h}</th>`).join("") + "</tr>";

    orders.forEach(order => {
        const status = order.status || "New";
        let rowClass = "";
        if (status === "Delivered") rowClass = ' class="delivered"';
        if (status === "Returned") rowClass = ' class="returned"';

        order.items.forEach(item => {
            const cells = [
                order.id,
                new Date(order.date).toLocaleString(),
                status,
                order.godownLocation,
                order.whatsappGroup || getGodownGroup(order.godownLocation),
                order.agentName,
                order.customerName || "",
                order.customerPhone || "",
                order.deliveryArea || "",
                order.locationLink || "",
                INVENTORY_CONFIG[item.product]?.name || item.product,
                item.color || "",
                item.qty,
                order.notes || ""
            ];
            tableHtml += `<tr${rowClass}>` + cells.map(c => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("") + "</tr>";
        });
    });

    tableHtml += "</table></body></html>";

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shoeden_orders_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

// ── DAILY SALES REPORT STATE & MANAGERS ──
let activeSalesPersonTab = "All";
let salesTrendChartInstance = null;
let salesRatioChartInstance = null;

const DEFAULT_PERSONS = ["Rafeeq", "Shuhaib", "Shanu", "Madurai Team", "Kanyakumari Team"];
let savedPersons = JSON.parse(localStorage.getItem("shoeden_sales_persons") || "null") || DEFAULT_PERSONS;
let salesReports = JSON.parse(localStorage.getItem("shoeden_sales_reports") || "[]");

function savePersonsToStorage() {
    localStorage.setItem("shoeden_sales_persons", JSON.stringify(savedPersons));
}

function saveSalesReportsToStorage() {
    localStorage.setItem("shoeden_sales_reports", JSON.stringify(salesReports));
}

function formatINR(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

function renderSalesReport() {
    const tableBody = document.getElementById("sales-table-body");
    const tableFoot = document.getElementById("sales-table-foot");
    const tabsContainer = document.getElementById("sales-person-tabs");
    const searchVal = document.getElementById("search-sales")?.value.toLowerCase().trim() || "";

    // 1. Unique Persons for Tabs
    const personList = ["All", ...new Set([
        ...savedPersons,
        ...salesReports.map(s => s.person)
    ])];

    if (tabsContainer) {
        tabsContainer.innerHTML = personList.map(person => {
            const activeCls = activeSalesPersonTab === person ? "active" : "";
            return `<button type="button" class="sales-person-tab ${activeCls}" onclick="switchSalesPersonTab('${jsString(person)}')">${escapeHtml(person)}</button>`;
        }).join("");
    }

    // 2. Filter Sales Entries
    let filtered = salesReports.filter(entry => {
        if (activeSalesPersonTab !== "All" && entry.person !== activeSalesPersonTab) return false;
        if (searchVal) {
            const queryMatch = entry.person.toLowerCase().includes(searchVal) || entry.date.includes(searchVal);
            if (!queryMatch) return false;
        }
        return true;
    });

    // Sort by Date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Compute Metrics
    let totalCash = 0;
    let totalUpi = 0;
    const personTotals = {};

    salesReports.forEach(entry => {
        const cash = Number(entry.cash) || 0;
        const upi = Number(entry.upi) || 0;
        totalCash += cash;
        totalUpi += upi;
        personTotals[entry.person] = (personTotals[entry.person] || 0) + (cash + upi);
    });

    const grandTotal = totalCash + totalUpi;
    const cashPercent = grandTotal > 0 ? Math.round((totalCash / grandTotal) * 100) : 0;
    const upiPercent = grandTotal > 0 ? Math.round((totalUpi / grandTotal) * 100) : 0;

    let topPerson = "--";
    let topPersonAmount = 0;
    Object.entries(personTotals).forEach(([person, amount]) => {
        if (amount > topPersonAmount) {
            topPersonAmount = amount;
            topPerson = person;
        }
    });

    // Update KPI Cards
    const totalEl = document.getElementById("sales-total-amount");
    const totalEntriesEl = document.getElementById("sales-total-entries");
    const cashEl = document.getElementById("sales-cash-amount");
    const cashPctEl = document.getElementById("sales-cash-percent");
    const upiEl = document.getElementById("sales-upi-amount");
    const upiPctEl = document.getElementById("sales-upi-percent");
    const topPersonEl = document.getElementById("sales-top-person");
    const topPersonAmtEl = document.getElementById("sales-top-person-amount");

    if (totalEl) totalEl.textContent = formatINR(grandTotal);
    if (totalEntriesEl) totalEntriesEl.textContent = `${salesReports.length} Days Logged`;
    if (cashEl) cashEl.textContent = formatINR(totalCash);
    if (cashPctEl) cashPctEl.textContent = `${cashPercent}% of total`;
    if (upiEl) upiEl.textContent = formatINR(totalUpi);
    if (upiPctEl) upiPctEl.textContent = `${upiPercent}% of total`;
    if (topPersonEl) topPersonEl.textContent = topPerson;
    if (topPersonAmtEl) topPersonAmtEl.textContent = `${formatINR(topPersonAmount)} Total`;

    // 4. Render Table Rows
    if (tableBody) {
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px; color: #64748b; font-weight: 600;">No sales records logged yet.<br><small style="color:#94a3b8;">Click 'Add Daily Collection' button above to log cash and UPI entries manually.</small></td></tr>`;
        } else {
            tableBody.innerHTML = filtered.map(entry => {
                const cash = Number(entry.cash) || 0;
                const upi = Number(entry.upi) || 0;
                const dailyTotal = cash + upi;
                const badgeClass = entry.person.toLowerCase().replace(/[^a-z]/g, "");

                return `
                    <tr>
                        <td><strong>${escapeHtml(entry.date)}</strong></td>
                        <td><span class="person-badge ${badgeClass}"><i class="fa-solid fa-user"></i> ${escapeHtml(entry.person)}</span></td>
                        <td><span style="color:#d97706; font-weight:700;">${formatINR(cash)}</span></td>
                        <td><span style="color:#2563eb; font-weight:700;">${formatINR(upi)}</span></td>
                        <td><strong style="color:#059669; font-size: 0.95rem;">${formatINR(dailyTotal)}</strong></td>
                        <td>
                            <button type="button" class="btn btn-compact btn-secondary" onclick="deleteSalesEntry('${jsString(entry.id)}')" title="Delete entry" style="padding: 4px 8px; color: #dc2626;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }

    // Table Footer Summary
    if (tableFoot) {
        let pageCash = 0;
        let pageUpi = 0;
        filtered.forEach(e => { pageCash += Number(e.cash) || 0; pageUpi += Number(e.upi) || 0; });
        const pageTotal = pageCash + pageUpi;

        tableFoot.innerHTML = `
            <tr>
                <td colspan="2">TOTAL (${filtered.length} Entries)</td>
                <td style="color:#d97706">${formatINR(pageCash)}</td>
                <td style="color:#2563eb">${formatINR(pageUpi)}</td>
                <td style="color:#059669">${formatINR(pageTotal)}</td>
                <td></td>
            </tr>
        `;
    }

    // 5. Update Charts
    updateSalesCharts();
}

window.switchSalesPersonTab = function(person) {
    activeSalesPersonTab = person;
    renderSalesReport();
};

function updateSalesCharts() {
    if (typeof Chart === "undefined") return;

    // Group sales data by date
    const dateMap = {};
    salesReports.forEach(entry => {
        if (!dateMap[entry.date]) {
            dateMap[entry.date] = { cash: 0, upi: 0 };
        }
        dateMap[entry.date].cash += Number(entry.cash) || 0;
        dateMap[entry.date].upi += Number(entry.upi) || 0;
    });

    const datesSorted = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b));
    const cashData = datesSorted.map(d => dateMap[d].cash);
    const upiData = datesSorted.map(d => dateMap[d].upi);

    // Render Trend Bar Chart
    const trendCtx = document.getElementById("salesTrendChart")?.getContext("2d");
    if (trendCtx) {
        if (salesTrendChartInstance) salesTrendChartInstance.destroy();

        salesTrendChartInstance = new Chart(trendCtx, {
            type: "bar",
            data: {
                labels: datesSorted.length ? datesSorted : ["No Data"],
                datasets: [
                    {
                        label: "Cash Collection (₹)",
                        data: cashData.length ? cashData : [0],
                        backgroundColor: "#f59e0b",
                        borderRadius: 6
                    },
                    {
                        label: "UPI Collection (₹)",
                        data: upiData.length ? upiData : [0],
                        backgroundColor: "#3b82f6",
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => "₹" + value.toLocaleString("en-IN")
                        }
                    }
                }
            }
        });
    }

    // Render Payment Ratio Pie Chart
    const ratioCtx = document.getElementById("salesRatioChart")?.getContext("2d");
    if (ratioCtx) {
        if (salesRatioChartInstance) salesRatioChartInstance.destroy();

        let totalCashAll = salesReports.reduce((sum, e) => sum + (Number(e.cash) || 0), 0);
        let totalUpiAll = salesReports.reduce((sum, e) => sum + (Number(e.upi) || 0), 0);

        salesRatioChartInstance = new Chart(ratioCtx, {
            type: "doughnut",
            data: {
                labels: ["Cash Collection", "UPI Collection"],
                datasets: [
                    {
                        data: totalCashAll || totalUpiAll ? [totalCashAll, totalUpiAll] : [1, 1],
                        backgroundColor: totalCashAll || totalUpiAll ? ["#f59e0b", "#3b82f6"] : ["#cbd5e1", "#e2e8f0"],
                        borderWidth: 2,
                        borderColor: "#ffffff"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" }
                }
            }
        });
    }
}

function populateSalesPersonDropdown() {
    const selectEl = document.getElementById("sales-person");
    if (!selectEl) return;
    const customGroup = document.getElementById("custom-person-group");
    const customInput = document.getElementById("sales-person-custom");
    if (customGroup) customGroup.classList.add("hide");
    if (customInput) {
        customInput.value = "";
        customInput.removeAttribute("required");
    }

    const uniquePersons = [...new Set([...savedPersons, ...salesReports.map(s => s.person)])];
    selectEl.innerHTML = `
        <option value="" disabled selected>Select person or team</option>
        ${uniquePersons.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
        <option value="__NEW__">+ Add New Person / Team...</option>
    `;
}

window.handleSalesPersonChange = function(selectEl) {
    const customGroup = document.getElementById("custom-person-group");
    const customInput = document.getElementById("sales-person-custom");
    if (selectEl.value === "__NEW__") {
        if (customGroup) customGroup.classList.remove("hide");
        if (customInput) customInput.setAttribute("required", "required");
    } else {
        if (customGroup) customGroup.classList.add("hide");
        if (customInput) customInput.removeAttribute("required");
    }
};

window.toggleAddSalesForm = function(forceShow) {
    const card = document.getElementById("inline-sales-form-card");
    const toggleBtnText = document.getElementById("toggle-sales-form-text");
    if (!card) return;

    const isHidden = card.classList.contains("hide");
    const shouldShow = forceShow !== undefined ? forceShow : isHidden;

    if (shouldShow) {
        populateSalesPersonDropdown();
        const dateInput = document.getElementById("sales-date");
        const cashInput = document.getElementById("sales-cash");
        const upiInput = document.getElementById("sales-upi");

        if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
        if (cashInput) cashInput.value = "";
        if (upiInput) upiInput.value = "";
        calcDailyTotalPreview();

        card.classList.remove("hide");
        if (toggleBtnText) toggleBtnText.textContent = "Close Form";
    } else {
        card.classList.add("hide");
        if (toggleBtnText) toggleBtnText.textContent = "+ Add Daily Collection";
    }
};

window.openAddSalesModal = window.toggleAddSalesForm;
window.closeAddSalesModal = function() { window.toggleAddSalesForm(false); };

window.calcDailyTotalPreview = function() {
    const cash = Number(document.getElementById("sales-cash")?.value) || 0;
    const upi = Number(document.getElementById("sales-upi")?.value) || 0;
    const previewEl = document.getElementById("sales-preview-total");
    if (previewEl) previewEl.textContent = formatINR(cash + upi);
};

window.saveSalesEntry = function(event) {
    event.preventDefault();
    const date = document.getElementById("sales-date")?.value;
    const selectPerson = document.getElementById("sales-person")?.value;
    const customPerson = document.getElementById("sales-person-custom")?.value.trim();
    const cash = Number(document.getElementById("sales-cash")?.value) || 0;
    const upi = Number(document.getElementById("sales-upi")?.value) || 0;

    let person = selectPerson;
    if (selectPerson === "__NEW__") {
        if (!customPerson) {
            showToast("Please enter a person name.", true);
            return;
        }
        person = customPerson;
        if (!savedPersons.includes(person)) {
            savedPersons.push(person);
            savePersonsToStorage();
        }
    }

    if (!date || !person) return;

    const newEntry = {
        id: "sale-" + Date.now(),
        date,
        person,
        cash,
        upi
    };

    salesReports.push(newEntry);
    saveSalesReportsToStorage();
    closeAddSalesModal();
    showToast(`Sales collection logged for ${person}.`);
    renderSalesReport();
};

window.deleteSalesEntry = function(id) {
    if (!confirm("Delete this sales entry?")) return;
    salesReports = salesReports.filter(e => e.id !== id);
    saveSalesReportsToStorage();
    showToast("Sales entry deleted.");
    renderSalesReport();
};

window.clearSalesData = function() {
    if (!confirm("Clear all logged sales data?")) return;
    salesReports = [];
    saveSalesReportsToStorage();
    showToast("All sales collection data cleared.");
    renderSalesReport();
};

window.exportSalesReport = function() {
    let csvContent = "data:text/csv;charset=utf-8,Date,Person/Godown,Cash (INR),UPI (INR),Daily Total (INR)\n";
    salesReports.forEach(e => {
        const row = [e.date, e.person, e.cash, e.upi, Number(e.cash) + Number(e.upi)].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `shoeden_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

function toDbOrder(order) {
    // Pack extra fields into notes to avoid DB schema breaking
    let dbNotes = order.notes || "";
    if (order.isInfluencer) dbNotes = `[INFLUENCER] ${dbNotes}`;
    if (order.specificDate) dbNotes = `${dbNotes}\n[TARGET_DATE:${order.specificDate}]`;

    return {
        id: order.id,
        date: order.date,
        agent_name: order.agentName,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        delivery_area: formatDeliveryInfo(order.deliveryArea, order.locationLink),
        godown_location: order.godownLocation,
        whatsapp_group: order.whatsappGroup,
        status: order.status,
        notes: dbNotes,
        items: order.items
    };
}

function fromDbOrder(row) {
    let notes = row.notes || "";
    let isInfluencer = false;
    let specificDate = "";

    if (notes.includes("[INFLUENCER]")) {
        isInfluencer = true;
        notes = notes.replace("[INFLUENCER]", "").trim();
    }

    const dateMatch = notes.match(/\[TARGET_DATE:(.+?)\]/);
    if (dateMatch) {
        specificDate = dateMatch[1];
        notes = notes.replace(dateMatch[0], "").trim();
    }

    const delivery = parseDeliveryInfo(row.delivery_area || "");

    return {
        id: row.id,
        date: row.date,
        agentName: row.agent_name,
        customerName: row.customer_name || "",
        customerPhone: row.customer_phone || "",
        deliveryArea: delivery.area,
        locationLink: delivery.locationLink,
        godownLocation: row.godown_location,
        whatsappGroup: row.whatsapp_group || "",
        status: row.status || "New",
        notes: notes.trim(),
        isInfluencer: isInfluencer,
        specificDate: specificDate,
        items: Array.isArray(row.items) ? row.items : []
    };
}

function formatItems(items) {
    return items.map(item => {
        const product = INVENTORY_CONFIG[item.product];
        const colorHtml = item.color ? `<span class="highlight-color"><i class="fa-solid fa-palette"></i> ${escapeHtml(item.color)}</span>` : "";
        return `<div class="item-ordered"><strong class="highlight-qty">${escapeHtml(String(item.qty))}x</strong> <span class="highlight-product">${escapeHtml(product?.name || item.product)}</span> ${colorHtml}</div>`;
    }).join("");
}

function customerLine(order) {
    const parts = [order.customerName, order.customerPhone, order.deliveryArea, order.locationLink].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Customer details not added";
}

function parseDeliveryInfo(value) {
    const lines = String(value || "").split(/\r?\n/);
    const areaLines = [];
    let locationLink = "";

    lines.forEach(line => {
        const match = line.match(/^\s*Location:\s*(.+)\s*$/i);
        if (match) {
            locationLink = match[1].trim();
        } else if (line.trim()) {
            areaLines.push(line.trim());
        }
    });

    return {
        area: areaLines.join(", "),
        locationLink
    };
}

function formatDeliveryInfo(area, locationLink) {
    const cleanArea = String(area || "").trim();
    const cleanLink = String(locationLink || "").trim();
    return [cleanArea, cleanLink ? `Location: ${cleanLink}` : ""].filter(Boolean).join("\n");
}

function getGodownGroup(godownId) {
    return GODOWNS.find(godown => godown.id === godownId)?.group || "";
}

function createOrderId(godown) {
    const code = godown.slice(0, 3).toUpperCase();
    const date = new Date();
    const ymd = date.toISOString().slice(2, 10).replaceAll("-", "");
    const random = Math.floor(100 + Math.random() * 900);
    return `${code}-${ymd}-${random}`;
}

function formatDate(date) {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return "Date not set";
    return parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function toDateInputValue(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;
}

function jsString(value) {
    return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function showToast(message, isError = false) {
    toast.querySelector(".toast-message").textContent = message;
    toast.classList.toggle("error", isError);
    toast.querySelector("i").className = isError
        ? "fa-solid fa-circle-exclamation"
        : "fa-solid fa-circle-check";
    toast.classList.add("show");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setDefaultOrderDate() {
    const dateInput = document.getElementById("orderDate");
    if (dateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

window.copyStockSql = function() {
    const sql = `-- Create godown_stocks table in Supabase SQL Editor
create table if not exists public.godown_stocks (
  id bigint generated by default as identity primary key,
  godown_location text not null,
  product text not null,
  color text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (godown_location, product, color)
);

alter table public.godown_stocks enable row level security;

drop policy if exists "Logged in users can read stock" on public.godown_stocks;
create policy "Logged in users can read stock" on public.godown_stocks for select to authenticated using (true);

drop policy if exists "Logged in users can create stock" on public.godown_stocks;
create policy "Logged in users can create stock" on public.godown_stocks for insert to authenticated with check (true);

drop policy if exists "Logged in users can update stock" on public.godown_stocks;
create policy "Logged in users can update stock" on public.godown_stocks for update to authenticated using (true) with check (true);

drop policy if exists "Logged in users can delete stock" on public.godown_stocks;
create policy "Logged in users can delete stock" on public.godown_stocks for delete to authenticated using (true);`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sql).then(() => {
            showToast("Stock SQL copied! Paste in Supabase SQL Editor.");
        }).catch(() => {
            showToast("Copied text fallback error", true);
        });
    } else {
        const area = document.createElement("textarea");
        area.value = sql;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        showToast("Stock SQL copied! Paste in Supabase SQL Editor.");
    }
};


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
const SUPABASE_CONFIG = window.SHOEDEN_SUPABASE || {};
const SUPABASE_IS_CONFIGURED = Boolean(
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
        title: "Orders",
        subtitle: "Godown-wise order board with delivered orders separated."
    },
    stock: {
        title: "Stock",
        subtitle: "Manage each godown stock and see dispatched pending delivery."
    },
    catalog: {
        title: "Catalog",
        subtitle: "Products, colors, and shoe pair capacities used by the system."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupControls();
    setupNavigation();
    setupMobileNav();
    setupOrderForm();
    renderCatalog();
    addNewItem();
    setDefaultOrderDate();
    checkLogin();
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
    if (!ensureSupabaseConfigured()) {
        showLogin();
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data.session) throw error || new Error("Not logged in");
        showApp();
        await loadAppData();
    } catch (error) {
        showLogin();
    }
}

function showApp() {
    appShell.classList.remove("auth-hidden");
    loginScreen.classList.add("hide");
}

function showLogin() {
    appShell.classList.add("auth-hidden");
    loginScreen.classList.remove("hide");
    document.getElementById("loginUsername").focus();
}

function ensureSupabaseConfigured() {
    if (SUPABASE_IS_CONFIGURED && supabaseClient) return true;
    showLogin();
    showToast("Add your Supabase URL and anon key in supabase-config.js.", true);
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

    document.getElementById("search-orders").addEventListener("input", renderOrdersTable);
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
        await requireSession();
        const { data, error } = await supabaseClient
            .from("orders")
            .select("*")
            .order("date", { ascending: false });
        if (error) throw error;
        orders = (data || []).map(fromDbOrder);
        updateDashboard();
        renderOrdersTable();
        renderStockTable();
    } catch (error) {
        showToast("Could not load orders from Supabase.", true);
        updateDashboard();
    }
}

async function loadStocks() {
    try {
        await requireSession();
        const { data, error } = await supabaseClient
            .from("godown_stocks")
            .select("*")
            .order("product", { ascending: true })
            .order("color", { ascending: true })
            .order("godown_location", { ascending: true });
        if (error) throw error;
        stocks = data || [];
        renderStockTable();
    } catch (error) {
        showToast("Could not load stock from Supabase.", true);
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
    if (targetId === "stock") renderStockTable();

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
    const orderDate = document.getElementById("orderDate").value;
    const notes = document.getElementById("orderNotes").value.trim();
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
        godownLocation,
        whatsappGroup: godown.group,
        status: "New",
        notes,
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
        orderForm.reset();
        setDefaultOrderDate();
        itemsContainer.innerHTML = "";
        addNewItem();
        updateDashboard();
        renderOrdersTable();
        renderStockTable();
        showToast("Order saved.");
        document.querySelector('[data-target="dashboard"]').click();
    } catch (error) {
        showToast("Order was not saved in Supabase.", true);
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
                    <strong>${godown.label}</strong>
                    <span>${godown.group}</span>
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
                <span>${status}</span>
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
                    <strong>${order.id}</strong>
                    <span>${order.agentName} / ${order.godownLocation}</span>
                </div>
                <div class="recent-meta">
                    <span class="status-pill">${order.status || "New"}</span>
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

    const search = document.getElementById("search-orders").value.toLowerCase();
    let matches = 0;

    board.innerHTML = "";

    const filteredOrders = orders.filter(order => {
        const searchText = [
            order.id,
            order.agentName,
            order.customerName,
            order.customerPhone,
            order.deliveryArea,
            order.godownLocation,
            order.whatsappGroup
        ].join(" ").toLowerCase();
        return searchText.includes(search) &&
            (currentOrdersGodown === "All" || order.godownLocation === currentOrdersGodown);
    });

    GODOWNS.forEach(godown => {
        const godownOrders = filteredOrders.filter(order => order.godownLocation === godown.id);
        if (!godownOrders.length && currentOrdersGodown !== godown.id) return;
        matches += godownOrders.length;

        const statusColumns = [...ACTIVE_STATUSES, "Delivered", "Returned"].map(status => {
            const statusOrders = godownOrders.filter(order => (order.status || "New") === status);
            let extClass = "";
            if (status === "Delivered") extClass = "delivered-column";
            if (status === "Returned") extClass = "returned-column";
            
            return `
                <div class="order-column ${extClass}">
                    <div class="order-column-title">
                        <span>${status}</span>
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
                        <h3>${godown.label}</h3>
                        <span>${godown.group}</span>
                    </div>
                    <strong>${godownOrders.length} orders</strong>
                </div>
                <div class="order-columns">${statusColumns}</div>
            </section>
        `);
    });

    noOrders.classList.toggle("hide", matches > 0);
    board.classList.toggle("hide", matches === 0);
}

function renderOrderCard(order) {
    const status = order.status || "New";
    const dateVal = toDateInputValue(order.date);
    return `
        <article class="order-card">
            <div class="order-card-top">
                <strong>${order.id}</strong>
                <button class="icon-button danger" onclick="deleteOrder('${order.id}')" title="Delete order">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <div class="order-card-date">
                <input type="date" class="order-date-input" value="${dateVal}" onchange="updateOrderDate('${order.id}', this.value)" title="Change order date">
            </div>
            <div class="order-card-line">
                <b>Agent</b>
                <span>${order.agentName}</span>
            </div>
            <div class="order-card-line">
                <b>Customer</b>
                <span>${customerLine(order)}</span>
            </div>
            <div class="items-cell">${formatItems(order.items)}</div>
            <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
                ${STATUSES.map(value => `<option value="${value}" ${value === status ? "selected" : ""}>${value}</option>`).join("")}
            </select>
        </article>
    `;
}

function renderStockTable() {
    const head = document.getElementById("stock-table-head");
    const body = document.getElementById("stock-table-body");
    if (!head || !body) return;

    const stockData = calculateStockMetrics();

    head.innerHTML = `
        <tr>
            <th>Product</th>
            ${GODOWNS.map(godown => `<th>${godown.label}</th>`).join("")}
            <th>Total Available</th>
        </tr>
    `;

    body.innerHTML = STOCK_VARIANTS.map(variant => {
        let totalAvailable = 0;
        const godownCells = GODOWNS.map(godown => {
            const stockQty = getStockQty(godown.id, variant.product, variant.color);
            const key = stockKeyForGodown(godown.id, variant.product, variant.color);
            const holdQty = stockData.holds.get(key) || 0;
            const delivQty = stockData.delivered.get(key) || 0;
            const available = stockQty - holdQty - delivQty;
            totalAvailable += available;
            const availableClass = available < 0 ? "negative" : available <= 3 ? "low" : "";

            return `
                <td>
                    <div class="stock-cell">
                        <input
                            type="number"
                            min="0"
                            value="${stockQty}"
                            onchange="updateStockQuantity('${jsString(godown.id)}', '${jsString(variant.product)}', '${jsString(variant.color)}', this.value)"
                            aria-label="${variant.label} ${variant.color || "stock"} ${godown.label}"
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
                    <strong>${variant.label}</strong>
                    <span>Total count / ${variant.category}</span>
                </td>
                ${godownCells}
                <td><strong class="${totalAvailable < 0 ? "negative" : totalAvailable <= 10 ? "low" : ""}">${totalAvailable}</strong></td>
            </tr>
        `;
    }).join("");
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
    const quantity = Math.max(0, Number.parseInt(value, 10) || 0);
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
        showToast("Stock was not saved in Supabase.", true);
    }
};

window.updateOrderStatus = async function(orderId, status) {
    const order = orders.find(entry => entry.id === orderId);
    if (!order) return;
    const previousStatus = order.status || "New";
    order.status = status;
    updateDashboard();

    try {
        await requireSession();
        const { error } = await supabaseClient
            .from("orders")
            .update({ status })
            .eq("id", orderId);
        if (error) throw error;
        showToast("Status updated.");
        renderOrdersTable();
        renderStockTable();
    } catch (error) {
        order.status = previousStatus;
        renderOrdersTable();
        updateDashboard();
        showToast("Status was not saved in Supabase.", true);
    }
};

window.updateOrderDate = async function(orderId, newDateValue) {
    const order = orders.find(entry => entry.id === orderId);
    if (!order || !newDateValue) return;
    const previousDate = order.date;
    order.date = new Date(newDateValue).toISOString();
    updateDashboard();

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
        renderOrdersTable();
        updateDashboard();
        showToast("Date was not saved in Supabase.", true);
    }
};

window.deleteOrder = async function(orderId) {
    if (!confirm("Delete this order?")) return;
    const previousOrders = [...orders];
    orders = orders.filter(order => order.id !== orderId);
    renderOrdersTable();
    updateDashboard();

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
        renderOrdersTable();
        updateDashboard();
        showToast("Delete was not saved in Supabase.", true);
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
    renderStockTable();
    showLogin();
    showToast("Logged out.");
};

window.exportData = function() {
    const headerCols = [
        "Order ID", "Date", "Status", "Godown", "WhatsApp Group", "Agent",
        "Customer", "Phone", "Delivery Area", "Product", "Color", "Quantity", "Notes"
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

function renderCatalog() {
    const container = document.getElementById("catalog-grid");
    container.innerHTML = "";
    Object.entries(INVENTORY_CONFIG).forEach(([key, product]) => {
        container.insertAdjacentHTML("beforeend", `
            <article class="catalog-card">
                <span>${product.category}</span>
                <h3>${product.name}</h3>
                <p>${product.capacityPairs ? `${product.capacityPairs} pairs capacity` : "Foldable furniture item"}</p>
                <div class="color-list">
                    ${product.colors.length ? product.colors.map(color => `<b>${color}</b>`).join("") : "<b>No color selection</b>"}
                </div>
            </article>
        `);
    });
}

function fromDbOrder(row) {
    return {
        id: row.id,
        date: row.date,
        agentName: row.agent_name,
        customerName: row.customer_name || "",
        customerPhone: row.customer_phone || "",
        deliveryArea: row.delivery_area || "",
        godownLocation: row.godown_location,
        whatsappGroup: row.whatsapp_group || "",
        status: row.status || "New",
        notes: row.notes || "",
        items: Array.isArray(row.items) ? row.items : []
    };
}

function toDbOrder(order) {
    return {
        id: order.id,
        date: order.date,
        agent_name: order.agentName,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        delivery_area: order.deliveryArea,
        godown_location: order.godownLocation,
        whatsapp_group: order.whatsappGroup,
        status: order.status,
        notes: order.notes,
        items: order.items
    };
}

function formatItems(items) {
    return items.map(item => {
        const product = INVENTORY_CONFIG[item.product];
        const color = item.color ? `, ${item.color}` : "";
        return `<div><strong>${item.qty}x</strong> ${product?.name || item.product}${color}</div>`;
    }).join("");
}

function customerLine(order) {
    const parts = [order.customerName, order.customerPhone, order.deliveryArea].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Customer details not added";
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
    return new Date(date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
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

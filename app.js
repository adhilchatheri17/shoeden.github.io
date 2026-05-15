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
    { id: "Chennai", label: "1st Chennai", group: "ShoeDen Chennai Group" },
    { id: "Erode", label: "2nd Erode", group: "ShoeDen Erode Group" },
    { id: "Kallakurichi", label: "3rd Kallakurichi", group: "ShoeDen Kallakurichi Group" },
    { id: "Madurai", label: "4th Madurai", group: "ShoeDen Madurai Group" },
    { id: "Kanyakumari", label: "5th Kanyakumari", group: "ShoeDen Kanyakumari Group" }
];

const STATUSES = ["New", "Packed", "Dispatched", "Delivered"];
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
        subtitle: "Search, filter, export, update status, and delete orders."
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
    setupOrderForm();
    renderCatalog();
    addNewItem();
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
            await loadOrders();
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
        await loadOrders();
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
    const filterGodown = document.getElementById("filter-godown");
    const filterStatus = document.getElementById("filter-status");

    godownSelect.innerHTML = '<option value="" disabled selected>Select godown group</option>';
    filterGodown.innerHTML = '<option value="All">All Godowns</option>';

    GODOWNS.forEach(godown => {
        godownSelect.insertAdjacentHTML(
            "beforeend",
            `<option value="${godown.id}">${godown.label} - ${godown.group}</option>`
        );
        filterGodown.insertAdjacentHTML("beforeend", `<option value="${godown.id}">${godown.label}</option>`);
    });

    filterStatus.innerHTML = '<option value="All">All Status</option>';
    STATUSES.forEach(status => {
        filterStatus.insertAdjacentHTML("beforeend", `<option value="${status}">${status}</option>`);
    });

    document.getElementById("search-orders").addEventListener("input", renderOrdersTable);
    filterGodown.addEventListener("change", renderOrdersTable);
    filterStatus.addEventListener("change", renderOrdersTable);
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
    } catch (error) {
        showToast("Could not load orders from Supabase.", true);
        updateDashboard();
    }
}

function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            const targetId = item.dataset.target;
            views.forEach(view => {
                view.classList.toggle("active", view.id === targetId);
                view.classList.toggle("hide", view.id !== targetId);
            });

            pageTitle.textContent = navConfig[targetId].title;
            pageSubtitle.textContent = navConfig[targetId].subtitle;

            if (targetId === "dashboard") updateDashboard();
            if (targetId === "orders-list") renderOrdersTable();
        });
    });
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
    const notes = document.getElementById("orderNotes").value.trim();
    const items = collectItems();

    if (!godownLocation || !agentName || !items.length) {
        showToast("Fill godown, agent, product, color, and quantity.", true);
        return;
    }

    const newOrder = {
        id: createOrderId(godownLocation),
        date: new Date().toISOString(),
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
        itemsContainer.innerHTML = "";
        addNewItem();
        updateDashboard();
        renderOrdersTable();
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
        if (status !== "Delivered") pending++;
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
    const tbody = document.getElementById("orders-table-body");
    const noOrders = document.getElementById("no-orders-message");
    const table = document.querySelector(".data-table");
    const search = document.getElementById("search-orders").value.toLowerCase();
    const godownFilter = document.getElementById("filter-godown").value;
    const statusFilter = document.getElementById("filter-status").value;
    let matches = 0;

    tbody.innerHTML = "";

    orders.forEach(order => {
        const searchText = [
            order.id,
            order.agentName,
            order.customerName,
            order.customerPhone,
            order.deliveryArea,
            order.godownLocation,
            order.whatsappGroup
        ].join(" ").toLowerCase();
        const status = order.status || "New";
        const matchesSearch = searchText.includes(search);
        const matchesGodown = godownFilter === "All" || order.godownLocation === godownFilter;
        const matchesStatus = statusFilter === "All" || status === statusFilter;

        if (!matchesSearch || !matchesGodown || !matchesStatus) return;
        matches++;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <strong>${order.id}</strong>
                <span>${formatDate(order.date)}</span>
            </td>
            <td>
                <strong>${order.godownLocation}</strong>
                <span>${order.whatsappGroup || getGodownGroup(order.godownLocation)}</span>
            </td>
            <td>
                <strong>${order.agentName}</strong>
                <span>${customerLine(order)}</span>
            </td>
            <td class="items-cell">${formatItems(order.items)}</td>
            <td>
                <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
                    ${STATUSES.map(value => `<option value="${value}" ${value === status ? "selected" : ""}>${value}</option>`).join("")}
                </select>
            </td>
            <td class="actions-cell">
                <button class="icon-button danger" onclick="deleteOrder('${order.id}')" title="Delete order">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    noOrders.classList.toggle("hide", matches > 0);
    table.classList.toggle("hide", matches === 0);
}

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
    } catch (error) {
        order.status = previousStatus;
        renderOrdersTable();
        updateDashboard();
        showToast("Status was not saved in Supabase.", true);
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
    updateDashboard();
    renderOrdersTable();
    showLogin();
    showToast("Logged out.");
};

window.exportData = function() {
    const header = [
        "Order ID", "Date", "Status", "Godown", "WhatsApp Group", "Agent",
        "Customer", "Phone", "Delivery Area", "Product", "Color", "Quantity", "Notes"
    ];
    const rows = [header];

    orders.forEach(order => {
        order.items.forEach(item => {
            rows.push([
                order.id,
                new Date(order.date).toLocaleString(),
                order.status || "New",
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
            ]);
        });
    });

    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `shoeden_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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

function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { adminApi } from "../api/client.js";
import AdminSanityAccountUpload from "../components/AdminSanityAccountUpload.jsx";
import { formatNaira } from "../data/marketData.js";

const emptyProduct = {
  categoryId: "",
  title: "",
  description: "",
  price: "",
  platform: "",
  deliveryTime: "48h",
  deliveryType: "MANUAL_SERVICE",
  deliveryInstructions: "",
  status: "ACTIVE",
  isActive: true,
};

export default function AdminPage({ user, categories, onCatalogRefresh }) {
  const [deposits, setDeposits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [productImage, setProductImage] = useState(null);
  const [productDeliveryFiles, setProductDeliveryFiles] = useState([]);
  const [productDeliveryText, setProductDeliveryText] = useState("");
  const [productDeliveryTextFormat, setProductDeliveryTextFormat] = useState("txt");
  const [productFileUploads, setProductFileUploads] = useState({});
  const [productWrittenFiles, setProductWrittenFiles] = useState({});
  const [productPriceEdits, setProductPriceEdits] = useState({});
  const [deliveryFiles, setDeliveryFiles] = useState({});
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const selectedCategory = categories.find((category) => category.id === productForm.categoryId);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [brandingFiles, setBrandingFiles] = useState({ logo: null, favicon: null });
  const [auditLogs, setAuditLogs] = useState([]);

  const loadAdminData = async () => {
    const [depositData, orderData, productData, analyticsData, settingsData, customerData, auditData] = await Promise.all([
      adminApi.deposits(),
      adminApi.orders(),
      adminApi.products(),
      adminApi.analytics(),
      adminApi.settings(),
      adminApi.users(),
      adminApi.auditLogs(),
    ]);
    setDeposits(depositData.deposits);
    setOrders(orderData.orders);
    setProducts(productData.products);
    setAnalytics(analyticsData);
    setSettings(settingsData.settings);
    setConfiguration(settingsData.configuration);
    setCustomers(customerData.users || []);
    setAuditLogs(auditData.logs);
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    loadAdminData().catch((error) => setMessage(error.message));
  }, [user]);

  if (!user) {
    return <Gate message="Login with an admin account to continue." />;
  }

  if (user.role !== "ADMIN") {
    return <Gate message="Admin access is required." />;
  }

  const pendingDeposits = deposits.filter((deposit) => deposit.status === "PENDING");

  const handleDeposit = async (id, action) => {
    setMessage("");
    try {
      if (action === "approve") await adminApi.approveDeposit(id);
      else await adminApi.rejectDeposit(id);
      await loadAdminData();
      setMessage(`Deposit ${action}d.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const payload = new FormData();
      Object.entries({
        ...productForm,
        platform: selectedCategory?.name || productForm.platform,
        price: Number(productForm.price),
      }).forEach(([key, value]) => payload.append(key, value));
      if (productImage) payload.append("image", productImage);
      productDeliveryFiles.forEach((file) => payload.append("deliveryFiles", file));
      if (productDeliveryText.trim()) {
        payload.append("deliveryText", productDeliveryText);
        payload.append("deliveryTextFormat", productDeliveryTextFormat);
      }
      if (editingId) {
        await adminApi.updateProduct(editingId, payload);
        setMessage("Product updated.");
      } else {
        await adminApi.createProduct(payload);
        setMessage("Product created.");
      }
      setProductForm(emptyProduct);
      setProductImage(null);
      setProductDeliveryFiles([]);
      setProductDeliveryText("");
      setProductDeliveryTextFormat("txt");
      setEditingId("");
      await loadAdminData();
      await onCatalogRefresh();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const uploadProductFiles = async (productId) => {
    const files = productFileUploads[productId] || [];
    const written = productWrittenFiles[productId] || { text: "", format: "txt" };
    if (!files.length && !written.text.trim()) {
      setMessage("Choose files or write delivery text first.");
      return;
    }
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (written.text.trim()) {
      form.append("deliveryText", written.text);
    form.append("deliveryTextFormat", written.format || "txt");
    }
    try {
      const data = await adminApi.uploadProductFiles(productId, form);
      const addedCount = files.length + (written.text.trim() ? 1 : 0);
      setProductFileUploads((current) => ({ ...current, [productId]: [] }));
      setProductWrittenFiles((current) => ({ ...current, [productId]: { text: "", format: "txt" } }));
      await loadAdminData();
      await onCatalogRefresh();
      setMessage(`${addedCount} delivery file${addedCount === 1 ? "" : "s"} added. Stock is now ${data.product.stock} pcs.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateProductPrice = async (product) => {
    const nextPrice = Number(productPriceEdits[product.id] ?? product.price);
    if (!nextPrice || nextPrice < 1) {
      setMessage("Enter a valid product price.");
      return;
    }
    const payload = new FormData();
    payload.append("price", nextPrice);
    try {
      await adminApi.updateProduct(product.id, payload);
      setProductPriceEdits((current) => ({ ...current, [product.id]: "" }));
      await loadAdminData();
      await onCatalogRefresh();
      setMessage("Product price updated.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setProductForm({
      categoryId: product.categoryId,
      title: product.title,
      description: product.description,
      price: product.price,
      platform: product.platform,
      deliveryTime: product.deliveryTime,
      deliveryType: product.deliveryType || "SERVICE",
      deliveryInstructions: product.deliveryInstructions || "",
      status: product.status || (product.isActive ? "ACTIVE" : "DISABLED"),
      isActive: product.isActive,
    });
  };

  const disableProduct = async (id) => {
    setMessage("");
    try {
      await adminApi.deleteProduct(id);
      await loadAdminData();
      await onCatalogRefresh();
      setMessage("Product disabled.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const enableProduct = async (id) => {
    setMessage("");
    try {
      await adminApi.enableProduct(id);
      await loadAdminData();
      await onCatalogRefresh();
      setMessage("Product enabled.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateOrderStatus = async (id, status) => {
    setMessage("");
    try {
      await adminApi.updateOrderStatus(id, status);
      await loadAdminData();
      setMessage("Order status updated.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const uploadDelivery = async (id) => {
    const file = deliveryFiles[id];
    if (!file) {
      setMessage("Choose a delivery file first.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    try {
      await adminApi.uploadDelivery(id, form);
      setDeliveryFiles((files) => ({ ...files, [id]: null }));
      await loadAdminData();
      setMessage("Delivery uploaded and order completed.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const saveSettings = async () => {
    try {
      const data = await adminApi.updateSettings(settings);
      setSettings(data.settings);
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const uploadBranding = async () => {
    if (!brandingFiles.logo && !brandingFiles.favicon) {
      setMessage("Choose a logo or favicon first.");
      return;
    }
    try {
      const form = new FormData();
      if (brandingFiles.logo) form.append("logo", brandingFiles.logo);
      if (brandingFiles.favicon) form.append("favicon", brandingFiles.favicon);
      const data = await adminApi.uploadBranding(form);
      setSettings(data.settings);
      setBrandingFiles({ logo: null, favicon: null });
      setMessage("Brand assets updated.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Operations</p>
        <h1 className="text-2xl font-black text-market-navy">Admin Dashboard</h1>
      </div>
      {message && (
        <div className="glass-panel rounded-2xl px-3 py-3 text-sm font-semibold text-gray-700">
          {message}
        </div>
      )}

      <section className="rounded-[1.6rem] bg-market-navy p-4 text-white shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Dashboard overview</p>
            <h2 className="mt-1 text-lg font-black">Store performance</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat label="Revenue" value={formatNaira(analytics?.totalRevenue || 0)} dark />
          <Stat label="Orders" value={analytics?.totalOrders || 0} dark />
          <Stat label="Available stock" value={products.reduce((total, product) => total + Number(product.stock || 0), 0)} dark />
          <Stat label="Low stock" value={products.filter((product) => Number(product.stock || 0) <= 3).length} dark />
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Orders</p>
            <h2 className="text-lg font-black text-market-navy">Latest orders</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-market-emerald">{orders.length} total</span>
        </div>
        <div className="space-y-2">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-market-navy">{order.user?.email}</p>
                <p className="text-xs text-slate-500">{order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-market-navy">{formatNaira(order.totalAmount)}</p>
                <p className="text-[11px] font-bold text-market-emerald">{order.status}</p>
              </div>
            </div>
          ))}
          {!orders.length && <EmptyPanel message="No orders have been placed yet." />}
        </div>
      </section>

      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">
          {editingId ? "Edit Product" : "Create Product"}
        </div>
        <form onSubmit={saveProduct} className="glass-panel space-y-2 rounded-[1.35rem] p-3">
          <select
            value={productForm.categoryId}
            onChange={(event) => {
              const category = categories.find((item) => item.id === event.target.value);
              setProductForm((form) => ({
                ...form,
                categoryId: event.target.value,
                platform: category?.name || form.platform,
              }));
            }}
            className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            required
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            value={productForm.title}
            onChange={(event) => setProductForm((form) => ({ ...form, title: event.target.value }))}
            className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            placeholder="Product title"
            required
          />
          <textarea
            value={productForm.description}
            onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))}
            className="min-h-20 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm"
            placeholder="Service/package description"
            required
          />
          <div className="grid gap-2">
            <input
              type="number"
              value={productForm.price}
              onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
              placeholder="Price"
              required
            />
          </div>
          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Available stock is calculated automatically from the individual delivery files added below.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={productForm.deliveryType}
              onChange={(event) => setProductForm((form) => ({ ...form, deliveryType: event.target.value }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            >
              <option value="INSTANT_DOWNLOAD">Instant Download</option>
              <option value="MANUAL_SERVICE">Manual Service</option>
            </select>
            <select
              value={productForm.status}
              onChange={(event) => setProductForm((form) => ({ ...form, status: event.target.value, isActive: event.target.value === "ACTIVE" }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
          <label className="grid gap-1 text-xs font-bold text-gray-600">
            Optional product image
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(event) => setProductImage(event.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-gray-600">
            Optional delivery files
            <input
              type="file"
              multiple
              accept=".zip,.pdf,.txt,.jpg,.jpeg,.png"
              onChange={(event) => setProductDeliveryFiles(Array.from(event.target.files || []))}
              className="w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm font-normal"
            />
          </label>
          {productDeliveryFiles.length > 0 && (
            <p className="text-xs font-semibold text-gray-600">
              Delivery files: {productDeliveryFiles.map((file) => file.name).join(", ")}
            </p>
          )}
          <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-white/70 p-2">
            <textarea
              value={productDeliveryText}
              onChange={(event) => setProductDeliveryText(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm"
              placeholder="Write delivery content here and convert it to a downloadable file"
            />
            <select
              value={productDeliveryTextFormat}
              onChange={(event) => setProductDeliveryTextFormat(event.target.value)}
              className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold"
            >
              <option value="txt">Save written content as TXT</option>
              <option value="pdf">Save written content as PDF</option>
            </select>
          </div>
          <textarea
            value={productForm.deliveryInstructions}
            onChange={(event) => setProductForm((form) => ({ ...form, deliveryInstructions: event.target.value }))}
            className="min-h-16 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm"
            placeholder="Manual service instructions or onboarding notes"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex h-11 items-center rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm font-bold text-gray-700">
              {selectedCategory?.name || productForm.platform || "Platform"}
            </div>
            <input
              value={productForm.deliveryTime}
              onChange={(event) => setProductForm((form) => ({ ...form, deliveryTime: event.target.value }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
              placeholder="Delivery"
              required
            />
          </div>
          <button type="submit" className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">
            {editingId ? "Save Product" : "Create Product"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId("");
                setProductForm(emptyProduct);
                setProductDeliveryFiles([]);
                setProductDeliveryText("");
                setProductDeliveryTextFormat("txt");
              }}
              className="h-10 w-full rounded-full bg-gray-100 text-sm font-bold text-gray-800"
            >
              Cancel Edit
            </button>
          )}
        </form>
      </section>

      <AdminSanityAccountUpload user={user} categories={categories} />

      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Products</div>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="glass-panel rounded-2xl px-3 py-3">
              <p className="text-sm font-bold text-gray-900">{product.title}</p>
              <p className="text-xs text-gray-500">
                {product.platform} - {formatNaira(product.price)} - {product.stock} pcs.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Inventory records: {product.deliveryFiles?.length ? product.deliveryFiles.map((file) => `${file.fileName} (${file.status})`).join(", ") : "None"}
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min="1"
                  value={productPriceEdits[product.id] ?? product.price}
                  onChange={(event) => setProductPriceEdits((current) => ({ ...current, [product.id]: event.target.value }))}
                  className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold"
                  placeholder="Price"
                />
                <button
                  type="button"
                  onClick={() => updateProductPrice(product)}
                  className="h-10 rounded-full bg-emerald-50 px-3 text-xs font-black text-market-emerald"
                >
                  Save Price
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => editProduct(product)}
                  className="h-9 rounded-full bg-emerald-50 px-3 text-xs font-bold text-market-emerald"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => disableProduct(product.id)}
                  className="h-9 rounded-full bg-slate-100 px-3 text-xs font-bold text-gray-800"
                >
                  Disable
                </button>
                {!product.isActive && (
                  <button
                    type="button"
                    onClick={() => enableProduct(product.id)}
                    className="h-9 rounded-full bg-emerald-50 px-3 text-xs font-bold text-market-emerald"
                  >
                    Enable
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="file"
                  multiple
                  accept=".zip,.pdf,.txt,.jpg,.jpeg,.png"
                  onChange={(event) => setProductFileUploads((current) => ({ ...current, [product.id]: Array.from(event.target.files || []) }))}
                  className="rounded-2xl border border-emerald-100 bg-white/85 px-2 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => uploadProductFiles(product.id)}
                  className="h-10 rounded-full bg-cyan-50 px-3 text-xs font-black text-market-cyan"
                >
                  Add Files
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                <textarea
                  value={productWrittenFiles[product.id]?.text || ""}
                  onChange={(event) =>
                    setProductWrittenFiles((current) => ({
                      ...current,
                      [product.id]: { ...(current[product.id] || { format: "txt" }), text: event.target.value },
                    }))
                  }
                  className="min-h-20 rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-xs"
                  placeholder="Write extra delivery content and convert it to TXT or PDF"
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    value={productWrittenFiles[product.id]?.format || "txt"}
                    onChange={(event) =>
                      setProductWrittenFiles((current) => ({
                        ...current,
                        [product.id]: { ...(current[product.id] || { text: "" }), format: event.target.value },
                      }))
                    }
                    className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold"
                  >
                    <option value="txt">TXT</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => uploadProductFiles(product.id)}
                    className="h-10 rounded-full bg-emerald-50 px-3 text-xs font-black text-market-emerald"
                  >
                    Add Written File
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Customers</p>
            <h2 className="text-lg font-black text-market-navy">Recent customers</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{customers.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {customers.filter((customer) => customer.role !== "ADMIN").slice(0, 6).map((customer) => (
            <div key={customer.id} className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-3">
              <p className="truncate text-sm font-black text-market-navy">{customer.email}</p>
              <p className="mt-1 text-xs text-slate-500">Joined {new Date(customer.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          {!customers.filter((customer) => customer.role !== "ADMIN").length && <EmptyPanel message="No customers yet." />}
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Payments</p>
            <h2 className="text-lg font-black text-market-navy">Recent payments</h2>
          </div>
          {pendingDeposits.length > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{pendingDeposits.length} pending</span>}
        </div>
        <div className="space-y-2">
          {deposits.slice(0, 6).map((deposit) => (
            <div key={deposit.id} className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-market-navy">{deposit.user?.email}</p>
                  <p className="text-xs text-slate-500">{deposit.reference}</p>
                  {deposit.proofFileUrl && (
                    <a href={adminApi.proofUrl(deposit.id)} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-black text-market-cyan underline">View proof</a>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-market-navy">{formatNaira(deposit.amount)}</p>
                  <p className="text-[11px] font-bold text-market-emerald">{deposit.status}</p>
                </div>
              </div>
              {deposit.status === "PENDING" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleDeposit(deposit.id, "approve")} className="brand-gradient h-9 rounded-full text-xs font-black text-white">Approve</button>
                  <button type="button" onClick={() => handleDeposit(deposit.id, "reject")} className="h-9 rounded-full bg-slate-100 text-xs font-black text-slate-700">Reject</button>
                </div>
              )}
            </div>
          ))}
          {!deposits.length && <EmptyPanel message="No payments have been received yet." />}
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Activity</p>
        <h2 className="mb-3 text-lg font-black text-market-navy">Recent activity</h2>
        <div className="space-y-2">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2.5 text-xs">
              <span className="font-bold text-slate-700">{log.action.replaceAll("_", " ")}</span>
              <span className="text-slate-400">{log.entityType}</span>
            </div>
          ))}
          {!auditLogs.length && <EmptyPanel message="No activity recorded yet." />}
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Configuration</p>
        <h2 className="mb-4 text-lg font-black text-market-navy">Store settings</h2>
        {settings && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingInput label="Store name" value={settings.siteName} onChange={(value) => setSettings((current) => ({ ...current, siteName: value }))} />
              <SettingInput label="Support email" type="email" value={settings.supportEmail} onChange={(value) => setSettings((current) => ({ ...current, supportEmail: value }))} />
              <SettingInput label="Currency" value={settings.currency || "NGN"} onChange={(value) => setSettings((current) => ({ ...current, currency: value.toUpperCase() }))} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-black text-market-navy">Brand assets</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <BrandUpload label="Logo" accept=".jpg,.jpeg,.png" configured={Boolean(settings.logoUrl)} onChange={(file) => setBrandingFiles((current) => ({ ...current, logo: file }))} />
                <BrandUpload label="Favicon" accept=".ico,.png" configured={Boolean(settings.faviconUrl)} onChange={(file) => setBrandingFiles((current) => ({ ...current, favicon: file }))} />
              </div>
              <button type="button" onClick={uploadBranding} className="mt-2 h-10 w-full rounded-full bg-slate-100 text-xs font-black text-slate-700">Upload brand assets</button>
            </div>
            <SettingsGroup title="Payment settings">
              <SettingToggle label="Paystack" checked={settings.paystackEnabled} onChange={(checked) => setSettings((current) => ({ ...current, paystackEnabled: checked }))} status={configuration?.paystackConfigured} />
              <SettingToggle label="Flutterwave" checked={settings.flutterwaveEnabled} onChange={(checked) => setSettings((current) => ({ ...current, flutterwaveEnabled: checked }))} status={configuration?.flutterwaveConfigured} />
              <SettingToggle label="Manual bank transfer" checked={settings.manualBankTransferEnabled} onChange={(checked) => setSettings((current) => ({ ...current, manualBankTransferEnabled: checked }))} />
              <SettingToggle label="Automatic delivery" checked={settings.automaticDeliveryEnabled} onChange={(checked) => setSettings((current) => ({ ...current, automaticDeliveryEnabled: checked }))} />
            </SettingsGroup>
            <SettingsGroup title="Security and email">
              <ConfigStatus label="JWT secret" configured={configuration?.jwtConfigured} />
              <ConfigStatus label={`Email provider: ${configuration?.emailProvider || "not configured"}`} configured={configuration?.emailProvider && configuration.emailProvider !== "not configured"} />
              <ConfigStatus label="Resend" configured={configuration?.resendConfigured} />
            </SettingsGroup>
            <button type="button" onClick={saveSettings} className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow">Save settings</button>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Order management</div>
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="glass-panel rounded-2xl px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{order.user?.email}</p>
                  <p className="text-xs text-gray-500">{order.id}</p>
                  <p className="text-xs text-gray-500">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {order.items?.map((item) => `${item.quantity}x ${item.product.title}`).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900">{formatNaira(order.totalAmount)}</p>
                  <p className="text-xs font-bold text-market-emerald">{order.status}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  value={order.status}
                  onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                  className="h-10 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs font-bold"
                >
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <input
                  type="file"
                  accept=".zip,.pdf,.txt,.jpg,.jpeg,.png"
                  onChange={(event) => setDeliveryFiles((files) => ({ ...files, [order.id]: event.target.files?.[0] || null }))}
                  className="rounded-2xl border border-emerald-100 bg-white/85 px-2 py-2 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => uploadDelivery(order.id)}
                className="brand-gradient mt-2 h-9 w-full rounded-full text-xs font-black text-white"
              >
                Upload Delivery
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-[1.6rem] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-market-emerald">Insights</p>
        <h2 className="mb-3 text-lg font-black text-market-navy">Analytics</h2>
        {analytics && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
              <Stat label="Customers" value={analytics.totalUsers} />
              <Stat label="Products" value={analytics.totalProducts} />
              <Stat label="Completed orders" value={analytics.completedOrders} />
              <Stat label="Revenue" value={formatNaira(analytics.totalRevenue)} />
            </div>
            {(analytics.bestSellingProducts || []).length > 0 ? (
              <div className="mt-4 h-48 rounded-2xl bg-white/70 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.bestSellingProducts}>
                    <XAxis dataKey="platform" hide />
                    <YAxis hide />
                    <Bar dataKey="orderCount" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyPanel message="No sales data yet." />}
          </>
        )}
      </section>
    </div>
  );
}

function Gate({ message }) {
  return (
    <div>
      <div className="mb-3 px-1 text-xl font-black text-market-navy">Admin Dashboard</div>
      <section className="glass-panel rounded-[1.35rem] p-4">
        <p className="text-sm text-gray-600">{message}</p>
        <Link className="brand-gradient mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-black text-white shadow-glow" to="/login">
          Login
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, dark = false }) {
  return (
    <div className={dark ? "rounded-2xl bg-white/10 p-3" : "rounded-2xl bg-white/80 p-3"}>
      <p className={dark ? "text-[11px] font-bold uppercase text-emerald-100" : "text-[11px] font-bold uppercase text-gray-500"}>{label}</p>
      <p className={dark ? "text-base font-black text-white" : "text-base font-black text-market-navy"}>{value}</p>
    </div>
  );
}

function EmptyPanel({ message }) {
  return <div className="rounded-2xl bg-white/75 px-3 py-4 text-sm font-semibold text-slate-500">{message}</div>;
}

function SettingInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-1.5 text-xs font-black text-slate-600">
      {label}
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300" />
    </label>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-black text-market-navy">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SettingToggle({ label, checked, onChange, status }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3 text-sm font-bold text-slate-700">
      <span>{label}{status !== undefined && <small className={`ml-2 ${status ? "text-emerald-600" : "text-amber-600"}`}>{status ? "Configured" : "Key missing"}</small>}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-emerald-500" />
    </label>
  );
}

function ConfigStatus({ label, configured }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 px-3 py-3 text-sm font-bold text-slate-700">
      <span>{label}</span>
      <span className={configured ? "text-emerald-600" : "text-amber-600"}>{configured ? "Configured" : "Needs setup"}</span>
    </div>
  );
}

function BrandUpload({ label, accept, configured, onChange }) {
  return (
    <label className="grid gap-1.5 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3 text-xs font-black text-slate-600">
      <span>{label} <small className={configured ? "text-emerald-600" : "text-slate-400"}>{configured ? "Uploaded" : "Not uploaded"}</small></span>
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} className="text-xs font-normal" />
    </label>
  );
}

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
  stock: "",
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
  const [sellers, setSellers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadAdminData = async () => {
    const [depositData, orderData, productData, analyticsData, settingsData, sellerData, withdrawalData, auditData] = await Promise.all([
      adminApi.deposits(),
      adminApi.orders(),
      adminApi.products(),
      adminApi.analytics(),
      adminApi.settings(),
      adminApi.sellers(),
      adminApi.withdrawals(),
      adminApi.auditLogs(),
    ]);
    setDeposits(depositData.deposits);
    setOrders(orderData.orders);
    setProducts(productData.products);
    setAnalytics(analyticsData);
    setSettings(settingsData.settings);
    setSellers(sellerData.sellers);
    setWithdrawals(withdrawalData.withdrawals);
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
        stock: Number(productForm.stock),
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
      stock: product.stock,
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

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-2 text-base font-black text-market-navy">Analytics</div>
        {analytics && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Users" value={analytics.totalUsers} />
              <Stat label="Sellers" value={analytics.totalSellers} />
              <Stat label="Orders" value={analytics.totalOrders} />
              <Stat label="Revenue" value={formatNaira(analytics.totalRevenue)} />
            </div>
            {(analytics.bestSellingProducts || []).length > 0 ? (
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.bestSellingProducts}>
                    <XAxis dataKey="platform" hide />
                    <YAxis hide />
                    <Bar dataKey="orderCount" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/75 px-3 py-4 text-sm font-semibold text-slate-500">
                No sales data yet.
              </div>
            )}
          </>
        )}
      </section>

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-2 text-base font-black text-market-navy">Settings</div>
        {settings && (
          <div className="space-y-2">
            {["siteName", "supportEmail", "bankName", "bankAccountName", "bankAccountNumber", "minimumWithdrawalAmount"].map((key) => (
              <input key={key} value={settings[key] ?? ""} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} className="h-10 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-xs" placeholder={key} />
            ))}
            <button type="button" onClick={saveSettings} className="brand-gradient h-10 w-full rounded-full text-xs font-black text-white">Save settings</button>
          </div>
        )}
      </section>

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-2 text-base font-black text-market-navy">Sellers & Withdrawals</div>
        {sellers.slice(0, 4).map((seller) => (
          <div key={seller.id} className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold">{seller.email} ({seller.sellerStatus})</span>
            <button type="button" onClick={() => adminApi.updateSellerStatus(seller.id, "APPROVED").then(loadAdminData)} className="rounded-full bg-emerald-50 px-2 py-1 font-black text-market-emerald">Approve</button>
          </div>
        ))}
        {withdrawals.slice(0, 4).map((item) => (
          <div key={item.id} className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span>{item.user?.email} - {formatNaira(item.amount)} - {item.status}</span>
            <button type="button" onClick={() => adminApi.updateWithdrawal(item.id, "approve").then(loadAdminData)} className="rounded-full bg-emerald-50 px-2 py-1 font-black text-market-emerald">Approve</button>
          </div>
        ))}
      </section>

      <section className="glass-panel rounded-[1.35rem] p-3">
        <div className="mb-2 text-base font-black text-market-navy">Audit Logs</div>
        {auditLogs.slice(0, 6).map((log) => (
          <p key={log.id} className="mb-1 text-xs text-gray-600">{log.action} - {log.entityType}</p>
        ))}
      </section>

      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Pending Deposits</div>
        <div className="space-y-2">
          {pendingDeposits.length === 0 && (
            <div className="glass-panel rounded-2xl px-3 py-3 text-sm text-gray-600">
              No pending deposits.
            </div>
          )}
          {pendingDeposits.map((deposit) => (
            <div key={deposit.id} className="glass-panel rounded-2xl px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{deposit.user?.email}</p>
                  <p className="text-xs text-gray-500">{deposit.reference}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-700">
                    {deposit.method.replace("_", " ")} - {formatNaira(deposit.amount)}
                  </p>
                  {deposit.proofFileUrl && (
                    <a
                      href={adminApi.proofUrl(deposit.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-black text-market-cyan underline"
                    >
                      View Proof
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeposit(deposit.id, "approve")}
                    className="brand-gradient h-9 rounded-full px-3 text-xs font-black text-white shadow-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeposit(deposit.id, "reject")}
                    className="h-9 rounded-full bg-slate-100 px-3 text-xs font-bold text-gray-800"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={productForm.price}
              onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
              placeholder="Price"
              required
            />
            <input
              type="number"
              value={productForm.stock}
              onChange={(event) => setProductForm((form) => ({ ...form, stock: event.target.value }))}
              className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
              placeholder="Stock"
              required
            />
          </div>
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
                Delivery files: {product.deliveryFiles?.length ? product.deliveryFiles.map((file) => file.fileName).join(", ") : product.deliveryFileName || "None"}
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

      <section>
        <div className="mb-2 px-1 text-base font-black text-market-navy">Orders</div>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3">
      <p className="text-[11px] font-bold uppercase text-gray-500">{label}</p>
      <p className="text-base font-black text-market-navy">{value}</p>
    </div>
  );
}

import { useMemo, useState } from "react";
import { adminApi } from "../api/client.js";

const fallbackCategories = [
  "Instagram",
  "Facebook",
  "TikTok",
  "Snapchat",
  "X/Twitter",
  "Telegram",
  "LinkedIn",
  "Reddit",
  "Digital Services",
  "Marketing Packages",
  "Content Templates",
];

const emptyForm = {
  accountName: "",
  category: "Instagram",
  price: "",
  stock: "1",
  description: "",
};

export default function AdminSanityAccountUpload({ user, categories = [], onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const names = categories.map((category) => category.name).filter(Boolean);
    return names.length ? names : fallbackCategories;
  }, [categories]);

  if (user?.role !== "ADMIN") {
    return (
      <section className="glass-panel rounded-[1.35rem] p-3">
        <p className="text-sm font-semibold text-slate-600">Admin access is required to upload listings.</p>
      </section>
    );
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectImage = (file) => {
    setImageFile(file || null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const submitListing = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!imageFile) {
      setStatus("Please choose a listing image.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("accountName", form.accountName.trim());
      payload.append("category", form.category);
      payload.append("price", form.price);
      payload.append("stock", form.stock);
      payload.append("description", form.description.trim());
      payload.append("image", imageFile);

      const { listing } = await adminApi.createSanityListing(payload);

      setForm(emptyForm);
      selectImage(null);
      setStatus("Listing uploaded to Sanity.");
      onCreated?.(listing);
    } catch (error) {
      setStatus(error.message || "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-panel rounded-[1.35rem] p-3">
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">Sanity catalog</p>
        <h2 className="text-base font-black text-market-navy">Upload Marketplace Listing</h2>
      </div>

      {status && <div className="mb-3 rounded-2xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-700">{status}</div>}

      <form onSubmit={submitListing} className="space-y-2">
        <input
          value={form.accountName}
          onChange={(event) => updateForm("accountName", event.target.value)}
          className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
          placeholder="Listing name"
          required
        />

        <select
          value={form.category}
          onChange={(event) => updateForm("category", event.target.value)}
          className="h-11 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
          required
        >
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            value={form.price}
            onChange={(event) => updateForm("price", event.target.value)}
            className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            placeholder="Price"
            required
          />
          <input
            type="number"
            min="0"
            value={form.stock}
            onChange={(event) => updateForm("stock", event.target.value)}
            className="h-11 rounded-2xl border border-emerald-100 bg-white/85 px-3 text-sm"
            placeholder="Available quantity"
            required
          />
        </div>

        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm"
          placeholder="Description"
          required
        />

        <input
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={(event) => selectImage(event.target.files?.[0] || null)}
          className="w-full rounded-2xl border border-emerald-100 bg-white/85 px-3 py-2 text-sm"
          required
        />

        {previewUrl && (
          <img src={previewUrl} alt="" className="h-24 w-24 rounded-2xl object-cover shadow-soft" />
        )}

        <button
          type="submit"
          disabled={submitting}
          className="brand-gradient h-11 w-full rounded-full text-sm font-black text-white shadow-glow disabled:opacity-60"
        >
          {submitting ? "Uploading..." : "Upload Listing"}
        </button>
      </form>
    </section>
  );
}

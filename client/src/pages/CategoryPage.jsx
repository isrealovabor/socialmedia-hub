import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { catalogApi } from "../api/client.js";

const categoryProductsCache = new Map();

export default function CategoryPage({
  allProducts = [],
  categories = [],
  loadingCatalog = false,
  onBuy,
  onFavorite,
  favoriteIds = [],
}) {
  const { slug } = useParams();
  const catalogCategory = useMemo(
    () => categories.find((item) => item.slug === slug) || null,
    [categories, slug]
  );
  const catalogProducts = useMemo(
    () =>
      allProducts.filter((product) => {
        const productSlug = product.category?.slug || product.categorySlug || product.slug;
        return productSlug === slug;
      }),
    [allProducts, slug]
  );
  const cached = categoryProductsCache.get(slug);
  const [category, setCategory] = useState(cached?.category || catalogCategory);
  const [products, setProducts] = useState(cached?.products || catalogProducts);
  const [message, setMessage] = useState(
    cached || catalogProducts.length ? "" : loadingCatalog ? "Loading products..." : "No active products in this category yet."
  );

  useEffect(() => {
    let active = true;
    const nextCached = categoryProductsCache.get(slug);
    const instantProducts = nextCached?.products || catalogProducts;
    const instantCategory = nextCached?.category || catalogCategory;

    setCategory(instantCategory);
    setProducts(instantProducts);
    setMessage(
      instantProducts.length ? "" : loadingCatalog ? "Loading products..." : "No active products in this category yet."
    );

    if (!loadingCatalog && catalogCategory) {
      return () => {
        active = false;
      };
    }

    catalogApi
      .categoryProducts(slug)
      .then((data) => {
        if (!active) return;
        categoryProductsCache.set(slug, {
          category: data.category,
          products: data.products,
        });
        setCategory(data.category);
        setProducts(data.products);
        setMessage(data.products.length ? "" : "No active products in this category yet.");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error.message);
        setProducts([]);
      });
    return () => {
      active = false;
    };
  }, [catalogCategory, catalogProducts, loadingCatalog, slug]);

  return (
    <div className="space-y-4">
      <div className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        <Link to="/" className="text-slate-500">
          Home
        </Link>{" "}
        / {category?.name ?? "Category"}
      </div>
      <section>
        <div className="mb-3 px-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-market-emerald">
            Service category
          </p>
          <h1 className="text-2xl font-black text-market-navy">{category?.name ?? "Featured"}</h1>
        </div>
        {message && (
          <div className="glass-panel mb-3 rounded-[1.35rem] px-4 py-4 text-sm font-semibold text-slate-600">
            {message}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{ ...product, isFavorite: favoriteIds.includes(product.id) }}
              onBuy={onBuy}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

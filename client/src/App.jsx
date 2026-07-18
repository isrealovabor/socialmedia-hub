import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import ProductDetailsPage from "./pages/ProductDetailsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import WalletPage from "./pages/WalletPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DepositPage from "./pages/DepositPage.jsx";
import WishlistPage from "./pages/WishlistPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import { authApi, catalogApi, clearToken, favoriteApi, notificationApi } from "./api/client.js";

export default function App() {
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const navigate = useNavigate();

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const refreshUser = async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      return data.user;
    } catch {
      clearToken();
      setUser(null);
      return null;
    }
  };

  const refreshNotifications = async () => {
    try {
      const data = await notificationApi.list();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  };

  const refreshFavorites = async () => {
    try {
      const data = await favoriteApi.list();
      setFavoriteIds(data.favorites.map((favorite) => favorite.productId));
    } catch {
      setFavoriteIds([]);
    }
  };

  const refreshCatalog = async () => {
    setLoadingCatalog(true);
    setCatalogError("");
    try {
      const [categoryData, productData] = await Promise.all([
        catalogApi.categories(),
        catalogApi.products(),
      ]);
      if (!Array.isArray(categoryData?.categories) || !Array.isArray(productData?.products)) {
        throw new Error("The marketplace returned an invalid catalog response.");
      }
      setCategories(categoryData.categories);
      setProducts(productData.products.map((product) => ({ ...product, isFavorite: favoriteIds.includes(product.id) })));
    } catch (error) {
      setCatalogError(error.message || "Unable to load live marketplace products.");
      setCategories([]);
      setProducts([]);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    refreshUser();
    refreshCatalog();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavoriteIds([]);
      setUnreadCount(0);
      return;
    }
    refreshFavorites();
    refreshNotifications();
  }, [user?.id]);

  useEffect(() => {
    setProducts((items) => items.map((product) => ({ ...product, isFavorite: favoriteIds.includes(product.id) })));
  }, [favoriteIds]);

  const addToCart = (product) => {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      if (existing) {
        return items.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...items, { ...product, quantity: 1 }];
    });
    navigate("/cart");
  };

  const toggleFavorite = async (product) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (favoriteIds.includes(product.id)) {
      await favoriteApi.remove(product.id);
      setFavoriteIds((ids) => ids.filter((id) => id !== product.id));
    } else {
      await favoriteApi.add(product.id);
      setFavoriteIds((ids) => [...ids, product.id]);
    }
  };

  const updateQuantity = (id, nextQuantity) => {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(1, nextQuantity) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((items) => items.filter((item) => item.id !== id));
  };

  const handleAuth = ({ token, user: nextUser }) => {
    setUser(nextUser);
    navigate(nextUser.role === "ADMIN" ? "/admin" : "/dashboard");
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setFavoriteIds([]);
    setUnreadCount(0);
    navigate("/login");
  };

  return (
    <Layout cartCount={cartCount} categories={categories} unreadCount={unreadCount}>
      <Routes>
        <Route
          path="/"
          element={<HomePage products={products} loading={loadingCatalog} error={catalogError} onBuy={addToCart} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/category/:slug"
          element={
            <CategoryPage
              allProducts={products}
              categories={categories}
              loadingCatalog={loadingCatalog}
              onBuy={addToCart}
              onFavorite={toggleFavorite}
              favoriteIds={favoriteIds}
            />
          }
        />
        <Route
          path="/product/:id"
          element={<ProductDetailsPage products={products} onBuy={addToCart} onFavorite={toggleFavorite} />}
        />
        <Route path="/login" element={<LoginPage onAuth={handleAuth} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<RegisterPage onAuth={handleAuth} />} />
        <Route
          path="/dashboard"
          element={<DashboardPage user={user} cartCount={cartCount} onLogout={handleLogout} />}
        />
        <Route
          path="/wallet"
          element={<WalletPage user={user} onUserRefresh={refreshUser} />}
        />
        <Route
          path="/deposit"
          element={<DepositPage user={user} onUserRefresh={refreshUser} />}
        />
        <Route
          path="/wishlist"
          element={<WishlistPage user={user} onBuy={addToCart} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/cart"
          element={
            <CartPage
              user={user}
              cart={cart}
              onClearCart={() => setCart([])}
              onUserRefresh={refreshUser}
              onCatalogRefresh={refreshCatalog}
              onQuantityChange={updateQuantity}
              onRemove={removeFromCart}
            />
          }
        />
        <Route
          path="/admin"
          element={<AdminPage user={user} categories={categories} onCatalogRefresh={refreshCatalog} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

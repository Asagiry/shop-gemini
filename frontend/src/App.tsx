import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Trash2, Filter, LogIn, LogOut, ShieldAlert, 
  CheckCircle, Package, User, Plus, Pencil, Settings, 
  ChevronRight, X, Copy, RefreshCw, Upload, Download, Key, Eye
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: string; // Numeric is returned as string from pg
  category: string;
  image_url: string;
  sizes: string[];
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  size: string;
}

interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  image_url: string;
  quantity: number;
  price: string;
  size: string;
}

interface Order {
  id: number;
  user_id: number | null;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  payment_method: string;
  total_amount: string;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface UserProfile {
  id: number;
  email: string;
  role: string;
}

export default function App() {
  // Navigation & Page State
  const [currentPage, setCurrentPage] = useState<'catalog' | 'dashboard' | 'admin'>('catalog');
  
  // API Data
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  
  // Filtering & Sorting
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');

  // Auth State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [importExportText, setImportExportText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & Forms State
  const [authModal, setAuthModal] = useState<null | 'login' | 'register' | 'forgot' | 'reset'>(null);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [cartModal, setCartModal] = useState(false);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [adminProductModal, setAdminProductModal] = useState<Product | null | 'add'>(null);
  
  // Form input states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Forgot Password / Recovery States
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Checkout inputs
  const [checkName, setCheckName] = useState('');
  const [checkAddress, setCheckAddress] = useState('');
  const [checkPhone, setCheckPhone] = useState('');
  const [checkPayment, setCheckPayment] = useState('Credit Card');
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  // Admin add/edit inputs
  const [adminProdName, setAdminProdName] = useState('');
  const [adminProdDesc, setAdminProdDesc] = useState('');
  const [adminProdPrice, setAdminProdPrice] = useState('');
  const [adminProdCategory, setAdminProdCategory] = useState('clothing');
  const [adminProdImageUrl, setAdminProdImageUrl] = useState('');
  const [adminProdSizes, setAdminProdSizes] = useState<string[]>([]);
  const [adminProdStock, setAdminProdStock] = useState('50');
  const [adminProdError, setAdminProdError] = useState('');

  // Admin tabs
  const [adminTab, setAdminTab] = useState<'catalog' | 'orders'>('catalog');

  // Load products & user session on mount
  useEffect(() => {
    fetchProducts();
    if (token) {
      fetchUserProfile();
    }
    // Load local cart
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart from localStorage');
      }
    }
  }, []);

  // Sync cart to localstorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Refetch products when filters or sort changes
  useEffect(() => {
    fetchProducts();
  }, [activeCategory, sortBy]);

  // ------------------- API OPERATIONS -------------------

  const fetchProducts = async () => {
    try {
      let url = '/api/products?';
      if (activeCategory && activeCategory !== 'all') {
        url += `category=${activeCategory}&`;
      }
      if (minPrice) {
        url += `minPrice=${minPrice}&`;
      }
      if (maxPrice) {
        url += `maxPrice=${maxPrice}&`;
      }
      if (sortBy && sortBy !== 'default') {
        url += `sortBy=${sortBy}&`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchUserProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const fetchUserOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const fetchAdminOrders = async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const res = await fetch('/api/orders/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
    }
  };

  // ------------------- CART METHODS -------------------

  const addToCart = (product: Product, size: string, quantity: number = 1) => {
    if (!size) {
      alert('Please select a size first.');
      return;
    }
    const existIdx = cart.findIndex(
      item => item.product.id === product.id && item.size === size
    );
    if (existIdx > -1) {
      const newCart = [...cart];
      newCart[existIdx].quantity += quantity;
      setCart(newCart);
    } else {
      setCart([...cart, { product, size, quantity }]);
    }
    setCartModal(true);
  };

  const updateCartQty = (productId: number, size: string, change: number) => {
    const existIdx = cart.findIndex(
      item => item.product.id === productId && item.size === size
    );
    if (existIdx > -1) {
      const newCart = [...cart];
      newCart[existIdx].quantity += change;
      if (newCart[existIdx].quantity <= 0) {
        newCart.splice(existIdx, 1);
      }
      setCart(newCart);
    }
  };

  const removeFromCart = (productId: number, size: string) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.size === size)));
  };

  const exportCart = () => {
    const cartString = JSON.stringify(cart);
    // Base64 encode the string
    const base64 = btoa(unescape(encodeURIComponent(cartString)));
    setImportExportText(base64);
    setImportStatus(null);
  };

  const importCart = () => {
    setImportStatus(null);
    if (!importExportText.trim()) {
      setImportStatus({ type: 'error', message: 'Backup string is empty' });
      return;
    }
    try {
      const decodedString = decodeURIComponent(escape(atob(importExportText.trim())));
      const parsed = JSON.parse(decodedString);
      if (Array.isArray(parsed)) {
        setCart(parsed);
        setImportStatus({ type: 'success', message: 'Cart successfully imported!' });
      } else {
        setImportStatus({ type: 'error', message: 'Invalid cart format' });
      }
    } catch (e) {
      setImportStatus({ type: 'error', message: 'Failed to decode backup string. Check integrity.' });
    }
  };

  const getCartTotal = () => {
    return cart.reduce((acc, item) => acc + Number(item.product.price) * item.quantity, 0);
  };

  // ------------------- AUTH FLOWS -------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthModal(null);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection failed. Try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthModal(null);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch (err) {
      setAuthError('Connection failed. Try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMessage('');
    setAuthError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setRecoveryToken(data.token);
        setRecoveryMessage('A recovery token was generated successfully (Mock email service).');
      } else {
        setAuthError(data.error || 'Failed to request password reset');
      }
    } catch (err) {
      setAuthError('Connection failed.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetTokenInput, newPassword: newPasswordInput })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password reset successfully. You can now login.');
        setAuthModal('login');
        setResetTokenInput('');
        setNewPasswordInput('');
        setRecoveryToken('');
        setRecoveryMessage('');
      } else {
        setAuthError(data.error || 'Password reset failed');
      }
    } catch (err) {
      setAuthError('Connection failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCurrentPage('catalog');
  };

  // ------------------- CHECKOUT -------------------

  const submitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutStatus(null);
    const checkoutItems = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      size: item.size
    }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: checkName,
          address: checkAddress,
          phone: checkPhone,
          paymentMethod: checkPayment,
          items: checkoutItems
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Order placed successfully! Order ID: ${data.orderId}`);
        setCart([]);
        setCheckoutModal(false);
        setCheckName('');
        setCheckAddress('');
        setCheckPhone('');
        fetchProducts(); // Refresh stock
      } else {
        setCheckoutStatus(data.error || 'Checkout failed');
      }
    } catch (err) {
      setCheckoutStatus('Failed to place order.');
    }
  };

  // ------------------- ADMIN PANEL METHODS -------------------

  const openAddProduct = () => {
    setAdminProdName('');
    setAdminProdDesc('');
    setAdminProdPrice('');
    setAdminProdCategory('clothing');
    setAdminProdImageUrl('');
    setAdminProdSizes(['S', 'M', 'L', 'XL']);
    setAdminProdStock('50');
    setAdminProductModal('add');
    setAdminProdError('');
  };

  const openEditProduct = (prod: Product) => {
    setAdminProdName(prod.name);
    setAdminProdDesc(prod.description);
    setAdminProdPrice(prod.price);
    setAdminProdCategory(prod.category);
    setAdminProdImageUrl(prod.image_url);
    setAdminProdSizes(prod.sizes);
    setAdminProdStock(prod.stock.toString());
    setAdminProductModal(prod);
    setAdminProdError('');
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminProdError('');
    
    if (!adminProdName || !adminProdPrice || !adminProdImageUrl) {
      setAdminProdError('Please enter product Name, Price, and Image URL.');
      return;
    }

    const payload = {
      name: adminProdName,
      description: adminProdDesc,
      price: Number(adminProdPrice),
      category: adminProdCategory,
      imageUrl: adminProdImageUrl,
      sizes: adminProdSizes,
      stock: Number(adminProdStock)
    };

    const isEdit = adminProductModal !== 'add' && adminProductModal !== null;
    const url = isEdit ? `/api/products/${(adminProductModal as Product).id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert(isEdit ? 'Product updated successfully' : 'Product created successfully');
        setAdminProductModal(null);
        fetchProducts();
      } else {
        setAdminProdError(data.error || 'Failed to save product');
      }
    } catch (err) {
      setAdminProdError('Connection error.');
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Product deleted successfully');
        fetchProducts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      alert('Connection error.');
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        alert(`Order status updated to ${status}`);
        fetchAdminOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update order status');
      }
    } catch (err) {
      alert('Connection error.');
    }
  };

  const handleSizeToggle = (size: string) => {
    if (adminProdSizes.includes(size)) {
      setAdminProdSizes(adminProdSizes.filter(s => s !== size));
    } else {
      setAdminProdSizes([...adminProdSizes, size]);
    }
  };

  // Filter products by size locally to make it dynamic
  const filteredProducts = products.filter(p => {
    if (selectedSizeFilter === 'all') return true;
    return p.sizes.includes(selectedSizeFilter);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER NAVBAR */}
      <header className="app-header">
        <div className="container header-container">
          <div className="logo" onClick={() => setCurrentPage('catalog')} style={{ cursor: 'pointer' }}>
            <ShoppingBag size={24} color="#8b5cf6" />
            <span>INDIE HAVEN</span>
          </div>

          <nav className="nav-links">
            <span 
              className={`nav-link ${currentPage === 'catalog' ? 'active' : ''}`}
              onClick={() => setCurrentPage('catalog')}
            >
              Shop
            </span>
            {token && (
              <span 
                className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                onClick={() => {
                  fetchUserOrders();
                  setCurrentPage('dashboard');
                }}
              >
                Dashboard
              </span>
            )}
            {user?.role === 'admin' && (
              <span 
                className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  fetchAdminOrders();
                  setCurrentPage('admin');
                }}
              >
                Admin Panel
              </span>
            )}
          </nav>

          <div className="header-actions">
            <button className="cart-icon-btn" onClick={() => setCartModal(true)}>
              <ShoppingBag size={20} />
              {cart.length > 0 && <span className="cart-badge">{cart.reduce((s,i)=>s+i.quantity, 0)}</span>}
            </button>

            {token ? (
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                <LogOut size={14} /> Log Out
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setAuthModal('login')}>
                <LogIn size={14} /> Log In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO BANNER - Display on Catalog page */}
      {currentPage === 'catalog' && (
        <section className="hero-banner">
          <div className="container">
            <h1 className="hero-title">Elevate Your Indie Wardrobe</h1>
            <p className="hero-subtitle">
              Official, premium-designed apparel and merchandise themed around your favorite indie game titles, including the legendary Vibe Miner.
            </p>
          </div>
        </section>
      )}

      {/* MAIN CONTAINER */}
      <main style={{ flexGrow: 1 }} className="container">
        
        {/* ================= CATALOG VIEW ================= */}
        {currentPage === 'catalog' && (
          <div className="catalog-layout">
            
            {/* SIDEBAR FILTERS */}
            <aside className="filters-sidebar glass-panel">
              <div className="filter-group">
                <h3 className="filter-title">Category</h3>
                <div className="category-list">
                  {['all', 'clothing', 'posters', 'accessories'].map(cat => (
                    <button 
                      key={cat}
                      className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <h3 className="filter-title">Price Range</h3>
                <div className="price-inputs">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    className="price-input" 
                    value={minPrice} 
                    onChange={e => setMinPrice(e.target.value)} 
                  />
                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    className="price-input" 
                    value={maxPrice} 
                    onChange={e => setMaxPrice(e.target.value)} 
                  />
                </div>
                {(minPrice || maxPrice) && (
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={() => { setMinPrice(''); setMaxPrice(''); fetchProducts(); }}
                  >
                    Clear Price
                  </button>
                )}
                <button 
                  className="btn btn-accent btn-sm"
                  style={{ width: '100%', marginTop: '8px' }}
                  onClick={fetchProducts}
                >
                  Apply Price
                </button>
              </div>

              <div className="filter-group">
                <h3 className="filter-title">Filter by Size</h3>
                <div className="size-grid">
                  {['all', 'S', 'M', 'L', 'XL', '12x18', '18x24', 'Standard'].map(sz => (
                    <button 
                      key={sz}
                      className={`size-btn ${selectedSizeFilter === sz ? 'active' : ''}`}
                      onClick={() => setSelectedSizeFilter(sz)}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* PRODUCTS CONTAINER */}
            <div className="products-container">
              <div className="catalog-header">
                <p style={{ color: 'var(--text-secondary)' }}>
                  Showing {filteredProducts.length} premium products
                </p>
                <select 
                  className="sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="default">Sort by: Default</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Package size={48} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                  <p>No products match your current filtering criteria.</p>
                </div>
              ) : (
                <div className="products-grid">
                  {filteredProducts.map(prod => (
                    <div 
                      key={prod.id} 
                      className="product-card glass-panel"
                      onClick={() => setProductDetails(prod)}
                      style={{ cursor: 'pointer' }}
                    >
                      {prod.stock === 0 && <span className="card-badge-stock">Out of Stock</span>}
                      {prod.stock > 0 && prod.stock <= 5 && <span className="card-badge-stock" style={{ background: 'var(--color-warning)', color: '#000' }}>Low Stock</span>}
                      
                      <div className="card-img-wrapper">
                        <img src={prod.image_url} alt={prod.name} className="product-card-img" />
                      </div>
                      
                      <div className="card-info">
                        <span className="product-category">{prod.category}</span>
                        <h4 className="product-title">{prod.name}</h4>
                        <div className="product-price">${Number(prod.price).toFixed(2)}</div>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 'auto' }}>
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= USER DASHBOARD VIEW ================= */}
        {currentPage === 'dashboard' && user && (
          <div className="dashboard-layout">
            <div className="admin-header">
              <h2>User Workspace Dashboard</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage('catalog')}>
                Back to Shop
              </button>
            </div>

            <div className="dashboard-grid">
              {/* Profile Details */}
              <aside className="profile-card glass-panel">
                <h3 className="profile-title">Profile Settings</h3>
                <div className="profile-detail">
                  <span>Registered Email</span>
                  <strong>{user.email}</strong>
                </div>
                <div className="profile-detail">
                  <span>User Type Role</span>
                  <strong style={{ textTransform: 'uppercase', color: user.role === 'admin' ? 'var(--color-accent)' : 'var(--text-primary)' }}>
                    {user.role}
                  </strong>
                </div>
              </aside>

              {/* Order History */}
              <div className="order-history-card glass-panel">
                <h3 className="profile-title">Your Order History</h3>
                {orders.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>You have not placed any orders yet.</p>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="order-item-block">
                      <div className="order-item-header">
                        <div>
                          <strong>Order #{order.id}</strong>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '12px' }}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`badge-status ${order.status}`}>{order.status}</span>
                      </div>
                      <div className="order-item-body">
                        {order.items.map(item => (
                          <div key={item.id} className="order-product-row">
                            <img src={item.image_url} alt={item.name} className="order-product-thumb" />
                            <div className="order-product-details">
                              <div><strong>{item.name}</strong></div>
                              <div className="order-product-meta">Size: {item.size} | Qty: {item.quantity}</div>
                            </div>
                            <div style={{ fontWeight: 700 }}>${(Number(item.price) * item.quantity).toFixed(2)}</div>
                          </div>
                        ))}

                        <div className="order-shipping-details">
                          <div><strong>Ship To:</strong> {order.customer_name} | {order.customer_phone}</div>
                          <div><strong>Address:</strong> {order.customer_address}</div>
                          <div style={{ marginTop: '8px', color: '#fff', fontSize: '14px', textAlign: 'right' }}>
                            <strong>Grand Total: ${Number(order.total_amount).toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= ADMIN DASHBOARD VIEW ================= */}
        {currentPage === 'admin' && user?.role === 'admin' && (
          <div className="admin-layout">
            <div className="admin-header">
              <div>
                <h2>Store Management Portal</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Manage stock, catalog listings, and order fullfilments</p>
              </div>
              <div className="admin-tabs">
                <button 
                  className={`admin-tab ${adminTab === 'catalog' ? 'active' : ''}`}
                  onClick={() => setAdminTab('catalog')}
                >
                  Manage Products
                </button>
                <button 
                  className={`admin-tab ${adminTab === 'orders' ? 'active' : ''}`}
                  onClick={() => {
                    fetchAdminOrders();
                    setAdminTab('orders');
                  }}
                >
                  Manage Orders
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage('catalog')}>
                  Exit Admin
                </button>
              </div>
            </div>

            <div className="admin-content">
              {/* CATALOG MANAGEMENT */}
              {adminTab === 'catalog' && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3>Product Catalog ({products.length})</h3>
                    <button className="btn btn-primary btn-sm" onClick={openAddProduct}>
                      <Plus size={14} /> Add Catalog Item
                    </button>
                  </div>

                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Sizes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(prod => (
                          <tr key={prod.id}>
                            <td>
                              <img src={prod.image_url} alt="" className="admin-thumbnail" />
                            </td>
                            <td><strong>{prod.name}</strong></td>
                            <td>{prod.category}</td>
                            <td>${Number(prod.price).toFixed(2)}</td>
                            <td>
                              <span style={{ color: prod.stock === 0 ? 'var(--color-danger)' : prod.stock <= 5 ? 'var(--color-warning)' : 'inherit' }}>
                                {prod.stock} items
                              </span>
                            </td>
                            <td>{prod.sizes.join(', ')}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEditProduct(prod)}>
                                  <Pencil size={12} /> Edit
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(prod.id)}>
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ORDER MANAGEMENT */}
              {adminTab === 'orders' && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3>Store Orders ({adminOrders.length})</h3>
                  <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>Advance orders through fullfilment pipeline</p>
                  
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Customer Details</th>
                          <th>Order Summary</th>
                          <th>Payment</th>
                          <th>Total</th>
                          <th>Status Pipeline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminOrders.map(order => (
                          <tr key={order.id}>
                            <td><strong>#{order.id}</strong></td>
                            <td>
                              <div><strong>{order.customer_name}</strong></div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.customer_phone}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{order.customer_address}</div>
                            </td>
                            <td>
                              {order.items.map(item => (
                                <div key={item.id} style={{ fontSize: '13px' }}>
                                  • {item.name} ({item.size}) x{item.quantity}
                                </div>
                              ))}
                            </td>
                            <td>{order.payment_method}</td>
                            <td><strong>${Number(order.total_amount).toFixed(2)}</strong></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className={`badge-status ${order.status}`}>{order.status}</span>
                                <select 
                                  value={order.status} 
                                  onChange={e => updateOrderStatus(order.id, e.target.value)}
                                  style={{
                                    background: 'var(--bg-input)',
                                    color: '#fff',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    padding: '4px'
                                  }}
                                >
                                  <option value="New">New</option>
                                  <option value="Confirmed">Confirmed</option>
                                  <option value="Shipped">Shipped</option>
                                  <option value="Delivered">Delivered</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', padding: '24px 0', background: 'rgba(10, 8, 19, 0.5)', fontSize: '13px', color: 'var(--text-muted)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>© 2026 Indie Haven E-Commerce Merchandise Shop. Powered by model design.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Privacy</span>
            <span>Terms of Service</span>
            <span>Support</span>
          </div>
        </div>
      </footer>

      {/* ================= MODAL: PRODUCT DETAILS ================= */}
      {productDetails && (
        <div className="modal-overlay" onClick={() => setProductDetails(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <button className="modal-close-btn" onClick={() => setProductDetails(null)}>
              <X size={18} />
            </button>
            <div className="details-layout" style={{ padding: '32px' }}>
              <div className="details-img-wrapper">
                <img src={productDetails.image_url} alt={productDetails.name} className="details-img" />
              </div>
              <div className="details-info">
                <span className="product-category" style={{ fontSize: '12px' }}>{productDetails.category}</span>
                <h2 className="details-title">{productDetails.name}</h2>
                <div style={{ marginBottom: '16px' }}>
                  <span className={`details-stock-status ${productDetails.stock === 0 ? 'out' : productDetails.stock <= 5 ? 'low' : ''}`}>
                    {productDetails.stock === 0 ? 'Out of Stock' : productDetails.stock <= 5 ? `Only ${productDetails.stock} left in stock!` : 'In Stock & Ready to Ship'}
                  </span>
                </div>
                <p className="details-desc">{productDetails.description}</p>
                
                {/* Size Selection */}
                {productDetails.stock > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <span className="form-label">Select Size</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {productDetails.sizes.map(size => {
                        const isSelected = cart.some(item => item.product.id === productDetails.id && item.size === size);
                        return (
                          <button 
                            key={size}
                            className={`size-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => addToCart(productDetails, size)}
                            style={{ minWidth: '48px' }}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="details-price-row">
                  <div className="details-price">${Number(productDetails.price).toFixed(2)}</div>
                  {productDetails.stock > 0 ? (
                    <button 
                      className="btn btn-primary"
                      onClick={() => addToCart(productDetails, productDetails.sizes[0])}
                    >
                      Quick Add (Size: {productDetails.sizes[0]})
                    </button>
                  ) : (
                    <button className="btn btn-secondary" disabled>
                      Sold Out
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SHOPPING CART ================= */}
      {cartModal && (
        <div className="modal-overlay" onClick={() => setCartModal(false)}>
          <div className="modal-content glass-panel cart-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setCartModal(false)}>
              <X size={18} />
            </button>
            <div className="cart-header">
              <ShoppingBag size={24} color="var(--color-accent)" />
              <h3 className="cart-title">Your Cart</h3>
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <p>Your shopping cart is currently empty.</p>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }} onClick={() => setCartModal(false)}>
                  Start Shopping
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items-list">
                  {cart.map(item => (
                    <div key={`${item.product.id}-${item.size}`} className="cart-item">
                      <img src={item.product.image_url} alt="" className="cart-item-img" />
                      <div className="cart-item-details">
                        <div className="cart-item-name">{item.product.name}</div>
                        <div className="cart-item-meta">Size: {item.size}</div>
                        <div className="cart-item-price">${Number(item.product.price).toFixed(2)}</div>
                      </div>
                      
                      <div className="cart-qty-ctrl">
                        <button className="qty-btn" onClick={() => updateCartQty(item.product.id, item.size, -1)}>-</button>
                        <span className="qty-val">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateCartQty(item.product.id, item.size, 1)}>+</button>
                      </div>

                      <button className="cart-remove-btn" onClick={() => removeFromCart(item.product.id, item.size)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <div className="cart-total-row">
                    <span>Total Amount</span>
                    <span>${getCartTotal().toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" style={{ width: '50%' }} onClick={exportCart}>
                      <Download size={14} /> Backup Cart
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '50%' }}
                      onClick={() => {
                        setCartModal(false);
                        setCheckoutModal(true);
                      }}
                    >
                      Checkout <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Cart Import/Export Backup Utilities */}
            <div className="cart-backup-section">
              <h4 className="backup-title">Import / Export Backup System</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Restore or share your shopping cart status using base64 tokens.
              </p>
              <textarea
                className="backup-textarea"
                placeholder="Paste backup token string here to import..."
                value={importExportText}
                onChange={e => setImportExportText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={importCart} style={{ fontSize: '11px', padding: '5px 10px' }}>
                  <Upload size={11} /> Load Backup
                </button>
                {importStatus && (
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '600', 
                    color: importStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
                  }}>
                    {importStatus.message}
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: AUTH (LOGIN / REGISTER / FORGOT / RESET) ================= */}
      {authModal && (
        <div className="modal-overlay" onClick={() => { setAuthModal(null); setAuthError(''); setRecoveryToken(''); setRecoveryMessage(''); }}>
          <div className="modal-content glass-panel auth-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => { setAuthModal(null); setAuthError(''); setRecoveryToken(''); setRecoveryMessage(''); }}>
              <X size={18} />
            </button>

            {/* LOGIN STATE */}
            {authModal === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="auth-header">
                  <h3 className="auth-title">Welcome Back</h3>
                  <p className="auth-subtitle">Sign in to view orders and checkout faster</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Email or Username</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    placeholder="admin or email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    required 
                    className="form-input" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    placeholder="Enter password"
                  />
                  <span className="forgot-password-link" onClick={() => { setAuthModal('forgot'); setAuthError(''); }}>
                    Forgot Password?
                  </span>
                </div>
                {authError && <div className="form-error" style={{ marginBottom: '12px' }}>{authError}</div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Log In
                </button>
                <div className="auth-switch">
                  Don't have an account? 
                  <span className="auth-link" onClick={() => { setAuthModal('register'); setAuthError(''); }}>Register</span>
                </div>
              </form>
            )}

            {/* REGISTER STATE */}
            {authModal === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="auth-header">
                  <h3 className="auth-title">Create Account</h3>
                  <p className="auth-subtitle">Register to trace shipments and log history</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    className="form-input" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    placeholder="user@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    required 
                    className="form-input" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    placeholder="Minimum 6 characters"
                  />
                </div>
                {authError && <div className="form-error" style={{ marginBottom: '12px' }}>{authError}</div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Sign Up & Register
                </button>
                <div className="auth-switch">
                  Already registered? 
                  <span className="auth-link" onClick={() => { setAuthModal('login'); setAuthError(''); }}>Log In</span>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD STATE */}
            {authModal === 'forgot' && (
              <form onSubmit={handleForgotPassword}>
                <div className="auth-header">
                  <Key size={32} color="var(--color-primary)" style={{ marginBottom: '10px' }} />
                  <h3 className="auth-title">Forgot Password</h3>
                  <p className="auth-subtitle">Submit email to generate recovery token</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Account Email Address</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    placeholder="admin or user@example.com"
                  />
                </div>
                {authError && <div className="form-error" style={{ marginBottom: '12px' }}>{authError}</div>}
                {recoveryMessage && (
                  <div style={{ color: 'var(--color-success)', fontSize: '13px', marginBottom: '12px' }}>
                    {recoveryMessage}
                  </div>
                )}
                
                {recoveryToken && (
                  <div style={{ background: 'var(--bg-input)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', wordBreak: 'break-all', marginBottom: '16px', color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                    <strong>Token:</strong> {recoveryToken}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: recoveryToken ? '50%' : '100%' }}>
                    Get Token
                  </button>
                  {recoveryToken && (
                    <button 
                      type="button" 
                      className="btn btn-accent" 
                      style={{ width: '50%' }}
                      onClick={() => {
                        setResetTokenInput(recoveryToken);
                        setAuthModal('reset');
                        setAuthError('');
                      }}
                    >
                      Reset Form <ChevronRight size={14} />
                    </button>
                  )}
                </div>

                <div className="auth-switch">
                  Remember credentials? 
                  <span className="auth-link" onClick={() => { setAuthModal('login'); setAuthError(''); }}>Log In</span>
                </div>
              </form>
            )}

            {/* RESET PASSWORD STATE */}
            {authModal === 'reset' && (
              <form onSubmit={handleResetPassword}>
                <div className="auth-header">
                  <h3 className="auth-title">Reset Password</h3>
                  <p className="auth-subtitle">Verify your recovery token to update password</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Recovery Token</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    value={resetTokenInput} 
                    onChange={e => setResetTokenInput(e.target.value)} 
                    placeholder="Paste recovery token"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    required 
                    className="form-input" 
                    value={newPasswordInput} 
                    onChange={e => setNewPasswordInput(e.target.value)} 
                    placeholder="Enter new password"
                  />
                </div>
                {authError && <div className="form-error" style={{ marginBottom: '12px' }}>{authError}</div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Submit New Password
                </button>
                <div className="auth-switch">
                  Back to login? 
                  <span className="auth-link" onClick={() => { setAuthModal('login'); setAuthError(''); }}>Cancel</span>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ================= MODAL: CHECKOUT FLOW ================= */}
      {checkoutModal && (
        <div className="modal-overlay" onClick={() => setCheckoutModal(false)}>
          <div className="modal-content glass-panel checkout-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setCheckoutModal(false)}>
              <X size={18} />
            </button>
            <div className="cart-header">
              <CheckCircle size={24} color="var(--color-success)" />
              <h3 className="cart-title">Order Checkout</h3>
            </div>

            <form onSubmit={submitCheckout} className="checkout-grid">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    placeholder="John Doe" 
                    value={checkName}
                    onChange={e => setCheckName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    placeholder="+1 234 567 890" 
                    value={checkPhone}
                    onChange={e => setCheckPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Shipping Address</label>
                <textarea 
                  required 
                  className="form-input" 
                  style={{ height: '70px', resize: 'none' }}
                  placeholder="Street, City, Zip Code" 
                  value={checkAddress}
                  onChange={e => setCheckAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select 
                  className="form-input" 
                  value={checkPayment}
                  onChange={e => setCheckPayment(e.target.value)}
                >
                  <option value="Credit Card">Credit Card (Mocked)</option>
                  <option value="PayPal">PayPal (Mocked)</option>
                  <option value="Crypto">Cryptocurrency (Mocked)</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                <div className="cart-total-row" style={{ fontSize: '16px', marginBottom: '16px' }}>
                  <span>Total Amount Due:</span>
                  <span style={{ color: 'var(--color-accent)' }}>${getCartTotal().toFixed(2)}</span>
                </div>
                
                {checkoutStatus && <div className="form-error" style={{ marginBottom: '12px' }}>{checkoutStatus}</div>}
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" style={{ width: '40%' }} onClick={() => { setCheckoutModal(false); setCartModal(true); }}>
                    Back to Cart
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ width: '60%' }}>
                    Confirm & Complete Checkout
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN ADD/EDIT PRODUCT ================= */}
      {adminProductModal && (
        <div className="modal-overlay" onClick={() => setAdminProductModal(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '32px' }}>
            <button className="modal-close-btn" onClick={() => setAdminProductModal(null)}>
              <X size={18} />
            </button>
            <h3>{adminProductModal === 'add' ? 'Add Catalog Item' : 'Edit Catalog Item'}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Specify details below. For external images, the server will download and store them locally.
            </p>

            <form onSubmit={saveProduct}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={adminProdName} 
                  onChange={e => setAdminProdName(e.target.value)} 
                  placeholder="e.g. Vibe Miner Neon Poster"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  style={{ height: '60px', resize: 'none' }}
                  value={adminProdDesc} 
                  onChange={e => setAdminProdDesc(e.target.value)} 
                  placeholder="Details and features"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="form-input" 
                    value={adminProdPrice} 
                    onChange={e => setAdminProdPrice(e.target.value)} 
                    placeholder="25.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Qty</label>
                  <input 
                    type="number" 
                    required 
                    className="form-input" 
                    value={adminProdStock} 
                    onChange={e => setAdminProdStock(e.target.value)} 
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-input" 
                  value={adminProdCategory} 
                  onChange={e => setAdminProdCategory(e.target.value)}
                >
                  <option value="clothing">Clothing</option>
                  <option value="posters">Posters</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Image Link / URL</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  value={adminProdImageUrl} 
                  onChange={e => setAdminProdImageUrl(e.target.value)} 
                  placeholder="e.g., https://example.com/image.png or /assets/..."
                />
              </div>

              {/* Sizes checkboxes */}
              <div className="form-group">
                <label className="form-label">Available Sizes</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['S', 'M', 'L', 'XL', '12x18', '18x24', 'Standard'].map(sz => {
                    const hasSize = adminProdSizes.includes(sz);
                    return (
                      <button
                        type="button"
                        key={sz}
                        className={`size-btn ${hasSize ? 'active' : ''}`}
                        onClick={() => handleSizeToggle(sz)}
                        style={{ minWidth: '40px', padding: '4px 8px' }}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {adminProdError && <div className="form-error" style={{ marginBottom: '12px' }}>{adminProdError}</div>}
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" style={{ width: '40%' }} onClick={() => setAdminProductModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: '60%' }}>
                  Save Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import ExportToExcelLib from 'react-export-table-to-excel';
const ExportToExcel = ExportToExcelLib || null;

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const categories = [
  'Electronics',
  'Clothing',
  'Food',
  'Books',
  'Furniture',
  'Tools',
  'Other'
];

const suppliers = [
  'TechCorp Inc.',
  'Fashion World',
  'Food Suppliers Ltd.',
  'Book Haven',
  'Furniture Masters',
  'Tool Depot',
  'General Suppliers'
];

const App = () => {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  // Analytics state
  const [chartTimePeriod, setChartTimePeriod] = useState('all');
  const [chartType, setChartType] = useState('pie');
  const [selectedMetric, setSelectedMetric] = useState('count');
  const [showTrendAnalysis, setShowTrendAnalysis] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    price: '',
    description: '',
    supplier: '',
    sku: '',
    reorderLevel: '10',
    lastUpdated: new Date().toISOString()
  });

  const printRef = useRef();

  useEffect(() => {
    const loadInventory = () => {
      try {
        // Try to load from localStorage first
        const savedInventory = localStorage.getItem('inventory');
        if (savedInventory) {
          const parsedInventory = JSON.parse(savedInventory);
          setInventory(parsedInventory);
          return;
        }
        // If localStorage is empty, try to load from sessionStorage as backup
        const sessionInventory = sessionStorage.getItem('inventory');
        if (sessionInventory) {
          const parsedInventory = JSON.parse(sessionInventory);
          setInventory(parsedInventory);
          return;
        }
      } catch (error) {
        // fail silently in production
      }
    };

    loadInventory();
  }, []);

  useEffect(() => {
    const saveInventory = () => {
      try {
        // Save to localStorage
        localStorage.setItem('inventory', JSON.stringify(inventory));
        // Also save to sessionStorage as backup
        sessionStorage.setItem('inventory', JSON.stringify(inventory));
      } catch (error) {
        // fail silently in production
        try {
          sessionStorage.setItem('inventory', JSON.stringify(inventory));
        } catch (backupError) {
          // fail silently
        }
      }
    };

    // Only save if inventory is not empty
    if (inventory.length > 0) {
      saveInventory();
    }
  }, [inventory]);

  // Manual export/import functions
  const exportInventory = () => {
    const dataStr = JSON.stringify(inventory, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'inventory-backup.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importInventory = (event) => {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = e => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          setInventory(importedData);
          toast.success('Inventory imported successfully!');
        } else {
          toast.error('Invalid inventory file format');
        }
      } catch (error) {
        toast.error('Error importing inventory file');
      }
    };
  };

  // Filter and sort inventory
  const filteredInventory = inventory
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      
      let matchesStock = true;
      if (filterStock === 'low') matchesStock = item.quantity <= 5;
      else if (filterStock === 'medium') matchesStock = item.quantity > 5 && item.quantity <= 20;
      else if (filterStock === 'high') matchesStock = item.quantity > 20;
      
      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStockStatus = (quantity, reorderLevel = 10) => {
    if (quantity === 0) return { class: 'stock-out', text: 'Out of Stock' };
    if (quantity <= reorderLevel) return { class: 'stock-low', text: 'Reorder Soon' };
    if (quantity <= reorderLevel * 2) return { class: 'stock-medium', text: 'Low Stock' };
    return { class: 'stock-high', text: 'In Stock' };
  };

  const getStats = () => {
    const totalItems = inventory.length;
    const lowStock = inventory.filter(item => item.quantity <= (item.reorderLevel || 10)).length;
    const outOfStock = inventory.filter(item => item.quantity === 0).length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const uniqueCategories = new Set(inventory.map(item => item.category)).size;
    const uniqueSuppliers = new Set(inventory.map(item => item.supplier).filter(Boolean)).size;

    return { totalItems, lowStock, outOfStock, totalValue, uniqueCategories, uniqueSuppliers };
  };

  const getChartData = () => {
    const categoryData = categories.map(category => {
      const items = inventory.filter(item => item.category === category);
      return {
        category,
        count: items.length,
        totalValue: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
      };
    }).filter(item => item.count > 0);

    return {
      categoryCount: {
        labels: categoryData.map(item => item.category),
        datasets: [{
          label: 'Items by Category',
          data: categoryData.map(item => item.count),
          backgroundColor: [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverBorderWidth: 3,
          hoverBorderColor: '#ffffff'
        }]
      },
      categoryValue: {
        labels: categoryData.map(item => item.category),
        datasets: [{
          label: 'Value by Category (₦)',
          data: categoryData.map(item => item.totalValue),
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 2,
          hoverBackgroundColor: 'rgba(102, 126, 234, 1)',
          hoverBorderColor: 'rgba(102, 126, 234, 1)'
        }]
      }
    };
  };

  // Enhanced analytics functions
  const getEnhancedStats = () => {
    const baseStats = getStats();
    const averageItemValue = inventory.length > 0 ? baseStats.totalValue / inventory.length : 0;
    const topCategory = categories.reduce((top, category) => {
      const categoryValue = inventory
        .filter(item => item.category === category)
        .reduce((sum, item) => sum + (item.quantity * item.price), 0);
      return categoryValue > top.value ? { category, value: categoryValue } : top;
    }, { category: 'None', value: 0 });

    const stockTurnover = inventory.reduce((sum, item) => {
      // Simple turnover calculation based on quantity and reorder level
      const reorderLevel = item.reorderLevel || 10;
      return sum + (item.quantity / reorderLevel);
    }, 0);

    const supplierStats = suppliers.map(supplier => {
      const supplierItems = inventory.filter(item => item.supplier === supplier);
      return {
        supplier,
        itemCount: supplierItems.length,
        totalValue: supplierItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
      };
    }).filter(stat => stat.itemCount > 0);

    return {
      ...baseStats,
      averageItemValue,
      topCategory,
      stockTurnover: stockTurnover.toFixed(2),
      supplierStats
    };
  };

  const getTrendData = () => {
    // Generate mock trend data for the last 7 days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trendData = days.map((day, index) => {
      const baseValue = stats.totalValue;
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      return Math.max(0, baseValue * (1 + variation));
    });

    return {
      labels: days,
      datasets: [{
        label: 'Inventory Value Trend (₦)',
        data: trendData,
        borderColor: 'rgba(102, 126, 234, 1)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(102, 126, 234, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    };
  };

  const exportChartData = (chartType) => {
    const data = chartType === 'trend' ? getTrendData() : getChartData();
    const csvContent = [
      ['Category', 'Value'],
      ...data.labels.map((label, index) => [
        label,
        data.datasets[0].data[index]
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chartType}-data.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  toast.success('Chart data exported successfully!');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.quantity || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const item = {
      id: editingItem?.id || Date.now().toString(),
      name: formData.name,
      category: formData.category,
      quantity: parseInt(formData.quantity),
      price: parseFloat(formData.price),
      description: formData.description,
      supplier: formData.supplier,
      sku: formData.sku || `SKU-${Date.now()}`,
      reorderLevel: parseInt(formData.reorderLevel) || 10,
      lastUpdated: new Date().toISOString(),
      dateAdded: editingItem?.dateAdded || new Date().toISOString()
    };

    if (editingItem) {
      setInventory(prev => prev.map(i => i.id === editingItem.id ? item : i));
      toast.success('Item updated successfully!');
    } else {
      setInventory(prev => [...prev, item]);
      toast.success('Item added successfully!');
    }

    resetForm();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
      description: item.description || '',
      supplier: item.supplier || '',
      sku: item.sku || '',
      reorderLevel: (item.reorderLevel || 10).toString(),
      lastUpdated: new Date().toISOString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setInventory(prev => prev.filter(item => item.id !== id));
      toast.success('Item deleted successfully!');
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm('Are you sure you want to delete all filtered items?')) {
      setInventory(prev => prev.filter(item => !filteredInventory.includes(item)));
      toast.success('Bulk delete completed!');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      quantity: '',
      price: '',
      description: '',
      supplier: '',
      sku: '',
      reorderLevel: '10',
      lastUpdated: new Date().toISOString()
    });
    setEditingItem(null);
    setIsModalOpen(false);
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Inventory-Report'
  });

  const stats = getStats();
  const chartData = getChartData();

  const excelHeaders = ['Name', 'Category', 'SKU', 'Quantity', 'Price', 'Total Value', 'Supplier', 'Stock Status', 'Last Updated'];
  const excelData = filteredInventory.map(item => ({
    name: item.name,
    category: item.category,
    sku: item.sku || 'N/A',
    quantity: item.quantity,
    price: item.price,
    totalValue: item.quantity * item.price,
    supplier: item.supplier || 'N/A',
    stockStatus: getStockStatus(item.quantity, item.reorderLevel).text,
    lastUpdated: format(new Date(item.lastUpdated), 'MMM dd, yyyy')
  }));

  return (
    <div className="App inventory-manager-app">
      <Toaster position="top-right" />
      <div className="container">
        <header className="header classy-header">
          <h1><i className="fas fa-warehouse"></i> Inventory Manager</h1>
          <p>Modern inventory management with advanced analytics & classy reports</p>
        </header>

        {/* Enhanced Stats */}
        <div className="stats">
          <div className="stat-card">
            <i className="fas fa-boxes"></i>
            <h3>{stats.totalItems}</h3>
            <p>Total Items</p>
            <div className="stat-change">+12% from last month</div>
          </div>
          <div className="stat-card">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>{stats.lowStock}</h3>
            <p>Low Stock</p>
            <div className="stat-change negative">Requires attention</div>
          </div>
          <div className="stat-card">
            <i className="fas fa-times-circle"></i>
            <h3>{stats.outOfStock}</h3>
            <p>Out of Stock</p>
            <div className="stat-change negative">Critical</div>
          </div>
                    <div className="stat-card">
            <i className="fas fa-naira-sign"></i>
            <h3>₦{stats.totalValue.toLocaleString()}</h3>
            <p>Total Value</p>
            <div className="stat-change positive">+8% growth</div>
          </div>
          <div className="stat-card">
            <i className="fas fa-tags"></i>
            <h3>{stats.uniqueCategories}</h3>
            <p>Categories</p>
          </div>
          <div className="stat-card">
            <i className="fas fa-truck"></i>
            <h3>{stats.uniqueSuppliers}</h3>
            <p>Suppliers</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <i className="fas fa-list"></i> Inventory
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="fas fa-chart-bar"></i> Analytics
          </button>
          <button 
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <i className="fas fa-file-alt"></i> Reports
          </button>
        </div>

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <main className="main-content">
            {/* Advanced Controls */}
            <div className="advanced-controls">
              <div className="control-row">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by name, category, SKU, supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <i className="fas fa-search"></i>
                </div>
                
                <div className="filter-controls">
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  
                  <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
                    <option value="all">All Stock Levels</option>
                    <option value="low">Low Stock</option>
                    <option value="medium">Medium Stock</option>
                    <option value="high">High Stock</option>
                  </select>
                  
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Sort by Name</option>
                    <option value="category">Sort by Category</option>
                    <option value="quantity">Sort by Quantity</option>
                    <option value="price">Sort by Price</option>
                    <option value="lastUpdated">Sort by Last Updated</option>
                  </select>
                  
                  <button 
                    className="sort-order-btn"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                  </button>
                </div>
              </div>
              
              <div className="action-controls">
                <div className="view-toggle">
                  <button 
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <i className="fas fa-th"></i>
                  </button>
                  <button 
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    <i className="fas fa-list"></i>
                  </button>
                </div>
                
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                  <i className="fas fa-plus"></i> Add Item
                </button>
                
                {filteredInventory.length > 0 && (
                  <>
                    {ExportToExcel ? (
                      <ExportToExcel 
                        fileName="inventory-report"
                        sheet="inventory"
                        headers={excelHeaders}
                        body={excelData}
                        className="btn btn-secondary"
                      >
                        <i className="fas fa-file-excel"></i> Export Excel
                      </ExportToExcel>
                    ) : null}
                    
                    <button className="btn btn-secondary" onClick={handlePrint}>
                      <i className="fas fa-print"></i> Print
                    </button>
                    
                    <button className="btn btn-danger" onClick={handleBulkDelete}>
                      <i className="fas fa-trash-alt"></i> Bulk Delete
                    </button>
                    
                    <button className="btn btn-info" onClick={exportInventory}>
                      <i className="fas fa-download"></i> Export Backup
                    </button>
                    
                    <label htmlFor="import-file" className="btn btn-info">
                      <i className="fas fa-upload"></i> Import Backup
                      <input
                        id="import-file"
                        type="file"
                        accept=".json"
                        onChange={importInventory}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Inventory Display */}
            <div ref={printRef}>
              {viewMode === 'grid' ? (
                <div className="inventory-grid">
                  {filteredInventory.map(item => {
                    const stockStatus = getStockStatus(item.quantity, item.reorderLevel);
                    const totalValue = item.quantity * item.price;

                    return (
                      <div key={item.id} className="inventory-card">
                        <div className="card-header">
                          <div>
                            <div className="card-title">{item.name}</div>
                            <div className="card-category">{item.category}</div>
                            {item.sku && <div className="card-sku">SKU: {item.sku}</div>}
                          </div>
                          <div className={`stock-status ${stockStatus.class}`}>
                            {stockStatus.text}
                          </div>
                        </div>
                        
                        <div className="card-details">
                          <div className="detail-row">
                            <span><strong>Quantity:</strong></span>
                            <span>{item.quantity}</span>
                          </div>
                          <div className="detail-row">
                            <span><strong>Price:</strong></span>
                            <span>₦{item.price.toFixed(2)}</span>
                          </div>
                          <div className="detail-row">
                            <span><strong>Total Value:</strong></span>
                            <span className="value-highlight">₦{totalValue.toFixed(2)}</span>
                          </div>
                          {item.supplier && (
                            <div className="detail-row">
                              <span><strong>Supplier:</strong></span>
                              <span>{item.supplier}</span>
                            </div>
                          )}
                          {item.description && (
                            <div className="detail-row">
                              <span><strong>Description:</strong></span>
                              <span>{item.description}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span><strong>Reorder Level:</strong></span>
                            <span>{item.reorderLevel || 10}</span>
                          </div>
                        </div>
                        
                        <div className="card-footer">
                          <div className="last-updated">
                            <i className="fas fa-clock"></i>
                            {format(new Date(item.lastUpdated), 'MMM dd, yyyy')}
                          </div>
                          <div className="card-actions">
                            <button className="btn btn-small btn-edit" onClick={() => handleEdit(item)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="btn btn-small btn-delete" onClick={() => handleDelete(item.id)}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="inventory-list">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total Value</th>
                        <th>Supplier</th>
                        <th>Stock Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map(item => {
                        const stockStatus = getStockStatus(item.quantity, item.reorderLevel);
                        const totalValue = item.quantity * item.price;

                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="item-name">
                                <strong>{item.name}</strong>
                                {item.description && (
                                  <small>{item.description}</small>
                                )}
                              </div>
                            </td>
                            <td>{item.category}</td>
                            <td>{item.sku || 'N/A'}</td>
                            <td>{item.quantity}</td>
                            <td>₦{item.price.toFixed(2)}</td>
                            <td className="value-highlight">₦{totalValue.toFixed(2)}</td>
                            <td>{item.supplier || 'N/A'}</td>
                            <td>
                              <span className={`stock-badge ${stockStatus.class}`}>
                                {stockStatus.text}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button className="btn btn-small btn-edit" onClick={() => handleEdit(item)}>
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button className="btn btn-small btn-delete" onClick={() => handleDelete(item.id)}>
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredInventory.length === 0 && (
                <div className="empty-state">
                  <i className="fas fa-box-open"></i>
                  <h3>No inventory items found</h3>
                  <p>{searchTerm || filterCategory !== 'all' || filterStock !== 'all' ? 'Try adjusting your filters' : 'Start by adding your first inventory item'}</p>
                </div>
              )}
            </div>
          </main>
        )}

        {/* Classy Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-content classy-analytics">
            <div className="analytics-controls classy-controls">
              <div className="control-group">
                <label>Time Period:</label>
                <select value={chartTimePeriod} onChange={e => setChartTimePeriod(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="month">Last Month</option>
                  <option value="week">Last Week</option>
                  <option value="day">Today</option>
                </select>
              </div>
              <div className="control-group">
                <label>Chart Type:</label>
                <select value={chartType} onChange={e => setChartType(e.target.value)}>
                  <option value="pie">Pie</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
              </div>
              <div className="control-group">
                <label>Metric:</label>
                <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)}>
                  <option value="count">Item Count</option>
                  <option value="value">Total Value</option>
                  <option value="quantity">Total Quantity</option>
                </select>
              </div>
              <div className="control-group">
                <button
                  className={`btn btn-glow ${showTrendAnalysis ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowTrendAnalysis(!showTrendAnalysis)}
                >
                  <i className="fas fa-chart-line"></i> {showTrendAnalysis ? 'Hide Trends' : 'Show Trends'}
                </button>
              </div>
            </div>
            <div className="charts-grid classy-charts">
              <div className="chart-container main-chart classy-main-chart">
                <div className="chart-header">
                  <h3>
                    {selectedMetric === 'count' ? 'Items by Category' :
                     selectedMetric === 'value' ? 'Value by Category' :
                     'Quantity by Category'}
                  </h3>
                  <div className="chart-actions">
                    <button
                      className="btn btn-small btn-info btn-glow"
                      onClick={() => exportChartData('category')}
                      title="Export Chart Data"
                    >
                      <i className="fas fa-download"></i>
                    </button>
                  </div>
                </div>
                <div className="chart-wrapper classy-chart-wrapper">
                  {chartType === 'pie' && selectedMetric === 'count' && (
                    <Pie data={chartData.categoryCount} options={{ plugins: { legend: { position: 'bottom' } } }} />
                  )}
                  {chartType === 'bar' && selectedMetric === 'count' && (
                    <Bar data={chartData.categoryCount} options={{ plugins: { legend: { display: false } }, borderRadius: 8, backgroundColor: '#6366f1' }} />
                  )}
                  {chartType === 'pie' && selectedMetric === 'value' && (
                    <Pie data={chartData.categoryValue} options={{ plugins: { legend: { position: 'bottom' } } }} />
                  )}
                  {chartType === 'bar' && selectedMetric === 'value' && (
                    <Bar data={chartData.categoryValue} options={{ plugins: { legend: { display: false } }, borderRadius: 8, backgroundColor: '#8b5cf6' }} />
                  )}
                  {chartType === 'line' && (
                    <Bar data={selectedMetric === 'count' ? chartData.categoryCount : chartData.categoryValue} options={{ plugins: { legend: { display: false } }, borderRadius: 8, backgroundColor: '#06b6d4', tension: 0.4 }} />
                  )}
                </div>
              </div>
              {showTrendAnalysis && (
                <div className="chart-container trend-chart classy-trend-chart">
                  <div className="chart-header">
                    <h3>Inventory Value Trend</h3>
                    <div className="chart-actions">
                      <button
                        className="btn btn-small btn-info btn-glow"
                        onClick={() => exportChartData('trend')}
                        title="Export Trend Data"
                      >
                        <i className="fas fa-download"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-wrapper classy-chart-wrapper">
                    <Bar data={getTrendData()} options={{ plugins: { legend: { display: false } }, borderRadius: 8, backgroundColor: '#10b981', tension: 0.4 }} />
                  </div>
                </div>
              )}
              <div className="chart-container full-width classy-summary">
                <h3>Analytics Summary</h3>
                <div className="enhanced-summary-grid">
                  <div className="summary-card">
                    <i className="fas fa-boxes"></i>
                    <h4>Total Items</h4>
                    <p className="summary-number">{stats.totalItems}</p>
                    <div className="metric-detail">{stats.uniqueCategories} categories</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-naira-sign"></i>
                    <h4>Total Value</h4>
                    <p className="summary-number">₦{stats.totalValue.toLocaleString()}</p>
                    <div className="metric-detail">Avg: ₦{getEnhancedStats().averageItemValue.toLocaleString()}</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-exclamation-triangle"></i>
                    <h4>Stock Alerts</h4>
                    <p className="summary-number">{stats.lowStock}</p>
                    <div className="metric-detail">{stats.outOfStock} out of stock</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-chart-line"></i>
                    <h4>Stock Turnover</h4>
                    <p className="summary-number">{getEnhancedStats().stockTurnover}</p>
                    <div className="metric-detail">Inventory efficiency</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-trophy"></i>
                    <h4>Top Category</h4>
                    <p className="summary-number">{getEnhancedStats().topCategory.category}</p>
                    <div className="metric-detail">₦{getEnhancedStats().topCategory.value.toLocaleString()}</div>
                  </div>
                  <div className="summary-card">
                    <i className="fas fa-truck"></i>
                    <h4>Suppliers</h4>
                    <p className="summary-number">{stats.uniqueSuppliers}</p>
                    <div className="metric-detail">Active suppliers</div>
                  </div>
                </div>
              </div>
              <div className="chart-container supplier-chart classy-supplier">
                <h3>Supplier Performance</h3>
                <div className="supplier-list">
                  {getEnhancedStats().supplierStats.map((supplier, index) => (
                    <div key={supplier.supplier} className="supplier-item">
                      <div className="supplier-info">
                        <span className="supplier-name">{supplier.supplier}</span>
                        <span className="supplier-count">{supplier.itemCount} items</span>
                      </div>
                      <div className="supplier-value">₦{supplier.totalValue.toLocaleString()}</div>
                      <div className="supplier-bar">
                        <div
                          className="supplier-bar-fill"
                          style={{ width: `${(supplier.totalValue / Math.max(...getEnhancedStats().supplierStats.map(s => s.totalValue))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-container category-breakdown classy-category">
                <h3>Category Breakdown</h3>
                <div className="category-stats">
                  {categories.map(category => {
                    const categoryItems = inventory.filter(item => item.category === category);
                    const categoryValue = categoryItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    const percentage = stats.totalValue > 0 ? (categoryValue / stats.totalValue) * 100 : 0;
                    return (
                      <div key={category} className="category-stat">
                        <div className="category-info">
                          <span className="category-name">{category}</span>
                          <span className="category-items">{categoryItems.length} items</span>
                        </div>
                        <div className="category-metrics">
                          <span className="category-value">₦{categoryValue.toLocaleString()}</span>
                          <span className="category-percentage">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="category-progress">
                          <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Classy Reports Tab */}
        {activeTab === 'reports' && (
          <div className="reports-content classy-reports">
            <div className="report-section">
              <h3><i className="fas fa-file-alt"></i> Inventory Reports</h3>
              <div className="report-grid classy-report-grid">
                <div className="report-card classy-report-card">
                  <i className="fas fa-file-pdf"></i>
                  <h4>Full Inventory Report</h4>
                  <p>Download a complete, styled inventory report as PDF</p>
                  <button className="btn btn-primary btn-glow" onClick={handlePrint}>
                    <i className="fas fa-download"></i> Generate PDF
                  </button>
                </div>
                <div className="report-card classy-report-card">
                  <i className="fas fa-exclamation-triangle"></i>
                  <h4>Low Stock Report</h4>
                  <p>See and export items that need reordering soon</p>
                  {ExportToExcel ? (
                    <ExportToExcel 
                      fileName="low-stock-report"
                      sheet="low-stock"
                      headers={excelHeaders}
                      body={excelData.filter(item => item.stockStatus.includes('Low') || item.stockStatus.includes('Reorder'))}
                      className="btn btn-warning btn-glow"
                    >
                      <i className="fas fa-file-excel"></i> Export Excel
                    </ExportToExcel>
                  ) : (
                    <button className="btn btn-warning" disabled>
                      <i className="fas fa-file-excel"></i> Export Excel (Not Available)
                    </button>
                  )}
                </div>
                <div className="report-card classy-report-card">
                  <i className="fas fa-chart-line"></i>
                  <h4>Value Analysis</h4>
                  <p>Visualize inventory value by category and supplier</p>
                  <button className="btn btn-primary btn-glow" onClick={() => setActiveTab('analytics')}>
                    <i className="fas fa-chart-bar"></i> View Analytics
                  </button>
                </div>
                <div className="report-card classy-report-card">
                  <i className="fas fa-history"></i>
                  <h4>Activity Log</h4>
                  <p>Recent inventory changes and updates (coming soon)</p>
                  <button className="btn btn-secondary" disabled>
                    <i className="fas fa-clock"></i> Coming Soon
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Modal */}
        {isModalOpen && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <button className="close" onClick={resetForm}>&times;</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="name">Item Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="category">Category *</label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="quantity">Quantity *</label>
                      <input
                        type="number"
                        id="quantity"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        min="0"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="price">Price (₦) *</label>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="sku">SKU</label>
                      <input
                        type="text"
                        id="sku"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="reorderLevel">Reorder Level</label>
                      <input
                        type="number"
                        id="reorderLevel"
                        name="reorderLevel"
                        value={formData.reorderLevel}
                        onChange={handleInputChange}
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="supplier">Supplier</label>
                      <select
                        id="supplier"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(supplier => (
                          <option key={supplier} value={supplier}>{supplier}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="description">Description</label>
                      <input
                        type="text"
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={resetForm}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingItem ? 'Update Item' : 'Add Item'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

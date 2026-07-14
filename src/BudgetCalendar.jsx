import React, { useState, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Trash2, Check, GripVertical, Download, Search, X, Archive, FolderOpen, Eye, Plus, StickyNote, ArrowUpDown, Settings, BarChart3, Tag, Building2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Guarded: createClient('','') throws at import time (would crash all of FreightIQ,
// not just this tab). When the VITE_SUPABASE_* env vars aren't set, `supabase` is
// null → loadData's try/catch trips loadError → the calendar shows its "saves
// disabled" banner (its own safe mode). Set both env vars in Vercel to activate.
const supabase = (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

// ── Categories for auto-categorization (#1) ──
const CATEGORIES = [
  'Fuel', 'Insurance', 'Lease', 'Payroll', 'Office', 'Utilities',
  'Maintenance', 'Software', 'Telecom', 'Storage', 'Loan', 'Tax',
  'Settlement', 'Travel', 'Marketing', 'Other'
];

// Variance threshold — recurring expenses deviating more than this % are flagged (#10)
const VARIANCE_THRESHOLD_PCT = 5;

// Heuristic auto-suggestions used when no prior history exists
const VENDOR_HINTS = {
  fuel: ['fuel', 'gas', 'wex', 'mudflap', 'gasoline', 'diesel'],
  insurance: ['insurance', 'progressive', 'anthem', 'glg', 'manhattan', 'workers comp', 'nis', 'capital group'],
  lease: ['lease', 'tci', 'penske', 'tec', 'mckinney', 'xtra', 'ryder', 'wells fargo', 'cadillac', 'mbfs', 'boa range'],
  payroll: ['payroll', 'colombia'],
  office: ['parking', 'storage', 'rent', 'unifirst', 'ifax'],
  utilities: ['nv energy', 'lvvwd', 'lvwd', 'swgas', 'cox', 'verizon', 'starlink'],
  maintenance: ['maintenance', 'repair'],
  software: ['adobe', 'google', 'samsara', 'sylectus', 'cloneops', 'descartes', 'mycarrier', 'dat', 'zoominfo', 'central dispatch', 'motorola'],
  telecom: ['phone', 'cellular'],
  storage: ['storage on wheels', 'green valley'],
  loan: ['lendr'],
  settlement: ['settlement', 'mortgage'],
};

// Normalize vendor names for matching
const normalizeVendorKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Heuristic category guess from vendor name (used when no learned category)
const heuristicCategory = (name) => {
  const lower = (name || '').toLowerCase();
  for (const [cat, hints] of Object.entries(VENDOR_HINTS)) {
    if (hints.some(h => lower.includes(h))) {
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
  }
  return null;
};

export default function BudgetCalendar() {
  const initialExpenses = [
    { name: "PARKING LOT", amount: 3100.00, day: 10, account: "IOTH SF", id: "exp-1" },
    { name: "TCI", amount: 4000.00, day: 10, account: "IOTH SF", id: "exp-2" },
    { name: "ASCEND", amount: 1902.63, day: 12, account: "AUTO SF", id: "exp-3" },
    { name: "LVWD", amount: 375.00, day: 14, account: "AUTO CE", id: "exp-5" },
    { name: "STORAGE ON WHEELS", amount: 271.00, day: 14, account: "AUTO SF", id: "exp-7" },
    { name: "PENSKE", amount: 7500.00, day: 10, account: "AUTO SF", id: "exp-8" },
    { name: "SYLECTUS", amount: 450.00, day: 15, account: "AUTO CE", id: "exp-9" },
    { name: "TEC", amount: 37000.00, day: 15, account: "SF", id: "exp-10" },
    { name: "WELLS FARGO FORKLIFT", amount: 1228.83, day: 15, account: "AUTO DOCKKT", id: "exp-11" },
    { name: "2025 CADILLAC", amount: 2100.00, day: 18, account: "AUTO J&A", id: "exp-12" },
    { name: "COX", amount: 844.69, day: 18, account: "AUTO SF", id: "exp-13" },
    { name: "DAT", amount: 1480.00, day: 18, account: "AUTO SF", id: "exp-14" },
    { name: "MANHATTAN LIFE", amount: 1400.00, day: 18, account: "SF", id: "exp-15" },
    { name: "VERIZON", amount: 508.30, day: 18, account: "AUTO J&A - CHRIS", id: "exp-16" },
    { name: "NV ENERGY", amount: 1000.00, day: 22, account: "CE - OFFICE", id: "exp-17" },
    { name: "GOOGLE ADS", amount: 220.00, day: 1, account: "AUTO CE", id: "exp-19" },
    { name: "GOOGLE GSUITE", amount: 230.42, day: 1, account: "AUTO CE", id: "exp-20" },
    { name: "GREEN VALLEY STORAGE", amount: 290.00, day: 1, account: "AUTO J&A - CHRIS", id: "exp-21" },
    { name: "SAMSARA", amount: 1533.88, day: 1, account: "AUTO SF", id: "exp-22" },
    { name: "UNIFIRST", amount: 900.00, day: 1, account: "AUTO SF", id: "exp-23" },
    { name: "XTRA", amount: 3000.00, day: 20, account: "AUTO J&A", id: "exp-24" },
    { name: "IFAX", amount: 19.99, day: 21, account: "AUTO CE", id: "exp-25" },
    { name: "SWGAS - RUBY SKY", amount: 100.00, day: 28, account: "CE - CHRIS", id: "exp-26" },
    { name: "SWGAS - MANDALAY", amount: 1200.00, day: 28, account: "CE - CHRIS", id: "exp-27" },
    { name: "ASCEND", amount: 1085.00, day: 23, account: "AUTO CE", id: "exp-28" },
    { name: "NV ENERGY - RUBY SKY", amount: 800.00, day: 20, account: "CE - CHRIS", id: "exp-29" },
    { name: "NV ENERGY - MANDALAY", amount: 800.00, day: 20, account: "CE - CHRIS", id: "exp-30" },
    { name: "STARLINK", amount: 232.00, day: 23, account: "AUTO J&A", id: "exp-31" },
    { name: "DESCARTES", amount: 570.00, day: 25, account: "AUTO WIRE SF", id: "exp-32" },
    { name: "TEC", amount: 4000.00, day: 25, account: "AUTO SF", id: "exp-33" },
    { name: "WORKERS COMP - SF", amount: 5000.00, day: 25, account: "SF", id: "exp-34" },
    { name: "RYDER TRUCKS", amount: 2500.00, day: 25, account: "AUTO SF", id: "exp-46" },
    { name: "NIS GENERAL LIABILITY", amount: 427.00, day: 28, account: "AUTO CE", id: "exp-35" },
    { name: "CARRIER RISK SOLUTIONS", amount: 1000.00, day: 28, account: "SF", id: "exp-36" },
    { name: "MOTOROLA", amount: 2199.50, day: 28, account: "AUTO SF", id: "exp-37" },
    { name: "MCKINNEY", amount: 6000.00, day: 31, account: "SF", id: "exp-38" },
    { name: "MYCARRIER PORTAL", amount: 655.00, day: 3, account: "AUTO WIRE SF", id: "exp-39" },
    { name: "PROGRESSIVE", amount: 599.46, day: 4, account: "AUTO CE", id: "exp-40" },
    { name: "ANTHEM", amount: 4494.97, day: 9, account: "AUTO J&A", id: "exp-41" },
    { name: "CAPITAL GROUP BENEFITS", amount: 1300.00, day: 9, account: "AUTO SF", id: "exp-42" },
    { name: "SETTLEMENT", amount: 6500.00, day: 1, account: "WIRE SYLVESTER & POLEDNAK", id: "exp-44" }
  ];

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [expenses, setExpenses] = useState(initialExpenses);
  const [checkedItems, setCheckedItems] = useState({});
  const [deletedItems, setDeletedItems] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ unpaid: false, overdue: false, dueSoon: false, account: '' });
  const [lastDeleted, setLastDeleted] = useState(null); // { key } — for undo toast
  const [editingAmount, setEditingAmount] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [archivedMonths, setArchivedMonths] = useState({});
  const [viewingArchive, setViewingArchive] = useState(null);
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    name: '', amount: '', account: '', isRecurring: false,
    recurType: 'monthly-date', recurDay: '', recurMonth: '',
    oneTimeDay: '', oneTimeMonth: currentMonth, oneTimeYear: currentYear
  });

  // NEW STATE
  const [notes, setNotes] = useState({});
  const [openNotes, setOpenNotes] = useState({});
  const [editingAccount, setEditingAccount] = useState(null);
  const [editAccountValue, setEditAccountValue] = useState('');
  const [daySort, setDaySort] = useState('default'); // 'default' | 'amount-desc' | 'amount-asc' | 'unchecked-first'
  const [customRecurring, setCustomRecurring] = useState([]); // user-added recurring patterns
  const [recurringOverrides, setRecurringOverrides] = useState([]); // overrides from w_recurring_overrides
  const [showManageRecurring, setShowManageRecurring] = useState(false);

  // ── Improvements: categories, vendor detail, account view, variance ──
  const [vendorCategories, setVendorCategories] = useState({});  // { vendorKey: 'Fuel', ... }
  const [baselineAmounts, setBaselineAmounts] = useState({});    // { vendorKey: 1234.56, ... }
  const [vendorDetailModal, setVendorDetailModal] = useState(null); // { name, vendorKey } or null
  const [showAccountView, setShowAccountView] = useState(false);
  const [categoryStorageMode, setCategoryStorageMode] = useState('local'); // 'local' or 'supabase'
  const [newExpenseCategory, setNewExpenseCategory] = useState('');

  // ── Round 2: year view, quick add, inline rename, variance dashboard ──
  const [showYearView, setShowYearView] = useState(false);
  const [showVarianceDashboard, setShowVarianceDashboard] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(null); // { day, x, y } when clicking a day's "+ quick add"
  const [renamingId, setRenamingId] = useState(null);     // ID of item being renamed
  const [renameValue, setRenameValue] = useState('');
  const [movingKey, setMovingKey] = useState(null);       // itemKey whose "move to day" picker is open

  // ── Load/save safety state ────────────────────────────────────────
  // isLoaded gates auto-save so empty state can't overwrite Supabase on cold
  // load or when a load silently fails. loadError surfaces failures to the UI
  // and blocks saves — a failed load must never be mistaken for "no data."
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Refs mirror what is currently in Supabase for each destructive table.
  // Saves diff (state vs ref) and only write the delta — never "delete all + re-insert."
  // This is what prevents cross-computer races from wiping each other's writes.
  const checkedItemsSyncedRef = useRef(new Set());
  const deletedItemsSyncedRef = useRef(new Set());
  const customRecurringSyncedRef = useRef(new Map()); // id -> row (for change detection)

  // ── Supabase helpers ──────────────────────────────────────────────

  const loadCheckedItems = async (month, year) => {
    // Load current month + adjacent months for overflow days
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    const { data, error } = await supabase
      .from('w_checked_items')
      .select('item_key')
      .or(`and(month.eq.${month},year.eq.${year}),and(month.eq.${prevMonth},year.eq.${prevYear}),and(month.eq.${nextMonth},year.eq.${nextYear})`);
    if (error) throw new Error(`loadCheckedItems: ${error.message}`);
    const keys = (data || []).map(r => r.item_key);
    const map = {};
    keys.forEach(k => { map[k] = true; });
    checkedItemsSyncedRef.current = new Set(keys);
    setCheckedItems(map);
  };

  const loadDeletedItems = async (month, year) => {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    const { data, error } = await supabase
      .from('w_deleted_items')
      .select('item_key')
      .or(`and(month.eq.${month},year.eq.${year}),and(month.eq.${prevMonth},year.eq.${prevYear}),and(month.eq.${nextMonth},year.eq.${nextYear})`);
    if (error) throw new Error(`loadDeletedItems: ${error.message}`);
    const keys = (data || []).map(r => r.item_key);
    const map = {};
    keys.forEach(k => { map[k] = true; });
    deletedItemsSyncedRef.current = new Set(keys);
    setDeletedItems(map);
  };

  const loadNotes = async () => {
    const { data, error } = await supabase.from('w_notes').select('item_key, note');
    if (error) throw new Error(`loadNotes: ${error.message}`);
    const map = {};
    (data || []).forEach(row => { if (row.note) map[row.item_key] = row.note; });
    setNotes(map);
  };

  const loadArchives = async () => {
    const { data, error } = await supabase.from('w_archives').select('month_key, data');
    if (error) throw new Error(`loadArchives: ${error.message}`);
    const map = {};
    (data || []).forEach(row => { map[row.month_key] = row.data; });
    setArchivedMonths(map);
  };

  const loadCustomRecurring = async () => {
    const { data, error } = await supabase.from('w_custom_recurring').select('*');
    if (error) throw new Error(`loadCustomRecurring: ${error.message}`);
    const rows = data || [];
    const syncedMap = new Map();
    rows.forEach(r => {
      syncedMap.set(r.id, {
        id: r.id, name: r.name, amount: parseFloat(r.amount),
        account: r.account, recur_type: r.recur_type, recur_day: r.recur_day
      });
    });
    customRecurringSyncedRef.current = syncedMap;
    setCustomRecurring(rows.map(r => ({
      id: r.id, name: r.name, amount: parseFloat(r.amount),
      account: r.account, recurType: r.recur_type, recurDay: r.recur_day
    })));
  };

  const loadRecurringOverrides = async () => {
    const { data, error } = await supabase.from('w_recurring_overrides').select('*');
    if (error) throw new Error(`loadRecurringOverrides: ${error.message}`);
    setRecurringOverrides(data || []);
  };

  const saveRecurringOverride = async (override) => {
    try {
      await supabase.from('w_recurring_overrides').upsert(override, { onConflict: 'original_id' });
      await loadRecurringOverrides();
    } catch (e) { console.log('Error saving recurring override:', e); }
  };

  const deleteRecurringOverride = async (originalId) => {
    try {
      await supabase.from('w_recurring_overrides').delete().eq('original_id', originalId);
      await loadRecurringOverrides();
    } catch (e) { console.log('Error deleting recurring override:', e); }
  };

  const loadOneTimeExpenses = async () => {
    const { data, error } = await supabase.from('w_one_time_expenses').select('*');
    if (error) throw new Error(`loadOneTimeExpenses: ${error.message}`);
    if (!data || data.length === 0) return;
    const extras = data.map(r => ({
      id: r.id, name: r.name, amount: parseFloat(r.amount),
      day: r.day, account: r.account, month: r.month, year: r.year
    }));
    setExpenses(prev => {
      // Merge: keep initialExpenses + add cloud one-time expenses (avoid duplicates)
      const existingIds = new Set(prev.map(e => e.id));
      const newOnes = extras.filter(e => !existingIds.has(e.id));
      return [...prev, ...newOnes];
    });
  };

  // ── Save helpers (called on state changes) ────────────────────────

  // Extract month/year from an item key (format: "YYYY-M-D-...")
  const getMonthYearFromKey = (key) => {
    const parts = key.split('-');
    if (parts.length >= 3 && !isNaN(parseInt(parts[0]))) {
      return { month: parseInt(parts[1]), year: parseInt(parts[0]) };
    }
    return null;
  };

  // Diff-based save: only writes keys that changed since the last successful
  // load/save. Never "delete month + re-insert" — that pattern wipes other
  // computers' writes in the spillover window.
  const saveCheckedItems = async (items, month, year) => {
    const currentKeys = new Set(Object.keys(items).filter(k => items[k]));
    const synced = checkedItemsSyncedRef.current;
    const toAdd = [...currentKeys].filter(k => !synced.has(k));
    const toRemove = [...synced].filter(k => !currentKeys.has(k));

    if (toRemove.length > 0) {
      const { error } = await supabase.from('w_checked_items').delete().in('item_key', toRemove);
      if (error) throw new Error(`saveCheckedItems.delete: ${error.message}`);
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map(k => {
        const my = getMonthYearFromKey(k);
        return { item_key: k, month: my ? my.month : month, year: my ? my.year : year };
      });
      const { error } = await supabase.from('w_checked_items').upsert(rows, { onConflict: 'item_key' });
      if (error) throw new Error(`saveCheckedItems.upsert: ${error.message}`);
    }
    checkedItemsSyncedRef.current = currentKeys;
  };

  const saveDeletedItems = async (items, month, year) => {
    const currentKeys = new Set(Object.keys(items).filter(k => items[k]));
    const synced = deletedItemsSyncedRef.current;
    const toAdd = [...currentKeys].filter(k => !synced.has(k));
    const toRemove = [...synced].filter(k => !currentKeys.has(k));

    if (toRemove.length > 0) {
      const { error } = await supabase.from('w_deleted_items').delete().in('item_key', toRemove);
      if (error) throw new Error(`saveDeletedItems.delete: ${error.message}`);
    }
    if (toAdd.length > 0) {
      const rows = toAdd.map(k => {
        const my = getMonthYearFromKey(k);
        return { item_key: k, month: my ? my.month : month, year: my ? my.year : year };
      });
      const { error } = await supabase.from('w_deleted_items').upsert(rows, { onConflict: 'item_key' });
      if (error) throw new Error(`saveDeletedItems.upsert: ${error.message}`);
    }
    deletedItemsSyncedRef.current = currentKeys;
  };

  const saveNotes = async (notesMap) => {
    try {
      // Upsert each note
      const rows = Object.entries(notesMap)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => ({ item_key: k, note: v }));
      if (rows.length > 0) {
        await supabase.from('w_notes').upsert(rows, { onConflict: 'item_key' });
      }
    } catch (e) { console.log('Error saving notes:', e); }
  };

  const saveArchives = async (archives) => {
    try {
      const rows = Object.entries(archives).map(([k, v]) => ({ month_key: k, data: v }));
      if (rows.length > 0) {
        await supabase.from('w_archives').upsert(rows, { onConflict: 'month_key' });
      }
    } catch (e) { console.log('Error saving archives:', e); }
  };

  // Diff-based save: delete only IDs we loaded but the user removed, upsert
  // current rows. Never "delete all + re-insert" — that wipes other computers'
  // custom recurrings the moment this computer saves anything.
  const saveCustomRecurring = async (patterns) => {
    const currentIds = new Set(patterns.map(p => p.id));
    const synced = customRecurringSyncedRef.current;
    const toRemove = [...synced.keys()].filter(id => !currentIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await supabase.from('w_custom_recurring').delete().in('id', toRemove);
      if (error) throw new Error(`saveCustomRecurring.delete: ${error.message}`);
    }

    // Upsert only rows that are new or changed vs synced snapshot.
    const toUpsert = patterns.filter(p => {
      const prev = synced.get(p.id);
      if (!prev) return true;
      return (
        prev.name !== p.name ||
        prev.amount !== p.amount ||
        prev.account !== p.account ||
        prev.recur_type !== p.recurType ||
        prev.recur_day !== p.recurDay
      );
    });
    if (toUpsert.length > 0) {
      const rows = toUpsert.map(p => ({
        id: p.id, name: p.name, amount: p.amount,
        account: p.account, recur_type: p.recurType, recur_day: p.recurDay
      }));
      const { error } = await supabase.from('w_custom_recurring').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`saveCustomRecurring.upsert: ${error.message}`);
    }

    // Refresh synced snapshot to match what's now in DB.
    const newSynced = new Map();
    patterns.forEach(p => {
      newSynced.set(p.id, {
        id: p.id, name: p.name, amount: p.amount,
        account: p.account, recur_type: p.recurType, recur_day: p.recurDay
      });
    });
    customRecurringSyncedRef.current = newSynced;
  };

  const saveOneTimeExpense = async (exp) => {
    try {
      await supabase.from('w_one_time_expenses').upsert({
        id: exp.id, name: exp.name, amount: exp.amount,
        day: exp.day, account: exp.account, month: exp.month, year: exp.year
      }, { onConflict: 'id' });
    } catch (e) { console.log('Error saving one-time expense:', e); }
  };

  // ── Categories persistence (#1) ──
  // Tries Supabase first, falls back to localStorage if table doesn't exist.
  const loadVendorCategories = async () => {
    try {
      const { data, error } = await supabase.from('w_categories').select('vendor_key, category');
      if (!error && data) {
        const map = {};
        data.forEach(r => { map[r.vendor_key] = r.category; });
        setVendorCategories(map);
        setCategoryStorageMode('supabase');
        return;
      }
      throw error || new Error('no data');
    } catch (e) {
      // Fall back to localStorage
      try {
        const stored = localStorage.getItem('w_vendor_categories');
        if (stored) setVendorCategories(JSON.parse(stored));
      } catch {}
      setCategoryStorageMode('local');
    }
  };

  const saveVendorCategory = async (vendorKey, vendorName, category) => {
    if (!vendorKey || !category) return;
    setVendorCategories(prev => {
      const next = { ...prev, [vendorKey]: category };
      // Always mirror to localStorage so changes survive even if Supabase write fails
      try { localStorage.setItem('w_vendor_categories', JSON.stringify(next)); } catch {}
      return next;
    });
    if (categoryStorageMode === 'supabase') {
      try {
        await supabase.from('w_categories').upsert({
          vendor_key: vendorKey, vendor_name: vendorName, category, updated_at: new Date().toISOString()
        }, { onConflict: 'vendor_key' });
      } catch (e) {
        console.log('Category save failed, kept in localStorage:', e);
      }
    }
  };

  // ── Baseline amounts for variance tracking (#10) ──
  const loadBaselineAmounts = async () => {
    try {
      const { data, error } = await supabase.from('w_baseline_amounts').select('vendor_key, baseline_amount');
      if (!error && data) {
        const map = {};
        data.forEach(r => { map[r.vendor_key] = parseFloat(r.baseline_amount) || 0; });
        setBaselineAmounts(map);
        return;
      }
      throw error || new Error('no data');
    } catch (e) {
      try {
        const stored = localStorage.getItem('w_baseline_amounts');
        if (stored) setBaselineAmounts(JSON.parse(stored));
      } catch {}
    }
  };

  const saveBaselineAmount = async (vendorKey, vendorName, amount) => {
    if (!vendorKey || !amount) return;
    setBaselineAmounts(prev => {
      const next = { ...prev, [vendorKey]: amount };
      try { localStorage.setItem('w_baseline_amounts', JSON.stringify(next)); } catch {}
      return next;
    });
    try {
      await supabase.from('w_baseline_amounts').upsert({
        vendor_key: vendorKey, vendor_name: vendorName, baseline_amount: amount, updated_at: new Date().toISOString()
      }, { onConflict: 'vendor_key' });
    } catch {}
  };

  // Auto-seed baseline from initialExpenses on first load (only if not already set)
  const autoSeedBaselines = () => {
    const seeded = {};
    initialExpenses.forEach(exp => {
      const k = normalizeVendorKey(exp.name);
      if (k && !baselineAmounts[k] && exp.amount > 0) {
        seeded[k] = exp.amount;
      }
    });
    if (Object.keys(seeded).length > 0) {
      setBaselineAmounts(prev => {
        const next = { ...seeded, ...prev };  // existing values win
        try { localStorage.setItem('w_baseline_amounts', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  // Suggest a category for a vendor name (used when adding new expenses)
  const suggestCategory = (name) => {
    const k = normalizeVendorKey(name);
    if (!k) return null;
    // Direct match
    if (vendorCategories[k]) return vendorCategories[k];
    // Substring match against learned categories
    for (const learnedKey of Object.keys(vendorCategories)) {
      if (learnedKey.length >= 4 && (k.includes(learnedKey) || learnedKey.includes(k))) {
        return vendorCategories[learnedKey];
      }
    }
    // Heuristic fallback
    return heuristicCategory(name);
  };

  // Find historical entries for a vendor across all months (current + archives)
  const getVendorHistory = (vendorName) => {
    const k = normalizeVendorKey(vendorName);
    if (!k) return [];
    const matches = [];

    // Current visible expenses (initial + custom recurring + one-time, all months)
    expenses.forEach(exp => {
      const ek = normalizeVendorKey(exp.name);
      if (ek === k || (k.length >= 4 && (ek.includes(k) || k.includes(ek)))) {
        matches.push({
          name: exp.name,
          amount: exp.amount,
          account: exp.account,
          month: exp.month !== undefined ? exp.month : currentMonth,
          year: exp.year !== undefined ? exp.year : currentYear,
          day: exp.day,
          source: 'current'
        });
      }
    });

    // Archived months
    Object.entries(archivedMonths).forEach(([monthKey, archive]) => {
      (archive.expenses || []).forEach(exp => {
        const ek = normalizeVendorKey(exp.name);
        if (ek === k || (k.length >= 4 && (ek.includes(k) || k.includes(ek)))) {
          matches.push({
            name: exp.name,
            amount: exp.amount,
            account: exp.account,
            month: archive.month,
            year: archive.year,
            day: exp.day,
            source: 'archive'
          });
        }
      });
    });

    return matches.sort((a, b) => {
      const aKey = `${a.year}-${String(a.month).padStart(2, '0')}-${String(a.day || 1).padStart(2, '0')}`;
      const bKey = `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day || 1).padStart(2, '0')}`;
      return aKey.localeCompare(bKey);
    });
  };

  // Compute variance: avg actual amount vs baseline expected (#10)
  const computeVariance = (vendorName) => {
    const k = normalizeVendorKey(vendorName);
    if (!k) return { hasData: false };
    const baseline = baselineAmounts[k];
    if (!baseline || baseline <= 0) return { hasData: false };
    const history = getVendorHistory(vendorName);
    if (history.length < 2) return { hasData: false, baseline };  // need 2+ data points
    const avgActual = history.reduce((s, h) => s + h.amount, 0) / history.length;
    const diff = avgActual - baseline;
    const pct = (diff / baseline) * 100;
    return {
      hasData: true,
      baseline,
      avgActual,
      diff,
      pct,
      flagged: Math.abs(pct) >= VARIANCE_THRESHOLD_PCT,
      count: history.length,
    };
  };

  // Aggregate monthly totals by account (#8)
  const getAccountSubtotals = () => {
    const totals = {};
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayExpenses = getExpensesForDay(day);
      dayExpenses.forEach(exp => {
        const acct = exp.account || 'Unassigned';
        if (!totals[acct]) totals[acct] = { items: 0, total: 0, completed: 0, vendors: new Set() };
        totals[acct].items++;
        totals[acct].total += exp.amount;
        totals[acct].vendors.add(exp.name);
        const itemKey = getItemKey(exp, `${currentYear}-${currentMonth}-${day}`);
        if (checkedItems[itemKey]) totals[acct].completed += exp.amount;
      });
    }
    // Convert vendor sets to counts
    Object.keys(totals).forEach(k => { totals[k].vendorCount = totals[k].vendors.size; delete totals[k].vendors; });
    return totals;
  };

  // ── Year view helpers (#2) ──
  // Compute summary for an arbitrary month/year using current data + archives
  const getMonthSummary = (month, year) => {
    // If archived, use snapshot
    const archive = archivedMonths[`${year}-${month}`];
    if (archive && archive.totals) {
      const total = archive.totals.monthly || 0;
      const paid = archive.totals.completed || 0;
      const overdue = 0; // archived months are historical, not "overdue"
      return { total, paid, overdue, archived: true };
    }
    // Otherwise compute from live data
    const daysInMonth = getDaysInMonth(month, year);
    const today = new Date();
    const todayDay = today.getDate();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
    let total = 0, paid = 0, overdue = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayExps = getExpensesForDay(d, month, year);
      dayExps.forEach(exp => {
        total += exp.amount;
        const k = getItemKey(exp, `${year}-${month}-${d}`);
        if (checkedItems[k]) paid += exp.amount;
        else if (isPastMonth || (isCurrentMonth && d < todayDay)) overdue += exp.amount;
      });
    }
    return { total, paid, overdue, archived: false };
  };

  // Top 10 most-used vendors across all expenses (for quick add #4)
  const getTopVendors = () => {
    const counts = {};
    expenses.forEach(exp => {
      const k = `${exp.name}|${exp.account || ''}`;
      if (!counts[k]) counts[k] = { name: exp.name, account: exp.account || '', amount: exp.amount, count: 0 };
      counts[k].count++;
      counts[k].amount = exp.amount; // last seen amount
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
  };

  // Quick add a one-time expense for a specific day, copying from a top vendor
  const quickAddVendor = (vendor, day) => {
    const newExp = {
      name: vendor.name,
      amount: vendor.amount,
      account: vendor.account,
      day,
      month: currentMonth,
      year: currentYear,
      id: `exp-quick-${Date.now()}`
    };
    setExpenses(prev => [...prev, newExp]);
    saveOneTimeExpense(newExp);
    setQuickAddOpen(null);
  };

  // Inline rename handler (#5)
  const startRename = (id, currentName) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const saveRename = (item) => {
    const newName = (renameValue || '').trim();
    if (!newName || newName === item.name) {
      setRenamingId(null);
      setRenameValue('');
      return;
    }
    if (item.isRecurring) {
      // Save as a recurring override
      saveRecurringOverride({
        original_id: item.originalId || item.id,
        name: newName,
        amount: item.amount,
        account: item.account,
        day: item.day,
        day_of_week: null,
        deleted: false
      });
    } else {
      // Update the one-time expense
      setExpenses(prev => prev.map(e => e.id === item.id ? { ...e, name: newName } : e));
      if (item.id && (item.id.startsWith('exp-new-') || item.id.startsWith('exp-quick-') || item.id.startsWith('moved-') || item.id.startsWith('edited-'))) {
        saveOneTimeExpense({ ...item, name: newName });
      }
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const cancelRename = () => { setRenamingId(null); setRenameValue(''); };

  // ── Variance dashboard data (#8) ──
  // Returns ALL recurring vendors with computed variance, sorted by absolute dollar impact
  const getVarianceReport = () => {
    const seenVendors = new Set();
    const report = [];
    // Walk through every recurring item from initialExpenses + customRecurring
    const recurringSources = [
      ...initialExpenses.map(e => ({ name: e.name, amount: e.amount, account: e.account })),
      ...customRecurring.map(c => ({ name: c.name, amount: c.amount, account: c.account })),
    ];
    recurringSources.forEach(item => {
      const k = normalizeVendorKey(item.name);
      if (!k || seenVendors.has(k)) return;
      seenVendors.add(k);
      const v = computeVariance(item.name);
      if (v.hasData) {
        report.push({
          name: item.name,
          account: item.account || '',
          baseline: v.baseline,
          avgActual: v.avgActual,
          diff: v.diff,
          pct: v.pct,
          flagged: v.flagged,
          count: v.count,
          dollarImpact: Math.abs(v.diff) * 12, // annualized impact
          vendorKey: k,
        });
      }
    });
    return report.sort((a, b) => b.dollarImpact - a.dollarImpact);
  };

  // ── Load saved data on mount ──────────────────────────────────────
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const now = new Date();
        await Promise.all([
          loadCheckedItems(now.getMonth(), now.getFullYear()),
          loadDeletedItems(now.getMonth(), now.getFullYear()),
          loadNotes(),
          loadArchives(),
          loadCustomRecurring(),
          loadOneTimeExpenses(),
          loadRecurringOverrides(),
          loadVendorCategories(),
          loadBaselineAmounts(),
        ]);
        // After baselines load, seed any missing ones from initialExpenses
        autoSeedBaselines();
        setIsLoaded(true);
      } catch (err) {
        console.error('Load failed — blocking saves to protect existing data:', err);
        setLoadError(err && err.message ? err.message : String(err));
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save to Supabase ─────────────────────────────────────────
  // Guarded by isLoaded + loadError: saves are disabled until all initial
  // loads succeed. This is the fix for the "calendar resets with all
  // recurrings back" bug — empty post-mount state can never overwrite DB.
  React.useEffect(() => {
    if (viewingArchive) return;
    if (!isLoaded) return;
    if (loadError) return;
    const timeoutId = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await Promise.all([
          saveCheckedItems(checkedItems, currentMonth, currentYear),
          saveDeletedItems(deletedItems, currentMonth, currentYear),
          saveNotes(notes),
          saveArchives(archivedMonths),
          saveCustomRecurring(customRecurring),
        ]);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error saving data:', error);
        setSaveStatus('error');
      }
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedItems, deletedItems, archivedMonths, notes, customRecurring, viewingArchive, isLoaded, loadError]);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const bankHolidays = {
    2025: [
      { month: 0, day: 1, name: "New Year's Day" },{ month: 0, day: 20, name: "MLK Jr. Day" },
      { month: 1, day: 17, name: "Presidents' Day" },{ month: 4, day: 26, name: "Memorial Day" },
      { month: 5, day: 19, name: "Juneteenth" },{ month: 6, day: 4, name: "Independence Day" },
      { month: 8, day: 1, name: "Labor Day" },{ month: 9, day: 13, name: "Columbus Day" },
      { month: 10, day: 11, name: "Veterans Day" },{ month: 10, day: 27, name: "Thanksgiving" },
      { month: 11, day: 25, name: "Christmas" }
    ],
    2026: [
      { month: 0, day: 1, name: "New Year's Day" },{ month: 0, day: 19, name: "MLK Jr. Day" },
      { month: 1, day: 16, name: "Presidents' Day" },{ month: 4, day: 25, name: "Memorial Day" },
      { month: 5, day: 19, name: "Juneteenth" },{ month: 6, day: 3, name: "Independence Day" },
      { month: 8, day: 7, name: "Labor Day" },{ month: 9, day: 12, name: "Columbus Day" },
      { month: 10, day: 11, name: "Veterans Day" },{ month: 10, day: 26, name: "Thanksgiving" },
      { month: 11, day: 25, name: "Christmas" }
    ]
  };

  const getDayOfWeek = (day, month, year) => new Date(year, month, day).getDay();
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const isBankHoliday = (day, month, year) => {
    const holidays = bankHolidays[year] || [];
    return holidays.find(h => h.month === month && h.day === day);
  };

  // DUE SOON logic
  const isDueSoon = (day) => {
    const today = new Date();
    const isCurrentMonthYear = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    if (!isCurrentMonthYear) return false;
    const todayDay = today.getDate();
    return day > todayDay && day <= todayDay + 3;
  };

  const isOverdue = (day) => {
    const today = new Date();
    const isCurrentMonthYear = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    if (!isCurrentMonthYear) return false;
    return day < today.getDate();
  };

  const getItemKey = (item, date) => {
    // EVERY key includes the date so nothing bleeds across months
    const base = item.id || `${item.name}-${item.amount}`;
    return `${date}-${base}`;
  };

  const toggleCheck = (key) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const deleteItem = (key) => {
    setDeletedItems(prev => ({ ...prev, [key]: true }));
    setLastDeleted({ key }); // surface an Undo (delete is soft; this just re-shows it)
  };
  const undoDelete = () => {
    setLastDeleted(ld => {
      if (ld) setDeletedItems(prev => { const n = { ...prev }; delete n[ld.key]; return n; });
      return null;
    });
  };
  React.useEffect(() => {
    if (!lastDeleted) return;
    const t = setTimeout(() => setLastDeleted(null), 6000);
    return () => clearTimeout(t);
  }, [lastDeleted]);

  // BULK CHECK: check/uncheck all items for a day
  const bulkCheckDay = (day) => {
    const dayExpenses = getExpensesForDay(day);
    const allKeys = dayExpenses.map(exp => getItemKey(exp, `${currentYear}-${currentMonth}-${day}`));
    const allChecked = allKeys.every(k => checkedItems[k]);
    const update = {};
    allKeys.forEach(k => { update[k] = !allChecked; });
    setCheckedItems(prev => ({ ...prev, ...update }));
  };

  const handleDragStart = (e, expense, day, fromMonth, fromYear) => {
    setDraggedItem({ expense, fromDay: day, fromMonth: fromMonth !== undefined ? fromMonth : currentMonth, fromYear: fromYear !== undefined ? fromYear : currentYear });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, day) => {
    if (viewingArchive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(day);
  };

  const handleDragLeave = () => setDragOverDay(null);

  const handleDrop = (e, toDay, toMonth, toYear) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!draggedItem || viewingArchive) return;
    const { expense, fromDay, fromMonth, fromYear } = draggedItem;
    const tM = toMonth !== undefined ? toMonth : currentMonth;
    const tY = toYear !== undefined ? toYear : currentYear;

    // Only allow drag within the same month — cross-month drags cause duplicates
    if (fromMonth !== tM || fromYear !== tY) {
      setDraggedItem(null);
      return;
    }

    if (fromDay !== toDay) {
      // Create a one-time copy at the target day and hide the original
      const newExpense = {
        name: expense.name, amount: expense.amount, account: expense.account,
        day: toDay, isRecurring: false,
        month: tM, year: tY,
        id: `moved-${Date.now()}-${Math.random()}`
      };
      setExpenses(prev => [...prev, newExpense]);
      saveOneTimeExpense(newExpense);
      const itemKey = getItemKey(expense, `${fromYear}-${fromMonth}-${fromDay}`);
      deleteItem(itemKey);
    }
    setDraggedItem(null);
  };

  // Button-based move (alternative to drag): move an item to a chosen day in the
  // same month. Reuses the exact drag semantics — a one-time copy at the target
  // day + hide the original. Same-month only (cross-month drags cause duplicates).
  const moveExpenseToDay = (expense, fromDay, fromMonth, fromYear, toDay) => {
    if (viewingArchive || !toDay || toDay === fromDay) { setMovingKey(null); return; }
    const newExpense = {
      name: expense.name, amount: expense.amount, account: expense.account,
      day: toDay, isRecurring: false,
      month: fromMonth, year: fromYear,
      id: `moved-${Date.now()}-${Math.random()}`
    };
    setExpenses(prev => [...prev, newExpense]);
    saveOneTimeExpense(newExpense);
    const itemKey = getItemKey(expense, `${fromYear}-${fromMonth}-${fromDay}`);
    deleteItem(itemKey);
    setMovingKey(null);
  };

  const getWeekdays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    // Add first week overflow from previous month
    const firstDayOfWeek = getDayOfWeek(1, currentMonth, currentYear);
    if (firstDayOfWeek > 0) {
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevDaysInMonth = getDaysInMonth(prevMonth, prevYear);
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = prevDaysInMonth - i;
        days.push({ day: d, dayOfWeek: getDayOfWeek(d, prevMonth, prevYear), overflow: true, overflowMonth: prevMonth, overflowYear: prevYear });
      }
    }
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ day, dayOfWeek: getDayOfWeek(day, currentMonth, currentYear) });
    }
    // Add last week overflow from next month
    const lastDayOfWeek = getDayOfWeek(daysInMonth, currentMonth, currentYear);
    if (lastDayOfWeek < 6) {
      const nextMo = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYr = currentMonth === 11 ? currentYear + 1 : currentYear;
      for (let d = 1; d <= 6 - lastDayOfWeek; d++) {
        days.push({ day: d, dayOfWeek: getDayOfWeek(d, nextMo, nextYr), overflow: true, overflowMonth: nextMo, overflowYear: nextYr });
      }
    }
    return days;
  };

  const getExpensesForDay = (day, forMonth, forYear) => {
    const m = forMonth !== undefined ? forMonth : currentMonth;
    const y = forYear !== undefined ? forYear : currentYear;
    const baseExpenses = expenses.filter(exp => exp.day === day);
    const dayOfWeek = getDayOfWeek(day, m, y);
    const allExpenses = [...baseExpenses];

    if (day === 1) allExpenses.push({ name: "\u23F0 REMINDER: BILL GOFO", amount: 0, account: "REMINDER", isRecurring: true, id: `rec-1st-gofo-reminder-${day}` });
    if (day === 4) allExpenses.push({ name: "SWGAS - OFFICE", amount: 100.00, account: "AUTO CE", isRecurring: true, id: `rec-4th-swgas-${day}` });
    if (day === 3) allExpenses.push({ name: "CENTRAL DISPATCH", amount: 199.95, account: "AUTO CE", isRecurring: true, id: `rec-3rd-centraldispatch-${day}` });
    if (day === 12) allExpenses.push({ name: "BOA RANGE ROVER", amount: 2025.49, account: "AUTO CE", isRecurring: true, id: `rec-12th-boa-${day}` });
    if (day === 14) allExpenses.push({ name: "MBFS", amount: 1287.92, account: "AUTO SF", isRecurring: true, id: `rec-14th-mbfs-${day}` });
    if (day === 15) {
      allExpenses.push({ name: "NELLY'S PAYROLL", amount: 1000.00, account: "AUTO CE", isRecurring: true, id: `rec-15th-nelly-${day}` });
      allExpenses.push({ name: "\u23F0 REMINDER: BILL GOFO", amount: 0, account: "REMINDER", isRecurring: true, id: `rec-15th-gofo-reminder-${day}` });
      allExpenses.push({ name: "VINIX", amount: 503.05, account: "AUTO CE", isRecurring: true, id: `rec-15th-vinix-${day}` });
    }
    if (day === 17) allExpenses.push({ name: "LVVWD", amount: 375.00, account: "AUTO CE", isRecurring: true, id: `rec-17th-lvvwd-${day}` });
    if (day === 17) allExpenses.push({ name: "ADOBE", amount: 335.86, account: "AUTO SF", isRecurring: true, id: `rec-17th-adobe-${day}` });
    if (day === 19) {
      allExpenses.push({ name: "IPFS (CE INSURANCE)", amount: 3861.45, account: "AUTO CE", isRecurring: true, id: `rec-19th-ipfs-${day}` });
      allExpenses.push({ name: "ATLUS TOYOTA", amount: 3000.00, account: "AUTO SF", isRecurring: true, id: `rec-19th-atlus-${day}` });
    }
    if (day === 21) allExpenses.push({ name: "SAS", amount: 435.00, account: "AUTO J&A", isRecurring: true, id: `rec-21st-sas-${day}` });
    if (day === 25) allExpenses.push({ name: "DAT SOLUTIONS", amount: 2280.00, account: "AUTO SF", isRecurring: true, id: `rec-25th-dat-${day}` });
    if (day === 27) allExpenses.push({ name: "CLONEOPS", amount: 500.00, account: "AUTO CE", isRecurring: true, id: `rec-27th-cloneops-${day}` });
    if (day === 29) allExpenses.push({ name: "ZOOMINFO", amount: 833.33, account: "AUTO CE", isRecurring: true, id: `rec-29th-zoominfo-${day}` });

    if (day === 20) {
      allExpenses.push({ name: "GLG (5SEVEN5 INSURANCE)", amount: 1397.00, account: "AUTO SF", isRecurring: true, id: `rec-20th-glg-${day}` });
      if (m === 0 || m === 3 || m === 6 || m === 9) {
        allExpenses.push({ name: "REPUBLIC SERVICES", amount: 1667.10, account: "AUTO SF", isRecurring: true, id: `rec-20th-republic-${day}` });
      }
    }
    if (dayOfWeek === 2) {
      allExpenses.push({ name: "WEX", amount: 4000.00, account: "", isRecurring: true, id: `rec-tue-wex-${day}` });
      allExpenses.push({ name: "RENT", amount: 5000.00, account: "", isRecurring: true, id: `rec-tue-rent-${day}` });
      allExpenses.push({ name: "ALEX NAHAI", amount: 500.00, account: "AUTO SF", isRecurring: true, id: `rec-tue-alex-${day}` });
    }
    if (dayOfWeek === 3) {
      allExpenses.push({ name: "UTILITY TRAILER", amount: 2520.00, account: "", isRecurring: true, id: `rec-wed-trailer-${day}` });
      allExpenses.push({ name: "MUDFLAP", amount: 2000.00, account: "", isRecurring: true, id: `rec-wed-mud-${day}` });
      allExpenses.push({ name: "COLOMBIA PAYROLL", amount: 1850.00, account: "AUTO CE", isRecurring: true, id: `rec-wed-colombia-${day}` });
      allExpenses.push({ name: "MCKINNEY TRAILERS", amount: 2500.00, account: "SF", isRecurring: true, id: `rec-wed-mckinney-${day}` });
      allExpenses.push({ name: "LENDR", amount: 2658.73, account: "AUTO SF", isRecurring: true, id: `rec-wed-lendr-${day}` });
    }
    if (dayOfWeek === 4) {
      const startDate = new Date(2026, 1, 12);
      const currentDate = new Date(y, m, day);
      const daysDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff % 14 === 0) {
        allExpenses.push({ name: "CHRIS MORTGAGE", amount: 8150.37, account: "", isRecurring: true, id: `rec-thu-mortgage-${day}` });
      }
    }
    if (dayOfWeek === 5) {
      allExpenses.push({ name: "DRIVER PAYROLL SUBMISSION", amount: 40000.00, account: "", isRecurring: true, id: `rec-fri-driver-${day}` });
      allExpenses.push({ name: "OFFICE PAYROLL SUBMISSION", amount: 30000.00, account: "", isRecurring: true, id: `rec-fri-office-${day}` });
      allExpenses.push({ name: "WEX", amount: 4000.00, account: "", isRecurring: true, id: `rec-fri-${day}` });
    }

    // USER-ADDED custom recurring patterns
    customRecurring.forEach(pattern => {
      let matches = false;
      if (pattern.recurType === 'monthly-date') {
        matches = day === parseInt(pattern.recurDay);
      } else if (pattern.recurType === 'weekly-day') {
        matches = dayOfWeek === parseInt(pattern.recurDay);
      }
      if (matches) {
        allExpenses.push({
          name: pattern.name,
          amount: parseFloat(pattern.amount),
          account: pattern.account,
          isRecurring: true,
          id: `custom-${pattern.id}-${day}`
        });
      }
    });

    // Apply recurring overrides
    const overrideMap = {};
    recurringOverrides.forEach(ov => { overrideMap[ov.original_id] = ov; });

    // Filter out deleted overrides and apply field changes
    const withOverrides = allExpenses.map(exp => {
      // Match by base id pattern (strip the trailing -${day} suffix for recurring items)
      const baseId = exp.id ? exp.id.replace(/-\d+$/, '') : null;
      const override = overrideMap[exp.id] || (baseId ? overrideMap[baseId] : null);
      if (!override) return exp;
      if (override.deleted) return null; // skip deleted
      // For monthly items, check if day was changed
      if (override.day !== null && override.day !== undefined && !exp.id?.match(/^rec-(tue|wed|thu|fri|sat|sun|mon)-/)) {
        if (exp.day !== undefined && override.day !== day) return null; // moved to different day
      }
      // For weekly items, check if day_of_week was changed
      if (override.day_of_week !== null && override.day_of_week !== undefined && exp.id?.match(/^rec-(tue|wed|thu|fri|sat|sun|mon)-/)) {
        if (override.day_of_week !== dayOfWeek) return null; // moved to different weekday
      }
      return {
        ...exp,
        amount: override.amount !== null && override.amount !== undefined ? parseFloat(override.amount) : exp.amount,
        account: override.account !== null && override.account !== undefined ? override.account : exp.account,
      };
    }).filter(Boolean);

    // Also add items whose day was changed TO this day
    recurringOverrides.forEach(ov => {
      if (ov.deleted) return;
      if (ov.day !== null && ov.day !== undefined && ov.day === day) {
        // Find if original is an initialExpenses item or hardcoded recurring
        const alreadyHere = withOverrides.some(e => {
          const bid = e.id ? e.id.replace(/-\d+$/, '') : null;
          return e.id === ov.original_id || bid === ov.original_id;
        });
        if (!alreadyHere) {
          // Look up the original to clone it
          const origFromInit = expenses.find(e => e.id === ov.original_id);
          if (origFromInit) {
            withOverrides.push({
              ...origFromInit,
              day: ov.day,
              amount: ov.amount !== null && ov.amount !== undefined ? parseFloat(ov.amount) : origFromInit.amount,
              account: ov.account !== null && ov.account !== undefined ? ov.account : origFromInit.account,
            });
          }
        }
      }
    });

    let filtered = withOverrides.filter(exp => {
      const itemKey = getItemKey(exp, `${y}-${m}-${day}`);
      const isDeleted = deletedItems[itemKey];
      const matchesSearch = searchTerm === '' ||
        exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.account || '').toLowerCase().includes(searchTerm.toLowerCase());
      const isWrongMonth = exp.month !== undefined &&
        (exp.month !== m || exp.year !== y);
      if (isDeleted || !matchesSearch || isWrongMonth) return false;
      // operational filters (unpaid / overdue / due-next-7 / account)
      const checked = !!checkedItems[itemKey];
      if (filters.unpaid && checked) return false;
      if (filters.overdue && (!isOverdue(day) || checked)) return false;
      if (filters.account && (exp.account || '') !== filters.account) return false;
      if (filters.dueSoon) {
        const dt = new Date(y, m, day); dt.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in7 = new Date(today); in7.setDate(today.getDate() + 7);
        if (dt < today || dt > in7) return false;
      }
      return true;
    });

    // SORT
    if (daySort === 'amount-desc') {
      filtered = [...filtered].sort((a, b) => b.amount - a.amount);
    } else if (daySort === 'amount-asc') {
      filtered = [...filtered].sort((a, b) => a.amount - b.amount);
    } else if (daySort === 'unchecked-first') {
      filtered = [...filtered].sort((a, b) => {
        const aKey = getItemKey(a, `${currentYear}-${currentMonth}-${day}`);
        const bKey = getItemKey(b, `${currentYear}-${currentMonth}-${day}`);
        const aChecked = checkedItems[aKey] ? 1 : 0;
        const bChecked = checkedItems[bKey] ? 1 : 0;
        return aChecked - bChecked;
      });
    }

    return filtered;
  };

  const getDayTotal = (day, forMonth, forYear) => getExpensesForDay(day, forMonth, forYear).reduce((sum, exp) => sum + exp.amount, 0);

  const getDayPendingTotal = (day, forMonth, forYear) => {
    const m = forMonth !== undefined ? forMonth : currentMonth;
    const y = forYear !== undefined ? forYear : currentYear;
    return getExpensesForDay(day, m, y).reduce((sum, exp) => {
      const itemKey = getItemKey(exp, `${y}-${m}-${day}`);
      return checkedItems[itemKey] ? sum : sum + exp.amount;
    }, 0);
  };

  const getWeekTotal = (weekDays) => weekDays.reduce((sum, d) => {
    const m = d.overflow ? d.overflowMonth : currentMonth;
    const y = d.overflow ? d.overflowYear : currentYear;
    return sum + getDayPendingTotal(d.day, m, y);
  }, 0);

  // Safe month navigation: flush any pending debounced changes first, then
  // block saves during load (so empty-state interim can't diff-wipe the old
  // month), then load. If either step fails, surface it and stop — never
  // silently lose data.
  const navigateToMonth = async (newMonth, newYear) => {
    setIsLoaded(false);
    setSaveStatus('saving');
    try {
      // Flush current month's pending edits before navigating. The debounced
      // effect might still be waiting to fire; calling explicitly is idempotent
      // (diff-based save returns no-op if nothing changed).
      await Promise.all([
        saveCheckedItems(checkedItems, currentMonth, currentYear),
        saveDeletedItems(deletedItems, currentMonth, currentYear),
      ]);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Flush before nav failed:', err);
      setSaveStatus('error');
      setLoadError(`Could not save current month before navigating: ${err.message || err}. Refresh the page.`);
      return;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    try {
      await Promise.all([
        loadCheckedItems(newMonth, newYear),
        loadDeletedItems(newMonth, newYear),
      ]);
      setIsLoaded(true);
    } catch (err) {
      console.error('Load on nav failed:', err);
      setLoadError(err && err.message ? err.message : String(err));
    }
  };

  const nextMonth = () => {
    const newMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const newYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    navigateToMonth(newMonth, newYear);
  };

  const prevMonth = () => {
    const newMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const newYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    navigateToMonth(newMonth, newYear);
  };

  const weekdays = getWeekdays();
  const weeks = [];
  let currentWeek = [];
  weekdays.forEach((d, idx) => {
    currentWeek.push(d);
    if (d.dayOfWeek === 6 || idx === weekdays.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  const getMonthlyTotal = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) total += getDayTotal(day);
    return total;
  };

  const getCompletedTotal = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      getExpensesForDay(day).forEach(exp => {
        const itemKey = getItemKey(exp, `${currentYear}-${currentMonth}-${day}`);
        if (checkedItems[itemKey]) total += exp.amount;
      });
    }
    return total;
  };

  const getPendingTotal = () => getMonthlyTotal() - getCompletedTotal();

  const getItemCounts = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    let total = 0, completed = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const exps = getExpensesForDay(day);
      total += exps.length;
      exps.forEach(exp => {
        const itemKey = getItemKey(exp, `${currentYear}-${currentMonth}-${day}`);
        if (checkedItems[itemKey]) completed++;
      });
    }
    return { total, completed };
  };

  // Scope bulk clears to the CURRENT month only. State holds spillover keys
  // from prev/next month too; wiping them here would make diff-save delete
  // other months' rows from Supabase.
  const clearCompleted = () => {
    const toClearCount = Object.keys(checkedItems).filter(key => {
      if (!checkedItems[key]) return false;
      const my = getMonthYearFromKey(key);
      return my && my.month === currentMonth && my.year === currentYear;
    }).length;
    if (toClearCount === 0) {
      alert('Nothing to clear — no completed items in this month.');
      return;
    }
    if (!window.confirm(`Mark ${toClearCount} completed item${toClearCount === 1 ? '' : 's'} as deleted for ${monthNames[currentMonth]} ${currentYear}?`)) return;
    const newDeleted = { ...deletedItems };
    const newChecked = {};
    Object.keys(checkedItems).forEach(key => {
      if (!checkedItems[key]) return;
      const my = getMonthYearFromKey(key);
      const isCurrent = my && my.month === currentMonth && my.year === currentYear;
      if (isCurrent) {
        newDeleted[key] = true;
      } else {
        newChecked[key] = true; // preserve spillover
      }
    });
    setDeletedItems(newDeleted);
    setCheckedItems(newChecked);
  };

  const resetMonth = () => {
    if (!window.confirm('Reset all checks and deletions for this month?')) return;
    const keepNonCurrent = (map) => {
      const out = {};
      Object.keys(map).forEach(key => {
        if (!map[key]) return;
        const my = getMonthYearFromKey(key);
        if (!my || my.month !== currentMonth || my.year !== currentYear) {
          out[key] = true; // preserve spillover months
        }
      });
      return out;
    };
    setCheckedItems(keepNonCurrent(checkedItems));
    setDeletedItems(keepNonCurrent(deletedItems));
  };

  const startEditAmount = (itemKey, currentAmount) => {
    setEditingAmount(itemKey);
    setEditValue(currentAmount.toString());
  };

  const saveEditAmount = (expense, day) => {
    const newAmount = parseFloat(editValue);
    if (isNaN(newAmount) || newAmount < 0) { setEditingAmount(null); return; }
    if (expense.isRecurring) {
      const newExpense = {
        name: expense.name, amount: newAmount, account: expense.account,
        day, isRecurring: false,
        month: currentMonth, year: currentYear,
        id: `edited-${Date.now()}-${Math.random()}`
      };
      setExpenses(prev => [...prev, newExpense]);
      saveOneTimeExpense(newExpense);
      deleteItem(getItemKey(expense, `${currentYear}-${currentMonth}-${day}`));
    } else {
      setExpenses(prev => prev.map(exp => exp.id === expense.id ? { ...exp, amount: newAmount } : exp));
      // Any non-recurring expense with an id is a one-time row — upsert so the edit STICKS.
      // (Previously missed quick-add ids `exp-quick-*`, so those edits silently reverted on reload.)
      if (expense.id) {
        saveOneTimeExpense({ ...expense, amount: newAmount });
      }
    }
    setEditingAmount(null);
    setEditValue('');
  };

  const cancelEditAmount = () => { setEditingAmount(null); setEditValue(''); };

  // EDITABLE ACCOUNT
  const startEditAccount = (itemKey, currentAccount) => {
    setEditingAccount(itemKey);
    setEditAccountValue(currentAccount || '');
  };

  const saveEditAccount = (expense, day) => {
    if (expense.isRecurring) {
      const newExpense = {
        name: expense.name, amount: expense.amount, account: editAccountValue,
        day, isRecurring: false,
        month: currentMonth, year: currentYear,
        id: `edited-acct-${Date.now()}-${Math.random()}`
      };
      setExpenses(prev => [...prev, newExpense]);
      saveOneTimeExpense(newExpense);
      deleteItem(getItemKey(expense, `${currentYear}-${currentMonth}-${day}`));
    } else {
      setExpenses(prev => prev.map(exp => exp.id === expense.id ? { ...exp, account: editAccountValue } : exp));
      if (expense.id) {
        saveOneTimeExpense({ ...expense, account: editAccountValue });
      }
    }
    setEditingAccount(null);
    setEditAccountValue('');
  };

  const cancelEditAccount = () => { setEditingAccount(null); setEditAccountValue(''); };

  // NOTES
  const toggleNoteOpen = (itemKey) => {
    setOpenNotes(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  const updateNote = (itemKey, value) => {
    setNotes(prev => ({ ...prev, [itemKey]: value }));
  };

  const archiveCurrentMonth = () => {
    const monthKey = `${currentYear}-${currentMonth}`;
    const archiveData = {
      month: currentMonth, year: currentYear, monthName: monthNames[currentMonth],
      checkedItems: { ...checkedItems }, deletedItems: { ...deletedItems },
      expenses: [...expenses], archivedDate: new Date().toISOString(),
      totals: { monthly: getMonthlyTotal(), completed: getCompletedTotal(), pending: getPendingTotal() }
    };
    setArchivedMonths(prev => ({ ...prev, [monthKey]: archiveData }));
    alert(`${monthNames[currentMonth]} ${currentYear} has been archived!`);
  };

  const viewArchive = (monthKey) => {
    const archive = archivedMonths[monthKey];
    if (archive) {
      setViewingArchive(monthKey);
      setCurrentMonth(archive.month);
      setCurrentYear(archive.year);
      setCheckedItems(archive.checkedItems);
      setDeletedItems(archive.deletedItems);
      setExpenses(archive.expenses);
      setShowArchiveList(false);
    }
  };

  const exitArchiveView = async () => {
    // Block saves during the transition. Archive view replaced state with
    // archived data but left synced refs pointing at live data — if saves ran
    // with empty state mid-transition, diff would wipe the live rows.
    setIsLoaded(false);
    setViewingArchive(null);
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    setExpenses(initialExpenses);
    try {
      await Promise.all([
        loadCheckedItems(now.getMonth(), now.getFullYear()),
        loadDeletedItems(now.getMonth(), now.getFullYear()),
        loadOneTimeExpenses(),
      ]);
      setIsLoaded(true);
    } catch (err) {
      console.error('Exit archive reload failed:', err);
      setLoadError(err && err.message ? err.message : String(err));
    }
  };

  const getArchivedMonthsList = () =>
    Object.keys(archivedMonths).sort().reverse().map(key => ({ key, ...archivedMonths[key] }));

  const addNewExpense = () => {
    const { name, amount, account, isRecurring, recurType, recurDay, oneTimeDay } = newExpenseForm;

    if (!name.trim() || !amount || !account.trim()) {
      alert('Please fill in Name, Amount, and Account'); return;
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      alert('Please enter a valid amount'); return;
    }

    // Persist category mapping for future auto-categorization (#1)
    const vendorKey = normalizeVendorKey(name);
    if (newExpenseCategory && vendorKey) {
      saveVendorCategory(vendorKey, name.trim(), newExpenseCategory);
    }
    // Remember baseline amount for variance tracking (#10)
    if (isRecurring && vendorKey) {
      saveBaselineAmount(vendorKey, name.trim(), parseFloat(amount));
    }

    if (isRecurring) {
      if (!recurDay && recurDay !== 0) {
        alert(recurType === 'monthly-date' ? 'Please enter the day of month' : 'Please select a day of week'); return;
      }
      if (recurType === 'monthly-date') {
        const d = parseInt(recurDay);
        if (isNaN(d) || d < 1 || d > 31) { alert('Day of month must be between 1 and 31'); return; }
      }
      const pattern = {
        id: `cr-${Date.now()}`,
        name: name.trim(),
        amount: parseFloat(amount),
        account: account.trim(),
        recurType,
        recurDay: parseInt(recurDay),
      };
      setCustomRecurring(prev => [...prev, pattern]);
    } else {
      const d = parseInt(oneTimeDay);
      if (!oneTimeDay || isNaN(d) || d < 1 || d > 31) {
        alert('Please enter a valid day of month (1-31)'); return;
      }
      const newExp = {
        name: name.trim(),
        amount: parseFloat(amount),
        account: account.trim(),
        day: d,
        month: currentMonth,
        year: currentYear,
        id: `exp-new-${Date.now()}`
      };
      setExpenses(prev => [...prev, newExp]);
      saveOneTimeExpense(newExp);
    }

    setNewExpenseForm({
      name: '', amount: '', account: '', isRecurring: false,
      recurType: 'monthly-date', recurDay: '',
      oneTimeDay: '', oneTimeMonth: currentMonth, oneTimeYear: currentYear
    });
    setNewExpenseCategory('');
    setShowAddExpenseModal(false);
  };

  const deleteCustomRecurring = (id) => {
    setCustomRecurring(prev => prev.filter(p => p.id !== id));
  };

  const generatePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to export PDF'); return; }
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    let html = `<!DOCTYPE html><html><head><title>${monthNames[currentMonth]} ${currentYear} Expense Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{text-align:center;color:#333}
    .summary{background:#f0f0f0;padding:15px;margin:20px 0;border-radius:8px}
    .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}
    .summary-box{text-align:center}.summary-label{font-size:12px;color:#666}
    .summary-value{font-size:20px;font-weight:bold;color:#333}
    .week{margin-bottom:30px;page-break-inside:avoid}
    .week-header{background:#4CAF50;color:white;padding:10px;font-weight:bold;margin-bottom:10px}
    .days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}
    .day{border:1px solid #ddd;padding:10px;min-height:150px}
    .day-header{font-weight:bold;border-bottom:2px solid #333;padding-bottom:5px;margin-bottom:10px}
    .expense{margin:5px 0;padding:5px;background:#f9f9f9;border-left:3px solid #2196F3}
    .expense.completed{background:#e8f5e9;border-left-color:#4CAF50;text-decoration:line-through}
    .expense.recurring{border-left-color:#9C27B0}
    .expense-name{font-weight:bold;font-size:11px}.expense-amount{color:#4CAF50;font-weight:bold;font-size:11px}
    .expense-account{color:#666;font-size:10px}.expense-notes{color:#999;font-size:9px;font-style:italic}
    .day-total{margin-top:10px;padding-top:5px;border-top:2px solid #333;font-weight:bold;color:#2196F3;font-size:12px}
    .weekend{background:#f5f5f5}.holiday{background:#fff9c4}
    @media print{.week{page-break-inside:avoid}}</style></head><body>
    <h1>${monthNames[currentMonth]} ${currentYear} Expense Report</h1>
    <div class="summary"><div class="summary-grid">
    <div class="summary-box"><div class="summary-label">Monthly Total</div><div class="summary-value">$${getMonthlyTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
    <div class="summary-box"><div class="summary-label">Completed</div><div class="summary-value">$${getCompletedTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
    <div class="summary-box"><div class="summary-label">Pending</div><div class="summary-value">$${getPendingTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
    </div></div>`;
    weeks.forEach((week, weekIdx) => {
      html += `<div class="week"><div class="week-header">Week ${weekIdx + 1} - Total: $${getWeekTotal(week).toLocaleString('en-US',{minimumFractionDigits:2})}</div><div class="days-grid">`;
      dayNames.forEach((dayName, dayIdx) => {
        const dayData = week.find(d => d.dayOfWeek === dayIdx);
        const day = dayData?.day;
        const holiday = day ? isBankHoliday(day, currentMonth, currentYear) : null;
        const isWeekend = dayIdx === 0 || dayIdx === 6;
        html += `<div class="day ${isWeekend?'weekend':''} ${holiday?'holiday':''}">`;
        html += `<div class="day-header">${dayName}${day?` ${day}`:''}${holiday?`<br><span style="color:#F57C00;font-size:10px">${holiday.name}</span>`:''}</div>`;
        if (day) {
          getExpensesForDay(day).forEach(exp => {
            const itemKey = getItemKey(exp, `${currentYear}-${currentMonth}-${day}`);
            const isChecked = checkedItems[itemKey];
            const note = notes[itemKey];
            html += `<div class="expense ${isChecked?'completed':''} ${exp.isRecurring?'recurring':''}">`;
            html += `<div class="expense-name">${exp.name}</div>`;
            html += `<div class="expense-amount">$${exp.amount.toLocaleString('en-US',{minimumFractionDigits:2})}</div>`;
            if (exp.account) html += `<div class="expense-account">${exp.account}</div>`;
            if (note) html += `<div class="expense-notes">\uD83D\uDCDD ${note}</div>`;
            html += `</div>`;
          });
          html += `<div class="day-total">Total: $${getDayTotal(day).toLocaleString('en-US',{minimumFractionDigits:2})}</div>`;
        }
        html += `</div>`;
      });
      html += `</div></div>`;
    });
    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const sortOptions = [
    { value: 'default', label: 'Default Order' },
    { value: 'amount-desc', label: 'Amount: High \u2192 Low' },
    { value: 'amount-asc', label: 'Amount: Low \u2192 High' },
    { value: 'unchecked-first', label: 'Unpaid First' },
  ];

  // Safety net: if the Supabase client couldn't be created (env vars unset),
  // don't render the interactive calendar — edits would appear on screen and
  // silently fail to persist. Show a clear message instead. (All hooks above
  // have already run, so this early return is Rules-of-Hooks safe.)
  if (!supabase) return (
    <div className="budget-root" style={{ padding: 24, fontFamily: "system-ui,sans-serif", color: "#b91c1c", fontSize: 14 }}>
      <b>Budget Calendar isn't configured.</b> Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel and redeploy. Editing is disabled until then so nothing is lost.
    </div>
  );
  return (
    <div className="budget-root">
      {lastDeleted && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 16px", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.4)", zIndex: 9999, display: "flex", alignItems: "center", gap: 14, fontSize: 14 }}>
          Expense deleted
          <button onClick={undoDelete} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 5, padding: "5px 12px", fontWeight: 700, cursor: "pointer" }}>Undo</button>
        </div>
      )}
    <div className="w-full min-h-screen bg-gray-50 p-3">
      <div className="max-w-full mx-auto bg-slate-100 rounded-lg shadow-lg p-3">

        {/* LOAD ERROR BANNER — shown when a load failed. Saves are disabled
            while this is visible so empty state can't overwrite existing data. */}
        {loadError && (
          <div className="mb-3 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-red-800">Data load failed {'—'} saves disabled</div>
                <div className="text-sm text-red-700 mt-1">
                  Do not make changes. Refresh the page to retry. If this persists, check your internet connection.
                </div>
                <div className="text-xs text-red-600 font-mono mt-1">{loadError}</div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
        {saveStatus === 'error' && !loadError && (
          <div style={{ position: "sticky", top: 0, zIndex: 50 }} className="mb-3 p-3 bg-red-600 text-white rounded-lg flex items-center gap-3 shadow-lg">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1 text-sm font-semibold">A change didn't save — your last edit may not be stored. Check your connection, then reload to see the true state.</div>
            <button onClick={() => window.location.reload()} className="px-3 py-1.5 bg-white text-red-700 rounded text-sm font-bold">Reload</button>
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">Expense Calendar</h1>
            <div className="flex items-center gap-2 text-xs">
              {!isLoaded && !loadError && <span className="text-blue-600">{'⏳'} Loading...</span>}
              {isLoaded && saveStatus === 'saving' && <span className="text-orange-600">{'\uD83D\uDCBE'} Saving...</span>}
              {isLoaded && saveStatus === 'saved' && <span className="text-green-600">{'\u2713'} Saved</span>}
              {isLoaded && saveStatus === 'error' && <span className="text-red-600">{'\u26A0\uFE0F'} Save Error</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!viewingArchive && (
              <>
                <button onClick={() => setShowAddExpenseModal(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Quick Add
                </button>
                <button onClick={() => setShowYearView(true)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Year View
                </button>
                <button onClick={() => setShowVarianceDashboard(true)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Variance
                </button>
                <button onClick={() => setShowAccountView(true)} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> By Account
                </button>
                <button onClick={() => setShowManageRecurring(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Settings className="w-4 h-4" /> Manage Recurring
                </button>
                <button onClick={archiveCurrentMonth} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Archive className="w-4 h-4" /> Archive
                </button>
                <button onClick={() => setShowArchiveList(!showArchiveList)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4" /> Archives ({Object.keys(archivedMonths).length})
                </button>
              </>
            )}
            {viewingArchive && (
              <button onClick={exitArchiveView} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Exit Archive
              </button>
            )}
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-lg font-bold text-gray-800 min-w-[180px] text-center">{monthNames[currentMonth]} {currentYear}</div>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* ARCHIVE BANNER */}
        {viewingArchive && (
          <div className="mb-3 p-3 bg-purple-100 border-2 border-purple-400 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-purple-700" />
                <div>
                  <div className="font-bold text-purple-900">Viewing Archived Month</div>
                  <div className="text-sm text-purple-700">Archived on {new Date(archivedMonths[viewingArchive].archivedDate).toLocaleString()}</div>
                </div>
              </div>
              <button onClick={exitArchiveView} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium">Return to Current Month</button>
            </div>
          </div>
        )}

        {/* ARCHIVE LIST */}
        {showArchiveList && !viewingArchive && (
          <div className="mb-3 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Archived Months</h3>
              <button onClick={() => setShowArchiveList(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            {getArchivedMonthsList().length === 0 ? (
              <div className="text-gray-500 text-center py-4">No archived months yet</div>
            ) : (
              <div className="space-y-2">
                {getArchivedMonthsList().map(archive => (
                  <div key={archive.key} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{archive.monthName} {archive.year}</div>
                      <div className="text-sm text-gray-600">
                        Total: ${archive.totals.monthly.toLocaleString('en-US',{minimumFractionDigits:2})} | Paid: ${archive.totals.completed.toLocaleString('en-US',{minimumFractionDigits:2})} | Pending: ${archive.totals.pending.toLocaleString('en-US',{minimumFractionDigits:2})}
                      </div>
                      <div className="text-xs text-gray-500">Archived: {new Date(archive.archivedDate).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => viewArchive(archive.key)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center gap-1.5">
                      <Eye className="w-4 h-4" /> View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH + SORT + EXPORT */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search expenses by name or account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* SORT SELECTOR */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <select
              value={daySort}
              onChange={(e) => setDaySort(e.target.value)}
              className="py-1.5 px-2 text-sm border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
            >
              {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={generatePDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>

        {/* FILTERS */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase">Filter</span>
          {[{ k: 'unpaid', label: 'Unpaid' }, { k: 'overdue', label: 'Overdue' }, { k: 'dueSoon', label: 'Due ≤ 7 days' }].map(f => (
            <button key={f.k} onClick={() => setFilters(s => ({ ...s, [f.k]: !s[f.k] }))}
              className={`px-3 py-1 text-sm rounded-full border-2 font-medium ${filters[f.k] ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>
              {f.label}
            </button>
          ))}
          <select value={filters.account} onChange={(e) => setFilters(s => ({ ...s, account: e.target.value }))}
            className={`py-1 px-2 text-sm rounded-full border-2 bg-white ${filters.account ? 'border-blue-600 text-blue-700 font-medium' : 'border-gray-300 text-gray-600'}`}>
            <option value="">All accounts</option>
            {[...new Set(initialExpenses.map(e => e.account).filter(Boolean))].sort().map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {(filters.unpaid || filters.overdue || filters.dueSoon || filters.account) && (
            <button onClick={() => setFilters({ unpaid: false, overdue: false, dueSoon: false, account: '' })}
              className="px-3 py-1 text-sm rounded-full text-red-600 hover:bg-red-50 font-medium">✕ Clear filters</button>
          )}
        </div>

        {/* SUMMARY */}
        <div className="mb-3 grid grid-cols-4 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-xs text-gray-600 mb-1">Monthly Total</div>
            <div className="text-lg font-bold text-gray-800">${getMonthlyTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            <div className="text-xs text-gray-500 mt-1">{getItemCounts().total} items</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-xs text-gray-600 mb-1">Completed</div>
            <div className="text-lg font-bold text-green-700">${getCompletedTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            <div className="text-xs text-gray-500 mt-1">{getItemCounts().completed} of {getItemCounts().total} items</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <div className="text-xs text-gray-600 mb-1">Pending</div>
            <div className="text-lg font-bold text-orange-700">${getPendingTotal().toLocaleString('en-US',{minimumFractionDigits:2})}</div>
            <div className="text-xs text-gray-500 mt-1">{getItemCounts().total - getItemCounts().completed} items left</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg flex flex-col gap-2">
            {!viewingArchive ? (
              <>
                <button onClick={clearCompleted} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium">Clear Completed</button>
                <button onClick={resetMonth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium">Reset Month</button>
              </>
            ) : (
              <div className="text-xs text-center text-gray-500 py-2">Read-only<br/>Archive View</div>
            )}
          </div>
        </div>

        {/* TIPS */}
        <div className="mb-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
            <strong>{'\uD83D\uDCA1'} Tips:</strong>
            <span>{'\u2713'} Check = paid</span>
            <span>{'\uD83D\uDDD1\uFE0F'} Skip</span>
            <span>{'\u22EE\u22EE'} Drag to move</span>
            <span>{'\uD83D\uDCB0'} Click $ to edit</span>
            <span>{'\uD83C\uDFF7\uFE0F'} Click account to edit</span>
            <span>{'\uD83D\uDCDD'} Notes per item</span>
            <span>{'\u2713\u2713'} Bulk check all in a day</span>
            <span className="text-amber-700 font-semibold">{'\uD83D\uDFE1'} Amber = due in 3 days</span>
            <span className="text-red-700 font-semibold">{'\uD83D\uDD34'} Red outline = overdue unpaid</span>
            <span>(R) = Recurring</span>
            <span>{'\uD83D\uDCBE'} Auto-saves</span>
          </div>
        </div>

        {/* ADD EXPENSE MODAL */}
        {showAddExpenseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Add Expense</h2>
                <button onClick={() => setShowAddExpenseModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={newExpenseForm.name}
                    onChange={(e) => setNewExpenseForm({...newExpenseForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Office Supplies" autoFocus />
                </div>
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" min="0" value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm({...newExpenseForm, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="0.00" />
                </div>
                {/* Account — autocomplete from existing accounts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account <span className="text-red-500">*</span></label>
                  <input type="text" value={newExpenseForm.account} list="account-suggestions"
                    onChange={(e) => setNewExpenseForm({...newExpenseForm, account: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="e.g., AUTO SF" />
                  <datalist id="account-suggestions">
                    {[...new Set(initialExpenses.map(e => e.account).filter(Boolean))].sort().map(a => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>

                {/* Category — auto-suggested from vendor name (#1) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                    {newExpenseForm.name && suggestCategory(newExpenseForm.name) && !newExpenseCategory && (
                      <span className="ml-2 text-xs text-amber-600 font-normal">
                        ✨ suggested: {suggestCategory(newExpenseForm.name)}
                      </span>
                    )}
                  </label>
                  <select
                    value={newExpenseCategory || (newExpenseForm.name ? suggestCategory(newExpenseForm.name) || '' : '')}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">— Select category —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Recurring toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="recurring" checked={newExpenseForm.isRecurring}
                    onChange={(e) => setNewExpenseForm({...newExpenseForm, isRecurring: e.target.checked, recurDay: ''})}
                    className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="recurring" className="text-sm font-medium text-gray-700 cursor-pointer">
                    This is a recurring expense
                  </label>
                </div>

                {/* Recurring fields */}
                {newExpenseForm.isRecurring ? (
                  <div className="space-y-3 pl-3 border-l-4 border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repeats</label>
                      <select value={newExpenseForm.recurType}
                        onChange={(e) => setNewExpenseForm({...newExpenseForm, recurType: e.target.value, recurDay: ''})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500">
                        <option value="monthly-date">Monthly -- on a specific date</option>
                        <option value="weekly-day">Weekly -- on a specific day</option>
                      </select>
                    </div>
                    {newExpenseForm.recurType === 'monthly-date' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Day of month <span className="text-red-500">*</span></label>
                        <input type="number" min="1" max="31" value={newExpenseForm.recurDay}
                          onChange={(e) => setNewExpenseForm({...newExpenseForm, recurDay: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="e.g., 15" />
                        <p className="text-xs text-gray-500 mt-1">Will appear on this date every month</p>
                      </div>
                    )}
                    {newExpenseForm.recurType === 'weekly-day' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Day of week <span className="text-red-500">*</span></label>
                        <select value={newExpenseForm.recurDay}
                          onChange={(e) => setNewExpenseForm({...newExpenseForm, recurDay: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500">
                          <option value="">Select a day...</option>
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Will appear on this day every week</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* One-time fields */
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day of month <span className="text-red-500">*</span></label>
                    <input type="number" min="1" max="31" value={newExpenseForm.oneTimeDay}
                      onChange={(e) => setNewExpenseForm({...newExpenseForm, oneTimeDay: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      placeholder={`1-${new Date(currentYear, currentMonth+1, 0).getDate()} for ${monthNames[currentMonth]}`} />
                    <p className="text-xs text-gray-500 mt-1">Only appears in {monthNames[currentMonth]} {currentYear}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button onClick={addNewExpense}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                    {newExpenseForm.isRecurring ? '+ Add Recurring' : '+ Add Expense'}
                  </button>
                  <button onClick={() => setShowAddExpenseModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">
                    Cancel
                  </button>
                </div>

                {/* Manage existing custom recurring */}
                {customRecurring.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Your recurring expenses</div>
                    <div className="space-y-1.5">
                      {customRecurring.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              ${parseFloat(p.amount).toLocaleString('en-US', {minimumFractionDigits:2})} {'\u00B7'} {p.account} {'\u00B7'}{' '}
                              {p.recurType === 'monthly-date'
                                ? `Every month on the ${p.recurDay}${['st','nd','rd'][((p.recurDay % 10)-1)] || 'th'}`
                                : `Every ${dayNames[p.recurDay]}`}
                            </div>
                          </div>
                          <button onClick={() => deleteCustomRecurring(p.id)}
                            className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                            title="Remove this recurring expense">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MANAGE RECURRING MODAL */}
        {showManageRecurring && (() => {
          // Build full list of all recurring items (hardcoded + custom)
          const dayNamesList = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
          const allRecurringItems = [];
          // From initialExpenses (monthly by date)
          initialExpenses.forEach(exp => {
            allRecurringItems.push({ originalId: exp.id, name: exp.name, amount: exp.amount, account: exp.account, day: exp.day, dayOfWeek: null, frequency: 'monthly', source: 'initial' });
          });
          // Hardcoded recurring rules
          const hardcodedMonthly = [
            { id: 'rec-1st-gofo-reminder', name: '\u23F0 REMINDER: BILL GOFO', amount: 0, account: 'REMINDER', day: 1 },
            { id: 'rec-4th-swgas', name: 'SWGAS - OFFICE', amount: 100.00, account: 'AUTO CE', day: 4 },
            { id: 'rec-3rd-centraldispatch', name: 'CENTRAL DISPATCH', amount: 199.95, account: 'AUTO CE', day: 3 },
            { id: 'rec-12th-boa', name: 'BOA RANGE ROVER', amount: 2025.49, account: 'AUTO CE', day: 12 },
            { id: 'rec-14th-mbfs', name: 'MBFS', amount: 1287.92, account: 'AUTO SF', day: 14 },
            { id: 'rec-15th-nelly', name: "NELLY'S PAYROLL", amount: 1000.00, account: 'AUTO CE', day: 15 },
            { id: 'rec-15th-gofo-reminder', name: '\u23F0 REMINDER: BILL GOFO', amount: 0, account: 'REMINDER', day: 15 },
            { id: 'rec-15th-vinix', name: 'VINIX', amount: 503.05, account: 'AUTO CE', day: 15 },
            { id: 'rec-17th-lvvwd', name: 'LVVWD', amount: 375.00, account: 'AUTO CE', day: 17 },
            { id: 'rec-17th-adobe', name: 'ADOBE', amount: 335.86, account: 'AUTO SF', day: 17 },
            { id: 'rec-19th-ipfs', name: 'IPFS (CE INSURANCE)', amount: 3861.45, account: 'AUTO CE', day: 19 },
            { id: 'rec-19th-atlus', name: 'ATLUS TOYOTA', amount: 3000.00, account: 'AUTO SF', day: 19 },
            { id: 'rec-20th-glg', name: 'GLG (5SEVEN5 INSURANCE)', amount: 1397.00, account: 'AUTO SF', day: 20 },
            { id: 'rec-20th-republic', name: 'REPUBLIC SERVICES', amount: 1667.10, account: 'AUTO SF', day: 20 },
            { id: 'rec-21st-sas', name: 'SAS', amount: 435.00, account: 'AUTO J&A', day: 21 },
            { id: 'rec-25th-dat', name: 'DAT SOLUTIONS', amount: 2280.00, account: 'AUTO SF', day: 25 },
            { id: 'rec-27th-cloneops', name: 'CLONEOPS', amount: 500.00, account: 'AUTO CE', day: 27 },
            { id: 'rec-29th-zoominfo', name: 'ZOOMINFO', amount: 833.33, account: 'AUTO CE', day: 29 },
          ];
          hardcodedMonthly.forEach(item => {
            allRecurringItems.push({ originalId: item.id, name: item.name, amount: item.amount, account: item.account, day: item.day, dayOfWeek: null, frequency: 'monthly', source: 'hardcoded' });
          });
          const hardcodedWeekly = [
            { id: 'rec-tue-wex', name: 'WEX', amount: 4000.00, account: '', dayOfWeek: 2 },
            { id: 'rec-tue-rent', name: 'RENT', amount: 5000.00, account: '', dayOfWeek: 2 },
            { id: 'rec-tue-alex', name: 'ALEX NAHAI', amount: 500.00, account: 'AUTO SF', dayOfWeek: 2 },
            { id: 'rec-wed-trailer', name: 'UTILITY TRAILER', amount: 2520.00, account: '', dayOfWeek: 3 },
            { id: 'rec-wed-mud', name: 'MUDFLAP', amount: 2000.00, account: '', dayOfWeek: 3 },
            { id: 'rec-wed-colombia', name: 'COLOMBIA PAYROLL', amount: 1850.00, account: 'AUTO CE', dayOfWeek: 3 },
            { id: 'rec-wed-mckinney', name: 'MCKINNEY TRAILERS', amount: 2500.00, account: 'SF', dayOfWeek: 3 },
            { id: 'rec-wed-lendr', name: 'LENDR', amount: 2658.73, account: 'AUTO SF', dayOfWeek: 3 },
            { id: 'rec-fri-driver', name: 'DRIVER PAYROLL SUBMISSION', amount: 40000.00, account: '', dayOfWeek: 5 },
            { id: 'rec-fri-office', name: 'OFFICE PAYROLL SUBMISSION', amount: 30000.00, account: '', dayOfWeek: 5 },
            { id: 'rec-fri', name: 'WEX (Friday)', amount: 4000.00, account: '', dayOfWeek: 5 },
          ];
          hardcodedWeekly.forEach(item => {
            allRecurringItems.push({ originalId: item.id, name: item.name, amount: item.amount, account: item.account, day: null, dayOfWeek: item.dayOfWeek, frequency: 'weekly', source: 'hardcoded' });
          });
          // Biweekly
          allRecurringItems.push({ originalId: 'rec-thu-mortgage', name: 'CHRIS MORTGAGE', amount: 8150.37, account: '', day: null, dayOfWeek: 4, frequency: 'biweekly', source: 'hardcoded' });
          // Custom recurring
          customRecurring.forEach(p => {
            allRecurringItems.push({
              originalId: p.id, name: p.name, amount: parseFloat(p.amount), account: p.account,
              day: p.recurType === 'monthly-date' ? parseInt(p.recurDay) : null,
              dayOfWeek: p.recurType === 'weekly-day' ? parseInt(p.recurDay) : null,
              frequency: p.recurType === 'monthly-date' ? 'monthly' : 'weekly',
              source: 'custom'
            });
          });

          // Build override lookup
          const ovMap = {};
          recurringOverrides.forEach(ov => { ovMap[ov.original_id] = ov; });

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5" /> Manage Recurring Expenses</h2>
                  <button onClick={() => setShowManageRecurring(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Edit amounts, accounts, schedule, or delete recurring items. Changes are saved as overrides -- your hardcoded defaults remain as fallbacks.</p>

                <div className="space-y-2">
                  {allRecurringItems.filter(item => {
                    const ov = ovMap[item.originalId];
                    return !ov || !ov.deleted;
                  }).map(item => {
                    const ov = ovMap[item.originalId] || {};
                    const currentAmount = ov.amount !== null && ov.amount !== undefined ? parseFloat(ov.amount) : item.amount;
                    const currentAccount = ov.account !== null && ov.account !== undefined ? ov.account : item.account;
                    const currentDay = ov.day !== null && ov.day !== undefined ? ov.day : item.day;
                    const currentDayOfWeek = ov.day_of_week !== null && ov.day_of_week !== undefined ? ov.day_of_week : item.dayOfWeek;
                    const isModified = Object.keys(ov).length > 0;
                    const ordSuffix = (d) => ['st','nd','rd'][((d % 10)-1)] || 'th';

                    return (
                      <div key={item.originalId} className={`flex items-center gap-3 p-3 rounded-lg border ${isModified ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                        {/* Name + source badge */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 truncate">{item.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              item.source === 'initial' ? 'bg-blue-100 text-blue-700' :
                              item.source === 'hardcoded' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>{item.source === 'custom' ? 'Custom' : item.frequency === 'weekly' ? 'Weekly' : item.frequency === 'biweekly' ? 'Bi-weekly' : 'Monthly'}</span>
                            {isModified && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium">Modified</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.frequency === 'weekly' ? `Every ${dayNamesList[currentDayOfWeek]}` :
                             item.frequency === 'biweekly' ? `Every other ${dayNamesList[currentDayOfWeek]}` :
                             `Day ${currentDay}${ordSuffix(currentDay)} of each month`}
                          </div>
                        </div>

                        {/* Amount edit */}
                        <div className="flex flex-col items-center">
                          <label className="text-xs text-gray-500 mb-0.5">Amount</label>
                          <input
                            type="number" step="0.01" min="0"
                            defaultValue={currentAmount}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val !== item.amount) {
                                saveRecurringOverride({ original_id: item.originalId, name: item.name, amount: val, account: currentAccount, day: currentDay, day_of_week: currentDayOfWeek, deleted: false });
                              }
                            }}
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-right"
                          />
                        </div>

                        {/* Account edit */}
                        <div className="flex flex-col items-center">
                          <label className="text-xs text-gray-500 mb-0.5">Account</label>
                          <input
                            type="text"
                            defaultValue={currentAccount}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val !== item.account) {
                                saveRecurringOverride({ original_id: item.originalId, name: item.name, amount: currentAmount, account: val, day: currentDay, day_of_week: currentDayOfWeek, deleted: false });
                              }
                            }}
                            className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            placeholder="Account..."
                          />
                        </div>

                        {/* Day / Day-of-week edit */}
                        <div className="flex flex-col items-center">
                          <label className="text-xs text-gray-500 mb-0.5">{item.frequency === 'weekly' || item.frequency === 'biweekly' ? 'Day of week' : 'Day'}</label>
                          {item.frequency === 'weekly' || item.frequency === 'biweekly' ? (
                            <select
                              defaultValue={currentDayOfWeek}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                saveRecurringOverride({ original_id: item.originalId, name: item.name, amount: currentAmount, account: currentAccount, day: currentDay, day_of_week: val, deleted: false });
                              }}
                              className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            >
                              {dayNamesList.map((dn, di) => <option key={di} value={di}>{dn}</option>)}
                            </select>
                          ) : (
                            <input
                              type="number" min="1" max="31"
                              defaultValue={currentDay}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val <= 31 && val !== item.day) {
                                  saveRecurringOverride({ original_id: item.originalId, name: item.name, amount: currentAmount, account: currentAccount, day: val, day_of_week: currentDayOfWeek, deleted: false });
                                }
                              }}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-center"
                            />
                          )}
                        </div>

                        {/* Reset button (if modified) */}
                        {isModified && (
                          <button
                            onClick={() => deleteRecurringOverride(item.originalId)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded flex-shrink-0"
                            title="Reset to default"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${item.name}" from all future months?`)) {
                              saveRecurringOverride({ original_id: item.originalId, name: item.name, amount: currentAmount, account: currentAccount, day: currentDay, day_of_week: currentDayOfWeek, deleted: true });
                            }
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                          title="Delete this recurring expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Deleted items section */}
                {recurringOverrides.filter(ov => ov.deleted).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-600 mb-2">Deleted Items (click to restore)</h3>
                    <div className="flex flex-wrap gap-2">
                      {recurringOverrides.filter(ov => ov.deleted).map(ov => (
                        <button key={ov.original_id}
                          onClick={() => deleteRecurringOverride(ov.original_id)}
                          className="px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 hover:bg-red-100 line-through"
                        >
                          {ov.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button onClick={() => setShowManageRecurring(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* VENDOR DETAIL MODAL (#4 + #10) */}
        {vendorDetailModal && (() => {
          const history = getVendorHistory(vendorDetailModal.name);
          const variance = computeVariance(vendorDetailModal.name);
          const currentCategory = vendorCategories[vendorDetailModal.vendorKey] || suggestCategory(vendorDetailModal.name) || '';

          // Group by year-month for trend chart
          const byMonth = {};
          history.forEach(h => {
            const key = `${h.year}-${String(h.month).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { count: 0, total: 0, label: `${monthNames[h.month].substring(0, 3)} ${h.year}` };
            byMonth[key].count++;
            byMonth[key].total += h.amount;
          });
          const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
          const maxAmt = Math.max(...sortedMonths.map(([, v]) => v.total), variance.baseline || 0, 0.01);

          // Year-over-year
          const byYear = {};
          history.forEach(h => {
            if (!byYear[h.year]) byYear[h.year] = 0;
            byYear[h.year] += h.amount;
          });
          const years = Object.keys(byYear).sort();
          let yoyText = null;
          if (years.length >= 2) {
            const lastYear = byYear[years[years.length - 1]];
            const prevYear = byYear[years[years.length - 2]];
            if (prevYear > 0) {
              const yoyPct = ((lastYear - prevYear) / prevYear) * 100;
              yoyText = { pct: yoyPct, lastYear: years[years.length - 1], prevYear: years[years.length - 2] };
            }
          }

          const totalSpend = history.reduce((s, h) => s + h.amount, 0);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setVendorDetailModal(null)}>
              <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{vendorDetailModal.name}</h2>
                    <div className="text-sm text-gray-600 mt-1">{history.length} transaction{history.length !== 1 ? 's' : ''} across {sortedMonths.length} month{sortedMonths.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={() => setVendorDetailModal(null)} className="text-gray-500 hover:text-gray-700 p-1"><X className="w-6 h-6" /></button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Total Spend</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Avg per Entry</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">${history.length > 0 ? (totalSpend / history.length).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Baseline</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">{variance.baseline ? '$' + variance.baseline.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${variance.flagged ? (variance.diff > 0 ? 'bg-red-50' : 'bg-amber-50') : 'bg-gray-50'}`}>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Variance</div>
                    <div className={`text-lg font-bold mt-1 ${variance.flagged ? (variance.diff > 0 ? 'text-red-700' : 'text-amber-700') : 'text-gray-900'}`}>
                      {variance.hasData ? `${variance.pct > 0 ? '+' : ''}${variance.pct.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Category control */}
                <div className="mb-5 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                  <Tag className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Category:</span>
                  <select
                    value={currentCategory}
                    onChange={(e) => saveVendorCategory(vendorDetailModal.vendorKey, vendorDetailModal.name, e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">— None —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-xs text-gray-500">
                    {categoryStorageMode === 'supabase' ? '☁ synced' : '💾 local only'}
                  </span>
                </div>

                {/* Baseline editor */}
                <div className="mb-5 p-3 bg-purple-50 rounded-lg flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">Expected baseline:</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={variance.baseline || ''}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        saveBaselineAmount(vendorDetailModal.vendorKey, vendorDetailModal.name, val);
                      }
                    }}
                    placeholder="Set baseline amount"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-xs text-gray-500">flags {VARIANCE_THRESHOLD_PCT}%+ deviations</span>
                </div>

                {/* Variance warning */}
                {variance.flagged && (
                  <div className={`mb-5 p-3 rounded-lg border ${variance.diff > 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
                    <div className={`flex items-center gap-2 text-sm font-semibold ${variance.diff > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                      <AlertTriangle className="w-4 h-4" />
                      Variance Alert
                    </div>
                    <div className="text-xs text-gray-700 mt-1">
                      Avg actual is <strong>${variance.avgActual.toFixed(2)}</strong> vs baseline <strong>${variance.baseline.toFixed(2)}</strong>
                      ({variance.diff > 0 ? '+' : ''}${variance.diff.toFixed(2)}, {variance.pct > 0 ? '+' : ''}{variance.pct.toFixed(1)}%).
                      {variance.diff > 0 ? ' Possible price increase or extra charges.' : ' Possible billing change or canceled item.'}
                    </div>
                  </div>
                )}

                {/* YoY */}
                {yoyText && (
                  <div className={`mb-5 px-3 py-2 rounded-lg inline-flex items-center gap-2 text-sm font-medium ${yoyText.pct > 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                    {yoyText.pct > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {yoyText.pct > 0 ? '+' : ''}{yoyText.pct.toFixed(1)}% YoY ({yoyText.lastYear} vs {yoyText.prevYear})
                  </div>
                )}

                {/* Monthly trend chart (#4) */}
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-2 mb-2">Monthly Trend</h3>
                {sortedMonths.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                    No history yet — entries will appear as months are archived.
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                    <div className="flex items-end gap-2 min-h-[180px]">
                      {sortedMonths.map(([key, v]) => {
                        const h = Math.max(8, (v.total / maxAmt) * 160);
                        const isAboveBaseline = variance.baseline && v.total > variance.baseline * 1.05;
                        const isBelowBaseline = variance.baseline && v.total < variance.baseline * 0.95;
                        const barColor = isAboveBaseline ? 'bg-red-500' : isBelowBaseline ? 'bg-amber-500' : 'bg-blue-500';
                        return (
                          <div key={key} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 60 }}>
                            <div className="text-[10px] text-gray-600 font-semibold">${v.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                            <div className={`w-10 ${barColor} rounded-t transition-all`} style={{ height: `${h}px` }} title={`${v.label}: $${v.total.toFixed(2)} (${v.count} entries)`} />
                            <div className="text-[10px] text-gray-500">{v.label}</div>
                          </div>
                        );
                      })}
                      {/* Baseline reference line */}
                      {variance.baseline && (
                        <div className="text-[10px] text-purple-600 font-semibold ml-3 self-center">
                          Baseline: ${variance.baseline.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent transactions */}
                {history.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-5 mb-2">Recent Entries</h3>
                    <div className="bg-gray-50 rounded-lg max-h-[200px] overflow-y-auto">
                      {history.slice(-15).reverse().map((h, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-gray-200 last:border-b-0 text-xs">
                          <span className="text-gray-600">{monthNames[h.month]} {h.day || '?'}, {h.year}</span>
                          <span className="text-gray-500 truncate flex-1 mx-3">{h.account || '—'}</span>
                          <span className="font-bold text-gray-900">${h.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          {h.source === 'archive' && <span className="ml-2 text-[9px] text-purple-600 bg-purple-100 px-1 rounded">archived</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={() => setVendorDetailModal(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ACCOUNT VIEW MODAL (#8) */}
        {showAccountView && (() => {
          const acctTotals = getAccountSubtotals();
          const sorted = Object.entries(acctTotals).sort((a, b) => b[1].total - a[1].total);
          const grandTotal = sorted.reduce((s, [, v]) => s + v.total, 0);
          const grandCompleted = sorted.reduce((s, [, v]) => s + v.completed, 0);

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAccountView(false)}>
              <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">By Account — {monthNames[currentMonth]} {currentYear}</h2>
                    <div className="text-sm text-gray-600 mt-1">
                      {sorted.length} account{sorted.length !== 1 ? 's' : ''} · ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total · ${grandCompleted.toLocaleString('en-US', { minimumFractionDigits: 2 })} paid
                    </div>
                  </div>
                  <button onClick={() => setShowAccountView(false)} className="text-gray-500 hover:text-gray-700 p-1"><X className="w-6 h-6" /></button>
                </div>

                {sorted.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No accounts assigned yet</div>
                ) : (
                  <div className="space-y-2">
                    {sorted.map(([acct, t]) => {
                      const pct = grandTotal > 0 ? (t.total / grandTotal) * 100 : 0;
                      const completedPct = t.total > 0 ? (t.completed / t.total) * 100 : 0;
                      return (
                        <div key={acct} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-teal-600" />
                              <span className="font-bold text-gray-900">{acct}</span>
                              <span className="text-xs text-gray-500">{t.vendorCount} vendor{t.vendorCount !== 1 ? 's' : ''} · {t.items} item{t.items !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">${t.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              <div className="text-xs text-gray-500">{pct.toFixed(1)}% of total</div>
                            </div>
                          </div>
                          {/* Progress bar: paid portion */}
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-green-500 h-full transition-all" style={{ width: `${completedPct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>${t.completed.toLocaleString('en-US', { minimumFractionDigits: 2 })} paid</span>
                            <span>${(t.total - t.completed).toLocaleString('en-US', { minimumFractionDigits: 2 })} pending</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={() => setShowAccountView(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* YEAR VIEW MODAL (#2) */}
        {showYearView && (() => {
          const months = Array.from({ length: 12 }, (_, m) => ({
            month: m,
            year: currentYear,
            ...getMonthSummary(m, currentYear),
          }));
          const yearTotal = months.reduce((s, m) => s + m.total, 0);
          const yearPaid = months.reduce((s, m) => s + m.paid, 0);
          const yearOverdue = months.reduce((s, m) => s + m.overdue, 0);
          const maxMonthly = Math.max(...months.map(m => m.total), 1);
          const today = new Date();
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowYearView(false)}>
              <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Year View — {currentYear}</h2>
                    <div className="text-sm text-gray-600 mt-1">
                      ${yearTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} total · ${yearPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} paid · ${yearOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })} overdue
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentYear(currentYear - 1)} className="p-1 hover:bg-gray-100 rounded" title="Previous year"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="font-bold text-lg">{currentYear}</span>
                    <button onClick={() => setCurrentYear(currentYear + 1)} className="p-1 hover:bg-gray-100 rounded" title="Next year"><ChevronRight className="w-5 h-5" /></button>
                    <button onClick={() => setShowYearView(false)} className="text-gray-500 hover:text-gray-700 p-1 ml-2"><X className="w-6 h-6" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {months.map(m => {
                    const isCurrent = today.getFullYear() === m.year && today.getMonth() === m.month;
                    const pct = m.total > 0 ? (m.paid / m.total) * 100 : 0;
                    const heightPct = (m.total / maxMonthly) * 100;
                    return (
                      <button
                        key={m.month}
                        onClick={() => { setCurrentMonth(m.month); setShowYearView(false); }}
                        className={`text-left p-3 border-2 rounded-lg transition-all hover:shadow-md hover:border-blue-400 ${
                          isCurrent ? 'border-blue-500 bg-blue-50' : m.archived ? 'border-purple-300 bg-purple-50' : 'border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-bold text-gray-900">{monthNames[m.month].substring(0, 3)}</div>
                          {isCurrent && <span className="text-[9px] font-bold text-blue-700 bg-blue-200 px-1 rounded">NOW</span>}
                          {m.archived && <span className="text-[9px] font-bold text-purple-700 bg-purple-200 px-1 rounded">ARCHIVED</span>}
                        </div>
                        <div className="text-sm font-bold text-gray-900">${m.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                        <div className="text-[10px] text-gray-500 mb-2">total</div>

                        {/* Bar visualization */}
                        <div className="h-12 flex items-end mb-1">
                          <div className="w-full bg-gray-100 rounded relative" style={{ height: `${Math.max(8, heightPct)}%` }}>
                            <div className="absolute inset-x-0 bottom-0 bg-green-500 rounded-b" style={{ height: `${pct}%` }} />
                          </div>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-green-600 font-semibold">{pct.toFixed(0)}% paid</span>
                          {m.overdue > 0 && <span className="text-red-600 font-semibold">${m.overdue.toLocaleString('en-US', { maximumFractionDigits: 0 })} owed</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end">
                  <button onClick={() => setShowYearView(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* VARIANCE DASHBOARD MODAL (#8) */}
        {showVarianceDashboard && (() => {
          const report = getVarianceReport();
          const flagged = report.filter(r => r.flagged);
          const totalAnnualImpact = flagged.reduce((s, r) => s + r.dollarImpact, 0);
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowVarianceDashboard(false)}>
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-orange-600" /> Variance Dashboard
                    </h2>
                    <div className="text-sm text-gray-600 mt-1">
                      {flagged.length} of {report.length} recurring vendors deviate &gt;{VARIANCE_THRESHOLD_PCT}% from baseline · ${totalAnnualImpact.toLocaleString('en-US', { minimumFractionDigits: 2 })} annual impact
                    </div>
                  </div>
                  <button onClick={() => setShowVarianceDashboard(false)} className="text-gray-500 hover:text-gray-700 p-1"><X className="w-6 h-6" /></button>
                </div>

                {report.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No variance data yet. Variance tracking activates once you have 2+ entries for a vendor across multiple months (auto-populated from archives).
                  </div>
                ) : (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-xs text-gray-600 uppercase">Over Baseline</div>
                        <div className="text-xl font-bold text-red-700">{flagged.filter(r => r.diff > 0).length}</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="text-xs text-gray-600 uppercase">Under Baseline</div>
                        <div className="text-xl font-bold text-amber-700">{flagged.filter(r => r.diff < 0).length}</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-gray-600 uppercase">Within {VARIANCE_THRESHOLD_PCT}%</div>
                        <div className="text-xl font-bold text-green-700">{report.length - flagged.length}</div>
                      </div>
                    </div>

                    {/* Flagged vendors table */}
                    {flagged.length > 0 && (
                      <>
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Flagged Vendors (sorted by annual $ impact)</h3>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold">Vendor</th>
                                <th className="text-left px-3 py-2 font-semibold">Account</th>
                                <th className="text-right px-3 py-2 font-semibold">Baseline</th>
                                <th className="text-right px-3 py-2 font-semibold">Avg Actual</th>
                                <th className="text-right px-3 py-2 font-semibold">Variance</th>
                                <th className="text-right px-3 py-2 font-semibold">Annual Impact</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {flagged.map(r => (
                                <tr key={r.vendorKey} className="border-t border-gray-200 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-semibold text-gray-900">{r.name}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600">{r.account || '—'}</td>
                                  <td className="text-right px-3 py-2 font-mono">${r.baseline.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                  <td className="text-right px-3 py-2 font-mono">${r.avgActual.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                  <td className={`text-right px-3 py-2 font-bold ${r.diff > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                                    {r.diff > 0 ? '▲' : '▼'} {r.pct > 0 ? '+' : ''}{r.pct.toFixed(1)}%
                                  </td>
                                  <td className={`text-right px-3 py-2 font-bold ${r.diff > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                                    {r.diff > 0 ? '+' : '−'}${r.dollarImpact.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => { setVendorDetailModal({ name: r.name, vendorKey: r.vendorKey }); setShowVarianceDashboard(false); }}
                                      className="text-xs text-blue-600 hover:underline"
                                    >View →</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* Healthy vendors */}
                    {report.length - flagged.length > 0 && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-bold text-gray-600 hover:text-gray-800">
                          Within tolerance ({report.length - flagged.length} vendors)
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {report.filter(r => !r.flagged).map(r => (
                            <div key={r.vendorKey} className="p-2 bg-green-50 rounded flex justify-between">
                              <span className="font-semibold">{r.name}</span>
                              <span className="text-green-700">{r.pct > 0 ? '+' : ''}{r.pct.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={() => setShowVarianceDashboard(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* QUICK ADD POPOVER (#4) — anchored to a calendar day */}
        {quickAddOpen && (() => {
          const topVendors = getTopVendors();
          return (
            <div
              className="fixed inset-0 z-50"
              onClick={() => setQuickAddOpen(null)}
            >
              <div
                className="absolute bg-white border-2 border-blue-400 rounded-lg shadow-xl p-3 w-72 max-h-96 overflow-y-auto"
                style={{
                  left: Math.min(quickAddOpen.x, window.innerWidth - 300),
                  top: Math.min(quickAddOpen.y, window.innerHeight - 380)
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-gray-900 text-sm">Quick Add — Day {quickAddOpen.day}</div>
                  <button onClick={() => setQuickAddOpen(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
                </div>
                <div className="text-xs text-gray-500 mb-2">Top vendors — click to add to {monthNames[currentMonth]} {quickAddOpen.day}</div>
                {topVendors.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">No vendors yet</div>
                ) : (
                  <div className="space-y-1">
                    {topVendors.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => quickAddVendor(v, quickAddOpen.day)}
                        className="w-full text-left p-2 rounded hover:bg-blue-50 border border-gray-200 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-900 truncate">{v.name}</div>
                            {v.account && <div className="text-[10px] text-gray-500 truncate">🏷️ {v.account}</div>}
                          </div>
                          <div className="text-xs font-bold text-green-700 ml-2">${v.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setQuickAddOpen(null); setShowAddExpenseModal(true); setNewExpenseForm({ ...newExpenseForm, oneTimeDay: String(quickAddOpen.day) }); }}
                  className="mt-2 w-full px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Custom expense
                </button>
              </div>
            </div>
          );
        })()}

        {/* CALENDAR WEEKS */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="mb-4">
            {/* STICKY WEEK TOTAL */}
            <div className="sticky top-0 z-20 mb-2 px-3 py-2 bg-green-600 text-white rounded-lg shadow-md flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide">Week {weekIdx + 1}</span>
              <span className="text-sm font-bold">
                Pending: ${getWeekTotal(week).toLocaleString('en-US',{minimumFractionDigits:2})}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {dayNames.map((dayName, dayIdx) => {
                const dayData = week.find(d => d.dayOfWeek === dayIdx);
                const day = dayData?.day;
                const isOverflow = dayData?.overflow || false;
                const dayMonth = isOverflow ? dayData.overflowMonth : currentMonth;
                const dayYear = isOverflow ? dayData.overflowYear : currentYear;
                const holiday = day ? isBankHoliday(day, dayMonth, dayYear) : null;
                const isWeekend = dayIdx === 0 || dayIdx === 6;
                const dueSoon = day && !isOverflow ? isDueSoon(day) : false;
                const overdue = day && !isOverflow ? isOverdue(day) : false;
                const dayExpenses = day ? getExpensesForDay(day, dayMonth, dayYear) : [];
                const allChecked = day && dayExpenses.length > 0 && dayExpenses.every(exp => checkedItems[getItemKey(exp, `${dayYear}-${dayMonth}-${day}`)]);
                const hasUnchecked = day && dayExpenses.some(exp => !checkedItems[getItemKey(exp, `${dayYear}-${dayMonth}-${day}`)]);

                return (
                  <div
                    key={dayIdx}
                    className={`border-2 rounded-lg p-2 transition-all ${
                      isOverflow ? 'bg-slate-100 border-slate-500 opacity-70' :
                      holiday ? 'bg-yellow-100 border-yellow-600' :
                      dueSoon ? 'bg-amber-100 border-amber-600' :
                      overdue && hasUnchecked ? 'bg-red-100 border-red-600' :
                      isWeekend ? 'bg-slate-200 border-gray-700' :
                      'bg-white border-gray-700'
                    } ${dragOverDay === day ? 'ring-4 ring-blue-400 bg-blue-50' : ''}`}
                    onDragOver={(e) => day && handleDragOver(e, day)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => day && handleDrop(e, day, dayMonth, dayYear)}
                  >
                    {/* DAY HEADER */}
                    <div className="font-bold text-sm mb-1.5 pb-1.5 border-b-2 border-gray-700 text-gray-900 flex items-center justify-between gap-1">
                      <div>
                        <span className="text-gray-900">{dayName}</span>
                        {day && <span className="ml-1.5 text-gray-900 font-extrabold">{day}</span>}
                        {isOverflow && <span className="ml-1 text-xs text-slate-500 font-medium">{monthNames[dayMonth].substring(0,3)}</span>}
                        {dueSoon && <span className="ml-1 text-xs text-amber-700 font-semibold">{'\u26A1'} Due soon</span>}
                        {overdue && hasUnchecked && <span className="ml-1 text-xs text-red-600 font-semibold">{'\u26A0\uFE0F'} Overdue</span>}
                        {holiday && <div className="text-xs text-yellow-700 font-semibold">{holiday.name}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* QUICK ADD BUTTON (#4) */}
                        {day && !isOverflow && !viewingArchive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setQuickAddOpen({ day, x: rect.right + 4, y: rect.top });
                            }}
                            title="Quick add expense from top vendors"
                            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded text-xs font-bold border bg-white border-gray-400 text-gray-600 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {/* BULK CHECK BUTTON */}
                        {day && dayExpenses.length > 1 && !viewingArchive && (
                          <button
                            onClick={() => bulkCheckDay(day)}
                            title={allChecked ? "Uncheck all" : "Check all as paid"}
                            className={`flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold border transition-colors ${
                              allChecked
                                ? 'bg-green-500 border-green-600 text-white hover:bg-green-600'
                                : 'bg-white border-gray-400 text-gray-600 hover:bg-green-50 hover:border-green-500 hover:text-green-700'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>All</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {day ? (
                      <div className="space-y-1.5">
                        {dayExpenses.map((expense, idx) => {
                          const itemKey = getItemKey(expense, `${dayYear}-${dayMonth}-${day}`);
                          const isChecked = checkedItems[itemKey];
                          const note = notes[itemKey] || '';
                          const noteOpen = openNotes[itemKey];

                          return (
                            <div
                              key={idx}
                              className={`p-1.5 rounded border ${viewingArchive ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${
                                expense.amount === 0 ? 'bg-orange-50 border-orange-400' :
                                isChecked ? 'bg-green-50 border-green-400' : 'bg-white border-gray-400'
                              }`}
                              draggable={!viewingArchive}
                              onDragStart={(e) => !viewingArchive && handleDragStart(e, expense, day, dayMonth, dayYear)}
                            >
                              <div className="flex items-start gap-1.5">
                                {!viewingArchive && <GripVertical className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0 cursor-grab" />}
                                <button
                                  onClick={() => !viewingArchive && toggleCheck(itemKey)}
                                  disabled={viewingArchive}
                                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 shadow-sm ${isChecked ? 'bg-green-600 border-green-700' : 'bg-white border-gray-600 hover:border-green-600 hover:bg-green-50'} ${viewingArchive ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  {isChecked && <Check className="w-3 h-3 text-white" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  {/* MOVE-TO-DAY PICKER (alternative to drag) */}
                                  {movingKey === itemKey && !viewingArchive && (
                                    <div className="flex items-center gap-1 mb-1 p-1 bg-blue-50 border-2 border-blue-400 rounded" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[10px] font-bold text-blue-800 flex-shrink-0">Move to:</span>
                                      <select
                                        defaultValue={day}
                                        onChange={(e) => moveExpenseToDay(expense, day, dayMonth, dayYear, parseInt(e.target.value, 10))}
                                        className="text-xs border border-blue-400 rounded px-1 py-0.5 flex-1 min-w-0"
                                        autoFocus
                                      >
                                        {Array.from({ length: getDaysInMonth(dayMonth, dayYear) }, (_, i) => i + 1).map(d => (
                                          <option key={d} value={d}>{monthNames[dayMonth].slice(0, 3)} {d}{d === day ? ' (here)' : ''}</option>
                                        ))}
                                      </select>
                                      <button onClick={() => setMovingKey(null)} className="p-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded flex-shrink-0"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                  )}
                                  {/* NAME — click to view vendor detail (#4), shift+click to rename (#5) */}
                                  {(() => {
                                    const variance = computeVariance(expense.name);
                                    const cat = suggestCategory(expense.name);
                                    const renameKey = expense.id || itemKey;
                                    const isRenaming = renamingId === renameKey;
                                    if (isRenaming) {
                                      return (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveRename({ ...expense, originalId: expense.id });
                                              if (e.key === 'Escape') cancelRename();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 min-w-0 px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none"
                                            autoFocus
                                          />
                                          <button onClick={(e) => { e.stopPropagation(); saveRename({ ...expense, originalId: expense.id }); }} className="p-0.5 bg-green-500 hover:bg-green-600 text-white rounded"><Check className="w-2.5 h-2.5" /></button>
                                          <button onClick={(e) => { e.stopPropagation(); cancelRename(); }} className="p-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded"><X className="w-2.5 h-2.5" /></button>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className={`text-xs font-semibold ${isChecked ? 'line-through text-gray-500' : 'text-gray-900'} flex items-center gap-1 flex-wrap`}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (e.shiftKey) {
                                              startRename(renameKey, expense.name);
                                            } else {
                                              setVendorDetailModal({ name: expense.name, vendorKey: normalizeVendorKey(expense.name) });
                                            }
                                          }}
                                          className={`text-left hover:text-blue-600 hover:underline ${isChecked ? 'line-through' : ''}`}
                                          title="Click for vendor history · Shift+click to rename"
                                        >
                                          {expense.name}
                                        </button>
                                        {!viewingArchive && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); startRename(renameKey, expense.name); }}
                                            className="text-gray-300 hover:text-blue-600 text-[10px]"
                                            title="Rename"
                                          >✎</button>
                                        )}
                                        {expense.isRecurring && <span className="text-xs text-purple-600">(R)</span>}
                                        {cat && <span className="text-[9px] text-gray-500 bg-gray-100 px-1 rounded" title={`Category: ${cat}`}>{cat}</span>}
                                        {variance.flagged && (
                                          <span
                                            className={`text-[9px] font-bold px-1 rounded ${variance.diff > 0 ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'}`}
                                            title={`Avg actual ${variance.avgActual.toFixed(2)} vs baseline ${variance.baseline.toFixed(2)} (${variance.pct.toFixed(1)}%)`}
                                          >
                                            {variance.diff > 0 ? '▲' : '▼'} {Math.abs(variance.pct).toFixed(0)}%
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* AMOUNT */}
                                  {editingAmount === itemKey && !viewingArchive ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-xs text-green-700">$</span>
                                      <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key==='Enter') saveEditAmount(expense,day); if (e.key==='Escape') cancelEditAmount(); }}
                                        className="w-20 px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none" autoFocus />
                                      <button onClick={() => saveEditAmount(expense,day)} className="p-0.5 bg-green-500 hover:bg-green-600 text-white rounded"><Check className="w-2.5 h-2.5" /></button>
                                      <button onClick={cancelEditAmount} className="p-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                  ) : expense.amount === 0 ? (
                                    <div
                                      className={`text-xs text-orange-600 font-bold italic ${viewingArchive ? '' : 'cursor-pointer hover:bg-orange-100 rounded px-1'}`}
                                      onClick={() => !viewingArchive && startEditAmount(itemKey, 0)}
                                      title={viewingArchive ? '' : 'Click to set an amount'}
                                    >REMINDER</div>
                                  ) : (
                                    <div
                                      className={`text-xs ${isChecked ? 'line-through text-gray-400' : 'text-green-700'} font-bold ${viewingArchive ? '' : 'cursor-pointer hover:bg-green-100'} inline-block px-1 rounded`}
                                      onClick={() => !viewingArchive && startEditAmount(itemKey, expense.amount)}
                                      title={viewingArchive ? '' : "Click to edit amount"}
                                    >
                                      ${expense.amount.toLocaleString('en-US',{minimumFractionDigits:2})}
                                    </div>
                                  )}

                                  {/* ACCOUNT -- EDITABLE */}
                                  {editingAccount === itemKey && !viewingArchive ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <input type="text" value={editAccountValue} onChange={(e) => setEditAccountValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key==='Enter') saveEditAccount(expense,day); if (e.key==='Escape') cancelEditAccount(); }}
                                        className="w-full px-1 py-0.5 text-xs border-2 border-blue-500 rounded focus:outline-none" autoFocus placeholder="Account..." />
                                      <button onClick={() => saveEditAccount(expense,day)} className="p-0.5 bg-green-500 hover:bg-green-600 text-white rounded flex-shrink-0"><Check className="w-2.5 h-2.5" /></button>
                                      <button onClick={cancelEditAccount} className="p-0.5 bg-gray-400 hover:bg-gray-500 text-white rounded flex-shrink-0"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                  ) : expense.account ? (
                                    <div
                                      className={`text-xs ${isChecked ? 'text-gray-400' : 'text-gray-500'} truncate ${viewingArchive ? '' : 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-0.5'}`}
                                      onClick={() => !viewingArchive && startEditAccount(itemKey, expense.account)}
                                      title={viewingArchive ? expense.account : "Click to edit account"}
                                    >
                                      {'\uD83C\uDFF7\uFE0F'} {expense.account}
                                    </div>
                                  ) : !viewingArchive ? (
                                    <div
                                      className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 rounded px-0.5"
                                      onClick={() => startEditAccount(itemKey, '')}
                                    >
                                      + account
                                    </div>
                                  ) : null}

                                  {/* NOTE TOGGLE + INPUT */}
                                  {!viewingArchive && (
                                    <div className="mt-0.5">
                                      <button
                                        onClick={() => toggleNoteOpen(itemKey)}
                                        className={`text-xs flex items-center gap-0.5 ${note ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-blue-500'}`}
                                        title={note ? "View/edit note" : "Add note"}
                                      >
                                        {'\uD83D\uDCDD'} {note ? 'Note' : 'Add note'}
                                      </button>
                                      {noteOpen && (
                                        <textarea
                                          value={note}
                                          onChange={(e) => updateNote(itemKey, e.target.value)}
                                          placeholder="e.g., Check #1042, confirmed..."
                                          rows={2}
                                          className="mt-0.5 w-full text-xs px-1.5 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500 resize-none"
                                          autoFocus
                                        />
                                      )}
                                    </div>
                                  )}
                                  {viewingArchive && note && (
                                    <div className="text-xs text-blue-600 italic mt-0.5">{'\uD83D\uDCDD'} {note}</div>
                                  )}
                                </div>
                                {!viewingArchive && (
                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                    <button
                                      onClick={() => setMovingKey(movingKey === itemKey ? null : itemKey)}
                                      title="Move to another day"
                                      className={`p-0.5 rounded ${movingKey === itemKey ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'}`}
                                    >
                                      <Calendar className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => deleteItem(itemKey)} className="p-0.5 text-red-500 hover:bg-red-50 rounded">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="mt-2 pt-2 border-t-2 border-gray-300">
                          <div className="text-xs font-bold text-blue-700">Total: ${getDayTotal(day, dayMonth, dayYear).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-center py-4">-</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

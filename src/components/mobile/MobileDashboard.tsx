import React, { useState, useEffect } from 'react';
import { Job, JobColumnId, JobStatus, PaymentStatus } from '../../types';
import { 
  Plus, ChevronUp, ChevronDown, Navigation, Phone,
  MoreVertical, Trash2, Copy, Archive, Package, Map, Layers, Search, Monitor
} from 'lucide-react';
import JobPlaceholder from '../JobPlaceholder';

// Helper: Pobierz ID kolumny dla dzisiejszego dnia tygodnia
const getTodayColumnId = (): JobColumnId => {
  const dayOfWeek = new Date().getDay(); // 0 = niedziela, 1 = poniedziałek, ...
  const dayMap: { [key: number]: JobColumnId } = {
    1: 'MON',
    2: 'TUE',
    3: 'WED',
    4: 'THU',
    5: 'FRI',
    6: 'PREPARE', // Sobota -> pokaż "Do przygotowania"
    0: 'PREPARE', // Niedziela -> pokaż "Do przygotowania"
  };
  return dayMap[dayOfWeek] || 'MON';
};

// Demo data for preview
const DEMO_JOBS: Job[] = [
  {
    id: 'demo-1',
    friendlyId: 'M24-001',
    createdAt: Date.now(),
    status: JobStatus.NEW,
    columnId: 'MON',
    order: 0,
    paymentStatus: PaymentStatus.PROFORMA,
    adminNotes: 'Pamiętać żeby wziąć gotówkę! Klient płaci przy odbiorze.',
    data: {
      jobTitle: 'Oklejanie witryny sklepowej - Żabka',
      clientName: 'Żabka Polska',
      phoneNumber: '500123456',
      address: 'ul. Marszałkowska 100, Warszawa',
      scopeWorkText: 'Oklejenie 3 witryn folią mrożoną z wyciętym logo. Wymiary: 2x3m każda.',
    },
    projectImages: ['https://images.unsplash.com/photo-1534430480872-3498386e7856?w=200&h=200&fit=crop'],
  },
  {
    id: 'demo-2',
    friendlyId: 'M24-002',
    createdAt: Date.now(),
    status: JobStatus.IN_PROGRESS,
    columnId: 'MON',
    order: 1,
    paymentStatus: PaymentStatus.PAID,
    adminNotes: '',
    data: {
      jobTitle: 'Montaż kasetonu świetlnego LED',
      clientName: 'Restauracja Złoty Kur',
      phoneNumber: '600789012',
      address: 'ul. Nowy Świat 25, Kraków',
      scopeWorkText: 'Kaseton podświetlany LED 150x50cm. Montaż na elewacji nad wejściem.',
    },
    projectImages: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop'],
  },
  {
    id: 'demo-3',
    friendlyId: 'M24-003',
    createdAt: Date.now(),
    status: JobStatus.NEW,
    columnId: 'MON',
    order: 2,
    paymentStatus: PaymentStatus.CASH,
    adminNotes: 'Zacząć od lewej strony! Klient będzie obecny.',
    data: {
      jobTitle: 'Wymiana folii na samochodzie dostawczym',
      clientName: 'DHL Express',
      phoneNumber: '512345678',
      address: 'ul. Przemysłowa 15, Poznań',
      scopeWorkText: 'Wymiana uszkodzonej folii na burcie samochodu dostawczego Sprinter.',
    },
    projectImages: ['https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=200&h=200&fit=crop'],
  },
  {
    id: 'demo-4',
    friendlyId: 'M24-004',
    createdAt: Date.now(),
    status: JobStatus.NEW,
    columnId: 'TUE',
    order: 0,
    paymentStatus: PaymentStatus.OVERDUE,
    data: {
      jobTitle: 'Litery przestrzenne 3D - salon fryzjerski',
      clientName: 'Hair Studio Anna',
      phoneNumber: '601234567',
      address: 'ul. Kwiatowa 8, Gdańsk',
      scopeWorkText: 'Montaż liter przestrzennych ze styroduru. Napis HAIR STUDIO.',
    },
    projectImages: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'],
  },
  {
    id: 'demo-5',
    friendlyId: 'M24-005',
    createdAt: Date.now(),
    status: JobStatus.NEW,
    columnId: 'WED',
    order: 0,
    paymentStatus: PaymentStatus.PARTIAL,
    adminNotes: 'Potrzebna drabina 6m i podnośnik!',
    data: {
      jobTitle: 'Tablica reklamowa zewnętrzna 3x2m',
      clientName: 'Deweloper Nowe Osiedle',
      phoneNumber: '505999888',
      address: 'ul. Budowlana 42, Wrocław',
      scopeWorkText: 'Montaż tablicy reklamowej na słupach. Fundament już przygotowany.',
    },
    projectImages: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&h=200&fit=crop'],
  },
];

// Column configuration
const COLUMNS: { id: JobColumnId; short: string; full: string; color: string }[] = [
  { id: 'PREPARE', short: '📦', full: 'Przygotowanie', color: '#475569' },
  { id: 'MON', short: 'Pn', full: 'Poniedziałek', color: '#f43f5e' },
  { id: 'TUE', short: 'Wt', full: 'Wtorek', color: '#10b981' },
  { id: 'WED', short: 'Śr', full: 'Środa', color: '#8b5cf6' },
  { id: 'THU', short: 'Cz', full: 'Czwartek', color: '#f59e0b' },
  { id: 'FRI', short: 'Pt', full: 'Piątek', color: '#3b82f6' },
  { id: 'COMPLETED', short: '✓', full: 'Ukończone', color: '#16a34a' },
];

// Payment status helpers
const getPaymentColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e';
    case PaymentStatus.PROFORMA: return '#f97316';
    case PaymentStatus.PARTIAL: return '#a855f7';
    case PaymentStatus.CASH: return '#eab308';
    case PaymentStatus.OVERDUE: return '#ef4444';
    default: return '#64748b';
  }
};

const getPaymentLabel = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return 'OPŁACONE';
    case PaymentStatus.PROFORMA: return 'PROFORMA';
    case PaymentStatus.PARTIAL: return 'ZALICZKA';
    case PaymentStatus.CASH: return 'BARTER';
    case PaymentStatus.OVERDUE: return 'DO ZAPŁATY';
    default: return '';
  }
};

// Format address (no postal code)
const formatAddress = (address: string | undefined): { street: string; city: string } => {
  if (!address) return { street: 'Brak adresu', city: '' };
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim();
    if (!city && parts[2]) city = parts[2].replace(/\d{2}-\d{3}\s*/g, '').trim();
    return { street, city };
  }
  return { street: address, city: '' };
};

// Format phone
const formatPhone = (phone: string | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  const match = cleaned.match(/^(\+48)?(\d{9})$/);
  if (match) {
    const num = match[2];
    return `${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
  }
  return phone;
};

interface MobileDashboardProps {
  jobs: Job[];
  onCreateNew: () => void;
  onOpenJob: (job: Job) => void;
  onOpenMap: (provider: 'GOOGLE' | 'OSM') => void;
  onMoveUp: (jobId: string) => void;
  onMoveDown: (jobId: string) => void;
  onMoveToColumn: (jobId: string, columnId: JobColumnId) => void;
  onPaymentStatusChange: (jobId: string, status: PaymentStatus) => void;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  isAdmin?: boolean;
  showDemo?: boolean; // Show demo data for preview
}

// Payment filter options
const PAYMENT_FILTERS: { status: PaymentStatus | 'ALL'; label: string; color: string }[] = [
  { status: 'ALL', label: 'Wszystkie', color: '#64748b' },
  { status: PaymentStatus.PAID, label: '💚', color: '#22c55e' },
  { status: PaymentStatus.PROFORMA, label: '🟠', color: '#f97316' },
  { status: PaymentStatus.CASH, label: '🟡', color: '#eab308' },
  { status: PaymentStatus.OVERDUE, label: '🔴', color: '#ef4444' },
  { status: PaymentStatus.PARTIAL, label: '🟣', color: '#a855f7' },
];

const MobileDashboard: React.FC<MobileDashboardProps> = ({
  jobs: realJobs,
  onCreateNew,
  onOpenJob,
  onOpenMap,
  onMoveUp,
  onMoveDown,
  onMoveToColumn,
  onPaymentStatusChange,
  onDelete,
  onDuplicate,
  onArchive,
  isAdmin = true,
  showDemo = false,
}) => {
  // Use demo jobs if no real jobs or showDemo is true
  const jobs = (showDemo || realJobs.length === 0) ? DEMO_JOBS : realJobs;
  const isDemo = showDemo || realJobs.length === 0;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payment filter state
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL');

  // Load last selected column from localStorage, default to today's day
  const [selectedColumn, setSelectedColumn] = useState<JobColumnId>(() => {
    const saved = localStorage.getItem('mobile_selected_column');
    // Jeśli zapisana kolumna istnieje, użyj jej; w przeciwnym razie dzisiejszy dzień
    if (saved && ['PREPARE', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'COMPLETED'].includes(saved)) {
      return saved as JobColumnId;
    }
    return getTodayColumnId();
  });

  // Save selected column to localStorage
  useEffect(() => {
    localStorage.setItem('mobile_selected_column', selectedColumn);
  }, [selectedColumn]);

  // Get jobs for selected column with search and payment filter
  const columnJobs = jobs
    .filter(j => {
      const matchesColumn = (j.columnId || 'PREPARE') === selectedColumn;
      const notArchived = j.status !== JobStatus.ARCHIVED;
      const matchesSearch = !searchQuery || 
        j.data.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.data.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.data.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.friendlyId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPayment = paymentFilter === 'ALL' || j.paymentStatus === paymentFilter;
      return matchesColumn && notArchived && matchesSearch && matchesPayment;
    })
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));

  // Get job count for a column
  const getCount = (colId: JobColumnId) => 
    jobs.filter(j => (j.columnId || 'PREPARE') === colId && j.status !== JobStatus.ARCHIVED).length;

  // Get current column info
  const currentColumn = COLUMNS.find(c => c.id === selectedColumn) || COLUMNS[1];

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* ============ TOP MENU - sticky ============ */}
      <div 
        className="flex-shrink-0 bg-slate-900 text-white p-2 shadow-lg z-20"
      >
        {/* Row 1: Mini logo + Action buttons */}
        <div className="flex items-center gap-2 mb-2">
          {/* Mini logo */}
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center font-black text-[10px] flex-shrink-0">
            M24
          </div>
          
          {/* Add button */}
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 rounded-lg font-bold text-xs active:scale-95 transition-transform shadow flex-1"
          >
            <Plus className="w-4 h-4" />
            DODAJ
          </button>
          
          {/* Google Maps style button */}
          <button
            onClick={() => onOpenMap('GOOGLE')}
            className="flex items-center gap-1 px-2 py-1.5 bg-blue-500 rounded-lg font-bold text-xs active:scale-95 transition-transform shadow"
            title="Mapa Google"
          >
            <Map className="w-4 h-4" />
          </button>
          
          {/* OSM style button */}
          <button
            onClick={() => onOpenMap('OSM')}
            className="flex items-center gap-1 px-2 py-1.5 bg-green-600 rounded-lg font-bold text-xs active:scale-95 transition-transform shadow"
            title="Mapa OpenStreetMap"
          >
            <Layers className="w-4 h-4" />
          </button>
          
          {/* Switch to PC version */}
          <button
            onClick={() => {
              window.location.href = window.location.pathname + '?desktop=1';
            }}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-600 rounded-lg font-bold text-xs active:scale-95 transition-transform shadow"
            title="Przełącz na wersję PC"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: Day buttons - horizontal scroll with padding for ring */}
        <div className="flex gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-hide">
          {COLUMNS.map(col => {
            const count = getCount(col.id);
            const isSelected = selectedColumn === col.id;
            const isToday = col.id === getTodayColumnId();
            return (
              <button
                key={col.id}
                onClick={() => setSelectedColumn(col.id)}
                className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg transition-all active:scale-95 relative ${
                  isSelected 
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' 
                    : 'opacity-60'
                }`}
                style={{ 
                  background: col.color,
                  width: '42px',
                  height: '42px'
                }}
              >
                {/* Trójkącik wskazujący dzisiejszy dzień */}
                {isToday && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-white"></div>
                  </div>
                )}
                <span className="text-base font-black text-white leading-none">{col.short}</span>
                <span className="text-[9px] font-bold text-white/80">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Search bar - below day buttons */}
        <div className="relative my-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj zlecenia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Row 4: Payment status filter chips */}
        <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide">
          {PAYMENT_FILTERS.map(filter => (
            <button
              key={filter.status}
              onClick={() => setPaymentFilter(filter.status)}
              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                paymentFilter === filter.status
                  ? 'bg-white text-slate-900 shadow'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Row 5: Current column indicator */}
        <div 
          className="flex items-center justify-center gap-2 py-1.5 rounded-lg"
          style={{ background: currentColumn.color }}
        >
          <span className="text-white font-bold text-xs uppercase tracking-wide">
            {currentColumn.full}
          </span>
          <span className="bg-white/30 px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
            {columnJobs.length}
          </span>
        </div>

        {/* Demo indicator */}
        {isDemo && (
          <div className="text-center text-[9px] text-orange-400 mt-1 font-medium">
            ⚠️ PODGLĄD DEMO - dane przykładowe
          </div>
        )}
      </div>

      {/* ============ JOBS LIST - 75% height, scrollable with swipe ============ */}
      <SwipeableJobList
        jobs={columnJobs}
        columns={COLUMNS}
        selectedColumn={selectedColumn}
        onColumnChange={setSelectedColumn}
        onOpenJob={onOpenJob}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onMoveToColumn={onMoveToColumn}
        onPaymentStatusChange={onPaymentStatusChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        isAdmin={isAdmin}
        isDemo={isDemo}
      />
    </div>
  );
};

// ============ SWIPEABLE JOB LIST ============
interface SwipeableJobListProps {
  jobs: Job[];
  columns: typeof COLUMNS;
  selectedColumn: JobColumnId;
  onColumnChange: (col: JobColumnId) => void;
  onOpenJob: (job: Job) => void;
  onMoveUp: (jobId: string) => void;
  onMoveDown: (jobId: string) => void;
  onMoveToColumn: (jobId: string, columnId: JobColumnId) => void;
  onPaymentStatusChange: (jobId: string, status: PaymentStatus) => void;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  isAdmin: boolean;
  isDemo: boolean;
}

const SwipeableJobList: React.FC<SwipeableJobListProps> = ({
  jobs,
  columns,
  selectedColumn,
  onColumnChange,
  onOpenJob,
  onMoveUp,
  onMoveDown,
  onMoveToColumn,
  onPaymentStatusChange,
  onDelete,
  onDuplicate,
  onArchive,
  isAdmin,
  isDemo,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    
    // Calculate offset for visual feedback
    const diff = currentTouch - touchStart;
    // Limit the offset for visual effect
    setSwipeOffset(Math.max(-100, Math.min(100, diff * 0.3)));
  };

  const onTouchEnd = () => {
    setSwiping(false);
    setSwipeOffset(0);
    
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    const currentIndex = columns.findIndex(c => c.id === selectedColumn);
    
    if (isLeftSwipe && currentIndex < columns.length - 1) {
      // Swipe left = next column
      onColumnChange(columns[currentIndex + 1].id);
    } else if (isRightSwipe && currentIndex > 0) {
      // Swipe right = previous column
      onColumnChange(columns[currentIndex - 1].id);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const currentColumn = columns.find(c => c.id === selectedColumn);

  return (
    <div 
      className="flex-1 overflow-y-auto p-3 space-y-3 relative"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe indicators */}
      {swiping && swipeOffset !== 0 && (
        <div className="fixed top-1/2 left-0 right-0 flex justify-between px-4 pointer-events-none z-50">
          <div className={`p-3 rounded-full bg-white shadow-lg transition-opacity ${swipeOffset > 30 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-2xl">◀</span>
          </div>
          <div className={`p-3 rounded-full bg-white shadow-lg transition-opacity ${swipeOffset < -30 ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-2xl">▶</span>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      {jobs.length === 0 && (
        <div className="text-center text-xs text-slate-400 mb-2">
          ← Przesuń palcem aby zmienić dzień →
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Package className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Brak zleceń</p>
          <p className="text-sm">Przesuń ← → lub wybierz inny dzień</p>
        </div>
      ) : (
        <>
          {/* Swipe hint at top */}
          <div className="text-center text-[10px] text-slate-400 pb-1">
            ← Przesuń aby zmienić dzień →
          </div>
          
          {jobs.map((job, index) => (
            <MobileJobCardCompact
              key={job.id}
              job={job}
              onOpen={() => onOpenJob(job)}
              onMoveUp={() => onMoveUp(job.id)}
              onMoveDown={() => onMoveDown(job.id)}
              onMoveToColumn={(colId) => onMoveToColumn(job.id, colId)}
              onPaymentStatusChange={(status) => onPaymentStatusChange(job.id, status)}
              onDelete={() => onDelete(job.id)}
              onDuplicate={() => onDuplicate(job.id)}
              onArchive={() => onArchive(job.id)}
              canMoveUp={index > 0}
              canMoveDown={index < jobs.length - 1}
              currentColumnId={selectedColumn}
              isAdmin={isAdmin}
              isDemo={isDemo}
            />
          ))}
        </>
      )}
      
      {/* Bottom padding for last card */}
      <div className="h-4" />
    </div>
  );
};

// ============ COMPACT JOB CARD ============
interface MobileJobCardCompactProps {
  job: Job;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToColumn: (columnId: JobColumnId) => void;
  onPaymentStatusChange: (status: PaymentStatus) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  currentColumnId: JobColumnId;
  isAdmin: boolean;
  isDemo?: boolean;
}

// Payment status options for mobile
const PAYMENT_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: PaymentStatus.NONE, label: 'BRAK', color: '#64748b' },
  { value: PaymentStatus.PROFORMA, label: 'PROFORMA', color: '#f97316' },
  { value: PaymentStatus.PARTIAL, label: 'ZALICZKA', color: '#a855f7' },
  { value: PaymentStatus.PAID, label: 'OPŁACONE', color: '#22c55e' },
  { value: PaymentStatus.CASH, label: 'BARTER', color: '#eab308' },
  { value: PaymentStatus.OVERDUE, label: 'DO ZAPŁATY', color: '#ef4444' },
];

const MobileJobCardCompact: React.FC<MobileJobCardCompactProps> = ({
  job,
  onOpen,
  onMoveUp,
  onMoveDown,
  onMoveToColumn,
  onPaymentStatusChange,
  onDelete,
  onDuplicate,
  onArchive,
  canMoveUp,
  canMoveDown,
  currentColumnId,
  isAdmin,
  isDemo = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const paymentColor = getPaymentColor(job.paymentStatus || PaymentStatus.NONE);
  const paymentLabel = getPaymentLabel(job.paymentStatus || PaymentStatus.NONE);
  const { street, city } = formatAddress(job.data.address);
  const phone = formatPhone(job.data.phoneNumber);

  // Get current column name for button
  const currentColName = COLUMNS.find(c => c.id === currentColumnId)?.short || '?';

  const handleMoveToColumn = (colId: JobColumnId) => {
    onMoveToColumn(colId);
    setShowMenu(false);
  };

  const handlePaymentChange = (status: PaymentStatus) => {
    onPaymentStatusChange(status);
    setShowMenu(false);
  };

  return (
    <div 
      className="bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200 relative"
      style={{ touchAction: 'manipulation' }}
    >
      {/* TOP: Payment status (clickable) + Move UP arrow */}
      <div className="flex items-stretch">
        {/* Payment status - now clickable to open menu */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="flex-1 text-[9px] font-bold text-white text-center py-1.5 uppercase tracking-wide active:opacity-80"
          style={{ background: paymentColor || '#64748b' }}
        >
          {paymentLabel || 'BRAK'} ▼
        </button>
        
        {/* Move UP button */}
        <button
          onClick={() => onMoveUp()}
          disabled={!canMoveUp}
          className={`px-4 flex items-center justify-center transition-all ${
            canMoveUp 
              ? 'bg-blue-500 text-white active:bg-blue-600' 
              : 'bg-slate-200 text-slate-400'
          }`}
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Main content row */}
      <div className="flex" onClick={onOpen}>
        {/* Left: Thumbnail */}
        <div className="w-16 h-16 flex-shrink-0 bg-slate-100 relative cursor-pointer overflow-hidden">
          {job.projectImages?.[0] ? (
            <img src={job.projectImages[0]} loading="lazy" className="w-full h-full object-cover" alt="" />
          ) : (
            <JobPlaceholder job={job} size="small" />
          )}
          <div className="absolute bottom-0.5 left-0.5 text-[6px] font-bold bg-black/70 text-white px-1 rounded">
            {job.friendlyId}
          </div>
        </div>

        {/* Middle: Title + Address */}
        <div className="flex-1 p-2 min-w-0 cursor-pointer">
          <h3 className="font-bold text-sm text-slate-900 line-clamp-1 leading-tight">
            {job.data.jobTitle || 'Bez nazwy'}
          </h3>
          <div className="text-xs text-slate-600 mt-0.5 leading-snug">
            <div className="font-medium text-slate-800">{street}</div>
            {city && <div className="text-slate-500">{city}</div>}
          </div>
        </div>

        {/* Right: "Przenieś" button like PC */}
        <div className="flex items-center pr-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="px-2 py-1.5 bg-purple-500 text-white rounded-lg active:scale-95 text-[10px] font-bold flex items-center gap-1"
          >
            📅 Przenieś
          </button>
        </div>
      </div>

      {/* Notes/Description - FULL WIDTH */}
      <div 
        className="bg-amber-50 px-3 py-2 text-[11px] leading-snug border-t border-amber-100 cursor-pointer mx-1 mb-1 rounded-lg"
        onClick={onOpen}
      >
        {job.adminNotes ? (
          <span className="font-medium text-amber-800">📌 {job.adminNotes.slice(0, 120)}{job.adminNotes.length > 120 ? '...' : ''}</span>
        ) : job.data.scopeWorkText ? (
          <span className="text-slate-600">{job.data.scopeWorkText.split('.')[0].slice(0, 120)}...</span>
        ) : (
          <span className="text-slate-400 italic">Brak opisu zlecenia</span>
        )}
      </div>

      {/* Bottom: Nav/Phone + Move DOWN arrow */}
      <div className="flex border-t border-slate-100">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.data.address || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex flex-col items-center justify-center py-2 bg-blue-50 text-blue-700 active:bg-blue-100 border-r border-slate-100"
        >
          <div className="flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            <span className="text-[10px] font-bold truncate max-w-[90px]">{street}</span>
          </div>
          {city && <span className="text-[8px] text-blue-500 font-medium">{city}</span>}
        </a>
        
        {phone ? (
          <a
            href={`tel:${job.data.phoneNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 font-bold text-xs active:bg-green-100 border-r border-slate-100"
          >
            <Phone className="w-4 h-4" />
            {phone}
          </a>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 text-slate-400 text-xs border-r border-slate-100">
            <Phone className="w-4 h-4" />
            Brak tel.
          </div>
        )}
        
        {/* Move DOWN button */}
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={!canMoveDown}
          className={`px-4 flex items-center justify-center transition-all ${
            canMoveDown 
              ? 'bg-blue-500 text-white active:bg-blue-600' 
              : 'bg-slate-200 text-slate-400'
          }`}
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Dropdown Menu - FIXED positioning to avoid cutoff */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/20" onClick={() => setShowMenu(false)} />
          <div 
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* PAYMENT STATUS SECTION */}
            <div className="text-xs font-bold text-slate-500 uppercase px-3 py-2 border-b border-slate-100 mb-2 flex items-center gap-2">
              💳 Status płatności:
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PAYMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handlePaymentChange(opt.value)}
                  className={`px-2 py-2 rounded-xl text-[10px] font-bold text-center transition-all ${
                    job.paymentStatus === opt.value 
                      ? 'ring-2 ring-offset-1 ring-blue-500' 
                      : ''
                  }`}
                  style={{ 
                    background: opt.color,
                    color: opt.value === PaymentStatus.CASH ? '#000' : '#fff'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            
            {/* MOVE TO COLUMN SECTION */}
            <div className="text-xs font-bold text-slate-500 uppercase px-3 py-2 border-b border-slate-100 mb-2 flex items-center gap-2">
              📅 Przenieś zlecenie do:
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {COLUMNS.filter(c => c.id !== currentColumnId).map(col => (
                <button
                  key={col.id}
                  onClick={() => handleMoveToColumn(col.id)}
                  className="text-left px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 text-sm font-medium text-slate-700 flex items-center gap-2 border border-slate-100"
                >
                  <span 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: col.color }}
                  >
                    {col.short}
                  </span>
                  <span className="flex-1">{col.full}</span>
                </button>
              ))}
            </div>
            
            {isAdmin && !isDemo && (
              <>
                <div className="border-t border-slate-200 my-2" />
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { onDuplicate(); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100"
                  >
                    <Copy className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Duplikuj</span>
                  </button>
                  <button
                    onClick={() => { onArchive(); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200"
                  >
                    <Archive className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Archiwum</span>
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl bg-red-50 text-red-600 active:bg-red-100"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Usuń</span>
                  </button>
                </div>
              </>
            )}
            
            <button
              onClick={() => setShowMenu(false)}
              className="w-full mt-3 py-3 text-center text-sm font-bold text-slate-500 bg-slate-100 rounded-xl active:bg-slate-200"
            >
              ✕ Anuluj
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileDashboard;

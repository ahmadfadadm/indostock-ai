import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, Newspaper, Bell, 
  Menu, User, ArrowUpRight, ArrowDownRight, Zap, 
  BarChart2, RefreshCw, ChevronRight, Wind, AlertTriangle, 
  ListOrdered, ShieldHalf, X, ExternalLink, FileText,
  Sparkles, Bot, BrainCircuit, Search, ArrowUp, ArrowDown, Users, DollarSign
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { getGeminiInsight } from './gemini';

// Strict spacing system
const LAYOUT_PX = "px-6 lg:px-8"; 
const LAYOUT_GAP = "gap-6 lg:gap-8"; 
const CARD_PADDING = "p-6"; 

// Common card styles
const COMMON_CARD_STYLE = `bg-[#111827]/60 backdrop-blur-2xl border border-white/5 rounded-3xl ${CARD_PADDING} shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden`;

const UNIFIED_CARD_HEIGHT = "h-[400px]"; 

// Card style variants
const PRIMARY_CARD_STYLE = `${COMMON_CARD_STYLE} h-full`; 
const SECONDARY_CARD_STYLE = `${COMMON_CARD_STYLE} ${UNIFIED_CARD_HEIGHT}`; 

const COMPANY_META = {
  'BBCA.JK': { name: 'Bank Central Asia Tbk', type: 'Finance' },
  'BBRI.JK': { name: 'Bank Rakyat Indonesia (Persero) Tbk', type: 'Finance' },
  'TLKM.JK': { name: 'Telkom Indonesia (Persero) Tbk', type: 'Infrastructure' },
  'BMRI.JK': { name: 'Bank Mandiri (Persero) Tbk', type: 'Finance' },
  'ASII.JK': { name: 'Astra International Tbk', type: 'Conglomerate' },
  'GOTO.JK': { name: 'GoTo Gojek Tokopedia Tbk', type: 'Tech' },
  'UNVR.JK': { name: 'Unilever Indonesia Tbk', type: 'Consumer' },
  'ICBP.JK': { name: 'Indofood CBP Sukses Makmur Tbk', type: 'Consumer' },
  'ADRO.JK': { name: 'Adaro Energy Indonesia Tbk', type: 'Energy' },
  'BBNI.JK': { name: 'Bank Negara Indonesia (Persero) Tbk', type: 'Finance' },
  'UNTR.JK': { name: 'United Tractors Tbk', type: 'Industrial' },
  'AMRT.JK': { name: 'Sumber Alfaria Trijaya Tbk', type: 'Consumer' },
  'MDKA.JK': { name: 'Merdeka Copper Gold Tbk', type: 'Basic Materials' },
  'KLBF.JK': { name: 'Kalbe Farma Tbk', type: 'Healthcare' },
  'INCO.JK': { name: 'Vale Indonesia Tbk', type: 'Basic Materials' },
  'PGAS.JK': { name: 'Perusahaan Gas Negara Tbk', type: 'Energy' },
  'PTBA.JK': { name: 'Bukit Asam Tbk', type: 'Energy' },
  'BUKA.JK': { name: 'Bukalapak.com Tbk', type: 'Tech' },
  'BRIS.JK': { name: 'Bank Syariah Indonesia Tbk', type: 'Finance' },
  'ANTM.JK': { name: 'Aneka Tambang Tbk', type: 'Basic Materials' }
};

const SENTIMENT_COLORS = {
  positive: '#10b981', 
  negative: '#f43f5e', 
  neutral: '#8b5cf6',  
};

const CHART_RANGES = ['5D', '1M', '6M', 'YTD', '1Y'];

// Helper functions
const StockLogo = ({ code, className = "w-8 h-8", fallbackClass = "" }) => {
    const [imgError, setImgError] = useState(false);
    const cleanCode = code ? code.replace('.JK', '') : 'XX';
    const logoUrl = `https://assets.stockbit.com/logos/companies/${cleanCode}.png`;

    if (imgError) {
        return (
            <div className={`${className} rounded-full flex items-center justify-center bg-slate-800 text-slate-400 font-bold text-[10px] ring-1 ring-white/10 ${fallbackClass}`}>
                {cleanCode.substring(0, 2)}
            </div>
        );
    }
    return (
        <img 
            src={logoUrl} 
            alt={code} 
            className={`${className} rounded-full object-contain bg-white p-0.5 shadow-sm`}
            onError={() => setImgError(true)}
        />
    );
};

const getMonthName = (monthIndex) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex % 12];
};

const formatFullDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return `${date.getDate()} ${getMonthName(date.getMonth())} ${date.getFullYear()}`;
};

const getStartDateISO = (range) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    const target = new Date(now);

    switch (range) {
        case '1M': target.setMonth(now.getMonth() - 1); break;
        case '6M': target.setMonth(now.getMonth() - 6); break;
        case 'YTD': target.setMonth(0, 1); break;
        case '1Y': target.setFullYear(now.getFullYear() - 1); break;
        case '5D': return null; 
        default: target.setMonth(now.getMonth() - 1);
    }

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Ui components
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f172a]/95 border border-slate-700/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md z-50">
          <p className="text-slate-400 text-xs mb-2 font-medium border-b border-white/5 pb-2">{new Date(label).toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-3 text-sm mb-1 last:mb-0">
                <span className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }}></span>
                <span className="text-slate-300 w-20">{entry.name === 'price' ? 'Actual' : 'Forecast'}</span>
                <span className="font-mono font-bold text-white">Rp {entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
};

const SentimentTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl shadow-xl z-50">
                 <p className="text-white font-bold text-sm mb-1" style={{ color: data.payload.color }}>
                    {data.payload.name}
                 </p>
                 <p className="text-slate-200 text-xs">
                    Share: <span className="font-mono font-bold text-white">{data.value}%</span>
                 </p>
            </div>
        );
    }
    return null;
}

const MetricCard = ({ title, value, change, isCurrency = false, icon: Icon, subLabel }) => {
  const isPositive = change >= 0;
  return (
    <div className={`${COMMON_CARD_STYLE} flex flex-col justify-between hover:-translate-y-1 h-full min-h-[180px]`}>
      <div className="flex items-start justify-between w-full mb-4">
        <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">{title}</p>
        <div className="p-2.5 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition-colors border border-indigo-500/10">
            <Icon size={18} className="text-indigo-400" />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        {React.isValidElement(value) ? (
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</div>
        ) : (
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isCurrency ? `Rp ${value.toLocaleString()}` : value}
            </h3>
        )}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
            <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'}`}>
                {isPositive ? <TrendingUp size={12} className="mr-1.5" /> : <TrendingDown size={12} className="mr-1.5" />}
                <span>{Math.abs(change).toFixed(2)}%</span>
            </div>
            {subLabel && <span className="text-xs text-slate-500 font-medium">{subLabel}</span>}
        </div>
    </div>
    </div>
  );
};

const SentimentBadge = ({ sentiment }) => {
  const safeSentiment = sentiment ? sentiment.toLowerCase() : 'neutral';
  const colors = {
    positive: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/20 shadow-[0_0_10px_-5px_#10b981]",
    negative: "bg-rose-500/10 text-rose-400 border-rose-500/20 ring-1 ring-rose-500/20 shadow-[0_0_10px_-5px_#f43f5e]",
    neutral: "bg-violet-500/10 text-violet-400 border-violet-500/20 ring-1 ring-violet-500/20",
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${colors[safeSentiment] || colors.neutral}`}>
      {safeSentiment.charAt(0).toUpperCase() + safeSentiment.slice(1)}
    </span>
  );
};

const StockSlider = ({ stockList, selectedStock, onSelectStock }) => {
  if (!stockList || stockList.length === 0) return <div className="p-4 text-slate-500 text-sm animate-pulse">Waiting for market data...</div>;

  return (
    <div className="-mx-6 lg:-mx-8 relative">
        <div className="absolute -top-2 -bottom-7 right-0 w-28 sm:w-56 bg-gradient-to-l from-[#020617] via-[#020617]/70 to-transparent z-30 pointer-events-none" />

        <div className="relative w-full overflow-x-auto whitespace-nowrap hide-scrollbar px-6 lg:px-8 py-10 -my-10">
            <div className={`flex ${LAYOUT_GAP}`}> 
            {stockList.map((stock) => {
                const isSelected = selectedStock && stock.code === selectedStock.code;
                const isPositive = stock.change >= 0;

                return (
                <button
                    key={stock.code}
                    onClick={() => onSelectStock(stock)}
                    className={`
                        relative flex flex-col items-start justify-center p-5 rounded-3xl min-w-60 h-40
                        transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] text-left group focus:outline-none border
                        ${isSelected 
                        ? 'bg-linear-to-br from-indigo-600 to-violet-700 shadow-[0_15px_25px_-10px_rgba(99,102,241,0.6)] border-transparent ring-1 ring-white scale-[1.05] z-10' 
                        : 'bg-[#111827]/60 backdrop-blur-2xl border-white/5 ring-0 ring-transparent shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 hover:bg-[#1f2937]'}
                    `}
                >
                    <div className="w-full mb-auto">
                        <div className="flex justify-between items-start w-full mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 shrink-0"><StockLogo code={stock.code} className="w-full h-full" /></div>
                                <span className={`text-xl font-extrabold tracking-wide ${isSelected ? 'text-white' : 'text-slate-200'}`}>{stock.code.replace('.JK','')}</span>
                            </div>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_15px_white] animate-pulse"></div>}
                        </div>
                        <p className={`text-xs font-medium whitespace-normal line-clamp-1 w-full ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`} title={stock.name}>{stock.name}</p>
                    </div>
                    <div className="w-full">
                        <div className={`flex items-baseline gap-1 text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span className={`text-sm font-semibold opacity-70 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>Rp</span> {stock.price ? stock.price.toLocaleString() : '-'}
                        </div>
                        <div className={`flex items-center text-xs font-bold mt-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
                            {stock.change ? stock.change.toFixed(2) : '0.00'}%
                        </div>
                    </div>
                </button>
                );
            })}
            </div>
        </div>
    </div>
  );
};

const FullNewsFeed = ({ newsData, selectedCode }) => (
    <div className={COMMON_CARD_STYLE}>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Newspaper size={24} className="text-indigo-400" /> 
            <span className="truncate">Global & Local News</span>
        </h2>
        <div className="space-y-4">
            {newsData.length === 0 ? 
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-xl bg-white/2">
                <FileText size={40} className="text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No news available for {selectedCode}</p>
            </div> : 
            newsData.map((news) => (
                <div key={news.id} className="group p-5 bg-white/2 rounded-2xl hover:bg-white/5 transition-all border border-white/5 hover:border-white/10 relative">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
                        <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
                            <span className="bg-white/5 border border-white/5 px-2 py-1 rounded text-slate-300 font-bold">{news.source || 'News'}</span> 
                            <span>{news.time}</span>
                        </span>
                        <SentimentBadge sentiment={news.sentiment} />
                    </div>
                    <a href={news.url} target="_blank" rel="noopener noreferrer" className="text-sm sm:text-base font-semibold text-slate-200 leading-relaxed hover:text-indigo-400 transition-colors block decoration-0">
                        {news.title} <ExternalLink size={12} className="inline ml-1 opacity-50 -mt-1"/>
                    </a>
                </div>
            ))}
        </div>
      </div>
);

const AllMarketMoversTable = ({ stockList, onSelectStock }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('change'); 
    const [sortDirection, setSortDirection] = useState('desc'); 

    const filteredAndSortedList = useMemo(() => {
        let list = stockList.filter(stock => 
            stock.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stock.type.toLowerCase().includes(searchTerm.toLowerCase())
        );

        list.sort((a, b) => {
            let valA, valB;

            switch (sortBy) {
                case 'code':
                    valA = a.code; valB = b.code; break;
                case 'price':
                    valA = a.price || 0; valB = b.price || 0; break;
                case 'change':
                    valA = a.change || 0; valB = b.change || 0; break;
                case 'type':
                    valA = a.type; valB = b.type; break;
                default:
                    valA = a.change || 0; valB = b.change || 0; 
            }

            if (typeof valA === 'string') {
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        return list;
    }, [stockList, searchTerm, sortBy, sortDirection]);

    const handleSort = (key) => {
        if (sortBy === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDirection(key === 'code' || key === 'type' ? 'asc' : 'desc');
        }
    };

    const SortIcon = ({ columnKey }) => {
        if (sortBy !== columnKey) return null;
        return sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1 text-indigo-400" /> : <ArrowDown size={14} className="ml-1 text-indigo-400" />;
    };

    return (
        <div className={COMMON_CARD_STYLE}>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <ListOrdered size={24} className="text-indigo-400" /> 
                <span className="truncate">All Market Movers</span>
            </h2>
            
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by Code, Name, or Sector..."
                        className="w-full bg-[#0b0f19] border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-white/5">
                <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-[#1f2937]/50 sticky top-0 backdrop-blur-sm">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">CODE</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">COMPANY NAME</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                                <button onClick={() => handleSort('type')} className="flex items-center hover:text-white transition-colors">SECTOR <SortIcon columnKey="type" /></button>
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <button onClick={() => handleSort('price')} className="flex items-center justify-end w-full hover:text-white transition-colors">PRICE <SortIcon columnKey="price" /></button>
                            </th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <button onClick={() => handleSort('change')} className="flex items-center justify-end w-full hover:text-white transition-colors">CHANGE (%) <SortIcon columnKey="change" /></button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredAndSortedList.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">No results found for "{searchTerm}".</td>
                            </tr>
                        ) : (
                            filteredAndSortedList.map((stock) => {
                                const isPositive = stock.change >= 0;
                                return (
                                    <tr 
                                        key={stock.code} 
                                        className={`hover:bg-white/5 cursor-pointer transition-colors ${stock.code === onSelectStock?.code ? 'bg-indigo-500/10' : ''}`}
                                        onClick={() => onSelectStock(stock)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-3">
                                            <div className="w-8 h-8 shrink-0"><StockLogo code={stock.code} className="w-full h-full" /></div>
                                            {stock.code.replace('.JK', '')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 hidden sm:table-cell">{stock.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 hidden md:table-cell">{stock.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-slate-300">Rp {stock.price ? stock.price.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                                            <span className={`flex items-center justify-end ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {isPositive ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
                                                {stock.change ? Math.abs(stock.change).toFixed(2) : '0.00'}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const DetailViewPlaceholder = ({ title }) => (
    <div className={`${COMMON_CARD_STYLE} h-[50vh] sm:h-[70vh] flex items-center justify-center text-center`}>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-500 flex flex-col sm:flex-row items-center gap-3">
             <ShieldHalf size={32} className="text-indigo-500/50"/> <span>{title}</span>
        </h2>
    </div>
);

const App = () => {
  const [stockList, setStockList] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [newsData, setNewsData] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mainView, setMainView] = useState('Dashboard');
  const [chartRange, setChartRange] = useState('1M');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for ai
  const [aiAnalysis, setAiAnalysis] = useState({ 
    text: "Waiting for market signals...", 
    upside: "", 
    sentiment: "" 
  });
  
  // Cache for ai insights
  const [aiCache, setAiCache] = useState({});

  const [typedText, setTypedText] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Typewriter effect logic
  useEffect(() => {
    if (!aiAnalysis.text) return;
    
    let i = 0;
    setTypedText(""); 
    const speed = 20; 
    
    const intervalId = setInterval(() => {
      setTypedText((prev) => {
          if (i < aiAnalysis.text.length) {
              return prev + aiAnalysis.text.charAt(i);
          }
          return prev;
      });
      i++;
      if (i >= aiAnalysis.text.length) clearInterval(intervalId);
    }, speed);

    return () => clearInterval(intervalId);
  }, [aiAnalysis.text]);

  // Check cache before fetching gemini insight
  const fetchGeminiInsight = useCallback(async (stockCode, price, change) => {
    if (aiCache[stockCode]) {
        setAiAnalysis(aiCache[stockCode]);
        return;
    }

    setIsAiLoading(true);
    setTypedText("");
    
    try {
        const data = await getGeminiInsight(stockCode, price, change);

        if (data) {
            const result = {
                text: data.summary || "Data not available.",
                upside: "",
                sentiment: "",
            };
            
            setAiAnalysis(result);
            setAiCache(prev => ({
                ...prev,
                [stockCode]: result
            }));
        }
    } catch (error) {
        console.error("Ai error:", error);
        setAiAnalysis({
            text: `Offline mode: Ai connection lost.`,
            upside: "",
            sentiment: "",
        });
    } finally {
        setIsAiLoading(false);
    }
  }, [aiCache]); 

  const customTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    const len = chartData.length;

    if (chartRange === '5D') {
        if (len < 5) return [];
        const t1 = Math.floor(len * 0.25);
        const t2 = Math.floor(len * 0.50);
        const t3 = Math.floor(len * 0.75);
        return [chartData[t1].rawDate, chartData[t2].rawDate, chartData[t3].rawDate];
    }
    
    if (chartRange === '1M') {
        if (len < 5) return [];
        const t1 = Math.floor(len * 0.20);
        const t2 = Math.floor(len * 0.40);
        const t3 = Math.floor(len * 0.60);
        const t4 = Math.floor(len * 0.80);
        const indices = [...new Set([t1, t2, t3, t4])].sort((a, b) => a - b);
        return indices.map(i => chartData[i].rawDate);
    }

    const ticks = [];
    let lastMonth = -1;
    let lastYear = -1;
    chartData.forEach((item, index) => {
        const d = new Date(item.rawDate);
        const currentMonth = d.getMonth();
        const currentYear = d.getFullYear();
        if (index === 0) { lastMonth = currentMonth; lastYear = currentYear; return; }
        if (currentMonth !== lastMonth || currentYear !== lastYear) {
            ticks.push(item.rawDate); 
            lastMonth = currentMonth;
            lastYear = currentYear;
        }
    });
    return ticks;
  }, [chartData, chartRange]);

  const fetchMarketData = useCallback(async () => {
    try {
        const codes = Object.keys(COMPANY_META);
        let tempStockList = [];
        for (const code of codes) {
            const { data, error } = await supabase.from('stock_predictions').select('*').eq('code', code).order('date', { ascending: false }).limit(2);
            if (data && data.length > 0) {
                const latest = data[0];
                const prev = data.length > 1 ? data[1] : latest;
                const price = latest.actual_close || latest.predicted_close || 0;
                const prevPrice = prev.actual_close || prev.predicted_close || price;
                const change = prevPrice !== 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
                tempStockList.push({
                    code: code, name: COMPANY_META[code].name, type: COMPANY_META[code].type,
                    price: price, change: change, volatility: latest.predicted_volatility
                });
            }
        }
        setStockList(tempStockList);
        if (!selectedStock && tempStockList.length > 0) setSelectedStock(tempStockList.find(s => s.code === 'BBCA.JK') || tempStockList[0]);
    } catch (err) { console.error("Fetch error:", err); }
  }, [selectedStock]);

  const fetchChartData = useCallback(async () => {
    if (!selectedStock) return;
    
    let query = supabase.from('stock_predictions').select('*').eq('code', selectedStock.code).order('date', { ascending: false });
    
    if (chartRange === '5D') { 
        query = query.limit(5); 
    } else {
        const startDate = getStartDateISO(chartRange);
        if (startDate) query = query.gte('date', startDate);
    }
    
    // Use await to get the actual result from the database
    const { data, error } = await query;
    
    if (error) {
        console.error("Database fetch error:", error);
        return;
    }

    const reversedData = data ? [...data].reverse() : [];
    const mappedData = reversedData.map(item => ({
        day: formatFullDate(item.date),
        rawDate: item.date,
        price: item.actual_close, 
        forecast: item.predicted_close,
        type: item.actual_close ? 'history' : 'forecast'
    }));
    setChartData(mappedData);
  }, [selectedStock, chartRange]);

  const fetchNews = useCallback(async () => {
    if (!selectedStock) return;
    const cleanCode = selectedStock.code.replace('.JK', '');
    const { data } = await supabase.from('sentimen_saham').select('*').eq('code', cleanCode).order('published_at', { ascending: false }).limit(10);
    if (data) {
        setNewsData(data.map(n => ({
            id: n.id, title: n.title, url: n.url, 
            source: n.url ? new URL(n.url).hostname.replace('www.', '') : 'News',
            time: n.published_at ? new Date(n.published_at).toLocaleDateString('en-US') : '',
            sentiment: n.sentiment, code: n.code, score: n.score
        })));
    }
  }, [selectedStock]); 

  useEffect(() => { fetchMarketData(); }, []);
  
  useEffect(() => { 
    if (selectedStock) { 
        fetchChartData(); 
        fetchNews(); 
        fetchGeminiInsight(selectedStock.code.replace('.JK',''), selectedStock.price, selectedStock.change);
    } 
  }, [selectedStock, chartRange, fetchChartData, fetchNews, fetchGeminiInsight]);

  // Synchronize data fetching
  const handleRefreshData = async () => { 
      if (isRefreshing) return;
      setIsRefreshing(true);
      
      try {
        const promises = [fetchMarketData(), fetchNews(), fetchChartData()];
        
        if(selectedStock) {
            promises.push(fetchGeminiInsight(selectedStock.code.replace('.JK',''), selectedStock.price, selectedStock.change));
        }
        
        await Promise.all(promises);
      } catch (error) {
        console.error("Sync failure:", error);
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000); 
      }
  };
  
  const handleSelectStock = (stock) => { setSelectedStock(stock); setMainView('Dashboard'); setChartRange('1M'); };
  const handleRangeChange = (range) => setChartRange(range);
  const handleBellClick = () => console.log("Notification clicked");

  const volatilityData = useMemo(() => {
      if (!selectedStock) return { volatility: 0, regime: 'N/A', color: 'text-slate-400' };
      const stockInfo = stockList.find(s => s.code === selectedStock.code);
      const vol = stockInfo && stockInfo.volatility ? stockInfo.volatility : 0;
      let regime, color, indicator;
      if (vol >= 0.05) { regime = 'Extreme Volatility'; color = 'text-rose-400'; indicator = 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'; } 
      else if (vol >= 0.03) { regime = 'High Volatility'; color = 'text-orange-400'; indicator = 'bg-orange-500 shadow-[0_0_10px_#fb923c]'; } 
      else if (vol >= 0.01) { regime = 'Medium Volatility'; color = 'text-indigo-400'; indicator = 'bg-indigo-500 shadow-[0_0_10px_#6366f1]'; } 
      else { regime = 'Low Volatility'; color = 'text-emerald-400'; indicator = 'bg-emerald-500 shadow-[0_0_10px_#10b981]'; }
      return { volatility: (vol * 100).toFixed(2), regime, color, indicator };
  }, [selectedStock, stockList]);

  const cnbcSentimentData = useMemo(() => {
    if (!selectedStock || newsData.length === 0) return [];
    const pos = newsData.filter(n => n.sentiment === 'positive').length;
    const neg = newsData.filter(n => n.sentiment === 'negative').length;
    const neu = newsData.filter(n => n.sentiment === 'neutral').length;
    const total = pos + neg + neu || 1;
    
    return [
        { name: 'Positive', value: Math.round((pos/total)*100), color: SENTIMENT_COLORS.positive },
        { name: 'Negative', value: Math.round((neg/total)*100), color: SENTIMENT_COLORS.negative },
        { name: 'Neutral', value: Math.round((neu/total)*100), color: SENTIMENT_COLORS.neutral },
    ];
  }, [selectedStock, newsData]);

  const priceForecastInterpretation = useMemo(() => {
    if (!chartData || chartData.length === 0) return { signal: 'NEUTRAL', diff: 0, color: 'text-slate-400' };
    const historyData = chartData.filter(d => d.type === 'history');
    const currentPrice = historyData.length > 0 ? historyData[historyData.length - 1].price : 0;
    const lastPoint = chartData[chartData.length - 1];
    const targetPrice = lastPoint.forecast || lastPoint.price;
    const diff = currentPrice !== 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
    let signal, color;
    if (diff > 2) { signal = 'STRONG BUY'; color = 'text-emerald-400'; } 
    else if (diff > 0.5) { signal = 'BUY'; color = 'text-emerald-400'; } 
    else if (diff < -2) { signal = 'STRONG SELL'; color = 'text-rose-400'; } 
    else if (diff < -0.5) { signal = 'SELL'; color = 'text-rose-400'; } 
    else { signal = 'HOLD'; color = 'text-yellow-400'; }
    return { signal, diff: diff.toFixed(2), color, endPrice: targetPrice };
  }, [chartData]);

  const topMovers = useMemo(() => {
      if (!stockList || stockList.length === 0) return [];
      return [...stockList].sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));
  }, [stockList]);
    
  const renderMainContent = () => {
    if (!selectedStock) return <div className="text-white text-center p-20 flex flex-col items-center gap-4"><div className="relative"><RefreshCw className="animate-spin text-indigo-500" size={40}/><div className="absolute inset-0 animate-ping bg-indigo-500 rounded-full opacity-20"></div></div><p className="text-slate-400">Loading market data...</p></div>;
    const displayCode = selectedStock.code.replace('.JK', ''); 

    switch (mainView) {
        case 'Full News Feed': return <FullNewsFeed newsData={newsData} selectedCode={displayCode} />;
        case 'All Market Movers': return <AllMarketMoversTable stockList={stockList} onSelectStock={handleSelectStock} />; 
        case 'Model Evaluation': return <DetailViewPlaceholder title="Model Evaluation & Backtest" />;
        case 'Dashboard':
        default:
            return (
                <div className={`flex flex-col ${LAYOUT_GAP}`}>
                    {/* Header section */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                                Issuer Details 
                                <span className="text-indigo-400 bg-indigo-500/10 px-3 py-0.5 rounded-xl border border-indigo-500/20 text-2xl">{displayCode}</span>
                            </h2>
                            <p className="text-base text-slate-400 font-medium flex items-center gap-2">
                                {selectedStock.name} <span className="w-1 h-1 rounded-full bg-slate-600"></span> <span className="text-slate-500">{selectedStock.type}</span>
                            </p>
                        </div>
                        <button onClick={handleRefreshData} disabled={isRefreshing} className={`w-full lg:w-auto justify-center px-6 py-3 rounded-xl text-white text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 ${isRefreshing ? 'bg-slate-700 cursor-not-allowed opacity-70' : 'bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/30 active:scale-95'}`}>
                            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? 'Syncing...' : 'Update Data'}
                        </button>
                    </div>
                      
                    <StockSlider stockList={stockList} selectedStock={selectedStock} onSelectStock={handleSelectStock} />

                    {/* Metrics grid */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${LAYOUT_GAP}`}>
                        <MetricCard title="Target Close (Est)" value={priceForecastInterpretation.endPrice ? Math.round(priceForecastInterpretation.endPrice).toLocaleString() : 'N/A'} change={parseFloat(priceForecastInterpretation.diff)} isCurrency icon={Zap} subLabel="Model Forecast" />
                        
                        <div className={`${COMMON_CARD_STYLE} flex flex-col justify-between hover:-translate-y-1 h-full min-h-[180px]`}>
                            <div className="flex items-start justify-between w-full mb-4">
                                <p className="text-slate-400 text-sm font-semibold tracking-wide">STOCK SIGNAL</p>
                                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/10"><Activity size={18} className={priceForecastInterpretation.color.replace('text-', 'text-')} /></div>
                            </div>
                            <div className="flex-1 flex flex-col justify-end gap-2">
                                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase leading-none drop-shadow-md ${priceForecastInterpretation.color}`}>{priceForecastInterpretation.signal}</h3>
                                <div className="mt-2 pt-3 border-t border-white/5 flex items-center gap-2"><span className="px-2 py-1 rounded-md bg-white/5 text-xs text-slate-400 font-mono">Confidence: 87.4%</span></div>
                            </div>
                        </div>

                        <div className={`${COMMON_CARD_STYLE} flex flex-col justify-between hover:-translate-y-1 h-full min-h-[180px]`}>
                            <div className="flex items-start justify-between w-full mb-4">
                                <p className="text-slate-400 text-sm font-semibold tracking-wide">VOLATILITY</p>
                                <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/10"><Wind size={18} className="text-blue-400" /></div>
                            </div>
                            <div className="flex-1 flex flex-col justify-end gap-2">
                                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{volatilityData.volatility}%</h3>
                                <div className="mt-2 pt-3 border-t border-white/5 flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${volatilityData.indicator}`}></span><span className={`text-sm font-medium ${volatilityData.color}`}>{volatilityData.regime}</span></div>
                            </div>
                        </div>

                        <MetricCard title="Top Gainer" value={<div className="flex items-center gap-3"><div className="w-8 h-8 shrink-0"><StockLogo code={topMovers[0]?.code || 'GOTO'} className="w-full h-full" /></div><span>{topMovers[0]?.code.replace('.JK', '') || 'GOTO'}</span></div>} change={topMovers[0]?.change || 0} icon={TrendingUp} subLabel="vs Prev Close" />
                    </div>

                    <div className={`grid grid-cols-1 lg:grid-cols-12 ${LAYOUT_GAP}`}>
                        
                        {/* Main chart column */}
                        <div className="lg:col-span-8">
                            <div className={`${PRIMARY_CARD_STYLE} p-1 flex flex-col`}> 
                                <div className={`${CARD_PADDING} flex-1 flex flex-col`}>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
                                        <div>
                                            {/* Xgboost badge style */}
                                            <h3 className="text-xl font-bold text-white flex items-center gap-3">{displayCode} Forecast <span className="text-[11px] font-bold text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg bg-indigo-500/10 tracking-wider flex items-center justify-center">XGBOOST</span></h3>
                                            <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                                                Current: <span className="text-white font-mono text-base">Rp {selectedStock.price ? selectedStock.price.toLocaleString() : '-'}</span> <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            </p>
                                        </div>
                                        <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                                            <div className="flex bg-[#0b0f19] rounded-xl p-1.5 border border-white/5 w-max shadow-inner">
                                            {CHART_RANGES.map(range => (
                                                <button key={range} onClick={() => handleRangeChange(range)} className={`px-4 py-1.5 text-xs font-bold transition-all rounded-lg whitespace-nowrap ${chartRange === range ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{range}</button>
                                            ))}
                                        </div>
                                        </div>
                                    </div>

                                    <div className="w-full min-w-0 flex-1 min-h-[300px]"> 
                                        {chartData.length > 0 ? (
                                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                <ResponsiveContainer width="99%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 10 }}> 
                                                    <defs>
                                                        <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                                                        <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                    
                                                    <XAxis 
                                                        dataKey="rawDate" 
                                                        stroke="#475569" 
                                                        tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        minTickGap={20} 
                                                        padding={{ left: 0, right: 0 }} 
                                                        ticks={customTicks} 
                                                        interval={customTicks ? 0 : 'preserveStartEnd'} 
                                                        tickFormatter={(value) => {
                                                            const date = new Date(value);
                                                            if (chartRange === '5D') return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
                                                            if (chartRange === '1M') {
                                                                if (date.getDate() <= 7) return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
                                                                return date.getDate(); 
                                                            }
                                                            if (chartRange === '6M') return date.toLocaleDateString('en-US', { month: 'short' });
                                                            if (chartRange === 'YTD') return date.toLocaleDateString('en-US', { month: 'short' });
                                                            if (chartRange === '1Y') {
                                                                if (date.getMonth() === 0) return date.getFullYear();
                                                                return date.toLocaleDateString('en-US', { month: 'short' });
                                                            }
                                                            return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
                                                        }}
                                                    />
                                                    
                                                    <YAxis stroke="#475569" tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value/1000).toFixed(1)}k`} tickMargin={16} domain={['auto', 'auto']} />
                                                    
                                                    <Tooltip content={<CustomTooltip />} />
                                                    
                                                    <Area type="monotone" dataKey="price" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorHistory)" dot={false} connectNulls={true} activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}/>
                                                    <Area type="monotone" dataKey="forecast" stroke="#34d399" strokeDasharray="5 5" strokeWidth={3} fillOpacity={1} fill="url(#colorForecast)" dot={false} connectNulls={true} activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}/>
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-slate-500 animate-pulse">
                                                Loading chart data...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Market movers column */}
                        <div className="lg:col-span-4">
                            <div className={`${PRIMARY_CARD_STYLE}`}>
                                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-200 text-lg">Top Movers (Real)</h3><button onClick={() => setMainView('All Market Movers')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors">SCREENER <ChevronRight size={12}/></button></div>
                                <div className="space-y-3">
                                {topMovers.slice(0, 5).map((stock) => {
                                    const isGainer = stock.change >= 0;
                                    return (
                                    <div key={stock.code} className={`flex justify-between items-center p-3.5 rounded-xl transition-all cursor-pointer border border-transparent ${stock.code === selectedStock.code ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'hover:bg-white/5 hover:border-white/5'}`} onClick={() => handleSelectStock(stock)}>
                                            <div className="flex items-center gap-3"><div className={`w-10 h-10 flex items-center justify-center shrink-0 ${isGainer ? 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] rounded-full ring-1 ring-emerald-500/20' : 'shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)] rounded-full ring-1 ring-rose-500/20'}`}><StockLogo code={stock.code} className="w-full h-full" /></div><div><p className="font-black text-sm text-white tracking-wide">{stock.code.replace('.JK', '')}</p><p className="text-[10px] sm:text-xs text-slate-400 font-mono">Rp {stock.price ? stock.price.toLocaleString() : '-'}</p></div></div>
                                            <div className={`text-sm font-bold flex items-center ${isGainer ? 'text-emerald-400' : 'text-rose-400'}`}>{stock.change > 0 ? '+' : ''}{stock.change ? stock.change.toFixed(2) : '0.00'}%{isGainer ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} className="mr-0.5" />}</div>
                                    </div>
                                    );
                                })}
                            </div>
                            </div>
                        </div>

                    </div>
                    
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${LAYOUT_GAP}`}>
                        
                        {/* Ai analysis card */}
                        <div className={`${SECONDARY_CARD_STYLE} flex flex-col relative overflow-hidden group border-indigo-500/30`}>
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-linear-to-br from-indigo-500 to-violet-600 rounded-lg shadow-lg shadow-indigo-500/20">
                                        <BrainCircuit size={20} className="text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg tracking-tight">Ai Market Insight</h3>
                                </div>
                                <div className="px-2 py-1 rounded-md bg-indigo-950/50 border border-indigo-500/30 flex items-center gap-1.5">
                                    <Sparkles size={12} className={`text-indigo-400 ${isAiLoading ? 'animate-spin' : 'animate-pulse'}`}/>
                                    <span className="text-[10px] font-bold text-indigo-300 tracking-wider">GEMINI</span>
                                </div>
                            </div>
                            
                            <div className="flex-1 bg-[#0b0f19]/80 rounded-xl border border-white/5 p-4 relative overflow-hidden flex flex-col justify-start overflow-y-auto custom-scrollbar">
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <div className={`w-1 rounded-full bg-indigo-500 self-stretch shrink-0 ${isAiLoading ? 'animate-pulse' : ''}`}></div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                                {isAiLoading ? (
                                                    <span className="animate-pulse text-slate-500">Analyzing real-time market data...</span>
                                                ) : (
                                                    <>
                                                        {typedText}
                                                        <span className="inline-block w-0.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle"></span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Sentiment chart */}
                        <div className={`${SECONDARY_CARD_STYLE} flex flex-col`}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/10"><Newspaper size={20} className="text-amber-400" /></div>
                                <h3 className="font-bold text-slate-200 text-base">Sentiment Distribution</h3>
                                {newsData.length > 0 && <span className="ml-auto text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center justify-center">{newsData.length} NEWS</span>}
                            </div>
                            
                            <div className="flex-1 w-full min-h-0">
                            {newsData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={cnbcSentimentData} 
                                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }} 
                                        maxBarSize={50}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#64748b" 
                                            tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} 
                                            tickMargin={12} 
                                            axisLine={false} 
                                            tickLine={false}
                                        />
                                        <YAxis hide domain={[0, 100]} />
                                        <Tooltip 
                                            cursor={{fill: '#ffffff05'}}
                                            content={<SentimentTooltip />}
                                        />
                                        <Bar 
                                            dataKey="value" 
                                            radius={[8, 8, 8, 8]} 
                                            background={{ fill: 'rgba(255, 255, 255, 0.05)', radius: [8, 8, 8, 8] }} 
                                        >
                                            {cnbcSentimentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} className="hover:opacity-80 transition-opacity cursor-pointer"/>
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/2">
                                    <p className="text-slate-500 text-xs font-medium">No sentiment data available.</p>
                                </div>
                            )}
                            </div>
                        </div>

                        {/* News feed mini */}
                        <div className={`${SECONDARY_CARD_STYLE} flex flex-col`}>
                            <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="font-bold text-slate-200 text-lg truncate mr-2">Latest News</h3><button onClick={() => setMainView('Full News Feed')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 whitespace-nowrap bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors">VIEW ALL</button></div>
                            
                            <div className="flex-1 overflow-hidden flex flex-col gap-4 justify-end pb-1">
                                {newsData.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-70">
                                        <FileText size={32} className="text-slate-600 mb-2"/>
                                        <p className="text-slate-500 text-xs text-center">No latest news available for {displayCode}.</p>
                                    </div>
                                ) : (
                                    newsData.slice(0, 3).map((news) => (
                                        <div key={news.id} className="group relative pl-4 border-l-2 border-white/5 hover:border-indigo-500 transition-colors shrink-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{news.source || 'News'}</span>
                                                <span className={`w-2 h-2 rounded-full ${news.sentiment === 'positive' ? 'bg-emerald-500' : news.sentiment === 'negative' ? 'bg-rose-500' : 'bg-violet-500'}`}></span>
                                            </div>
                                            <a href={news.url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm font-semibold text-slate-200 leading-snug hover:text-indigo-400 transition-colors line-clamp-2 block mb-1">{news.title}</a>
                                            <span className="text-[10px] text-slate-600">{news.time}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            );
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[150px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-violet-900/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>
      
      {/* Global styling */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none !important; } 
        .hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; } 
        .recharts-wrapper { outline: none !important; } 
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #020617; 
        }
        ::-webkit-scrollbar-thumb {
          background: #4338ca;
          border-radius: 5px;
          border: 2px solid #020617;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #6366f1;
        }
      `}</style>
      
      <div className="flex h-screen overflow-hidden">
        {sidebarOpen && <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
        <aside className={`fixed z-50 lg:relative h-full w-[280px] lg:w-72 bg-[#020617] border-r border-white/5 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-8 flex items-center justify-between lg:justify-start gap-4 mb-2">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10"><Zap size={22} className="text-white" /></div><h1 className="text-2xl font-black text-white tracking-tight">IndoStock<span className="text-indigo-400">Ai</span></h1></div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
          </div>
          <nav className="mt-4 px-6 space-y-2">
            {['Dashboard', 'Full News Feed', 'All Market Movers', 'Model Evaluation'].map((item) => (
              <button key={item} onClick={() => { setSidebarOpen(false); setMainView(item); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group ${mainView === item ? 'bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/20 font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white font-medium'}`}>
                {item === 'Dashboard' ? <Activity size={20} className={mainView === item ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'} /> : item === 'Full News Feed' ? <Newspaper size={20} className={mainView === item ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'}/> : item === 'All Market Movers' ? <ListOrdered size={20} className={mainView === item ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'}/> : <BarChart2 size={20} className={mainView === item ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'}/>}<span className="text-sm">{item}</span>
                {mainView === item && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
              </button>
            ))}
          </nav>
          
          <div className="absolute bottom-8 left-0 w-full px-6">
            <div className="bg-linear-to-br from-indigo-900/20 to-violet-900/20 border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl"></div>
                <h4 className="text-white font-bold mb-1 relative z-10">Upgrade Pro</h4>
                <p className="text-xs text-indigo-200/70 mb-3 relative z-10">Get realtime signals & ai predictions.</p>
                <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all relative z-10">Upgrade Now</button>
            </div>
            
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <header className={`h-24 flex items-center justify-between border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-30 ${LAYOUT_PX}`}>
            <div className="flex items-center gap-4"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-400 hover:text-white"><Menu size={24} /></button><h2 className="text-xl font-bold text-white hidden md:block tracking-tight">{mainView === 'Dashboard' ? 'IndoStockAI Dashboard' : mainView}</h2><h2 className="text-base font-bold text-white md:hidden">{mainView === 'Dashboard' ? 'Dashboard' : mainView}</h2></div>
            <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-sm font-bold text-white">Group 2 - Big Data Analysis</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider">PRO MEMBER</span>
                </div>
                <button onClick={handleBellClick} className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5"><Bell size={20} /><span className="absolute top-2.5 right-3 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e] animate-pulse"></span></button>
                <div className="h-10 w-10 rounded-full bg-linear-to-tr from-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20 cursor-pointer hover:scale-105 transition-transform"><div className="h-full w-full rounded-full bg-[#020617] flex items-center justify-center"><User size={20} className="text-white" /></div></div>
            </div>
          </header>
          <div className={`flex-1 overflow-y-auto ${LAYOUT_PX} py-8 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent`}>{renderMainContent()}</div>
        </main>
      </div>
    </div>
  );
};

export default App;
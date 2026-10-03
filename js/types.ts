export interface Transaction {
  id?: number;
  amount: number;
  date: string;
  type: string;
  category: string;
  notes?: string;
  accountId?: number;
  [key: string]: any;
}

export interface Account {
  id?: number;
  name: string;
  type: string;
  balance: number;
  [key: string]: any;
}

export interface Budget {
  id?: number;
  category: string;
  limit: number;
  spent: number;
  [key: string]: any;
}

export interface GoalContribution {
  id?: number;
  goal_id?: number;
  amount: number;
  date: string;
  note?: string | null;
  account_id?: number | null;
  type?: 'deposit' | 'withdraw';
  [key: string]: any;
}

export interface Goal {
  id: number;
  name: string;
  cat: string;
  emoji?: string;
  color: string;
  target: number;
  current: number;
  deadline?: string | null;
  start_date?: string | null;
  currency?: string;
  notes?: string | null;
  status?: 'active' | 'paused' | 'completed' | string;
  created_at?: string | null;
  contributions?: GoalContribution[];
  [key: string]: any;
}

declare global {
  interface Window {
    [key: string]: any;
  }
  interface Document {
    querySelector(selectors: string): HTMLElement | any;
    querySelectorAll(selectors: string): NodeListOf<HTMLElement | any>;
    getElementById(elementId: string): HTMLElement | any;
  }
  interface HTMLElement {
    value?: any;
    disabled?: any;
    options?: any;
    selectedIndex?: any;
    text?: any;
    placeholder?: any;
    src?: any;
    _customSelectBtn?: any;
    _customSelectList?: any;
    _customSelectWrapper?: any;
  }
  
  var scCameraStream: any;
  var scStopCamera: any;
  var scCleanupWorker: any;
  var renderAll: any;
  var initQuickAdd: any;
  var txFilter: any;
  var txSort: any;
  var txPage: any;
  var enterTxView: any;
  var syncTxFilterUI: any;
  var renderTxView: any;
  var enterBudgetView: any;
  var enterCuentasView: any;
  var enterReportesView: any;
  var enterObjetivosView: any;
  var enterScannerView: any;
  var enterInsightsView: any;
  var enterPerfilView: any;
  var detectLocation: any;
  var initShopping: any;
  var toggleSidebar: any;
  var updateCustomSelectDisplay: any;
  var setPage: any;
  var initCustomSelects: any;
  var getCurrencySymbol: any;
  var formatMoney: any;
  var formatCurrency: any;
  var escHtml: any;
  var renderChart: any;
  var renderBudgets: any;
  var ExcelJS: any;
  var currentPage: any;
  var IS_SERVER: any;
  var state: any;
  var Tesseract: any;
  var loadUserData: any;
  var save: any;
  var applyTxFilter: any;
  var formatDate: any;
  var Chart: any;
  var google: any;
  var Papa: any;
  var renderCuentasView: any;
}

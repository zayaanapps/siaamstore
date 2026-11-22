import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Edit3,
  Trash2,
  ArrowLeft,
  Phone,
  MapPin,
  Users,
  User,
  UserPlus,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Receipt,
  Fingerprint,
  FileText,
  Sparkles,
  ArrowUpDown,
  FileDown,
  Printer,
  X,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  AppLanguage,
  Customer,
  StoreTransaction,
  formatMoney,
  toBengaliDigits,
  formatTimestamp,
} from '../types/dokan';
import { DokanTranslations } from '../i18n/strings';

interface CustomersViewProps {
  customers: Customer[];
  transactions: StoreTransaction[];
  strings: DokanTranslations;
  language: AppLanguage;
  onAddCustomer: (params: {
    name: string;
    phone: string;
    address: string;
    initialDue: number;
    identityHint?: string;
    note?: string;
  }) => Promise<void>;
  onUpdateCustomer: (
    customer: Customer,
    params: {
      name: string;
      phone: string;
      address: string;
      identityHint?: string;
      note?: string;
    }
  ) => Promise<void>;
  onRecordPaymentOrCredit: (params: {
    customer: Customer;
    amount: number;
    isGiveDue: boolean;
    notes: string;
  }) => Promise<void>;
  onDeleteCustomerTransaction: (tx: StoreTransaction) => Promise<void>;
  onDeleteCustomer: (customerId: string, customerName: string) => Promise<void>;
}

type CustomerSortBy = 'DUE_DESC' | 'SL_ASC' | 'NAME_ASC';

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  transactions,
  strings,
  language,
  onAddCustomer,
  onUpdateCustomer,
  onRecordPaymentOrCredit,
  onDeleteCustomerTransaction,
  onDeleteCustomer,
}) => {
  const isBengali = language === AppLanguage.BENGALI;
  const [searchQuery, setSearchQuery] = useState('');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'HAS_DUES' | 'NO_DUES'>(
    'ALL'
  );
  const [sortBy, setSortBy] = useState<CustomerSortBy>('DUE_DESC');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // Add/Edit Customer Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [identityHintInput, setIdentityHintInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [customerNoteInput, setCustomerNoteInput] = useState('');
  const [initialDueInput, setInitialDueInput] = useState('');

  // Credit / Payment Modal (works from both list card & detail view)
  const [creditPaymentTarget, setCreditPaymentTarget] =
    useState<Customer | null>(null);
  const [creditPaymentMode, setCreditPaymentMode] = useState<
    'CREDIT' | 'PAYMENT' | null
  >(null);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  const [confirmDeleteCustomer, setConfirmDeleteCustomer] =
    useState<Customer | null>(null);

  // PDF Report Modal State: either 'CENTRAL' or an individual Customer
  const [pdfReportMode, setPdfReportMode] = useState<
    { type: 'CENTRAL' } | { type: 'CUSTOMER'; customer: Customer } | null
  >(null);
  const [centralReportScope, setCentralReportScope] = useState<
    'ALL' | 'HAS_DUES'
  >('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  // Chronological SL Number map: 1st added customer = 1, 2nd = 2, and so on
  const customerSlMap = useMemo(() => {
    const sortedByCreation = [...customers].sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
      if (aTime !== bTime) {
        if (aTime === 0) return 1;
        if (bTime === 0) return -1;
        return aTime - bTime;
      }
      return a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    sortedByCreation.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [customers]);

  // Last transaction timestamp map per customer
  const lastTxByCustomerMap = useMemo(() => {
    const map = new Map<string, StoreTransaction>();
    for (const tx of transactions) {
      if (tx.customerId && !map.has(tx.customerId)) {
        map.set(tx.customerId, tx);
      }
    }
    return map;
  }, [transactions]);

  const totalPendingDues = customers.reduce(
    (acc, c) => acc + Math.max(0, c.totalDue),
    0
  );
  const totalLifetimePurchased = customers.reduce(
    (acc, c) => acc + Math.max(0, c.totalPurchased),
    0
  );
  const totalLifetimePaid = customers.reduce(
    (acc, c) => acc + Math.max(0, c.totalPaid),
    0
  );
  const customersOwingCount = customers.filter((c) => c.totalDue > 0).length;
  const customersSettledCount = customers.length - customersOwingCount;

  const identityHintPresets = isBengali
    ? [
        'পূর্ব পাড়া',
        'পশ্চিম পাড়া',
        'উত্তর পাড়া',
        'দক্ষিণ পাড়া',
        'বাজারের ব্যবসায়ী',
        'শিক্ষক',
        'চাকরিজীবী',
        'নিয়মিত ক্রেতা',
      ]
    : [
        'East Para',
        'West Para',
        'Bazaar Merchant',
        'Teacher',
        'Service Holder',
        'Regular Customer',
      ];

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setNameInput('');
    setIdentityHintInput('');
    setPhoneInput('');
    setAddressInput('');
    setCustomerNoteInput('');
    setInitialDueInput('');
    setShowCustomerModal(true);
  };

  const openEditCustomer = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(customer);
    setNameInput(customer.name);
    setIdentityHintInput(customer.identityHint || '');
    setPhoneInput(customer.phone === '—' ? '' : customer.phone);
    setAddressInput(customer.address);
    setCustomerNoteInput(customer.note || '');
    setInitialDueInput(String(customer.totalDue));
    setShowCustomerModal(true);
  };

  const openCreditOrPaymentModal = (
    customer: Customer,
    mode: 'CREDIT' | 'PAYMENT',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setCreditPaymentTarget(customer);
    setCreditPaymentMode(mode);
    setAmountInput(
      mode === 'PAYMENT' && customer.totalDue > 0
        ? String(customer.totalDue)
        : ''
    );
    setNoteInput('');
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    if (editingCustomer) {
      await onUpdateCustomer(editingCustomer, {
        name: nameInput.trim(),
        phone: phoneInput.trim(),
        address: addressInput.trim(),
        identityHint: identityHintInput.trim(),
        note: customerNoteInput.trim(),
      });
    } else {
      await onAddCustomer({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
        address: addressInput.trim(),
        initialDue: Math.max(0, Number(initialDueInput) || 0),
        identityHint: identityHintInput.trim(),
        note: customerNoteInput.trim(),
      });
    }
    setShowCustomerModal(false);
  };

  const handleCreditOrPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const target =
      (creditPaymentTarget &&
        customers.find((c) => c.id === creditPaymentTarget.id)) ||
      creditPaymentTarget ||
      activeCustomer;
    if (!target || !creditPaymentMode) return;
    const amt = Math.max(0, Number(amountInput) || 0);
    if (amt <= 0) return;

    await onRecordPaymentOrCredit({
      customer: target,
      amount: amt,
      isGiveDue: creditPaymentMode === 'CREDIT',
      notes: noteInput.trim(),
    });
    setCreditPaymentMode(null);
    setCreditPaymentTarget(null);
    setAmountInput('');
    setNoteInput('');
  };

  // Exact SMS text requested by user:
  // "আসসালামু আলাইকুম, (Name), সিয়াম স্টোরের পক্ষ থেকে শুভেচ্ছা। আপনার মোট দেনার পরিমাণ (Amount) টাকা। পরিশোধের জন্য অনুরোধ করা হলো।"
  const buildDueReminderText = (customer: Customer): string => {
    const formattedAmount = toBengaliDigits(
      formatMoney(customer.totalDue),
      AppLanguage.BENGALI
    );
    return `আসসালামু আলাইকুম, ${customer.name}, সিয়াম স্টোরের পক্ষ থেকে শুভেচ্ছা। আপনার মোট দেনার পরিমাণ ${formattedAmount} টাকা। পরিশোধের জন্য অনুরোধ করা হলো।`;
  };

  const handleDownloadPdfFile = async (filename: string) => {
    if (!pdfSheetRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const element = pdfSheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= pdfPageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
        heightLeft -= pdfPageHeight - margin * 2;
      }

      pdf.save(filename);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdfSheet = () => {
    if (!pdfSheetRef.current) return;
    const htmlContent = pdfSheetRef.current.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${strings.appName} - PDF Report</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif; }
    body { margin: 0; padding: 16px; color: #0f172a; background: #ffffff; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 11px; }
    th { background: #f1f5f9; font-weight: 800; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .text-red { color: #dc2626; }
    .text-green { color: #00965e; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>${htmlContent}</body>
</html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = customers.filter((c) => {
      const sl = customerSlMap.get(c.id) || 0;
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.identityHint || '').toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q) ||
        `#${sl}` === q ||
        String(sl) === q;
      const matchesDue =
        dueFilter === 'ALL'
          ? true
          : dueFilter === 'HAS_DUES'
          ? c.totalDue > 0
          : c.totalDue <= 0;
      return matchesSearch && matchesDue;
    });

    return list.sort((a, b) => {
      if (sortBy === 'SL_ASC') {
        return (customerSlMap.get(a.id) || 0) - (customerSlMap.get(b.id) || 0);
      }
      if (sortBy === 'NAME_ASC') {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      // DUE_DESC default
      if (b.totalDue !== a.totalDue) return b.totalDue - a.totalDue;
      return (customerSlMap.get(a.id) || 0) - (customerSlMap.get(b.id) || 0);
    });
  }, [customers, searchQuery, dueFilter, sortBy, customerSlMap]);

  const activeCustomer = selectedCustomer
    ? customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer
    : null;

  // Render PDF Report Preview & Download Modal (Individual Customer or Central Balance)
  const renderPdfReportModal = () => {
    if (!pdfReportMode) return null;

    const nowDateStr = new Date().toLocaleString(
      isBengali ? 'bn-BD' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );

    if (pdfReportMode.type === 'CUSTOMER') {
      const cust =
        customers.find((c) => c.id === pdfReportMode.customer.id) ||
        pdfReportMode.customer;
      const sl = customerSlMap.get(cust.id) || 1;
      const custTxs = transactions
        .filter(
          (t) =>
            t.customerId === cust.id ||
            t.customerName.toLowerCase() === cust.name.toLowerCase()
        )
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        );
      const safeFileName = `Siaam_Store_Customer_${cust.name.replace(
        /\s+/g,
        '_'
      )}_Report.pdf`;

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Modal Action Bar */}
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00965E]" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  {isBengali
                    ? `কাস্টমার লেনদেন ও ব্যালেন্স রিপোর্ট (PDF) — ${cust.name}`
                    : `Customer Transaction & Balance Report (PDF) — ${cust.name}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={() => handleDownloadPdfFile(safeFileName)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00965E] hover:bg-[#057A50] text-white text-xs font-extrabold shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingPdf
                      ? isBengali
                        ? 'তৈরি হচ্ছে...'
                        : 'Generating...'
                      : isBengali
                      ? 'পিডিএফ ডাউনলোড'
                      : 'Download PDF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdfSheet}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isBengali ? 'প্রিন্ট / সেভ' : 'Print / Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfReportMode(null)}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable A4 Sheet Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 dark:bg-slate-950">
              <div
                ref={pdfSheetRef}
                className="bg-white text-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 max-w-[780px] mx-auto"
              >
                {/* Store Header */}
                <div className="border-b-2 border-[#00965E] pb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-[#064E3B]">
                      {strings.appName}
                    </h2>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {strings.subtitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-[#064E3B] text-xs font-black">
                      {isBengali
                        ? 'কাস্টমার লেনদেন ও ব্যালেন্স রিপোর্ট'
                        : 'Customer Ledger & Balance Report'}
                    </span>
                    <p className="text-[10.5px] text-slate-500 mt-1">
                      {isBengali ? 'তারিখ:' : 'Date:'} {nowDateStr}
                    </p>
                  </div>
                </div>

                {/* Customer Profile & Balance Summary Box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-[10px] text-slate-500 font-bold block">
                      {isBengali ? 'কাস্টমার ও ক্রমিক' : 'Customer & SL'}
                    </span>
                    <p className="font-black text-slate-900 mt-0.5">
                      #{toBengaliDigits(sl, language)} — {cust.name}
                    </p>
                    {cust.identityHint && (
                      <p className="text-[10.5px] text-teal-700 font-bold mt-0.5">
                        {isBengali ? 'চেনার উপায়:' : 'Hint:'} {cust.identityHint}
                      </p>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <span className="text-[10px] text-slate-500 font-bold block">
                      {isBengali ? 'মোবাইল ও ঠিকানা' : 'Phone & Address'}
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {cust.phone || '—'}
                    </p>
                    <p className="text-[10.5px] text-slate-600 truncate">
                      {cust.address || '—'}
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg border ${
                      cust.totalDue > 0
                        ? 'border-red-300 bg-red-50'
                        : 'border-emerald-300 bg-emerald-50'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-600 block">
                      {isBengali ? 'বর্তমান বকেয়া (Balance)' : 'Current Due Balance'}
                    </span>
                    <p
                      className={`text-base font-black mt-0.5 ${
                        cust.totalDue > 0 ? 'text-red-600' : 'text-[#00965E]'
                      }`}
                    >
                      ৳{toBengaliDigits(formatMoney(cust.totalDue), language)}
                    </p>
                    <span className="text-[10px] font-bold text-slate-500">
                      {cust.totalDue > 0
                        ? isBengali
                          ? 'পরিশোধযোগ্য বকেয়া'
                          : 'Pending Due'
                        : isBengali
                        ? 'কোনো বাকি নেই'
                        : 'Settled'}
                    </span>
                  </div>
                </div>

                {cust.note && (
                  <div className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-900">
                    <strong>{isBengali ? 'নোট:' : 'Note:'}</strong> {cust.note}
                  </div>
                )}

                {/* Transactions Table */}
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 mb-1.5">
                    {isBengali
                      ? `লেনদেনের বিবরণী (${toBengaliDigits(
                          custTxs.length,
                          language
                        )} টি)`
                      : `Transaction History (${custTxs.length})`}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-300 px-2 py-1.5 text-center w-10">
                            #
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                            {isBengali ? 'তারিখ ও সময়' : 'Date & Time'}
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                            {isBengali ? 'ধরণ' : 'Type'}
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                            {isBengali ? 'বিবরণ' : 'Description'}
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">
                            {isBengali ? 'বাকি / ক্রয় (+)' : 'Credit / Sale (+)'}
                          </th>
                          <th className="border border-slate-300 px-2.5 py-1.5 text-right">
                            {isBengali ? 'জমা (-)' : 'Paid (-)'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {custTxs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="border border-slate-300 px-3 py-4 text-center text-slate-400"
                            >
                              {isBengali
                                ? 'কোনো লেনদেন পাওয়া যায়নি'
                                : 'No transactions recorded'}
                            </td>
                          </tr>
                        ) : (
                          custTxs.map((tx, idx) => {
                            const isPayment = tx.type === 'RECEIVE_PAYMENT';
                            const isSale = tx.type === 'SALE';
                            const creditAmt = isPayment ? 0 : tx.amount;
                            const paidAmt = isPayment
                              ? tx.amount
                              : isSale
                              ? tx.paidAmount
                              : 0;

                            return (
                              <tr key={tx.id} className="even:bg-slate-50/70">
                                <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                                  {toBengaliDigits(idx + 1, language)}
                                </td>
                                <td className="border border-slate-300 px-2.5 py-1.5 whitespace-nowrap">
                                  {formatTimestamp(tx.createdAt)}
                                </td>
                                <td className="border border-slate-300 px-2.5 py-1.5 font-bold">
                                  {isPayment
                                    ? isBengali
                                      ? 'জমা'
                                      : 'Payment'
                                    : isSale
                                    ? isBengali
                                      ? 'বিক্রি'
                                      : 'Sale'
                                    : isBengali
                                    ? 'বাকি প্রদান'
                                    : 'Credit Given'}
                                </td>
                                <td className="border border-slate-300 px-2.5 py-1.5">
                                  <span className="font-semibold text-slate-800">
                                    {tx.title}
                                  </span>
                                  {tx.notes && !tx.notes.startsWith('ITEMS:') && (
                                    <span className="text-slate-500 block text-[10px]">
                                      {tx.notes}
                                    </span>
                                  )}
                                </td>
                                <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold text-red-600">
                                  {creditAmt > 0
                                    ? `৳${toBengaliDigits(
                                        formatMoney(creditAmt),
                                        language
                                      )}`
                                    : '—'}
                                </td>
                                <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold text-[#00965E]">
                                  {paidAmt > 0
                                    ? `৳${toBengaliDigits(
                                        formatMoney(paidAmt),
                                        language
                                      )}`
                                    : '—'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black text-slate-900">
                          <td
                            colSpan={5}
                            className="border border-slate-300 px-2.5 py-2 text-right"
                          >
                            {isBengali
                              ? 'বর্তমান বকেয়া (Current Due Balance):'
                              : 'Current Due Balance:'}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 text-right text-red-600">
                            ৳
                            {toBengaliDigits(
                              formatMoney(cust.totalDue),
                              language
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // CENTRAL BALANCE REPORT
    const reportCustomers = [...customers]
      .filter((c) => (centralReportScope === 'HAS_DUES' ? c.totalDue > 0 : true))
      .sort(
        (a, b) => (customerSlMap.get(a.id) || 0) - (customerSlMap.get(b.id) || 0)
      );

    const reportTotalPurchased = reportCustomers.reduce(
      (s, c) => s + Math.max(0, c.totalPurchased),
      0
    );
    const reportTotalPaid = reportCustomers.reduce(
      (s, c) => s + Math.max(0, c.totalPaid),
      0
    );
    const reportTotalDue = reportCustomers.reduce(
      (s, c) => s + Math.max(0, c.totalDue),
      0
    );

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Modal Action Bar */}
          <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-[#00965E]" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                {isBengali
                  ? 'কেন্দ্রীয় কাস্টমার ব্যালেন্স রিপোর্ট (PDF)'
                  : 'Central Customer Balance Report (PDF)'}
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCentralReportScope('ALL')}
                  className={`px-2.5 py-1 cursor-pointer ${
                    centralReportScope === 'ALL'
                      ? 'bg-[#00965E] text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBengali
                    ? `সব কাস্টমার (${toBengaliDigits(customers.length, language)})`
                    : `All (${customers.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCentralReportScope('HAS_DUES')}
                  className={`px-2.5 py-1 cursor-pointer ${
                    centralReportScope === 'HAS_DUES'
                      ? 'bg-[#00965E] text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isBengali
                    ? `শুধু বকেয়া (${toBengaliDigits(
                        customersOwingCount,
                        language
                      )})`
                    : `Only Dues (${customersOwingCount})`}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() =>
                  handleDownloadPdfFile('Siaam_Store_Central_Balance_Report.pdf')
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00965E] hover:bg-[#057A50] text-white text-xs font-extrabold shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>
                  {isGeneratingPdf
                    ? isBengali
                      ? 'তৈরি হচ্ছে...'
                      : 'Generating...'
                    : isBengali
                    ? 'পিডিএফ ডাউনলোড'
                    : 'Download PDF'}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePrintPdfSheet}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isBengali ? 'প্রিন্ট / সেভ' : 'Print / Save'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPdfReportMode(null)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-red-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable A4 Sheet Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 dark:bg-slate-950">
            <div
              ref={pdfSheetRef}
              className="bg-white text-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 max-w-[820px] mx-auto"
            >
              {/* Store Header */}
              <div className="border-b-2 border-[#00965E] pb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#064E3B]">
                    {strings.appName}
                  </h2>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {strings.subtitle}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-[#064E3B] text-xs font-black">
                    {isBengali
                      ? 'কেন্দ্রীয় কাস্টমার ব্যালেন্স রিপোর্ট'
                      : 'Central Customer Balance Report'}
                  </span>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    {isBengali ? 'তারিখ:' : 'Date:'} {nowDateStr}
                  </p>
                </div>
              </div>

              {/* Summary Boxes */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    {isBengali ? 'মোট কাস্টমার' : 'Total Customers'}
                  </span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {toBengaliDigits(reportCustomers.length, language)}{' '}
                    {isBengali ? 'জন' : ''}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60">
                  <span className="text-[10px] text-amber-800 font-bold block">
                    {isBengali ? 'বকেয়া কাস্টমার' : 'Customers with Dues'}
                  </span>
                  <p className="text-sm font-black text-amber-700 mt-0.5">
                    {toBengaliDigits(
                      reportCustomers.filter((c) => c.totalDue > 0).length,
                      language
                    )}{' '}
                    {isBengali ? 'জন' : ''}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg border border-red-300 bg-red-50">
                  <span className="text-[10px] text-red-700 font-bold block">
                    {isBengali ? 'সর্বমোট বকেয়া পাওনা' : 'Total Pending Due'}
                  </span>
                  <p className="text-sm font-black text-red-600 mt-0.5">
                    ৳{toBengaliDigits(formatMoney(reportTotalDue), language)}
                  </p>
                </div>
              </div>

              {/* Central Balance Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-10">
                        SL
                      </th>
                      <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                        {isBengali ? 'কাস্টমারের নাম' : 'Customer Name'}
                      </th>
                      <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                        {isBengali ? 'চেনার উপায়' : 'Identity Hint'}
                      </th>
                      <th className="border border-slate-300 px-2.5 py-1.5 text-left">
                        {isBengali ? 'মোবাইল ও ঠিকানা' : 'Phone & Address'}
                      </th>
                      <th className="border border-slate-300 px-2.5 py-1.5 text-right">
                        {isBengali ? 'বর্তমান বকেয়া' : 'Current Due'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCustomers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="border border-slate-300 px-3 py-4 text-center text-slate-400"
                        >
                          {isBengali
                            ? 'কোনো কাস্টমার পাওয়া যায়নি'
                            : 'No customers found'}
                        </td>
                      </tr>
                    ) : (
                      reportCustomers.map((c) => {
                        const sl = customerSlMap.get(c.id) || 1;
                        return (
                          <tr key={c.id} className="even:bg-slate-50/70">
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                              #{toBengaliDigits(sl, language)}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-1.5 font-extrabold text-slate-900">
                              {c.name}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-1.5 text-teal-800 font-semibold">
                              {c.identityHint || '—'}
                            </td>
                            <td className="border border-slate-300 px-2.5 py-1.5">
                              <span>{c.phone || '—'}</span>
                              {c.address ? (
                                <span className="text-slate-500 block text-[10px]">
                                  {c.address}
                                </span>
                              ) : null}
                            </td>
                            <td
                              className={`border border-slate-300 px-2.5 py-1.5 text-right font-black ${
                                c.totalDue > 0
                                  ? 'text-red-600'
                                  : 'text-[#00965E]'
                              }`}
                            >
                              ৳
                              {toBengaliDigits(
                                formatMoney(c.totalDue),
                                language
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900">
                      <td
                        colSpan={4}
                        className="border border-slate-300 px-2.5 py-2 text-right"
                      >
                        {isBengali ? 'সর্বমোট বকেয়া (Grand Total Due):' : 'Grand Total Due:'}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 text-right text-red-600">
                        ৳
                        {toBengaliDigits(formatMoney(reportTotalDue), language)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Shared Modals (Add/Edit Customer, Credit/Payment, Delete Confirmation, PDF Report)
  const renderModals = () => {
    const modalTarget =
      (creditPaymentTarget &&
        customers.find((c) => c.id === creditPaymentTarget.id)) ||
      creditPaymentTarget ||
      activeCustomer;

    return (
      <>
        {renderPdfReportModal()}

        {/* Credit / Payment Modal */}
        {creditPaymentMode && modalTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {creditPaymentMode === 'CREDIT'
                      ? `${strings.quickGiveDue} — ${modalTarget.name}`
                      : `${strings.quickReceiveMoney} — ${modalTarget.name}`}
                  </h3>
                  {modalTarget.identityHint && (
                    <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 mt-0.5">
                      {isBengali ? 'চেনার উপায়' : 'Identity Hint'}:{' '}
                      {modalTarget.identityHint}
                    </p>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-black text-slate-700 dark:text-slate-300">
                  #{toBengaliDigits(customerSlMap.get(modalTarget.id) || 1, language)}
                </span>
              </div>

              <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">
                  {isBengali ? 'বর্তমান বাকি' : 'Current Due'}:
                </span>
                <span
                  className={`font-black text-sm ${
                    modalTarget.totalDue > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[#00965E]'
                  }`}
                >
                  ৳{toBengaliDigits(formatMoney(modalTarget.totalDue), language)}
                </span>
              </div>

              <form onSubmit={handleCreditOrPayment} className="mt-3.5 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {isBengali ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                    </label>
                    {creditPaymentMode === 'PAYMENT' &&
                      modalTarget.totalDue > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAmountInput(String(modalTarget.totalDue))
                          }
                          className="text-[10.5px] font-extrabold text-[#00965E] hover:underline cursor-pointer"
                        >
                          {isBengali ? 'সম্পূর্ণ বাকি বসান' : 'Fill Full Due'} (৳
                          {toBengaliDigits(
                            formatMoney(modalTarget.totalDue),
                            language
                          )}
                          )
                        </button>
                      )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold dark:bg-slate-900 dark:text-white"
                  />
                  {/* Quick Amount Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {[100, 200, 500, 1000, 2000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmountInput(String(preset))}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 hover:border-[#00965E] cursor-pointer"
                      >
                        ৳{toBengaliDigits(preset, language)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'নোট বা বিবরণ (ঐচ্ছিক)' : 'Note (optional)'}
                  </label>
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'যেমন: নগদ জমা / বিকাশ / পণ্যের বাকি'
                        : 'e.g. Cash payment / bKash / Grocery credit'
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreditPaymentMode(null);
                      setCreditPaymentTarget(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                      creditPaymentMode === 'CREDIT'
                        ? 'bg-[#0EA5E9] hover:bg-[#0284C7]'
                        : 'bg-[#059669] hover:bg-[#047857]'
                    }`}
                  >
                    {isBengali ? 'সংরক্ষণ করুন' : 'Save Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add / Edit Customer Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 my-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingCustomer
                    ? isBengali
                      ? 'কাস্টমারের তথ্য সম্পাদনা'
                      : 'Edit Customer'
                    : strings.addCustomerBtn}
                </h3>
                {editingCustomer && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-black text-slate-700 dark:text-slate-300">
                    SL #
                    {toBengaliDigits(
                      customerSlMap.get(editingCustomer.id) || 1,
                      language
                    )}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveCustomer} className="mt-3.5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'কাস্টমারের নাম *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={
                      isBengali ? 'যেমন: মো: রহিম উদ্দিন' : 'e.g. Rahim Uddin'
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {/* Identity Hint / চেনার উপায় */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Fingerprint className="w-3.5 h-3.5 text-[#00965E]" />
                    <span>
                      {isBengali
                        ? 'চেনার উপায় / পরিচয় সংকেত (Identity Hint)'
                        : 'Identity Hint / চেনার উপায়'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={identityHintInput}
                    onChange={(e) => setIdentityHintInput(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'যেমন: করিম মিয়ার ছেলে / পূর্ব পাড়া / স্কুল শিক্ষক'
                        : 'e.g. Son of Karim / East Para / School Teacher'
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                  {/* Quick Suggestion Chips for Identity Hint */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {identityHintPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setIdentityHintInput((prev) =>
                            prev.trim()
                              ? prev.includes(preset)
                                ? prev
                                : `${prev.trim()}, ${preset}`
                              : preset
                          )
                        }
                        className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/70 text-[10px] font-bold text-teal-800 dark:text-teal-300 hover:bg-teal-100 cursor-pointer"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {isBengali ? 'মোবাইল নম্বর' : 'Phone Number'}
                    </label>
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {isBengali ? 'ঠিকানা' : 'Address'}
                    </label>
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      placeholder={
                        isBengali ? 'গ্রাম / রোড / বাজার' : 'Village / Road / Area'
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Note Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {isBengali ? 'নোট / মন্তব্য (ঐচ্ছিক)' : 'Note / Remarks (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={customerNoteInput}
                    onChange={(e) => setCustomerNoteInput(e.target.value)}
                    placeholder={
                      isBengali
                        ? 'যেমন: মাসের ১০ তারিখে বাকি পরিশোধ করেন'
                        : 'e.g. Pays dues on the 10th of every month'
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {!editingCustomer && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {isBengali ? 'পূর্বের বাকি (৳)' : 'Opening Due Balance (৳)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={initialDueInput}
                      onChange={(e) => setInitialDueInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    {isBengali ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00965E] hover:bg-[#057A50] text-white cursor-pointer"
                  >
                    {isBengali ? 'সংরক্ষণ করুন' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Customer Modal */}
        {confirmDeleteCustomer && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {isBengali ? 'কাস্টমার মুছবেন?' : 'Delete Customer?'} —{' '}
                {confirmDeleteCustomer.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isBengali
                  ? 'এই কাস্টমারকে রিসাইকেল বিনে স্থানান্তর করা হবে।'
                  : 'This customer will be moved to the Recycle Bin.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isBengali ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteCustomer(
                      confirmDeleteCustomer.id,
                      confirmDeleteCustomer.name
                    );
                    setConfirmDeleteCustomer(null);
                    setSelectedCustomer(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white cursor-pointer"
                >
                  {isBengali ? 'ডিলিট' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (activeCustomer) {
    const activeSlNumber = customerSlMap.get(activeCustomer.id) || 1;
    const customerTxs = transactions.filter(
      (t) =>
        t.customerId === activeCustomer.id ||
        t.customerName.toLowerCase() === activeCustomer.name.toLowerCase()
    );
    const hasPhone =
      Boolean(activeCustomer.phone) && activeCustomer.phone !== '—';
    const reminderText = encodeURIComponent(
      buildDueReminderText(activeCustomer)
    );

    return (
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3.5 space-y-3">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 px-3.5 py-2.5 rounded-xl border border-[#CBEAD9] dark:border-slate-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setSelectedCustomer(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#00965E] hover:text-[#00965E] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {isBengali ? 'কাস্টমার তালিকায় ফিরুন' : 'Back to Customers'}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Individual Customer PDF Report Button */}
            <button
              type="button"
              onClick={() =>
                setPdfReportMode({ type: 'CUSTOMER', customer: activeCustomer })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-[#00965E] dark:text-emerald-300 text-xs font-extrabold hover:bg-emerald-100 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isBengali ? 'পিডিএফ রিপোর্ট' : 'PDF Report'}</span>
            </button>
            <button
              type="button"
              onClick={() => openEditCustomer(activeCustomer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white text-xs font-bold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isBengali ? 'এডিট' : 'Edit'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteCustomer(activeCustomer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBengali ? 'ডিলিট' : 'Delete'}</span>
            </button>
          </div>
        </div>

        {/* Customer Detail Card with Separate Bordered Information Boxes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5">
          {/* Header Row: SL + Name + Quick Contact Buttons (Call & SMS only, no WhatsApp) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-black text-[#00965E] dark:text-emerald-300 shrink-0">
                #{toBengaliDigits(activeSlNumber, language)}
              </span>
              <div className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 min-w-0">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {activeCustomer.name}
                </h2>
              </div>
            </div>

            {hasPhone && (
              <div className="flex flex-wrap items-center gap-1.5">
                <a
                  href={`tel:${activeCustomer.phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-slate-900 border border-emerald-300 dark:border-slate-700 text-[#00965E] text-[11px] font-bold hover:bg-emerald-100"
                >
                  <Phone className="w-3 h-3" />
                  <span>{isBengali ? 'কল' : 'Call'}</span>
                </a>
                <a
                  href={`sms:${activeCustomer.phone}?body=${reminderText}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-slate-900 border border-sky-300 dark:border-slate-700 text-sky-700 dark:text-sky-300 text-[11px] font-bold hover:bg-sky-100"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{isBengali ? 'এসএমএস তাগাদা' : 'SMS Reminder'}</span>
                </a>
              </div>
            )}
          </div>

          {/* Separate Minimal Bordered Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
            {/* Identity Hint / চেনার উপায় */}
            <div className="px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/70 bg-teal-50/50 dark:bg-teal-950/30 flex items-center justify-between gap-1.5 col-span-2 sm:col-span-1">
              <span className="text-teal-700 dark:text-teal-400 font-semibold inline-flex items-center gap-1 shrink-0">
                <Fingerprint className="w-3 h-3" />
                {isBengali ? 'চেনার উপায়' : 'Identity Hint'}
              </span>
              <span className="font-extrabold text-teal-900 dark:text-teal-200 truncate">
                {activeCustomer.identityHint || (isBengali ? 'দেওয়া হয়নি' : '—')}
              </span>
            </div>

            {/* Phone */}
            <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-1.5">
              <span className="text-slate-400 font-semibold inline-flex items-center gap-1 shrink-0">
                <Phone className="w-3 h-3 text-[#00965E]" />
                {isBengali ? 'মোবাইল' : 'Phone'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {activeCustomer.phone || '—'}
              </span>
            </div>

            {/* Address */}
            <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-1.5">
              <span className="text-slate-400 font-semibold inline-flex items-center gap-1 shrink-0">
                <MapPin className="w-3 h-3 text-[#00965E]" />
                {isBengali ? 'ঠিকানা' : 'Address'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {activeCustomer.address || (isBengali ? 'নেই' : '—')}
              </span>
            </div>

            {/* Current Due */}
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 col-span-2 sm:col-span-3 ${
                activeCustomer.totalDue > 0
                  ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/35'
                  : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
              }`}
            >
              <span
                className={`font-semibold ${
                  activeCustomer.totalDue > 0
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {strings.totalDuesLabel}
              </span>
              <span
                className={`font-black text-xs ${
                  activeCustomer.totalDue > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-[#00965E]'
                }`}
              >
                ৳
                {toBengaliDigits(
                  formatMoney(activeCustomer.totalDue),
                  language
                )}
              </span>
            </div>

            {/* Customer Note if present */}
            {activeCustomer.note && (
              <div className="px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/25 flex items-center justify-between gap-2 col-span-2 sm:col-span-3">
                <span className="text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1 shrink-0">
                  <FileText className="w-3 h-3" />
                  {isBengali ? 'নোট' : 'Note'}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {activeCustomer.note}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openCreditOrPaymentModal(activeCustomer, 'CREDIT')}
              className="py-2 px-3 rounded-xl bg-[#0EA5E9] hover:bg-[#0284C7] border border-sky-300/60 text-white font-bold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{strings.quickGiveDue}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                openCreditOrPaymentModal(activeCustomer, 'PAYMENT')
              }
              className="py-2 px-3 rounded-xl bg-[#059669] hover:bg-[#047857] border border-emerald-300/60 text-white font-bold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{strings.quickReceiveMoney}</span>
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-[#CBEAD9] dark:border-slate-700 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#00965E]" />
              <span>
                {isBengali ? 'লেনদেনের খতিয়ান' : 'Transaction Ledger'} (
                {toBengaliDigits(customerTxs.length, language)})
              </span>
            </h3>
            <button
              type="button"
              onClick={() =>
                setPdfReportMode({ type: 'CUSTOMER', customer: activeCustomer })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#00965E] dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer"
            >
              <FileDown className="w-3 h-3" />
              <span>
                {isBengali ? 'খতিয়ান পিডিএফ (PDF)' : 'Export Ledger PDF'}
              </span>
            </button>
          </div>
          {customerTxs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              {isBengali
                ? 'এখনো কোনো লেনদেন নেই'
                : 'No transactions recorded yet'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {customerTxs.map((tx) => {
                const isPayment = tx.type === 'RECEIVE_PAYMENT';
                return (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${
                            isPayment
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                              : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/60 dark:border-red-800 dark:text-red-300'
                          }`}
                        >
                          {isPayment
                            ? isBengali
                              ? 'জমা'
                              : 'Payment'
                            : isBengali
                            ? 'বাকি / বিক্রি'
                            : 'Credit / Sale'}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {tx.title}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-400">
                        {formatTimestamp(tx.createdAt)}
                        {tx.notes && !tx.notes.startsWith('ITEMS:')
                          ? ` • ${tx.notes}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-xs font-black ${
                          isPayment
                            ? 'border-emerald-200 bg-emerald-50/70 text-[#059669] dark:bg-emerald-950/40 dark:border-emerald-800'
                            : 'border-red-200 bg-red-50/70 text-red-600 dark:bg-red-950/40 dark:border-red-800'
                        }`}
                      >
                        {isPayment ? '-' : '+'}৳
                        {toBengaliDigits(formatMoney(tx.amount), language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomerTransaction(tx)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 cursor-pointer"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {renderModals()}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2.5 pb-8 space-y-2">
      {/* Compact & Beautiful Top Customer Khata Summary Card */}
      <div className="relative overflow-hidden rounded-xl border border-[#A7F3D0] dark:border-emerald-800/80 bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#00965E] text-white shadow-sm px-3 py-2.5">
        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />

        {/* Prominent Main Header Row: Customers Title + Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-emerald-200 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap">
                {strings.navCustomers}
              </h1>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-extrabold text-emerald-100 whitespace-nowrap">
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                {toBengaliDigits(customers.length, language)}{' '}
                {isBengali ? 'জন' : 'Total'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Central Balance PDF Report Button */}
            <button
              type="button"
              onClick={() => setPdfReportMode({ type: 'CENTRAL' })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-extrabold text-[10.5px] sm:text-xs border border-white/30 transition cursor-pointer whitespace-nowrap"
              title={
                isBengali
                  ? 'কেন্দ্রীয় ব্যালেন্স পিডিএফ রিপোর্ট'
                  : 'Central Balance PDF Report'
              }
            >
              <FileDown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{isBengali ? 'পিডিএফ রিপোর্ট' : 'PDF Report'}</span>
            </button>

            <button
              type="button"
              onClick={openAddCustomer}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-[#064E3B] hover:bg-emerald-50 font-extrabold text-[10.5px] sm:text-xs shadow-2xs border border-emerald-200 transition cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#00965E] shrink-0" />
              <span>{strings.addCustomerBtn}</span>
            </button>
          </div>
        </div>

        {/* Compact Summary Strip (Total Dues & Customer Counts — without Bought/Paid) */}
        <div className="relative z-10 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-black/20 border border-white/20 px-2.5 py-1.5 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-amber-200 uppercase truncate">
              {strings.totalDuesLabel}
            </span>
            <p className="text-xs sm:text-sm font-black text-white mt-0.5 truncate">
              ৳{toBengaliDigits(formatMoney(totalPendingDues), language)}
            </p>
          </div>

          <div className="rounded-lg bg-white/12 border border-white/20 px-2.5 py-1.5 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-emerald-100 uppercase truncate">
              {strings.filterHasDues}
            </span>
            <p className="text-xs sm:text-sm font-black text-amber-200 mt-0.5 truncate">
              {toBengaliDigits(customersOwingCount, language)}{' '}
              {isBengali ? 'জন' : 'Customers'}
            </p>
          </div>

          <div className="rounded-lg bg-white/12 border border-white/20 px-2.5 py-1.5 flex flex-col justify-between">
            <span className="text-[9.5px] font-bold text-emerald-100 uppercase truncate">
              {strings.filterNoDues}
            </span>
            <p className="text-xs sm:text-sm font-black text-emerald-200 mt-0.5 truncate">
              {toBengaliDigits(customersSettledCount, language)}{' '}
              {isBengali ? 'জন' : 'Customers'}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar (searches Name, Identity Hint / চেনার উপায়, Phone, Address, SL #) */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#00965E] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            isBengali
              ? 'নাম, চেনার উপায়, মোবাইল, ঠিকানা বা #ক্রমিক দিয়ে খুঁজুন...'
              : 'Search by name, identity hint, phone, address, or #SL...'
          }
          className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 text-xs focus:border-[#00965E] focus:outline-none dark:text-white"
        />
      </div>

      {/* Single-Line Filter & Sort Bar */}
      <div className="flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar">
        {(
          [
            [
              'ALL',
              `${strings.filterAll} (${toBengaliDigits(
                customers.length,
                language
              )})`,
              Users,
            ],
            [
              'HAS_DUES',
              `${strings.filterHasDues} (${toBengaliDigits(
                customersOwingCount,
                language
              )})`,
              AlertCircle,
            ],
            [
              'NO_DUES',
              `${strings.filterNoDues} (${toBengaliDigits(
                customersSettledCount,
                language
              )})`,
              CheckCircle2,
            ],
          ] as const
        ).map(([key, label, FilterIcon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDueFilter(key)}
            className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold border whitespace-nowrap transition cursor-pointer ${
              dueFilter === key
                ? 'bg-[#00965E] text-white border-[#00965E]'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E]'
            }`}
          >
            <FilterIcon className="w-3 h-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}

        {/* Sort selector in same single row */}
        <div className="relative shrink-0">
          <ArrowUpDown className="w-2.5 h-2.5 text-[#00965E] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CustomerSortBy)}
            aria-label="Sort Customers"
            className="pl-5 pr-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-[#CBEAD9] dark:border-slate-700 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:border-[#00965E] focus:outline-none cursor-pointer"
          >
            <option value="DUE_DESC">
              {isBengali ? 'বাকি বেশি' : 'Highest Due'}
            </option>
            <option value="SL_ASC">
              {isBengali ? 'ক্রমিক #১→' : 'SL #1→'}
            </option>
            <option value="NAME_ASC">
              {isBengali ? 'নাম A-Z' : 'Name A-Z'}
            </option>
          </select>
        </div>
      </div>

      {/* Customer List — Minimal Cards with Separate Bordered Boxes */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border border-[#CBEAD9] dark:border-slate-700 space-y-1.5">
          <Users className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {isBengali ? 'কোনো কাস্টমার পাওয়া যায়নি' : 'No customers found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredCustomers.map((customer) => {
            const slNumber = customerSlMap.get(customer.id) || 1;
            const lastTx = lastTxByCustomerMap.get(customer.id);
            const hasPhone =
              Boolean(customer.phone) && customer.phone !== '—';

            return (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-[#CBEAD9] dark:border-slate-700 hover:border-[#00965E] transition cursor-pointer shadow-2xs space-y-1.5"
              >
                {/* Row 1: SL Number Box + Customer Name Box + Current Due Status Box + PDF + Edit Buttons */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* SL Number Box */}
                    <span className="px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-[10.5px] font-black text-[#00965E] dark:text-emerald-300 shrink-0">
                      #{toBengaliDigits(slNumber, language)}
                    </span>

                    {/* Customer Name Box */}
                    <div className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 min-w-0 flex-1 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-[#00965E] shrink-0" />
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {customer.name}
                      </p>
                    </div>
                  </div>

                  {/* Due Amount Box */}
                  <div
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-black shrink-0 ${
                      customer.totalDue > 0
                        ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {isBengali ? 'বাকি:' : 'Due:'} ৳
                    {toBengaliDigits(formatMoney(customer.totalDue), language)}
                  </div>

                  {/* Quick Individual PDF Report Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPdfReportMode({ type: 'CUSTOMER', customer });
                    }}
                    title={
                      isBengali
                        ? 'কাস্টমার পিডিএফ রিপোর্ট'
                        : 'Customer PDF Report'
                    }
                    className="px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-[#00965E] dark:text-emerald-300 text-[9.5px] font-extrabold hover:bg-emerald-100 shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <FileDown className="w-2.5 h-2.5" />
                    <span>PDF</span>
                  </button>

                  {/* Quick Edit Button */}
                  <button
                    type="button"
                    onClick={(e) => openEditCustomer(customer, e)}
                    title={isBengali ? 'এডিট' : 'Edit'}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#00965E] hover:border-[#00965E] shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>

                {/* Row 2: Identity Hint (চেনার উপায়) + Phone + Address in separate bordered boxes */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {/* Identity Hint Box */}
                  <span
                    className={`px-2 py-0.5 rounded-md border inline-flex items-center gap-1 font-bold max-w-full truncate ${
                      customer.identityHint
                        ? 'border-teal-300 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400'
                    }`}
                  >
                    <Fingerprint className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {isBengali ? 'চেনার উপায়:' : 'Hint:'}{' '}
                      {customer.identityHint ||
                        (isBengali ? 'যোগ করুন' : 'Not set')}
                    </span>
                  </span>

                  {/* Phone Box */}
                  {hasPhone && (
                    <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 font-semibold inline-flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-[#00965E]" />
                      <span>{customer.phone}</span>
                    </span>
                  )}

                  {/* Address Box */}
                  {customer.address && (
                    <span className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 font-semibold inline-flex items-center gap-1 max-w-[180px] truncate">
                      <MapPin className="w-2.5 h-2.5 text-[#00965E] shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </span>
                  )}

                  {/* Note Box */}
                  {customer.note && (
                    <span className="px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-semibold inline-flex items-center gap-1 max-w-full truncate">
                      <FileText className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{customer.note}</span>
                    </span>
                  )}
                </div>

                {/* Row 3: Last Activity & Quick Action Buttons (Call, SMS, +Due, +Pay — No Bought/Paid, No WhatsApp) */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    {lastTx?.createdAt ? (
                      <span className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 font-medium inline-flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimestamp(lastTx.createdAt, false)}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                        {customer.totalDue > 0
                          ? strings.filterHasDues
                          : strings.filterNoDues}
                      </span>
                    )}
                  </div>

                  {/* Quick 1-Tap Actions: Call, SMS Reminder, +Credit, +Payment */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasPhone && (
                      <>
                        <a
                          href={`tel:${customer.phone}`}
                          title={isBengali ? 'কল করুন' : 'Call'}
                          className="p-1 rounded-md border border-emerald-200 dark:border-slate-700 bg-emerald-50/70 dark:bg-slate-900 text-[#00965E] hover:bg-emerald-100"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                        <a
                          href={`sms:${customer.phone}?body=${encodeURIComponent(
                            buildDueReminderText(customer)
                          )}`}
                          title={isBengali ? 'এসএমএস পাঠান' : 'Send SMS'}
                          className="p-1 rounded-md border border-sky-200 dark:border-slate-700 bg-sky-50/70 dark:bg-slate-900 text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) =>
                        openCreditOrPaymentModal(customer, 'CREDIT', e)
                      }
                      className="px-2 py-0.5 rounded-md border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[10px] font-extrabold hover:bg-sky-100 cursor-pointer"
                    >
                      {isBengali ? '+বাকি' : '+Due'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) =>
                        openCreditOrPaymentModal(customer, 'PAYMENT', e)
                      }
                      className="px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-[#00965E] dark:text-emerald-300 text-[10px] font-extrabold hover:bg-emerald-100 cursor-pointer"
                    >
                      {isBengali ? '+জমা' : '+Pay'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderModals()}
    </div>
  );
};

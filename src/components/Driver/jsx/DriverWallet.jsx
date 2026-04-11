import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Clock, X, BarChart2, Check } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/DriverWallet.css';

const DriverWallet = ({ onBack }) => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [ridePayments, setRidePayments] = useState([]); // NEW: For invoice breakdowns
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState('upi'); // 'upi' or 'bank'
    const [withdrawDetails, setWithdrawDetails] = useState({
        upiId: '',
        accountNumber: '',
        ifsc: '',
        holderName: ''
    });
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'withdrawals'
    const [weeklyEarnings, setWeeklyEarnings] = useState([]);
    const [maxEarning, setMaxEarning] = useState(0);

    // NEW ADD FUNDS STATE
    const [showAddFundsModal, setShowAddFundsModal] = useState(false);
    const [addFundsAmount, setAddFundsAmount] = useState('');
    const [addFundsLoading, setAddFundsLoading] = useState(false);
    const [sdkReady, setSdkReady] = useState(false);

    // Load Cashfree SDK
    useEffect(() => {
        if (window.Cashfree) {
            setSdkReady(true);
            return;
        }
        const existing = document.getElementById('cashfree-sdk');
        if (existing) {
            existing.addEventListener('load', () => setSdkReady(true));
            if (window.Cashfree) setSdkReady(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'cashfree-sdk';
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.async = true;
        script.onload = () => {
            console.log('Cashfree SDK loaded successfully');
            setSdkReady(true);
        };
        script.onerror = () => {
            console.error('Failed to load Cashfree SDK');
        };
        document.body.appendChild(script);
    }, []);



    const fetchWalletData = React.useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get driver ID
            const { data: driver } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!driver) return;

            // Get Wallet Balance
            const { data: wallet } = await supabase
                .from('driver_wallets')
                .select('id, balance')
                .eq('driver_id', driver.id)
                .maybeSingle();

            if (wallet) {
                setBalance(wallet.balance);
            } else {
                setBalance(0);
            }

            // Get Driver's Completed Trips & Valid Bookings to calculate Earnings
            const { data: tripsList } = await supabase
                .from('trips')
                .select('*, booking_requests(*)')
                .eq('driver_id', driver.id)
                .in('status', ['completed'])
                .order('created_at', { ascending: false });

            // Get Withdrawal Requests
            const { data: reqs } = await supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('driver_id', driver.id)
                .order('created_at', { ascending: false });

            if (reqs) setRequests(reqs);

            let combinedTxs = [];

            if (tripsList) {
                tripsList.forEach(t => {
                    // Gather only valid bookings that contributed to earnings
                    const validBookings = t.booking_requests?.filter(b => 
                        ['approved', 'completed', 'paid', 'in_progress'].includes(b.status)
                    ) || [];

                    if (validBookings.length > 0) {
                        let onlineFare = 0;
                        let codFare = 0;

                        validBookings.forEach(b => {
                            const fare = Number(b.seats_requested || 1) * Number(t.price_per_seat || 0);
                            if (b.payment_mode === 'online') {
                                onlineFare += fare;
                            } else {
                                codFare += fare;
                            }
                        });

                        const totalFare = onlineFare + codFare;
                        const onlineDriverNet = onlineFare * 0.85;
                        const codCommissionDue = codFare * 0.15;

                        const netImpact = onlineDriverNet - codCommissionDue;
                        const isCredit = netImpact >= 0;

                        combinedTxs.push({
                            id: `trip-${t.id}`,
                            type: isCredit ? 'credit' : 'debit',
                            description: isCredit ? `Ride Earning (Online)` : `App Commission (Cash Ride)`,
                            amount: Math.abs(netImpact),
                            created_at: t.completed_at || t.created_at,
                            reference_id: t.id,
                            isRide: true,
                            invoiceTotalFare: totalFare,
                            invoiceOnlineFare: onlineFare,
                            invoiceCodFare: codFare,
                            invoiceOnlineDriverNet: onlineDriverNet,
                            invoiceCodCommissionDue: codCommissionDue,
                            invoiceNetImpact: netImpact
                        });
                    }
                });
            }

            if (reqs) {
                reqs.forEach(r => {
                    combinedTxs.push({
                        id: `with-${r.id}`,
                        type: 'debit',
<<<<<<< HEAD
                        description: r.status === 'pending' ? 'Withdrawal Request' : (r.status === 'approved' ? 'Withdrawal Successful' : 'Withdrawal Rejected'),
=======
                        description: r.status === 'pending' ? 'Withdrawal Request' : 'Withdrawal Approved',
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                        amount: Number(r.amount || 0),
                        created_at: r.created_at,
                        isWithdrawal: true,
                        status: r.status
                    });
                });
            }

            combinedTxs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Dynamically recalculate balance securely from ledger
            let dynBalance = 0;
            combinedTxs.forEach(tx => {
                if (tx.type === 'credit') {
                    dynBalance += tx.amount;
                } else if (tx.type === 'debit' && (!tx.isWithdrawal || tx.status !== 'rejected')) {
                    dynBalance -= tx.amount; // Deduct approved/pending withdrawals and cash commissions
                }
            });

            setBalance(dynBalance);
            setTransactions(combinedTxs);
            calculateWeeklyEarnings(combinedTxs);

        } catch (error) {
            console.error('Error fetching wallet data:', error);
            toast.error('Failed to load wallet data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWalletData();

        const setupSubscriptions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: driver } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!driver) return;

            const walletChannel = supabase
                .channel('wallet_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'driver_wallets',
                    filter: `driver_id=eq.${driver.id}`
                }, () => fetchWalletData())
                .subscribe();

            const tripsChannel = supabase
                .channel('trips_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'trips',
                    filter: `driver_id=eq.${driver.id}`
                }, () => fetchWalletData())
                .subscribe();
                
            const withdrawalsChannel = supabase
                .channel('withdrawal_requests_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'withdrawal_requests',
                    filter: `driver_id=eq.${driver.id}`
                }, () => fetchWalletData())
                .subscribe();

            const bookingsChannel = supabase
                .channel('bookings_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'booking_requests',
                    filter: `driver_id=eq.${user.id}`
                }, () => fetchWalletData())
                .subscribe();

            const rechargesChannel = supabase
                .channel('recharges_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'wallet_recharges',
                    filter: `driver_id=eq.${driver.id}`
                }, () => fetchWalletData())
                .subscribe();

<<<<<<< HEAD
            const broadcastChannel = supabase
                .channel('app_wide_events')
                .on('broadcast', { event: 'force_wallet_refresh' }, () => {
                    fetchWalletData();
                })
                .subscribe();

            return { walletChannel, tripsChannel, withdrawalsChannel, bookingsChannel, rechargesChannel, broadcastChannel };
=======
            return { walletChannel, tripsChannel, withdrawalsChannel, bookingsChannel, rechargesChannel };
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
        };

        const subscriptionsPromise = setupSubscriptions();

        return () => {
            subscriptionsPromise.then(channels => {
                if (channels) {
                    supabase.removeChannel(channels.walletChannel);
                    supabase.removeChannel(channels.tripsChannel);
                    supabase.removeChannel(channels.withdrawalsChannel);
                    supabase.removeChannel(channels.bookingsChannel);
                    supabase.removeChannel(channels.rechargesChannel);
<<<<<<< HEAD
                    if (channels.broadcastChannel) {
                        supabase.removeChannel(channels.broadcastChannel);
                    }
=======
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                }
            });
        };
    }, [fetchWalletData]);

    const calculateWeeklyEarnings = (txs) => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const data = last7Days.map(date => {
            const dayTotal = txs
                .filter(tx => tx.type === 'credit' && tx.created_at.startsWith(date))
                .reduce((sum, tx) => sum + tx.amount, 0);

            return {
                day: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
                amount: dayTotal
            };
        });

        setWeeklyEarnings(data);
        setMaxEarning(Math.max(...data.map(d => d.amount), 100)); // Min max scale 100
    };

    const handleAddFundsSubmit = async (e) => {
        e.preventDefault();
        
        const amount = Number(addFundsAmount);
        if (!amount || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setAddFundsLoading(true);
        
        try {
            if (!sdkReady || !window.Cashfree) {
                throw new Error('Payment gateway is still loading. Please try again.');
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error('Authentication error');

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('create-wallet-recharge', {
                body: { amount }
            });

            if (error) {
                let errorMessage = error.message;
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const errorDetails = await error.context.json();
                        errorMessage = errorDetails?.error || errorMessage;
                    }
                } catch(e) { /* ignore */ }
                throw new Error(errorMessage);
            }

            if (!data.success) {
                throw new Error(data.error || 'Failed to create payment order');
            }

            if (data.stub_mode) {
                toast.success('Funds setup complete. Check dashboard to verify.');
                setShowAddFundsModal(false);
                setAddFundsAmount('');
                setAddFundsLoading(false);
                return;
            }

            // Init Cashfree
            const cashfree = window.Cashfree({
                mode: 'production' // Switch to sandbox if needed
            });

            const checkoutOptions = {
                paymentSessionId: data.payment_session_id,
                redirectTarget: "_modal",
            };

            cashfree.checkout(checkoutOptions).then((result) => {
                if (result.error) {
                    console.log("User closed the popup or there was an error: ", result.error);
                    toast.error(result.error.message || 'Payment cancelled or failed');
                } else if (result.redirect) {
                    console.log("Payment will be redirected");
                } else if (result.paymentDetails) {
                    console.log("Payment completed details", result.paymentDetails);
                    toast.success('Payment Successful! Wallet will update shortly.');
                    setShowAddFundsModal(false);
                    setAddFundsAmount('');
                    // Webhook triggers the wallet update and supabase realtime refreshes the UI!
                }
            });

        } catch (error) {
            console.error('Add funds error:', error);
            toast.error(error.message || 'Failed to start payment process');
        } finally {
            setAddFundsLoading(false);
        }
    };

    const handleWithdrawSubmit = async (e) => {
        e.preventDefault();

        if (!withdrawAmount || Number(withdrawAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (Number(withdrawAmount) > balance) {
            toast.error('Insufficient balance');
            return;
        }

        // Validate Details
        if (withdrawMethod === 'upi' && !withdrawDetails.upiId) {
            toast.error('Please enter UPI ID');
            return;
        }
        if (withdrawMethod === 'bank' && (!withdrawDetails.accountNumber || !withdrawDetails.ifsc)) {
            toast.error('Please enter Bank Details');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: driver } = await supabase.from('drivers').select('id').eq('user_id', user.id).single();

            const payload = {
                driver_id: driver.id,
                amount: Number(withdrawAmount),
                method: withdrawMethod,
                details: withdrawMethod === 'upi' ? { upiId: withdrawDetails.upiId } : withdrawDetails,
                status: 'pending'
            };

            const { error } = await supabase
                .from('withdrawal_requests')
                .insert([payload]);

            if (error) throw error;

            toast.success('Withdrawal Request Sent!');
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            fetchWalletData(); // Refresh history

        } catch (error) {
            console.error('Error requesting withdrawal:', error);
            toast.error('Failed to submit request');
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    return (
        <div className="driver-wallet-container animate-page-in">
            {/* Header */}
            <div className="wallet-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>My Wallet</h1>
                <div className="header-spacer" />
            </div>

            {/* Balance Card */}
            <div className={`balance-card ${balance < 0 ? 'negative' : ''}`}>
                <div className="balance-label">Total Balance</div>
                <div className="balance-amount">{formatCurrency(balance)}</div>
                <div className="balance-status">
                    {balance < 0
                        ? 'You owe commission to the platform.'
                        : 'Available to withdraw.'}
                </div>
                <div className="balance-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button 
                        className="withdraw-btn-main action-btn" 
                        onClick={() => setShowAddFundsModal(true)}
                        style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold' }}
                    >
                        Add Funds
                    </button>
                    <button 
                        className="withdraw-btn-main action-btn" 
                        onClick={() => {
                            if (balance > 0) setShowWithdrawModal(true);
                            else toast.error('Insufficient funds to withdraw');
                        }}
                        style={{ flex: 1, backgroundColor: balance > 0 ? '#10b981' : '#ccc', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: balance > 0 ? 'pointer' : 'not-allowed' }}
                    >
                        Withdraw
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="wallet-tabs">
                <button
                    className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions
                </button>
                <button
                    className={`tab ${activeTab === 'withdrawals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('withdrawals')}
                >
                    Withdrawals
                </button>
                <button
                    className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    <BarChart2 size={16} /> Analytics
                </button>
            </div>

            {/* Content Area */}
            <div className="transactions-section">
                {activeTab === 'analytics' ? (
                    <div className="analytics-view">
                        <h3>Weekly Earnings</h3>
                        <div className="chart-container">
                            {weeklyEarnings.map((day, index) => (
                                <div key={index} className="chart-column">
                                    <div
                                        className="chart-bar"
                                        style={{ height: `${(day.amount / (maxEarning || 1)) * 100}%` }}
                                        title={`₹${day.amount}`}
                                    ></div>
                                    <span className="chart-label">{day.day}</span>
                                </div>
                            ))}
                        </div>
                        <div className="analytics-summary">
                            <div className="summary-card">
                                <span>Total EARNINGS (7 Days)</span>
                                <strong>₹{weeklyEarnings.reduce((a, b) => a + b.amount, 0)}</strong>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'transactions' ? (
                    /* Transactions List */
                    loading ? <div className="loading-spinner"></div> :
                        transactions.length === 0 ? (
                            <div className="empty-state"><Clock size={48} /><p>No transactions yet</p></div>
                        ) : (
                            <div className="transactions-list">
                                {transactions.map(tx => {
                                    const isRideTransaction = tx.isRide;
                                    
                                    const invoiceTotalFare = tx.invoiceTotalFare || 0;
                                    const invoiceOnlineFare = tx.invoiceOnlineFare || 0;
                                    const invoiceCodFare = tx.invoiceCodFare || 0;

                                    return (
                                        <div key={tx.id} className="transaction-item-wrapper">
                                            <div className="transaction-item">
<<<<<<< HEAD
                                                <div className={`tx-icon ${tx.isWithdrawal && tx.status === 'approved' ? 'credit' : tx.type}`}>
                                                    {tx.isWithdrawal && tx.status === 'approved' ? <Check size={20} /> : tx.type === 'credit' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
=======
                                                <div className={`tx-icon ${tx.type}`}>
                                                    {tx.type === 'credit' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                                                </div>
                                                <div className="tx-details">
                                                    <div className="tx-desc">
                                                        {tx.description || 'Transaction'} 
<<<<<<< HEAD
                                                        {tx.isWithdrawal && tx.status === 'pending' ? ' (pending)' : ''}
                                                    </div>
                                                    <div className="tx-date">{formatDate(tx.created_at)}</div>
                                                </div>
                                                <div className={`tx-amount ${tx.isWithdrawal && tx.status === 'approved' ? 'credit' : tx.type}`}>
=======
                                                        {tx.isWithdrawal && tx.status && ` (${tx.status})`}
                                                    </div>
                                                    <div className="tx-date">{formatDate(tx.created_at)}</div>
                                                </div>
                                                <div className={`tx-amount ${tx.type}`}>
>>>>>>> 17258722 (feat: complete app & admin panel updates, unify rating system, and cleanup repo)
                                                    {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                </div>
                                            </div>

                                            {/* Invoice Breakdown for Ride Transactions */}
                                            {isRideTransaction && (
                                                <div className="tx-invoice-breakdown">
                                                    <div className="invoice-header">
                                                        <span>Trip Invoice Summary</span>
                                                        <span className="invoice-trip-id">#{tx.reference_id?.substring(0,8) || 'N/A'}</span>
                                                    </div>
                                                    
                                                    {/* If it had online payments */}
                                                    {invoiceOnlineFare > 0 && (
                                                        <>
                                                            <div className="invoice-row">
                                                                <span>Online Payments (Total Fare)</span>
                                                                <span>{formatCurrency(invoiceOnlineFare)}</span>
                                                            </div>
                                                            <div className="invoice-row commission">
                                                                <span>Platform Commission (15%)</span>
                                                                <span>-{formatCurrency(invoiceOnlineFare * 0.15)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    
                                                    {/* If it had COD payments */}
                                                    {invoiceCodFare > 0 && (
                                                        <>
                                                            <div className="invoice-row">
                                                                <span>Cash Collected by You</span>
                                                                <span>{formatCurrency(invoiceCodFare)}</span>
                                                            </div>
                                                            <div className="invoice-row commission">
                                                                <span>Platform Commission on Cash (15%)</span>
                                                                <span>-{formatCurrency(tx.invoiceCodCommissionDue || 0)}</span>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="invoice-divider"></div>
                                                    <div className="invoice-row net">
                                                        <span>Net Impact on Wallet</span>
                                                        <span>
                                                            {tx.type === 'credit' ? '+' : '-'}
                                                            {formatCurrency(tx.amount)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                ) : (
                    /* Withdrawals List */
                    loading ? <div className="loading-spinner"></div> :
                        requests.length === 0 ? (
                            <div className="empty-state"><Wallet size={48} /><p>No withdrawal requests</p></div>
                        ) : (
                            <div className="transactions-list">
                                {requests.map(req => (
                                    <div key={req.id} className="transaction-item">
                                        <div className={`tx-icon ${req.status === 'approved' ? 'credit' : req.status}`}>
                                            {req.status === 'approved' ? <Check size={20} /> : <Wallet size={20} />}
                                        </div>
                                        <div className="tx-details">
                                            <div className="tx-desc">
                                                {req.status === 'pending' ? 'Processing...' :
                                                    req.status === 'approved' ? 'Withdrawal Successful' :
                                                        'Request Rejected'}
                                            </div>
                                            <div className="tx-date">{formatDate(req.created_at)}</div>
                                            {req.status === 'rejected' && req.admin_note && (
                                                <div className="error-note">Note: {req.admin_note}</div>
                                            )}
                                        </div>
                                        <div className={`tx-status-badge ${req.status}`}>
                                            {req.status === 'approved' ? 'Successful' : req.status}
                                        </div>
                                        <div className={`tx-amount ${req.status === 'approved' ? 'credit' : 'debit'}`}>
                                            -{formatCurrency(req.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                )}
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawModal && (
                <div className="modal-overlay">
                    <div className="modal-content bottom-sheet">
                        <div className="modal-header">
                            <h2>Withdraw Funds</h2>
                            <button className="close-btn" onClick={() => setShowWithdrawModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleWithdrawSubmit} className="withdraw-form">
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={e => setWithdrawAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    max={balance}
                                    min="1"
                                    required
                                />
                                <span className="helper-text">Max available: {formatCurrency(balance)}</span>
                            </div>

                            <div className="form-group">
                                <label>Payment Method</label>
                                <div className="method-selector">
                                    <button
                                        type="button"
                                        className={`method-btn ${withdrawMethod === 'upi' ? 'active' : ''}`}
                                        onClick={() => setWithdrawMethod('upi')}
                                    >
                                        UPI
                                    </button>
                                    <button
                                        type="button"
                                        className={`method-btn ${withdrawMethod === 'bank' ? 'active' : ''}`}
                                        onClick={() => setWithdrawMethod('bank')}
                                    >
                                        Bank Transfer
                                    </button>
                                </div>
                            </div>

                            {withdrawMethod === 'upi' ? (
                                <div className="form-group">
                                    <label>UPI ID</label>
                                    <input
                                        type="text"
                                        placeholder="user@upi"
                                        value={withdrawDetails.upiId}
                                        onChange={e => setWithdrawDetails({ ...withdrawDetails, upiId: e.target.value })}
                                        required
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label>Account Number</label>
                                        <input
                                            type="text"
                                            value={withdrawDetails.accountNumber}
                                            onChange={e => setWithdrawDetails({ ...withdrawDetails, accountNumber: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>IFSC Code</label>
                                        <input
                                            type="text"
                                            value={withdrawDetails.ifsc}
                                            onChange={e => setWithdrawDetails({ ...withdrawDetails, ifsc: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Account Holder Name</label>
                                        <input
                                            type="text"
                                            value={withdrawDetails.holderName}
                                            onChange={e => setWithdrawDetails({ ...withdrawDetails, holderName: e.target.value })}
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="submit-btn">Send Withdrawal Request</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Settlement Placeholder */}
            {balance < 0 && (
                <div className="settlement-banner">
                    <p>Please settle the due amount of {formatCurrency(Math.abs(balance))} to accept cash rides continuously.</p>
                    <button className="settle-btn" onClick={() => {
                        setAddFundsAmount(Math.abs(balance).toString());
                        setShowAddFundsModal(true);
                    }}>Pay Now</button>
                </div>
            )}

            {/* Add Funds Modal */}
            {showAddFundsModal && (
                <div className="modal-overlay">
                    <div className="modal-content bottom-sheet">
                        <div className="modal-header">
                            <h2>Add Funds</h2>
                            <button className="close-btn" onClick={() => setShowAddFundsModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddFundsSubmit} className="withdraw-form">
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    {[100, 200, 500].map(amt => (
                                        <button 
                                            key={amt} 
                                            type="button" 
                                            className="method-btn"
                                            style={{ flex: 1, padding: '8px' }}
                                            onClick={() => setAddFundsAmount(amt.toString())}
                                        >
                                            +₹{amt}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    value={addFundsAmount}
                                    onChange={e => setAddFundsAmount(e.target.value)}
                                    placeholder="Enter amount manually"
                                    min="1"
                                    required
                                />
                                {balance < 0 && (
                                    <span className="helper-text" style={{ color: '#ef4444' }}>
                                        Recommended: {formatCurrency(Math.abs(balance))} to clear dues
                                    </span>
                                )}
                            </div>

                            <button type="submit" className="submit-btn" disabled={addFundsLoading || !sdkReady} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', backgroundColor: '#3b82f6' }}>
                                {addFundsLoading ? (
                                    <span>Processing...</span>
                                ) : !sdkReady ? (
                                    <span>Loading Gateway...</span>
                                ) : (
                                    <span>Pay Securely via Cashfree</span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverWallet;


import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Clock, X, BarChart2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/DriverWallet.css';

const DriverWallet = ({ onBack }) => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
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
                .single();

            if (wallet) {
                setBalance(wallet.balance);

                // Get Transactions
                const { data: txs } = await supabase
                    .from('wallet_transactions')
                    .select('*')
                    .eq('wallet_id', wallet.id)
                    .order('created_at', { ascending: false });

                if (txs) {
                    setTransactions(txs);
                    calculateWeeklyEarnings(txs);
                }
            }

            // Get Withdrawal Requests
            const { data: reqs } = await supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('driver_id', driver.id)
                .order('created_at', { ascending: false });

            if (reqs) setRequests(reqs);

        } catch (error) {
            console.error('Error fetching wallet data:', error);
            toast.error('Failed to load wallet data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWalletData();

        // Subscribe to wallet transactions for real-time updates
        const setupSubscriptions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: driver } = await supabase
                .from('drivers')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (!driver) return;

            // Subscribe to wallet transactions
            const transactionsChannel = supabase
                .channel('wallet_transactions_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'wallet_transactions',
                }, (payload) => {
                    console.log('Wallet transaction update:', payload);
                    fetchWalletData(); // Refresh wallet data
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to wallet transactions updates');
                    }
                });

            // Subscribe to withdrawal requests
            const withdrawalsChannel = supabase
                .channel('withdrawal_requests_updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'withdrawal_requests',
                    filter: `driver_id=eq.${driver.id}`,
                }, (payload) => {
                    console.log('Withdrawal request update:', payload);
                    fetchWalletData(); // Refresh wallet data
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to withdrawal requests updates');
                    }
                });

            return { transactionsChannel, withdrawalsChannel };
        };

        const subscriptionsPromise = setupSubscriptions();

        return () => {
            subscriptionsPromise.then(channels => {
                if (channels) {
                    console.log('Cleaning up wallet subscriptions');
                    supabase.removeChannel(channels.transactionsChannel);
                    supabase.removeChannel(channels.withdrawalsChannel);
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
                {balance > 0 && (
                    <button className="withdraw-btn-main" onClick={() => setShowWithdrawModal(true)}>
                        Result Funds
                    </button>
                )}
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
                                {transactions.map(tx => (
                                    <div key={tx.id} className="transaction-item">
                                        <div className={`tx-icon ${tx.type}`}>
                                            {tx.type === 'credit' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                        </div>
                                        <div className="tx-details">
                                            <div className="tx-desc">{tx.description || 'Transaction'}</div>
                                            <div className="tx-date">{formatDate(tx.created_at)}</div>
                                        </div>
                                        <div className={`tx-amount ${tx.type}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </div>
                                    </div>
                                ))}
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
                                        <div className={`tx-icon ${req.status}`}>
                                            <Wallet size={20} />
                                        </div>
                                        <div className="tx-details">
                                            <div className="tx-desc">
                                                {req.status === 'pending' ? 'Processing...' :
                                                    req.status === 'approved' ? 'Sent to Bank/UPI' :
                                                        'Request Not Sent'}
                                            </div>
                                            <div className="tx-date">{formatDate(req.created_at)}</div>
                                            {req.status === 'rejected' && req.admin_note && (
                                                <div className="error-note">Note: {req.admin_note}</div>
                                            )}
                                        </div>
                                        <div className={`tx-status-badge ${req.status}`}>
                                            {req.status}
                                        </div>
                                        <div className="tx-amount debit">
                                            {formatCurrency(req.amount)}
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
                    <button className="settle-btn">Pay Now</button>
                </div>
            )}
        </div>
    );
};

export default DriverWallet;


import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import './WithdrawalRequests.css';

const WithdrawalRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            // Fetch requests and join with drivers -> user_id to get profile info
            // Supabase inner joins are tricky with this setup, so let's do two queries for simplicity or use view
            const { data: reqs, error } = await supabase
                .from('withdrawal_requests')
                .select('*, drivers:driver_id ( full_name, vehicle_number )')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setRequests(reqs);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id, amount) => {
        if (!confirm(`Are you sure you want to SEND ₹${amount}? This will deduct from driver wallet.`)) return;

        try {
            const { error } = await supabase.rpc('approve_withdrawal_request', { request_id: id });

            if (error) throw error;

            toast.success('Funds Sent & Wallet Deducted');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Approval Failed');
        }
    };

    const handleReject = async (id) => {
        const reason = prompt('Enter reason for rejection (e.g., Incorrect Details):');
        if (!reason) return;

        try {
            const { error } = await supabase
                .from('withdrawal_requests')
                .update({ status: 'rejected', admin_note: reason, updated_at: new Date() })
                .eq('id', id);

            if (error) throw error;

            toast.success('Request Rejected');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error('Rejection Failed');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) return <div className="loading-screen"><Loader2 className="loading-spinner" /></div>;

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="dashboard-content-wrapper">
                <main className="dashboard-main">
                    <div className="page-header-flex">
                        <div className="page-title-section">
                            <h1 className="page-title">Withdrawal Requests</h1>
                            <p className="page-subtitle">Manage driver payout requests</p>
                        </div>
                    </div>

                    <div className="requests-content">
                        {requests.length === 0 ? (
                            <div className="empty-state">
                                <Wallet size={48} />
                                <h3>No Pending Requests</h3>
                            </div>
                        ) : (
                            <div className="requests-grid">
                                {requests.map(req => (
                                    <div key={req.id} className="request-card">
                                        <div className="req-header">
                                            <div className="driver-info">
                                                <span className="driver-name">{req.drivers?.full_name || 'Unknown Driver'}</span>
                                                <span className="vehicle-info">{req.drivers?.vehicle_number}</span>
                                            </div>
                                            <div className="req-amount">
                                                {formatCurrency(req.amount)}
                                            </div>
                                        </div>

                                        <div className="req-details">
                                            <div className="method-badge">{req.method.toUpperCase()}</div>
                                            <div className="details-box">
                                                {req.method === 'upi' ? (
                                                    <div className="detail-row">
                                                        <span>UPI ID:</span> <strong>{req.details.upiId}</strong>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="detail-row"><span>Acc No:</span> <strong>{req.details.accountNumber}</strong></div>
                                                        <div className="detail-row"><span>IFSC:</span> <strong>{req.details.ifsc}</strong></div>
                                                        <div className="detail-row"><span>Holder:</span> <strong>{req.details.holderName}</strong></div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="req-date">
                                                Requested: {new Date(req.created_at).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="req-actions">
                                            <button className="action-btn reject" onClick={() => handleReject(req.id)}>
                                                <X size={18} /> Not Sent
                                            </button>
                                            <button className="action-btn approve" onClick={() => handleApprove(req.id, req.amount)}>
                                                <Check size={18} /> Sent
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default WithdrawalRequests;

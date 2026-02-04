import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Banknote, Smartphone, Plus, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
    encryptCardNumber,
    maskCardNumber,
    validateCardNumber,
    validateIFSC,
    validateUPI,
    detectCardNetwork,
    formatCardNumber,
    validateCardExpiry,
    validateAccountNumber
} from '../../../utils/paymentEncryption';
import '../css/PaymentDetails.css';

const PaymentDetails = ({ onBack }) => {
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [paymentType, setPaymentType] = useState('bank'); // 'bank', 'upi', 'card'
    const [showCardNumber, setShowCardNumber] = useState(false);

    const [formData, setFormData] = useState({
        // Bank details
        account_holder_name: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        // UPI details
        upi_id: '',
        upi_name: '',
        // Card details
        card_number: '',
        card_holder_name: '',
        card_expiry_month: '',
        card_expiry_year: '',
        card_type: 'debit',
        is_default: false,
    });

    useEffect(() => {
        fetchPaymentMethods();
    }, []);

    const fetchPaymentMethods = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('passenger_payment_details')
                .select('*')
                .eq('passenger_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPaymentMethods(data || []);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            toast.error('Failed to load payment methods');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            account_holder_name: '',
            bank_name: '',
            account_number: '',
            ifsc_code: '',
            branch_name: '',
            upi_id: '',
            upi_name: '',
            card_number: '',
            card_holder_name: '',
            card_expiry_month: '',
            card_expiry_year: '',
            card_type: 'debit',
            is_default: false,
        });
        setPaymentType('bank');
        setShowCardNumber(false);
    };

    const validateForm = () => {
        if (paymentType === 'bank') {
            if (!formData.account_holder_name || !formData.bank_name || !formData.account_number || !formData.ifsc_code) {
                toast.error('Please fill all required bank details');
                return false;
            }
            if (!validateAccountNumber(formData.account_number)) {
                toast.error('Invalid account number');
                return false;
            }
            if (!validateIFSC(formData.ifsc_code)) {
                toast.error('Invalid IFSC code');
                return false;
            }
        } else if (paymentType === 'upi') {
            if (!formData.upi_id) {
                toast.error('Please enter UPI ID');
                return false;
            }
            if (!validateUPI(formData.upi_id)) {
                toast.error('Invalid UPI ID format');
                return false;
            }
        } else if (paymentType === 'card') {
            if (!formData.card_number || !formData.card_holder_name || !formData.card_expiry_month || !formData.card_expiry_year) {
                toast.error('Please fill all required card details');
                return false;
            }
            if (!validateCardNumber(formData.card_number)) {
                toast.error('Invalid card number');
                return false;
            }
            if (!validateCardExpiry(parseInt(formData.card_expiry_month), parseInt(formData.card_expiry_year))) {
                toast.error('Card has expired');
                return false;
            }
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let insertData = {
                passenger_id: user.id,
                payment_method: paymentType,
                is_default: formData.is_default,
            };

            if (paymentType === 'bank') {
                insertData = {
                    ...insertData,
                    account_holder_name: formData.account_holder_name,
                    bank_name: formData.bank_name,
                    account_number: formData.account_number,
                    ifsc_code: formData.ifsc_code.toUpperCase(),
                    branch_name: formData.branch_name,
                };
            } else if (paymentType === 'upi') {
                insertData = {
                    ...insertData,
                    upi_id: formData.upi_id,
                    upi_name: formData.upi_name,
                };
            } else if (paymentType === 'card') {
                const encryptedCardNumber = await encryptCardNumber(formData.card_number);
                const cardNetwork = detectCardNetwork(formData.card_number);

                insertData = {
                    ...insertData,
                    card_number_encrypted: encryptedCardNumber,
                    card_holder_name: formData.card_holder_name,
                    card_expiry_month: parseInt(formData.card_expiry_month),
                    card_expiry_year: parseInt(formData.card_expiry_year),
                    card_type: formData.card_type,
                    card_network: cardNetwork,
                };
            }

            // If setting as default, unset other defaults first
            if (formData.is_default) {
                await supabase
                    .from('passenger_payment_details')
                    .update({ is_default: false })
                    .eq('passenger_id', user.id);
            }

            const { error } = await supabase
                .from('passenger_payment_details')
                .insert(insertData);

            if (error) throw error;

            toast.success('Payment method added successfully');
            setShowAddModal(false);
            resetForm();
            fetchPaymentMethods();
        } catch (error) {
            console.error('Error saving payment method:', error);
            toast.error('Failed to save payment method');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this payment method?')) return;

        try {
            const { error } = await supabase
                .from('passenger_payment_details')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Payment method deleted');
            fetchPaymentMethods();
        } catch (error) {
            console.error('Error deleting payment method:', error);
            toast.error('Failed to delete payment method');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Unset all defaults
            await supabase
                .from('passenger_payment_details')
                .update({ is_default: false })
                .eq('passenger_id', user.id);

            // Set new default
            const { error } = await supabase
                .from('passenger_payment_details')
                .update({ is_default: true })
                .eq('id', id);

            if (error) throw error;

            toast.success('Default payment method updated');
            fetchPaymentMethods();
        } catch (error) {
            console.error('Error setting default:', error);
            toast.error('Failed to update default');
        }
    };

    const renderPaymentCard = (method) => {
        return (
            <div key={method.id} className={`payment-card ${method.is_default ? 'default' : ''}`}>
                <div className="payment-card-header">
                    <div className="payment-icon">
                        {method.payment_method === 'bank' && <Banknote size={24} />}
                        {method.payment_method === 'upi' && <Smartphone size={24} />}
                        {method.payment_method === 'card' && <CreditCard size={24} />}
                    </div>
                    <div className="payment-type">
                        {method.payment_method.toUpperCase()}
                        {method.is_default && <span className="default-badge">Default</span>}
                    </div>
                    <button className="delete-btn" onClick={() => handleDelete(method.id)}>
                        <Trash2 size={18} />
                    </button>
                </div>

                <div className="payment-details">
                    {method.payment_method === 'bank' && (
                        <>
                            <div className="detail-row">
                                <span className="label">Account Holder:</span>
                                <span className="value">{method.account_holder_name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Bank:</span>
                                <span className="value">{method.bank_name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Account Number:</span>
                                <span className="value">****{method.account_number.slice(-4)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">IFSC:</span>
                                <span className="value">{method.ifsc_code}</span>
                            </div>
                        </>
                    )}

                    {method.payment_method === 'upi' && (
                        <>
                            <div className="detail-row">
                                <span className="label">UPI ID:</span>
                                <span className="value">{method.upi_id}</span>
                            </div>
                            {method.upi_name && (
                                <div className="detail-row">
                                    <span className="label">Name:</span>
                                    <span className="value">{method.upi_name}</span>
                                </div>
                            )}
                        </>
                    )}

                    {method.payment_method === 'card' && (
                        <>
                            <div className="detail-row">
                                <span className="label">Card Holder:</span>
                                <span className="value">{method.card_holder_name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Card Number:</span>
                                <span className="value">**** **** **** {method.card_number_encrypted ? method.card_number_encrypted.slice(-4) : '****'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Expiry:</span>
                                <span className="value">{method.card_expiry_month}/{method.card_expiry_year}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Type:</span>
                                <span className="value">{method.card_type} - {method.card_network}</span>
                            </div>
                        </>
                    )}
                </div>

                {!method.is_default && (
                    <button className="set-default-btn" onClick={() => handleSetDefault(method.id)}>
                        Set as Default
                    </button>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="payment-details-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading payment methods...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-details-container">
            {/* Header */}
            <div className="payment-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1>Payment Methods</h1>
                <button className="add-btn" onClick={() => setShowAddModal(true)}>
                    <Plus size={24} />
                </button>
            </div>

            {/* Payment Methods List */}
            <div className="payment-content">
                {paymentMethods.length === 0 ? (
                    <div className="empty-state">
                        <CreditCard size={64} />
                        <h3>No Payment Methods</h3>
                        <p>Add a payment method to get started</p>
                        <button className="add-first-btn" onClick={() => setShowAddModal(true)}>
                            <Plus size={20} />
                            Add Payment Method
                        </button>
                    </div>
                ) : (
                    <div className="payment-list">
                        {paymentMethods.map(renderPaymentCard)}
                    </div>
                )}
            </div>

            {/* Add Payment Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Payment Method</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Payment Type Selector */}
                        <div className="payment-type-selector">
                            <button
                                className={`type-btn ${paymentType === 'bank' ? 'active' : ''}`}
                                onClick={() => setPaymentType('bank')}
                            >
                                <Banknote size={20} />
                                Bank Account
                            </button>
                            <button
                                className={`type-btn ${paymentType === 'upi' ? 'active' : ''}`}
                                onClick={() => setPaymentType('upi')}
                            >
                                <Smartphone size={20} />
                                UPI
                            </button>
                            <button
                                className={`type-btn ${paymentType === 'card' ? 'active' : ''}`}
                                onClick={() => setPaymentType('card')}
                            >
                                <CreditCard size={20} />
                                Card
                            </button>
                        </div>

                        {/* Form Fields */}
                        <div className="modal-form">
                            {paymentType === 'bank' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Account Holder Name *"
                                        value={formData.account_holder_name}
                                        onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Bank Name *"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Account Number *"
                                        value={formData.account_number}
                                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value.replace(/\D/g, '') })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="IFSC Code *"
                                        value={formData.ifsc_code}
                                        onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                                        maxLength={11}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Branch Name (Optional)"
                                        value={formData.branch_name}
                                        onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                                    />
                                </>
                            )}

                            {paymentType === 'upi' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="UPI ID * (e.g., user@paytm)"
                                        value={formData.upi_id}
                                        onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Name (Optional)"
                                        value={formData.upi_name}
                                        onChange={(e) => setFormData({ ...formData, upi_name: e.target.value })}
                                    />
                                </>
                            )}

                            {paymentType === 'card' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Card Holder Name *"
                                        value={formData.card_holder_name}
                                        onChange={(e) => setFormData({ ...formData, card_holder_name: e.target.value })}
                                    />
                                    <div className="card-number-field">
                                        <input
                                            type={showCardNumber ? 'text' : 'password'}
                                            placeholder="Card Number *"
                                            value={formData.card_number}
                                            onChange={(e) => setFormData({ ...formData, card_number: e.target.value.replace(/\D/g, '') })}
                                            maxLength={19}
                                        />
                                        <button
                                            type="button"
                                            className="toggle-visibility"
                                            onClick={() => setShowCardNumber(!showCardNumber)}
                                        >
                                            {showCardNumber ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <div className="expiry-row">
                                        <select
                                            value={formData.card_expiry_month}
                                            onChange={(e) => setFormData({ ...formData, card_expiry_month: e.target.value })}
                                        >
                                            <option value="">Month *</option>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                <option key={month} value={month}>{month.toString().padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={formData.card_expiry_year}
                                            onChange={(e) => setFormData({ ...formData, card_expiry_year: e.target.value })}
                                        >
                                            <option value="">Year *</option>
                                            {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + i).map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <select
                                        value={formData.card_type}
                                        onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                                    >
                                        <option value="debit">Debit Card</option>
                                        <option value="credit">Credit Card</option>
                                        <option value="prepaid">Prepaid Card</option>
                                    </select>
                                </>
                            )}

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                />
                                Set as default payment method
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
                                Cancel
                            </button>
                            <button className="btn-save" onClick={handleSave}>
                                <Check size={18} />
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentDetails;

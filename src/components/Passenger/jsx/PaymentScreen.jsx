import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, ShieldCheck, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { paymentService } from '../../../services/payments/PaymentService';
import toast from 'react-hot-toast';
import '../css/PaymentScreen.css';

const PaymentScreen = ({ paymentData, onBack, onPaymentComplete }) => {
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
    const [errorMsg, setErrorMsg] = useState('');
    const [sdkReady, setSdkReady] = useState(false);

    // Load Cashfree SDK
    useEffect(() => {
        // If already loaded from a previous mount
        if (window.Cashfree) {
            setSdkReady(true);
            return;
        }

        const existing = document.getElementById('cashfree-sdk');
        if (existing) {
            // Script tag exists but might still be loading
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
            setErrorMsg('Payment gateway failed to load. Please refresh.');
        };
        document.body.appendChild(script);
    }, []);

    const handlePayment = async () => {
        if (!paymentData?.payment_id && !paymentData?.booking_id) {
            toast.error('Invalid payment data provided');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Create order via Supabase Edge Function
            const orderData = await paymentService.createPaymentOrder(paymentData.payment_id, paymentData.booking_id);

            // Important: Save the created payment_id so verifyPayment can use it
            if (orderData.payment_id) {
                paymentData.payment_id = orderData.payment_id;
            }

            if (orderData.stub_mode) {
                // Handle stub mode (No API keys provided)
                setPaymentStatus('processing');
                setTimeout(() => {
                    handleSuccess();
                }, 2000);
                return;
            }

            // 2. Initialize Cashfree
            if (!window.Cashfree) {
                throw new Error('Payment gateway failed to load');
            }

            const cashfree = window.Cashfree({
                mode: 'production' // Updated for live
            });

            // 3. Open Checkout
            let checkoutOptions = {
                paymentSessionId: orderData.payment_session_id,
                redirectTarget: "_modal",
            };

            setPaymentStatus('processing');

            cashfree.checkout(checkoutOptions).then((result) => {
                if (result.error) {
                    // This handles cases like user closing the modal
                    console.log("User closed the popup or there was an error: ", result.error);
                    setPaymentStatus('failed');
                    setErrorMsg(result.error.message || 'Payment cancelled or failed');
                } else if (result.redirect) {
                    // Redirection based payment
                    console.log("Payment will be redirected");
                } else if (result.paymentDetails) {
                    // Process payment success directly
                    console.log("Payment completed details", result.paymentDetails);
                    verifyPayment(orderData.order_id);
                }
            });

        } catch (error) {
            console.error('Payment launch error:', error);
            setPaymentStatus('failed');
            setErrorMsg(error.message || 'Failed to start payment process');
        } finally {
            setLoading(false);
        }
    };

    const verifyPayment = async (orderId) => {
        setVerifying(true);
        try {
            // Poll DB until webhook is received
            const isPaid = await paymentService.pollPaymentStatus(paymentData.payment_id);

            if (isPaid) {
                handleSuccess();
            } else {
                setPaymentStatus('failed');
                setErrorMsg('Payment verification taking too long. Check your trips later to confirm.');
            }
        } catch (error) {
            setPaymentStatus('failed');
            setErrorMsg('Could not verify payment status automatically.');
        } finally {
            setVerifying(false);
        }
    };

    const handleSuccess = () => {
        setPaymentStatus('success');
        toast.success('Payment completed successfully!');
        if (onPaymentComplete) {
            setTimeout(onPaymentComplete, 2000); // give time to see success
        }
    };

    if (!paymentData) {
        return (
            <div className="payment-screen-container">
                <div className="empty-state">
                    <AlertCircle size={48} color="#ef4444" />
                    <h3>Invalid Payment</h3>
                    <button className="back-btn" onClick={onBack}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-screen-container animate-page-in">
            <header className="payment-header">
                {paymentStatus !== 'success' && paymentStatus !== 'processing' && (
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                )}
                <h1>Complete Payment</h1>
            </header>

            <div className="payment-content">
                {paymentStatus === 'success' ? (
                    <div className="payment-success">
                        <div className="success-icon-wrapper">
                            <CheckCircle size={64} className="success-icon animate-pulse" />
                        </div>
                        <h2>Payment Successful!</h2>
                        <p>₹{paymentData.amount} paid successfully</p>
                        <p className="redirect-note">Redirecting you shortly...</p>
                    </div>
                ) : (
                    <>
                        <div className="invoice-card">
                            <div className="invoice-header">
                                <ShieldCheck size={24} color="#10b981" />
                                <span>Secure Checkout</span>
                            </div>

                            <div className="invoice-details">
                                <div className="detail-row">
                                    <span>Ride Fare</span>
                                    <span>₹{paymentData.amount}</span>
                                </div>
                                <div className="divider"></div>
                                <div className="detail-row total">
                                    <span>Total Amount to Pay</span>
                                    <span>₹{paymentData.amount}</span>
                                </div>
                            </div>

                            <p className="secure-note">
                                Payments are secured by Cashfree. You can use UPI, Credit/Debit cards, or Netbanking.
                            </p>
                        </div>

                        {paymentStatus === 'failed' && (
                            <div className="payment-error">
                                <AlertCircle size={20} />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <button
                            className="pay-btn"
                            onClick={handlePayment}
                            disabled={!sdkReady || loading || paymentStatus === 'processing' || verifying}
                        >
                            {!sdkReady ? (
                                <>
                                    <Loader2 size={20} className="spinning-loader" />
                                    <span>Loading Gateway...</span>
                                </>
                            ) : loading || paymentStatus === 'processing' || verifying ? (
                                <>
                                    <Loader2 size={20} className="spinning-loader" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <CreditCard size={20} />
                                    <span>Pay ₹{paymentData.amount} via Cashfree</span>
                                </>
                            )}
                        </button>

                        {(paymentStatus === 'processing' || verifying) && (
                            <p className="processing-note text-center mt-4 text-gray-500">
                                Please do not close this window or press back.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentScreen;

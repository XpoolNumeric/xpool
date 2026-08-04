import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, ShieldCheck, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { paymentService } from '../../../services/payments/PaymentService';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/PaymentScreen.css';

const PaymentScreen = ({ paymentData, onBack, onPaymentComplete }) => {
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
    const [errorMsg, setErrorMsg] = useState('');
    const [sdkReady, setSdkReady] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    // Fetch user details for prefill
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, email, phone')
                    .eq('id', user.id)
                    .single();
                setUserProfile(profile || { full_name: user.user_metadata?.full_name || '', email: user.email, phone: user.phone });
            }
        };
        fetchUser();
    }, []);

    // Load Razorpay SDK
    useEffect(() => {
        if (window.Razorpay) {
            setSdkReady(true);
            return;
        }

        const existing = document.getElementById('razorpay-sdk');
        if (existing) {
            existing.addEventListener('load', () => setSdkReady(true));
            if (window.Razorpay) setSdkReady(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'razorpay-sdk';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
            console.log('Razorpay SDK loaded successfully');
            setSdkReady(true);
        };
        script.onerror = () => {
            console.error('Failed to load Razorpay SDK');
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
            // 1. Create Razorpay order via Supabase Edge Function
            const orderData = await paymentService.createPaymentOrder(paymentData.payment_id, paymentData.booking_id);

            if (orderData.payment_id) {
                paymentData.payment_id = orderData.payment_id;
            }

            // 2. Verify Razorpay SDK loaded
            if (!window.Razorpay) {
                throw new Error('Payment gateway SDK failed to load');
            }

            const razorpayKey = orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TIqp0Gw2vCZY5F';

            // 3. Open Razorpay Checkout Modal
            const options = {
                key: razorpayKey,
                amount: orderData.amount,
                currency: orderData.currency || 'INR',
                name: 'xpool',
                description: 'Ride Fare Payment',
                order_id: orderData.order_id,
                config: {
                    display: {
                        blocks: {
                            upi_block: {
                                name: 'Pay via UPI / QR Code',
                                instruments: [
                                    {
                                        method: 'upi',
                                        flows: ['intent', 'qr']
                                    }
                                ]
                            }
                        },
                        sequence: ['block.upi_block', 'block.default'],
                        preferences: {
                            show_default_blocks: true
                        }
                    }
                },
                method: {
                    upi: true,
                    card: true,
                    netbanking: true,
                    wallet: true,
                    qr: true
                },
                upi: {
                    flow: 'intent'
                },
                handler: async function (response) {
                    console.log('Razorpay success response:', response);
                    setVerifying(true);
                    setPaymentStatus('processing');

                    try {
                        await paymentService.verifyRazorpayPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            payment_id: orderData.payment_id,
                            booking_id: paymentData?.booking_id,
                            type: 'ride_payment'
                        });
                        handleSuccess();
                    } catch (verifyErr) {
                        console.error('Signature verification error:', verifyErr);
                        setPaymentStatus('failed');
                        setErrorMsg(verifyErr.message || 'Payment verification failed.');
                    } finally {
                        setVerifying(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        console.log('Razorpay modal dismissed by user');
                        setPaymentStatus('failed');
                        setErrorMsg('Payment cancelled.');
                    }
                },
                prefill: {
                    name: userProfile?.full_name || 'Passenger',
                    email: userProfile?.email || 'passenger@xpool.app',
                    contact: userProfile?.phone || ''
                },
                theme: {
                    color: '#10b981'
                }
            };

            setPaymentStatus('processing');
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                console.error('Razorpay payment failed event:', response.error);
                setPaymentStatus('failed');
                setErrorMsg(response.error.description || 'Payment failed.');
            });
            rzp.open();

        } catch (error) {
            console.error('Payment launch error:', error);
            setPaymentStatus('failed');
            setErrorMsg(error.message || 'Failed to start payment process');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = async () => {
        setPaymentStatus('success');

        try {
            if (paymentData?.booking_id) {
                await supabase
                    .from('booking_requests')
                    .update({ status: 'completed', drop_status: 'completed' })
                    .eq('id', paymentData.booking_id);
            }
        } catch (err) {
            console.error('Failed to update booking status automatically:', err);
        }

        toast.success('Paid successfully and your ride completed, thank you for choosing xpool', {
            duration: 4000,
            icon: '✅',
            style: {
                minWidth: '350px',
                textAlign: 'center'
            }
        });

        if (onPaymentComplete) {
            setTimeout(onPaymentComplete, 4000);
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
                                Payments are secured by Razorpay. You can use UPI, Credit/Debit cards, Netbanking, or Wallets.
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
                                    <span>Pay ₹{paymentData.amount} via Razorpay</span>
                                </>
                            )}
                        </button>

                        {(paymentStatus === 'processing' || verifying) && (
                            <p className="processing-note text-center mt-4 text-gray-500">
                                Please do not close this window or press back while payment is processing.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentScreen;

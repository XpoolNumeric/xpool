import React from 'react';
import { ArrowLeft, CreditCard, Plus, Trash2, Loader2 } from 'lucide-react';
import './PaymentMethods.css';
import toast from 'react-hot-toast';

const PaymentMethods = ({ onBack }) => {
    const [methods, setMethods] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [showAddForm, setShowAddForm] = React.useState(false);
    const [newMethod, setNewMethod] = React.useState({ type: 'card', val1: '', val2: '' });

    React.useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_payment_methods')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMethods(data || []);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            toast.error('Failed to load payment methods');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const payload = {
                user_id: user.id,
                type: newMethod.type,
            };

            if (newMethod.type === 'card') {
                payload.brand = 'Visa'; // Mock brand for now
                payload.last4 = newMethod.val1.slice(-4);
                payload.expiry = newMethod.val2;
            } else {
                payload.id_val = newMethod.val1;
            }

            const { error } = await supabase
                .from('user_payment_methods')
                .insert([payload]);

            if (error) throw error;

            toast.success('Payment method added!');
            setShowAddForm(false);
            setNewMethod({ type: 'card', val1: '', val2: '' });
            fetchMethods();
        } catch (error) {
            toast.error('Failed to add payment method');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this payment method?')) return;

        try {
            const { error } = await supabase
                .from('user_payment_methods')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Deleted successfully');
            fetchMethods();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="payment-methods-container">
            <div className="sub-page-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={24} />
                </button>
                <h2>Payment Methods</h2>
            </div>

            {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-yellow-500" /></div>
            ) : (
                <div className="payment-list">
                    {methods.length === 0 && !showAddForm && (
                        <div className="text-center p-10 text-gray-400">No payment methods added yet.</div>
                    )}

                    {methods.map(method => (
                        <div key={method.id} className="payment-card">
                            <div className="card-icon-wrapper">
                                <CreditCard size={24} />
                            </div>
                            <div className="payment-info">
                                <span className="method-name">
                                    {method.type === 'card' ? `${method.brand} •••• ${method.last4}` : 'UPI ID'}
                                </span>
                                <span className="method-desc">
                                    {method.type === 'card' ? `Expires ${method.expiry}` : method.id_val}
                                </span>
                            </div>
                            <button
                                onClick={() => handleDelete(method.id)}
                                className="text-red-400 hover:text-red-600 p-2 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showAddForm ? (
                <form onSubmit={handleAdd} className="mt-6 p-4 bg-white rounded-2xl shadow-sm space-y-4 animate-fadeIn">
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        <button
                            type="button"
                            className={`flex-1 py-2 text-sm font-bold rounded-lg ${newMethod.type === 'card' ? 'bg-white shadow' : ''}`}
                            onClick={() => setNewMethod({ ...newMethod, type: 'card' })}
                        >Card</button>
                        <button
                            type="button"
                            className={`flex-1 py-2 text-sm font-bold rounded-lg ${newMethod.type === 'upi' ? 'bg-white shadow' : ''}`}
                            onClick={() => setNewMethod({ ...newMethod, type: 'upi' })}
                        >UPI</button>
                    </div>

                    {newMethod.type === 'card' ? (
                        <>
                            <input
                                className="w-full p-3 rounded-xl border border-gray-200"
                                placeholder="Card Number"
                                value={newMethod.val1}
                                onChange={e => setNewMethod({ ...newMethod, val1: e.target.value })}
                                required
                            />
                            <input
                                className="w-full p-3 rounded-xl border border-gray-200"
                                placeholder="Expiry (MM/YY)"
                                value={newMethod.val2}
                                onChange={e => setNewMethod({ ...newMethod, val2: e.target.value })}
                                required
                            />
                        </>
                    ) : (
                        <input
                            className="w-full p-3 rounded-xl border border-gray-200"
                            placeholder="UPI ID (e.g. name@upi)"
                            value={newMethod.val1}
                            onChange={e => setNewMethod({ ...newMethod, val1: e.target.value })}
                            required
                        />
                    )}

                    <div className="flex gap-2">
                        <button type="button" className="flex-1 py-3 text-gray-500 font-bold" onClick={() => setShowAddForm(false)}>Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-brand-yellow text-black font-bold rounded-xl">Save</button>
                    </div>
                </form>
            ) : (
                <button className="add-method-btn" onClick={() => setShowAddForm(true)}>
                    <Plus size={20} />
                    Add New Method
                </button>
            )}
        </div>
    );
};

export default PaymentMethods;


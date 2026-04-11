import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, UserCircle, MessageSquare } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Chat.css';

const Chat = ({ tripId, bookingId, onBack, currentUserId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [driverId, setDriverId] = useState(null);
    const [senderProfiles, setSenderProfiles] = useState({});
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchTripAndMessages();
        const subscribeToMessages = () => {
            const channel = supabase
                .channel(`trip_chat_${tripId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: bookingId ? `booking_id=eq.${bookingId}` : `trip_id=eq.${tripId}`
                    },
                    (payload) => {
                        setMessages((prev) => {
                            // Prevent duplicate if optimistic update was used
                            if (!prev.some(m => m.id === payload.new.id || (m.content === payload.new.content && m.sender_id === payload.new.sender_id && new Date(payload.new.created_at) - new Date(m.created_at) < 5000))) {
                                return [...prev, payload.new];
                            }
                            return prev;
                        });
                    }
                )
                .subscribe();

            return channel;
        };

        const channel = subscribeToMessages();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tripId, bookingId, driverId, senderProfiles]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchTripAndMessages = async () => {
        try {
            // First fetch driver ID for this trip
            const { data: tripData } = await supabase
                .from('trips')
                .select('user_id')
                .eq('id', tripId)
                .single();

            if (tripData) {
                setDriverId(tripData.user_id);
            }

            // Fetch messages
            let query = supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true });

            if (bookingId) {
                query = query.eq('booking_id', bookingId);
            } else if (tripId) {
                query = query.eq('trip_id', tripId);
            }

            const { data: msgs, error } = await query;

            if (error) throw error;

            // Fetch profiles for sender names
            if (msgs && msgs.length > 0) {
                const uniqueSenderIds = [...new Set(msgs.map(m => m.sender_id))];
                await fetchProfiles(uniqueSenderIds);
            }

            setMessages(msgs || []);
        } catch (error) {
            console.error('Error fetching chat data:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async (userIds) => {
        if (!userIds || userIds.length === 0) return;

        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);

            if (data) {
                setSenderProfiles(prev => {
                    const newProfiles = { ...prev };
                    data.forEach(p => newProfiles[p.id] = p.full_name);
                    return newProfiles;
                });
            }
        } catch (err) {
            console.error('Failed to fetch user profiles for chat:', err);
        }
    };

    // When a real-time message arrives, try fetching their profile if missing
    useEffect(() => {
        if (messages.length > 0) {
            const latestMsg = messages[messages.length - 1];
            if (latestMsg && latestMsg.sender_id && !senderProfiles[latestMsg.sender_id]) {
                fetchProfiles([latestMsg.sender_id]);
            }
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!newMessage.trim()) return;

        const messageData = {
            trip_id: tripId,
            sender_id: currentUserId,
            content: newMessage.trim()
        };

        if (bookingId) {
            messageData.booking_id = bookingId;
        }

        const msgText = newMessage.trim();
        setNewMessage(''); // Clear input immediately for better UX
        
        // Optimistic update
        const optimisticMsg = {
            id: `temp-${Date.now()}`,
            ...messageData,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) throw error;
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            // Remove optimistic message if failed
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setNewMessage(msgText); // Restore input
        }
    };

    const handleQuickReplySend = async (text) => {
        const messageData = {
            trip_id: tripId,
            sender_id: currentUserId,
            content: text.trim()
        };

        if (bookingId) {
            messageData.booking_id = bookingId;
        }
        
        // Optimistic update
        const optimisticMsg = {
            id: `temp-${Date.now()}`,
            ...messageData,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) throw error;
        } catch (error) {
            console.error('Error sending quick reply:', error);
            toast.error('Failed to send message');
            // Remove optimistic message if failed
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isCurrentUserDriver = currentUserId === driverId;
    const driverQuickReplies = [
        "I've arrived! 📍",
        "Stuck in traffic 🚦",
        "Be there in 5 mins ⏳"
    ];
    const passengerQuickReplies = [
        "I'm here! 🏃",
        "Give me 2 mins ⏳",
        "Are you nearby? 🚕"
    ];

    return (
        <div className="chat-container">
            <header className="chat-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} />
                </button>
                <div className="header-info">
                    <div className="user-avatar-wrapper">
                        <UserCircle size={28} />
                    </div>
                    <div className="text-info">
                        <h3>Trip Chat</h3>
                        <p>Real-time messaging</p>
                    </div>
                </div>
            </header>

            <div className="messages-list">
                {loading ? (
                    <div className="loading-spinner">Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className="empty-chat">
                        <div className="empty-chat-icon">
                            <MessageSquare size={48} />
                        </div>
                        <div>
                            <p style={{ fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem', fontSize: '1.1rem' }}>No messages yet</p>
                            <p style={{ margin: 0 }}>Send a message to start the conversation!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.sender_id === currentUserId;
                        const isDriver = msg.sender_id === driverId;
                        const senderName = isMine ? 'You' : (senderProfiles[msg.sender_id] || 'User');
                        const role = isDriver ? 'Driver' : 'Passenger';

                        return (
                            <div
                                key={msg.id}
                                className={`message-bubble ${isMine ? 'sent' : 'received'}`}
                            >
                                {!isMine && (
                                    <div className="msg-sender-info">
                                        <span className="msg-name">{senderName}</span>
                                        <span className={`msg-role ${isDriver ? 'role-driver' : 'role-passenger'}`}>{role}</span>
                                    </div>
                                )}
                                <div className="message-content">
                                    <p>{msg.content}</p>
                                    <span className="message-time">{formatTime(msg.created_at)}</span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-footer">
                {!loading && driverId && (
                    <div className="quick-replies-container">
                        {(isCurrentUserDriver ? driverQuickReplies : passengerQuickReplies).map((reply, idx) => (
                            <button
                                key={idx}
                                className="quick-reply-pill"
                                onClick={() => handleQuickReplySend(reply)}
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                )}
                
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="send-btn">
                        <Send size={18} strokeWidth={2.5} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat;

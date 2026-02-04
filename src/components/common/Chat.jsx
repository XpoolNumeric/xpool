import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, User, UserCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import './Chat.css';

const Chat = ({ tripId, onBack, currentUserId }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [recipient, setRecipient] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchMessages();
        const subscribeToMessages = () => {
            const channel = supabase
                .channel(`trip_chat_${tripId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `trip_id=eq.${tripId}`
                    },
                    (payload) => {
                        setMessages((prev) => [...prev, payload.new]);
                    }
                )
                .subscribe();

            return channel;
        };

        const channel = subscribeToMessages();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tripId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('trip_id', tripId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const messageData = {
            trip_id: tripId,
            sender_id: currentUserId,
            content: newMessage.trim()
        };

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) throw error;
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-container">
            <header className="chat-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <div className="header-info">
                    <UserCircle size={32} className="user-avatar" />
                    <div className="text-info">
                        <h3>Trip Chat</h3>
                        <p>Real-time messaging</p>
                    </div>
                </div>
            </header>

            <div className="messages-list">
                {loading ? (
                    <div className="loading-spinner">Loading...</div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message-bubble ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}
                        >
                            <div className="message-content">
                                <p>{msg.content}</p>
                                <span className="message-time">{formatTime(msg.created_at)}</span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" disabled={!newMessage.trim()}>
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
};

export default Chat;

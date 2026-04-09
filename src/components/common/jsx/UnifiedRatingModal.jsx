import React, { useState, useEffect } from 'react';
import { Star, X, MessageSquare, ShieldCheck, CheckCircle2, Send } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/UnifiedRatingModal.css';

/**
 * Unified Rating Modal for Drivers and Passengers
 * @param {Object} targetUser - The user being rated (e.g., { id, name, role })
 * @param {string} tripId - Current trip ID
 * @param {Function} onClose - Close handler
 * @param {Function} onFinish - Completion handler
 */
const UnifiedRatingModal = ({ targetUser, tripId, onClose, onFinish }) => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessTick, setShowSuccessTick] = useState(true);

    useEffect(() => {
        // Auto-show the rating form after a brief delay for the tick animation
        const timer = setTimeout(() => {
            setShowSuccessTick(false);
        }, 2200);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required');

            const { error } = await supabase
                .from('reviews')
                .insert({
                    reviewer_id: user.id,
                    target_id: targetUser.id,
                    rating: rating,
                    comment: comment.trim(),
                    // Note: Schema doesn't have trip_id yet based on confirm SQL, 
                    // but we keep it in state in case we want to extend
                });

            if (error) throw error;

            toast.success('Thank you for your feedback!');
            if (onFinish) onFinish();
            onClose();
        } catch (error) {
            console.error('Error submitting review:', error);
            toast.error('Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="unified-rating-overlay">
            <div className={`unified-rating-card ${showSuccessTick ? 'showing-tick' : 'showing-form'}`}>
                {/* Close Button */}
                {!showSuccessTick && (
                    <button className="close-btn" onClick={onClose} disabled={submitting}>
                        <X size={20} />
                    </button>
                )}

                {/* Success Animation Area */}
                {showSuccessTick ? (
                    <div className="success-animation-container">
                        <div className="tick-wrapper">
                            <CheckCircle2 size={80} className="tick-icon" />
                        </div>
                        <h2 className="success-title">Ride Finished!</h2>
                        <p className="success-subtitle">Successfully completed the trip</p>
                    </div>
                ) : (
                    <div className="rating-form-container">
                        <div className="form-header">
                            <div className="avatar-placeholder">
                                {targetUser.name?.charAt(0) || <CheckCircle2 />}
                            </div>
                            <h2>Rate your experience</h2>
                            <p>How was your experience with <strong>{targetUser.name}</strong>?</p>
                        </div>

                        {/* Star Section */}
                        <div className="stars-grid">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    className={`star-button ${star <= (hover || rating) ? 'active' : ''}`}
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHover(star)}
                                    onMouseLeave={() => setHover(0)}
                                    type="button"
                                >
                                    <Star
                                        size={42}
                                        fill={star <= (hover || rating) ? "#facc15" : "none"}
                                        strokeWidth={1.5}
                                    />
                                </button>
                            ))}
                        </div>

                        {/* Comment Section */}
                        <div className="comment-box-wrapper">
                            <label className="input-label">
                                <MessageSquare size={16} />
                                <span>Leave a comment (optional)</span>
                            </label>
                            <textarea
                                className="comment-textarea"
                                placeholder="Write your highlights or suggestions here..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={4}
                            />
                        </div>

                        {/* Safety Note */}
                        <div className="safety-footer">
                            <ShieldCheck size={14} />
                            <span>Your honest feedback helps the Xpool community stay safe and reliable.</span>
                        </div>

                        {/* Footer Action */}
                        <button
                            className="submit-rating-button"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="loader-span">Submitting...</span>
                            ) : (
                                <>
                                    <span>Submit Review</span>
                                    <Send size={18} />
                                </>
                            )}
                        </button>
                        
                        <button className="skip-text-btn" onClick={onClose} disabled={submitting}>
                            Not now, maybe later
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnifiedRatingModal;

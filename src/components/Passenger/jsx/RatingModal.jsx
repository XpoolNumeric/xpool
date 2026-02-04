import React, { useState } from 'react';
import { Star, X, MessageSquare, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/RatingModal.css';

const RatingModal = ({ ride, onClose, onFinish }) => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Insert review
            const { error } = await supabase
                .from('reviews')
                .insert({
                    trip_id: ride.id,
                    reviewer_id: user.id,
                    reviewee_id: ride.user_id, // Driver
                    rating: rating,
                    comment: comment.trim(),
                    role: 'passenger'
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
        <div className="rating-modal-overlay">
            <div className="rating-modal-content">
                <button className="close-btn" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="modal-header">
                    <div className="success-badge">
                        <Star fill="#fbbf24" color="#fbbf24" size={24} />
                    </div>
                    <h2>How was your ride?</h2>
                    <p>Rating your experience with {ride.driver_name || 'the driver'} helps us improve Xpool.</p>
                </div>

                <div className="stars-container">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className={`star-btn ${star <= (hover || rating) ? 'active' : ''}`}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHover(star)}
                            onMouseLeave={() => setHover(0)}
                        >
                            <Star
                                size={36}
                                fill={star <= (hover || rating) ? "#fbbf24" : "none"}
                            />
                        </button>
                    ))}
                </div>

                <div className="comment-section">
                    <label>
                        <MessageSquare size={16} />
                        Any specific highlights?
                    </label>
                    <textarea
                        placeholder="Great driving, friendly, on time..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                    />
                </div>

                <div className="safety-note">
                    <ShieldCheck size={16} color="#16a34a" />
                    <span>Your feedback is anonymous and helps other passengers.</span>
                </div>

                <button
                    className="submit-rating-btn"
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
            </div>
        </div>
    );
};

export default RatingModal;

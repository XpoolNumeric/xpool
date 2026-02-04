import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import '../css/DriverRatingModal.css';

const DriverRatingModal = ({ ride, onClose, onFinish }) => {
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
            if (!user) throw new Error('No user found');

            const { error } = await supabase
                .from('reviews')
                .insert([{
                    reviewer_id: user.id,
                    target_id: ride.passenger_id,
                    rating,
                    comment,
                    trip_id: ride.id // Assuming trip_id exists or target_id is enough
                }]);

            if (error) throw error;

            toast.success('Rating submitted successfully!');
            onFinish();
        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Failed to submit rating');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="driver-rating-overlay">
            <div className="driver-rating-content">
                <button className="close-btn" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="modal-header">
                    <h2>Rate Passenger</h2>
                    <p>How was your experience with {ride.passenger_name || 'the passenger'}?</p>
                </div>

                <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className={`star-btn ${star <= (hover || rating) ? 'active' : ''}`}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHover(star)}
                            onMouseLeave={() => setHover(0)}
                        >
                            <Star size={40} fill={star <= (hover || rating) ? 'var(--primary-yellow)' : 'none'} />
                        </button>
                    ))}
                </div>

                <div className="comment-section">
                    <label>Comments (Optional)</label>
                    <textarea
                        placeholder="Tell us about the ride..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    ></textarea>
                </div>

                <button
                    className="submit-rating-btn"
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? 'Submitting...' : 'Submit Rating'}
                </button>
            </div>
        </div>
    );
};

export default DriverRatingModal;

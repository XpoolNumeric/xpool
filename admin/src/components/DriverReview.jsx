import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Check, X, Loader2, FileText, Smartphone, Mail, Calendar, Briefcase, MapPin, ZoomIn } from 'lucide-react';
import Sidebar from './Sidebar';
import './DriverReview.css';

function DriverReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageModal, setImageModal] = useState({ open: false, url: '', label: '' });
    const [confirmModal, setConfirmModal] = useState({ open: false, action: '', status: '' });
    const [actionLoading, setActionLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetchDriverDetails();
    }, [id]);

    const fetchDriverDetails = async () => {
        const { data } = await supabase.from('drivers').select('*').eq('id', id).single();
        setDriver(data);
        setLoading(false);
    };

    const openConfirmModal = (status) => {
        setConfirmModal({
            open: true,
            action: status === 'approved' ? 'approve' : 'reject',
            status: status
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ open: false, action: '', status: '' });
    };

    const updateStatus = async () => {
        setActionLoading(true);
        const { error } = await supabase.from('drivers').update({ status: confirmModal.status }).eq('id', id);

        if (!error) {
            setDriver(prev => ({ ...prev, status: confirmModal.status }));
        }

        setActionLoading(false);
        closeConfirmModal();
    };

    const openImageModal = (url, label) => {
        setImageModal({ open: true, url, label });
    };

    const closeImageModal = () => {
        setImageModal({ open: false, url: '', label: '' });
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <Loader2 className="loading-spinner" size={40} />
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="error-screen">
                <p>Driver not found</p>
                <button onClick={() => navigate('/dashboard')}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <div className="dashboard-content-wrapper">
                <main className="dashboard-main">
                    <div className="page-header-flex">
                        <div className="page-title-section">
                            <button onClick={() => navigate('/dashboard')} className="back-link-btn">
                                <ArrowLeft size={16} />
                                Back to Dashboard
                            </button>
                            <h1 className="page-title">Driver Application</h1>
                            <p className="page-subtitle">Verify documents and details for {driver.full_name}</p>
                        </div>
                    </div>

                    {/* Driver Info Card */}
                    <div className="driver-info-card">
                        <div className="driver-header">
                            {driver.profile_photo_url ? (
                                <img
                                    src={driver.profile_photo_url}
                                    alt="Driver"
                                    className="driver-photo"
                                    onClick={() => openImageModal(driver.profile_photo_url, 'Profile Photo')}
                                />
                            ) : (
                                <div className="driver-photo-placeholder">
                                    <FileText size={24} />
                                </div>
                            )}
                            <div className="driver-title">
                                <h1>{driver.full_name}</h1>
                                <span className={`status-badge ${driver.status}`}>
                                    {driver.status}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {driver.status === 'pending' && (
                            <div className="action-buttons">
                                <button className="action-btn reject" onClick={() => openConfirmModal('rejected')}>
                                    <X size={18} />
                                    Reject
                                </button>
                                <button className="action-btn approve" onClick={() => openConfirmModal('approved')}>
                                    <Check size={18} />
                                    Approve
                                </button>
                            </div>
                        )}

                        {driver.status !== 'pending' && (
                            <div className={`status-banner ${driver.status}`}>
                                {driver.status === 'approved' ? <Check size={18} /> : <X size={18} />}
                                Driver has been {driver.status}
                            </div>
                        )}
                    </div>

                    {/* Content Grid */}
                    <div className="content-grid">
                        {/* Left Column */}
                        <div className="left-column">
                            {/* Personal Details */}
                            <div className="section-card">
                                <h3 className="section-title">Personal Details</h3>
                                <div className="details-list">
                                    <DetailRow icon={<Smartphone size={16} />} label="Phone" value={driver.phone} />
                                    <DetailRow icon={<Mail size={16} />} label="Email" value={driver.email} />
                                    <DetailRow icon={<Calendar size={16} />} label="Date of Birth" value={driver.dob} />
                                    <DetailRow icon={<Briefcase size={16} />} label="Profession" value={driver.profession} />
                                    <DetailRow icon={<MapPin size={16} />} label="Address" value={`${driver.address || ''}, ${driver.city || ''} - ${driver.pincode || ''}`} />
                                </div>
                            </div>

                            {/* Vehicle Info */}
                            <div className="section-card">
                                <h3 className="section-title">Vehicle Information</h3>
                                <div className="vehicle-info-box">
                                    <div className="vehicle-number">{driver.vehicle_number}</div>
                                    <div className="vehicle-type">{driver.vehicle_type}</div>
                                </div>
                            </div>

                            {/* Document Numbers */}
                            <div className="section-card">
                                <h3 className="section-title">Document Details</h3>
                                <div className="details-list">
                                    {driver.dl_number && (
                                        <div className="doc-number-item">
                                            <span className="doc-label">Driving License</span>
                                            <span className="doc-value">{driver.dl_number}</span>
                                        </div>
                                    )}
                                    {driver.aadhaar_pan_number && (
                                        <div className="doc-number-item">
                                            <span className="doc-label">{driver.aadhaar_pan_type === 'pan' ? 'PAN' : 'Aadhaar'}</span>
                                            <span className="doc-value">{driver.aadhaar_pan_number}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Photos */}
                        <div className="right-column">
                            {/* Vehicle Photos */}
                            <div className="section-card">
                                <h3 className="section-title">Vehicle Photos</h3>
                                <div className="photo-grid">
                                    <PhotoCard label="Front View" url={driver.vehicle_front_url} onOpen={openImageModal} />
                                    <PhotoCard label="Back View" url={driver.vehicle_back_url} onOpen={openImageModal} />
                                    <PhotoCard label="Left Side" url={driver.vehicle_left_url} onOpen={openImageModal} />
                                    <PhotoCard label="Right Side" url={driver.vehicle_right_url} onOpen={openImageModal} />
                                </div>
                            </div>

                            {/* Document Scans */}
                            <div className="section-card">
                                <h3 className="section-title">Document Scans</h3>
                                <div className="photo-grid docs">
                                    <PhotoCard label="DL Front" url={driver.dl_front_url} onOpen={openImageModal} />
                                    <PhotoCard label="DL Back" url={driver.dl_back_url} onOpen={openImageModal} />
                                    <PhotoCard label="RC Front" url={driver.rc_front_url} onOpen={openImageModal} />
                                    <PhotoCard label="RC Back" url={driver.rc_back_url} onOpen={openImageModal} />
                                    <PhotoCard label="ID Front" url={driver.aadhaar_pan_front_url} onOpen={openImageModal} />
                                    {driver.aadhaar_pan_back_url && (
                                        <PhotoCard label="ID Back" url={driver.aadhaar_pan_back_url} onOpen={openImageModal} />
                                    )}
                                    <PhotoCard label="Insurance" url={driver.insurance_url} onOpen={openImageModal} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Image Modal */}
                    {imageModal.open && (
                        <div className="modal-overlay" onClick={closeImageModal}>
                            <div className="image-modal" onClick={(e) => e.stopPropagation()}>
                                <button className="modal-close" onClick={closeImageModal}>
                                    <X size={24} />
                                </button>
                                <div className="modal-label">{imageModal.label}</div>
                                <img src={imageModal.url} alt={imageModal.label} className="modal-image" />
                            </div>
                        </div>
                    )}

                    {/* Confirmation Modal */}
                    {confirmModal.open && (
                        <div className="modal-overlay" onClick={closeConfirmModal}>
                            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                                <div className={`confirm-icon ${confirmModal.action}`}>
                                    {confirmModal.action === 'approve' ? <Check size={32} /> : <X size={32} />}
                                </div>
                                <h2>{confirmModal.action === 'approve' ? 'Approve Driver?' : 'Reject Driver?'}</h2>
                                <p>
                                    {confirmModal.action === 'approve'
                                        ? `Are you sure you want to approve ${driver.full_name}? They will be able to start accepting rides.`
                                        : `Are you sure you want to reject ${driver.full_name}? They will need to resubmit their documents.`
                                    }
                                </p>
                                <div className="confirm-actions">
                                    <button className="confirm-btn cancel" onClick={closeConfirmModal} disabled={actionLoading}>
                                        Cancel
                                    </button>
                                    <button
                                        className={`confirm-btn ${confirmModal.action}`}
                                        onClick={updateStatus}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading && <Loader2 size={16} className="spinner" />}
                                        {confirmModal.action === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

// Helper Components
const DetailRow = ({ icon, label, value }) => (
    <div className="detail-row">
        <div className="detail-icon">{icon}</div>
        <div className="detail-content">
            <span className="detail-label">{label}</span>
            <span className="detail-value">{value || '-'}</span>
        </div>
    </div>
);

const PhotoCard = ({ label, url, onOpen }) => (
    <div className="photo-card" onClick={() => url && onOpen(url, label)}>
        <div className="photo-label">{label}</div>
        {url ? (
            <>
                <img src={url} alt={label} className="photo-image" />
                <div className="photo-zoom">
                    <ZoomIn size={16} />
                </div>
            </>
        ) : (
            <div className="photo-placeholder">
                <FileText size={20} />
                <span>No Image</span>
            </div>
        )}
    </div>
);

export default DriverReview;

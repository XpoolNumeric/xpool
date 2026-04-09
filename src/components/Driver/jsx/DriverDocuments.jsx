import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../supabaseClient';
import { Loader2 } from 'lucide-react';
// import '../css/DriverDocuments.css'; // Removed in favor of Tailwind

// --- Icons (unchanged) ---
const BackIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor" />
    </svg>
);
// ... existing icons (LockIcon, ArrowRightIcon, CheckIcon, UploadIcon) ...
const LockIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15.1 8H8.9V6C8.9 4.29 10.29 2.9 12 2.9C13.71 2.9 15.1 4.29 15.1 6V8Z" fill="#999" />
    </svg>
);
const ArrowRightIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z" fill="currentColor" />
    </svg>
);
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="white" />
    </svg>
);
const UploadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 16H15V8H19L12 1L5 8H9V16ZM5 18H19V20H5V18Z" fill="currentColor" />
    </svg>
);

// --- Helpers ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const uploadFileToSupabase = async (file, path) => {
    if (!file) return null;
    console.log(`[Upload] Starting upload for ${path}, Size: ${file.size}`);

    if (file.size > MAX_FILE_SIZE) {
        toast.error(`File size too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Limit: 5MB`);
        throw new Error("File too large");
    }

    try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        // 2. Upload with Timeout
        console.log(`[Upload] Uploading to ${filePath}...`);

        // Create a timeout promise (60 seconds for slower mobile connections)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Upload timed out after 60s')), 60000)
        );

        // Convert File to ArrayBuffer to bypass WebView file object issues
        console.log(`[Upload] Reading file as ArrayBuffer...`);
        const fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => reject(new Error(`File read error: ${e.target?.error?.message}`));
            reader.readAsArrayBuffer(file);
        });
        console.log(`[Upload] File read complete. Bytes: ${fileData.byteLength}`);

        const uploadPromise = supabase.storage
            .from('driver-docs')
            .upload(filePath, fileData, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });

        const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

        if (uploadError) {
            console.error('[Upload] Failure:', uploadError);
            console.error('[Upload] Error details:', {
                message: uploadError.message,
                statusCode: uploadError.statusCode,
                error: uploadError.error,
                hint: uploadError.hint
            });

            if (uploadError.message.includes('Upload timed out')) {
                toast.error("Upload timed out. Connection is slow. Try again.");
            } else if (uploadError.message.includes("row-level security") || uploadError.message.includes("new row violates")) {
                toast.error("Permission denied. check bucket policies.");
            } else if (uploadError.message.includes("Bucket not found") || uploadError.statusCode === 404) {
                toast.error("Storage bucket 'driver-docs' not found.");
            } else if (uploadError.message.includes("JWT") || uploadError.message.includes("JWTExpired")) {
                toast.error("Session expired. Please log out and log in again.");
            } else {
                toast.error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
            }
            throw uploadError;
        }

        console.log('[Upload] Success! Fetching Public URL...');

        const { data } = supabase.storage
            .from('driver-docs')
            .getPublicUrl(filePath);

        console.log('[Upload] URL retrieved:', data?.publicUrl);
        return data.publicUrl;

    } catch (err) {
        console.error("[Upload] Wrapper Exception:", err);
        throw err;
    }
};

// --- Sub-Forms with State Lifting ---

const DrivingLicenseForm = ({ onSubmit, initialData = {} }) => {
    const [dlNumber, setDlNumber] = useState(initialData.dl_number || '');
    const [frontFile, setFrontFile] = useState(null);
    const [backFile, setBackFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        console.log('[DriverDocs] Submit clicked. Checking fields...');
        if (!dlNumber || !frontFile || !backFile) {
            console.warn('[DriverDocs] Missing fields:', { dlNumber, hasFront: !!frontFile, hasBack: !!backFile });
            toast.error("Please fill DL number and upload both photos");
            return;
        }

        console.log('[DriverDocs] Fields OK. Setting loading=true');
        setLoading(true);
        try {
            console.log('[DriverDocs] Calling uploadFileToSupabase for Front...');
            const frontUrl = await uploadFileToSupabase(frontFile, 'dl_front');

            console.log('[DriverDocs] Calling uploadFileToSupabase for Back...');
            const backUrl = await uploadFileToSupabase(backFile, 'dl_back');

            onSubmit({ dl_number: dlNumber, dl_front_url: frontUrl, dl_back_url: backUrl });
        } catch (error) {
            console.error('[DriverDocs] Submit Error:', error);
            // Toast handled in upload helper
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn p-2">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">License Verification</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-600">FRONT SIDE</span>
                    <button
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all duration-300 group
                        ${frontFile ? 'border-brand-yellow bg-yellow-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}
                        onClick={() => document.getElementById('dl-front').click()}
                    >
                        <div className={`p-2 rounded-full mb-2 ${frontFile ? 'bg-brand-yellow text-black' : 'bg-gray-100 text-gray-400 group-hover:scale-110 transition-transform'}`}>
                            {frontFile ? <CheckIcon /> : <UploadIcon />}
                        </div>
                        <span className="text-[10px] font-medium text-gray-500">{frontFile ? "Photo Selected" : "Tap to Upload"}</span>
                    </button>
                    <input id="dl-front" type="file" hidden accept="image/*" onChange={(e) => {
                        console.log('[DriverDocs] Front file selected:', e.target.files[0]?.name, e.target.files[0]?.size);
                        setFrontFile(e.target.files[0]);
                    }} />
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-600">BACK SIDE</span>
                    <button
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all duration-300 group
                        ${backFile ? 'border-brand-yellow bg-yellow-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'}`}
                        onClick={() => document.getElementById('dl-back').click()}
                    >
                        <div className={`p-2 rounded-full mb-2 ${backFile ? 'bg-brand-yellow text-black' : 'bg-gray-100 text-gray-400 group-hover:scale-110 transition-transform'}`}>
                            {backFile ? <CheckIcon /> : <UploadIcon />}
                        </div>
                        <span className="text-[10px] font-medium text-gray-500">{backFile ? "Photo Selected" : "Tap to Upload"}</span>
                    </button>
                    <input id="dl-back" type="file" hidden accept="image/*" onChange={(e) => {
                        console.log('[DriverDocs] Back file selected:', e.target.files[0]?.name, e.target.files[0]?.size);
                        setBackFile(e.target.files[0]);
                    }} />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase">Driving License Number</label>
                <input
                    type="text"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-yellow focus:border-transparent outline-none transition-all bg-gray-50 font-medium text-lg placeholder:text-gray-300"
                    placeholder="e.g. MH 02 2018 1234567"
                    value={dlNumber} onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                />
            </div>
            <button
                className="w-full bg-brand-yellow text-black py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all active:scale-[0.98] disabled:opacity-70 disabled:scale-100 flex justify-center items-center gap-3 shadow-lg hover:shadow-xl"
                disabled={loading} onClick={handleSubmit}
            >
                {loading ? (
                    <>
                        <Loader2 className="animate-spin" size={20} />
                        Uploading...
                    </>
                ) : 'Submit License Details'}
            </button>
        </div>
    );
};

const InputField = ({ label, name, type = "text", placeholder, value, onChange }) => (
    <div className="space-y-1">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        <input
            name={name} type={type} placeholder={placeholder} value={value} onChange={onChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-yellow focus:border-transparent outline-none bg-white font-medium transition-all"
        />
    </div>
);

const NameDetailsForm = ({ onSubmit, initialData = {} }) => {
    const [formData, setFormData] = useState({
        full_name: initialData.full_name || '',
        dob: initialData.dob || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        profession: initialData.profession || '',
        address: initialData.address || '',
        city: initialData.city || '',
        pincode: initialData.pincode || ''
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async () => {
        // Basic validation
        if (Object.values(formData).some(x => !x) || !photoFile) {
            toast.error("All fields and photo are required");
            return;
        }
        setLoading(true);
        try {
            const photoUrl = await uploadFileToSupabase(photoFile, 'profile_photos');
            onSubmit({ ...formData, profile_photo_url: photoUrl });
        } catch (e) { } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-center mb-8">
                <div className="relative group">
                    <button
                        className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden relative group-hover:scale-105 transition-transform"
                        onClick={() => document.getElementById('profile-pic').click()}
                    >
                        {photoFile ? (
                            <img src={URL.createObjectURL(photoFile)} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                                <UploadIcon />
                                <span className="text-[10px] mt-1 font-bold">ADD PHOTO</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                    </button>
                    <div className="absolute bottom-0 right-0 bg-brand-yellow p-2 rounded-full border-2 border-white shadow-md text-black pointer-events-none">
                        <UploadIcon />
                    </div>
                    <input id="profile-pic" type="file" hidden accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
                </div>
            </div>

            <div className="space-y-4">
                <InputField label="Full Name" name="full_name" placeholder="John Doe" value={formData.full_name} onChange={handleChange} />
                <div className="grid grid-cols-2 gap-4">
                    <InputField label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} />
                    <InputField label="Phone" name="phone" type="tel" placeholder="+91 99999..." value={formData.phone} onChange={handleChange} />
                </div>
                <InputField label="Email" name="email" type="email" placeholder="john@example.com" value={formData.email} onChange={handleChange} />
                <InputField label="Profession" name="profession" placeholder="e.g. Software Engineer" value={formData.profession} onChange={handleChange} />

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Address</label>
                    <textarea
                        name="address" rows="2" placeholder="Your permanent address" value={formData.address} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-yellow focus:border-transparent outline-none bg-white font-medium resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <InputField label="City" name="city" placeholder="Mumbai" value={formData.city} onChange={handleChange} />
                    <InputField label="Pincode" name="pincode" placeholder="400001" value={formData.pincode} onChange={handleChange} />
                </div>
            </div>

            <button className="w-full bg-brand-yellow text-black py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-all active:scale-[0.98] shadow-lg mt-4" disabled={loading} onClick={handleSubmit}>
                {loading ? <Loader2 className="animate-spin inline mr-2" /> : ''}
                {loading ? 'Saving...' : 'Save Personal Details'}
            </button>
        </div>
    );
};

const RCBookForm = ({ onSubmit }) => {
    const [vehicleNo, setVehicleNo] = useState('');
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!vehicleNo || !front || !back) { toast.error("Vehicle number and both RC sides required"); return; }
        setLoading(true);
        try {
            const fUrl = await uploadFileToSupabase(front, 'rc_front');
            const bUrl = await uploadFileToSupabase(back, 'rc_back');
            onSubmit({ vehicle_number: vehicleNo, rc_front_url: fUrl, rc_back_url: bUrl });
        } catch (e) { } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase">Vehicle Number</label>
                <input
                    type="text"
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-yellow focus:border-transparent outline-none transition-all bg-gray-50 font-black text-xl tracking-wider uppercase text-center placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal"
                    placeholder="TN 01 AB 1234"
                    value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                    <span className="block text-sm font-medium mb-2">RC Front *</span>
                    <button className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => document.getElementById('rc-front').click()}><div className="text-gray-400 mb-2"><UploadIcon /></div> <span className="text-xs text-gray-500">{front ? 'Selected' : 'Upload'}</span></button>
                    <input id="rc-front" type="file" hidden accept="image/*" onChange={e => setFront(e.target.files[0])} />
                </div>
                <div className="flex flex-col items-center">
                    <span className="block text-sm font-medium mb-2">RC Back *</span>
                    <button className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-gray-50/50" onClick={() => document.getElementById('rc-back').click()}><div className="text-gray-400 mb-2"><UploadIcon /></div> <span className="text-xs text-gray-500">{back ? 'Selected' : 'Upload'}</span></button>
                    <input id="rc-back" type="file" hidden accept="image/*" onChange={e => setBack(e.target.files[0])} />
                </div>
            </div>
            <button className="w-full bg-brand-yellow text-black py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-transform active:scale-95 disabled:opacity-70 shadow-lg" disabled={loading} onClick={handleSubmit}>{loading ? 'Uploading...' : 'Submit RC Book'}</button>
        </div>
    );
};

const AadhaarPanForm = ({ onSubmit }) => {
    const [mode, setMode] = useState('aadhaar');
    const [number, setNumber] = useState('');
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!number || !front || (mode === 'aadhaar' && !back)) {
            toast.error("Please complete all ID fields");
            return;
        }
        setLoading(true);
        try {
            const fUrl = await uploadFileToSupabase(front, `${mode}_front`);
            let bUrl = null;
            if (back) bUrl = await uploadFileToSupabase(back, `${mode}_back`);

            onSubmit({
                aadhaar_pan_type: mode,
                aadhaar_pan_number: number,
                aadhaar_pan_front_url: fUrl,
                aadhaar_pan_back_url: bUrl
            });
        } catch (e) { } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                <button className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'aadhaar' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setMode('aadhaar')}>Aadhaar</button>
                <button className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'pan' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setMode('pan')}>PAN</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                    <span className="block text-sm font-medium mb-2">Front side *</span>
                    <button className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => document.getElementById('id-front').click()}><div className="text-gray-400 mb-2"><UploadIcon /></div> <span className="text-xs text-gray-500">{front ? 'Selected' : 'Upload'}</span></button>
                    <input id="id-front" type="file" hidden accept="image/*" onChange={e => setFront(e.target.files[0])} />
                </div>
                {mode === 'aadhaar' && <div className="flex flex-col items-center">
                    <span className="block text-sm font-medium mb-2">Back side *</span>
                    <button className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-gray-50/50" onClick={() => document.getElementById('id-back').click()}><div className="text-gray-400 mb-2"><UploadIcon /></div> <span className="text-xs text-gray-500">{back ? 'Selected' : 'Upload'}</span></button>
                    <input id="id-back" type="file" hidden accept="image/*" onChange={e => setBack(e.target.files[0])} />
                </div>}
            </div>
            <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter {mode === 'aadhaar' ? 'Aadhaar' : 'PAN'} number *</label>
                <input type="text" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-gray-50" value={number} onChange={e => setNumber(e.target.value)} />
            </div>
            <button className="w-full bg-brand-yellow text-black py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-transform active:scale-95 disabled:opacity-70 shadow-lg" disabled={loading} onClick={handleSubmit}>{loading ? 'Uploading...' : 'Submit ID'}</button>
        </div>
    );
};

const InsuranceForm = ({ onSubmit }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!file) { toast.error("File required"); return; }
        setLoading(true);
        try {
            const url = await uploadFileToSupabase(file, 'insurance');
            onSubmit({ insurance_url: url });
        } catch (e) { } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col items-center">
                <span className="block text-sm font-medium mb-2">Upload Insurance Document *</span>
                <button className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition-colors" onClick={() => document.getElementById('ins-doc').click()}><div className="text-gray-400 mb-2"><UploadIcon /></div> <span className="text-xs text-gray-500">{file ? 'Selected' : 'Upload Document'}</span></button>
                <input id="ins-doc" type="file" hidden accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button className="w-full bg-brand-yellow text-black py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-transform active:scale-95 disabled:opacity-70 shadow-lg" disabled={loading} onClick={handleSubmit}>{loading ? 'Uploading...' : 'Submit Insurance'}</button>
        </div>
    );
};

// --- Main Component ---

const DriverDocuments = ({ selectedVehicle = 'Car', onBack, onComplete, onLogout }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([]);
    const [allData, setAllData] = useState({ vehicle_type: selectedVehicle });

    const steps = [
        { id: 'dl', label: 'Driving License', Component: DrivingLicenseForm },
        { id: 'details', label: 'Name and Details', Component: NameDetailsForm },
        { id: 'rc_book', label: 'RC Book Details', Component: RCBookForm },
        { id: 'id_proof', label: 'Aadhaar or PAN Card', Component: AadhaarPanForm },
        { id: 'insurance', label: 'Vehicle Insurance', Component: InsuranceForm },
    ];

    const handleStepSubmit = async (stepIndex, stepData) => {
        const updatedData = { ...allData, ...stepData };
        setAllData(updatedData);

        const newCompleted = [...completedSteps, stepIndex];
        setCompletedSteps(newCompleted);

        const nextStep = stepIndex + 1;
        if (nextStep < steps.length) {
            setCurrentStep(nextStep);
            toast.success("Section Saved!");
        } else {
            // Final Submission to Database
            const loadingToast = toast.loading("Finalizing submission...");
            try {
                // Get current user ID to link the record
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not found");

                const finalData = { ...updatedData, user_id: user.id };

                // Check if a driver record already exists for this user
                const { data: existingDriver, error: fetchError } = await supabase
                    .from('drivers')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                let error;
                if (existingDriver) {
                    // Update existing record
                    const { error: updateError } = await supabase
                        .from('drivers')
                        .update({ ...updatedData, status: 'pending' }) // Reset to pending on re-submission? Or keep as is? Let's assume pending for now.
                        .eq('id', existingDriver.id);
                    error = updateError;
                } else {
                    // Insert new record
                    const finalData = { ...updatedData, user_id: user.id, status: 'pending' };
                    const { error: insertError } = await supabase
                        .from('drivers')
                        .insert([finalData]);
                    error = insertError;
                }

                if (error) throw error;

                toast.success("All details submitted successfully!", { id: loadingToast });
                onComplete();
            } catch (err) {
                console.error("DB Insert/Update Error:", err);
                // Check if it's an RLS error on the Table itself
                if (err.message && err.message.includes("row-level security")) {
                    toast.error("Failed to save: Permission denied. Try re-logging in.", { id: loadingToast });
                } else {
                    toast.error(`Failed to save details: ${err.message || "Unknown error"}`, { id: loadingToast });
                }
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        } else {
            onBack();
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 animate-page-in">
            <div className="flex items-center p-4 bg-white shadow-sm sticky top-0 z-10">
                <button className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors" onClick={handleBack}>
                    <BackIcon />
                </button>
                <h1 className="flex-1 text-xl font-bold text-center mr-8">Document verification</h1>
                {onLogout && (
                    <button
                        className="text-red-500 font-medium text-sm ml-2"
                        onClick={onLogout}
                    >
                        Logout
                    </button>
                )}
            </div>
            <p className="text-center text-gray-500 text-xs py-2 bg-gray-100">
                Max upload size: 100KB per file
            </p>

            <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full pb-20">
                <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                            <CheckIcon />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Vehicle - {selectedVehicle === 'car' ? 'Car' : 'Bike'}</h3>
                            <p className="text-xs text-gray-500 font-medium">Selected</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {steps.map((step, index) => {
                        const isLocked = index > currentStep && !completedSteps.includes(index);
                        const isCompleted = completedSteps.includes(index);
                        const isActive = index === currentStep;

                        return (
                            <div key={step.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${isActive ? 'ring-2 ring-yellow-400 ring-offset-1' : ''} ${isLocked ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                <div
                                    className={`flex items-center justify-between p-4 cursor-pointer ${isActive ? 'bg-yellow-50/50' : ''}`}
                                    onClick={() => !isLocked && setCurrentStep(index)}
                                >
                                    <span className={`font-semibold ${isActive ? 'text-black' : 'text-gray-600'}`}>{step.label}</span>
                                    <div className="flex items-center justify-center w-6 h-6">
                                        {isLocked ? <LockIcon /> :
                                            isCompleted ? <div className="text-green-500 font-bold bg-green-100 rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div> :
                                                isActive ? <ArrowRightIcon /> : null}
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="p-4 border-t border-gray-100 bg-white animate-slideDown">
                                        <step.Component
                                            label={step.label}
                                            initialData={allData} // Passing partial data back if needed
                                            onSubmit={(data) => handleStepSubmit(index, data)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DriverDocuments;


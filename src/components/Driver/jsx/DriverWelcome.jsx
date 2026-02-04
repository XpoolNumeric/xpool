import React, { useEffect, useState } from 'react';
import { ArrowRight, User } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const DriverWelcome = ({ onContinue }) => {
    const [visible, setVisible] = useState(false);
    const [photoUrl, setPhotoUrl] = useState(null);
    const [userName, setUserName] = useState('');

    const fetchDriverProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('drivers')
                    .select('profile_photo_url, full_name')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data && !error) {
                    setPhotoUrl(data.profile_photo_url);
                    setUserName(data.full_name?.split(' ')[0] || 'Buddy');
                }
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        }
    };

    useEffect(() => {
        setVisible(true);
        fetchDriverProfile();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black p-6 font-sans text-center relative overflow-hidden">

            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-yellow/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-brand-yellow/10 rounded-full blur-3xl"></div>
            </div>

            {/* Content */}
            <div className={`relative z-10 transition-all duration-1000 transform ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

                {/* Profile Image Circle */}
                <div className="w-40 h-40 mx-auto mb-8 rounded-full p-1 bg-brand-yellow shadow-[0_0_30px_rgba(244,196,48,0.4)] animate-pulse-slow">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center border-4 border-white">
                        {photoUrl ? (
                            <img
                                src={photoUrl}
                                alt="Driver Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={64} className="text-gray-300" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter text-black">
                    WELCOME <br /> <span className="text-brand-yellow">{userName.toUpperCase()}!</span>
                </h1>

                <p className="text-gray-500 text-lg font-medium max-w-xs mx-auto leading-relaxed mb-12">
                    You're all set to start your journey. Get ready for an amazing adventure!
                </p>

                {/* Dashboard Button */}
                <button
                    onClick={onContinue}
                    className="group bg-brand-yellow text-black px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 mx-auto hover:bg-yellow-400 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                >
                    Go to Dashboard
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default DriverWelcome;



import React, { useState } from 'react';
import { Car, Bike, ChevronLeft, Check } from 'lucide-react';

const PoolingSelection = ({ onConfirm, onBack }) => {
    const [selectedOption, setSelectedOption] = useState(null);

    return (
        <div className="flex flex-col min-h-screen bg-white animate-page-in">
            {/* Header */}
            <div className="relative flex items-center justify-center p-6 pt-8 mb-4">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute left-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <ChevronLeft size={28} className="text-black" />
                    </button>
                )}
                <h1 className="text-2xl font-black tracking-widest text-black">XPOOL</h1>
            </div>

            <div className="flex-1 px-6 flex flex-col max-w-md mx-auto w-full">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose your ride</h2>
                <p className="text-gray-500 mb-8 font-medium">Select the vehicle type you will be using for pooling.</p>

                <div className="space-y-4 flex-1">
                    {/* Car Option */}
                    <div
                        onClick={() => setSelectedOption('car')}
                        className={`relative group flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${selectedOption === 'car'
                            ? 'border-brand-yellow bg-yellow-50/30'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mr-5 transition-colors duration-300 ${selectedOption === 'car' ? 'bg-brand-yellow text-black' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                            }`}>
                            <Car size={32} />
                        </div>
                        <div className="flex-1">
                            <span className={`block text-lg font-bold ${selectedOption === 'car' ? 'text-black' : 'text-gray-700'}`}>
                                Car Pooling
                            </span>
                            <span className="text-sm text-gray-500 font-medium">For verified car owners</span>
                        </div>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedOption === 'car' ? 'border-brand-yellow bg-brand-yellow' : 'border-gray-300'
                            }`}>
                            {selectedOption === 'car' && <Check size={14} className="text-black stroke-[3]" />}
                        </div>
                    </div>

                    {/* Bike Option */}
                    <div
                        onClick={() => setSelectedOption('bike')}
                        className={`relative group flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${selectedOption === 'bike'
                            ? 'border-brand-yellow bg-yellow-50/30'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mr-5 transition-colors duration-300 ${selectedOption === 'bike' ? 'bg-brand-yellow text-black' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                            }`}>
                            <Bike size={32} />
                        </div>
                        <div className="flex-1">
                            <span className={`block text-lg font-bold ${selectedOption === 'bike' ? 'text-black' : 'text-gray-700'}`}>
                                Bike Pooling
                            </span>
                            <span className="text-sm text-gray-500 font-medium">For two-wheeler riders</span>
                        </div>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedOption === 'bike' ? 'border-brand-yellow bg-brand-yellow' : 'border-gray-300'
                            }`}>
                            {selectedOption === 'bike' && <Check size={14} className="text-black stroke-[3]" />}
                        </div>
                    </div>
                </div>

                <div className="py-8">
                    <button
                        disabled={!selectedOption}
                        onClick={() => onConfirm(selectedOption)}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 transform ${selectedOption
                            ? 'bg-brand-yellow text-black shadow-xl hover:shadow-2xl active:scale-[0.98] translate-y-0 hover:bg-yellow-400'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        Confirm Selection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PoolingSelection;


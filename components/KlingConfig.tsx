
import React, { useState, useEffect } from 'react';
import { SettingsIcon, CloseIcon } from './icons';

interface KlingConfigProps {
    onKeysChange: (keys: { apiKey: string, secretKey: string }) => void;
}

export const KlingConfig: React.FC<KlingConfigProps> = ({ onKeysChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');

    useEffect(() => {
        const savedApiKey = localStorage.getItem('KLING_API_KEY') || '';
        const savedSecretKey = localStorage.getItem('KLING_SECRET_KEY') || '';
        setApiKey(savedApiKey);
        setSecretKey(savedSecretKey);
        onKeysChange({ apiKey: savedApiKey, secretKey: savedSecretKey });
    }, []);

    const handleSave = () => {
        localStorage.setItem('KLING_API_KEY', apiKey);
        localStorage.setItem('KLING_SECRET_KEY', secretKey);
        onKeysChange({ apiKey, secretKey });
        setIsOpen(false);
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestError('');
        try {
            // We'll try a dummy text-to-video request with a very short prompt
            // or just check if the token generation works on the server.
            // Actually, let's just try to hit the status endpoint with a fake ID
            // to see if the authentication (JWT) is accepted.
            const queryParams = new URLSearchParams({ apiKey, secretKey });
            const response = await fetch(`/api/video/kling/status/test-id?${queryParams.toString()}`);
            const data = await response.json();
            
            // If we get "task not found" (404), it means authentication was successful!
            // If we get 401 or 403, authentication failed.
            if (response.status === 404 || response.ok) {
                setTestStatus('success');
            } else {
                setTestStatus('error');
                setTestError(data.message || 'Authentication failed');
            }
        } catch (err) {
            setTestStatus('error');
            setTestError('Connection failed');
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xs font-semibold text-brand-light hover:text-white transition-colors bg-brand-primary/50 px-3 py-1.5 rounded-lg border border-gray-700"
            >
                <SettingsIcon className="w-4 h-4" />
                Configure Kling Keys
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 right-0 w-80 bg-brand-secondary border border-gray-700 rounded-xl shadow-2xl p-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-brand-accent">Kling API Configuration</h4>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">API Key</label>
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter Kling API Key"
                                className="w-full p-2 bg-brand-primary border border-gray-600 rounded-lg text-xs focus:ring-1 focus:ring-brand-accent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Secret Key</label>
                            <input 
                                type="password" 
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                placeholder="Enter Kling Secret Key"
                                className="w-full p-2 bg-brand-primary border border-gray-600 rounded-lg text-xs focus:ring-1 focus:ring-brand-accent outline-none"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={handleTestConnection}
                                disabled={testStatus === 'testing' || !apiKey || !secretKey}
                                className={`flex-1 font-bold py-2 rounded-lg text-xs transition-colors ${
                                    testStatus === 'success' ? 'bg-green-600 text-white' : 
                                    testStatus === 'error' ? 'bg-red-600 text-white' : 
                                    'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {testStatus === 'testing' ? 'Testing...' : 
                                 testStatus === 'success' ? 'Connection OK' : 
                                 testStatus === 'error' ? 'Failed' : 'Test Connection'}
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 bg-brand-accent text-brand-primary font-bold py-2 rounded-lg text-xs hover:bg-indigo-400 transition-colors"
                            >
                                Save & Close
                            </button>
                        </div>
                        
                        {testStatus === 'error' && (
                            <p className="text-[10px] text-red-400 mt-1">{testError}</p>
                        )}
                        
                        <p className="text-[10px] text-gray-500 leading-tight">
                            Keys are stored locally in your browser and used only for proxying requests to Kling AI.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
